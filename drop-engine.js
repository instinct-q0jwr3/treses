/* Original number-drop engine. Columns are stored bottom first. No DOM or storage. */
(function(root){
'use strict';
const WIDTH=5, HEIGHT=6;
const copy=s=>JSON.parse(JSON.stringify(s));
const largest=s=>Math.max(2,...s.cols.flat());
const floor=s=>2**Math.max(1,Math.floor(Math.log2(s.peak||largest(s)))-8);
function draw(s,rng=Math.random){
  const min=Math.log2(floor(s));
  const max=Math.max(min+2,Math.min(min+5,Math.floor(Math.log2(s.peak||2))-2));
  return 2**(min+Math.min(max-min,Math.floor(rng()*(max-min+1))));
}
function create(rng=Math.random){
  const s={version:1,cols:Array.from({length:WIDTH},()=>[]),score:0,peak:2,moves:0,current:2,next:2};
  s.current=draw(s,rng); s.next=draw(s,rng);return s;
}
function valid(s){
  return !!s && s.version===1 && Array.isArray(s.cols)&&s.cols.length===WIDTH&&s.cols.every(c=>Array.isArray(c)&&c.length<=HEIGHT&&c.every(power))&&[s.current,s.next,s.peak].every(power)&&Number.isFinite(s.score)&&s.score>=0&&Number.isInteger(s.moves)&&s.moves>=0;
}
function power(n){return Number.isFinite(n)&&n>=2&&Number.isInteger(Math.log2(n));}
function over(s){return s.cols.every(c=>c.length>=HEIGHT);}
/* Merge the first group of equal orthogonally touching blocks into its lowest
   (then leftmost) cell. Returns the merged value, or 0 when none remain.
   The active-tile loop never sees these: a block absorbed in another column
   lets the blocks above it fall, and they can land on or next to equals. */
function settleOnce(s,frames,acc){
  const seen=Array.from({length:WIDTH},()=>new Array(HEIGHT).fill(false));
  for(let c=0;c<WIDTH;c++)for(let r=0;r<s.cols[c].length;r++){
    if(seen[c][r])continue;
    const v=s.cols[c][r],stack=[[c,r]],comp=[];
    seen[c][r]=true;
    while(stack.length){
      const [cc,rr]=stack.pop();comp.push([cc,rr]);
      for(const [nc,nr] of [[cc,rr-1],[cc,rr+1],[cc-1,rr],[cc+1,rr]]){
        if(nc<0||nc>=WIDTH||nr<0||nr>=s.cols[nc].length||seen[nc][nr]||s.cols[nc][nr]!==v)continue;
        seen[nc][nr]=true;stack.push([nc,nr]);
      }
    }
    if(comp.length<2)continue;
    comp.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const [tc,tr]=comp[0];
    for(const [c2,r2] of comp.slice(1).sort((a,b)=>b[1]-a[1]))s.cols[c2].splice(r2,1);
    const result=v*2**(comp.length-1);
    s.cols[tc][tr]=result;
    s.score+=result;s.peak=Math.max(s.peak,result);
    acc.chain++;acc.gain+=result;
    if(frames)frames.push({cols:copy(s.cols),col:tc,row:tr,type:'merge',value:result,chain:acc.chain,gain:result});
    return result;
  }
  return 0;
}
/* Retire small blocks and merge strays until the board is stable: a clear can
   drop equal blocks together, and a merge can raise the retirement floor. */
function resolve(s,frames,acc){
  let removed=0;
  for(let guard=0;guard<WIDTH*HEIGHT*4;guard++){
    const min=floor(s);let rm=0;
    for(let c=0;c<WIDTH;c++){const before=s.cols[c].length;s.cols[c]=s.cols[c].filter(v=>v>=min);rm+=before-s.cols[c].length;}
    if(rm){removed+=rm;if(frames)frames.push({cols:copy(s.cols),type:'clear',minimum:min});continue;}
    if(settleOnce(s,frames,acc))continue;
    break;
  }
  return removed;
}
function drop(input,col,rng=Math.random){
  if(!valid(input)||!Number.isInteger(col)||col<0||col>=WIDTH||input.cols[col].length>=HEIGHT)return null;
  const s=copy(input), frames=[];let row=s.cols[col].length;const acc={chain:0,gain:0};
  s.cols[col].push(s.current);
  frames.push({cols:copy(s.cols),col,row,type:'drop',value:s.current});
  for(let guard=0;guard<WIDTH*HEIGHT;guard++){
    const v=s.cols[col][row];
    const same=[[col,row-1],[col-1,row],[col+1,row],[col,row+1]].filter(([c,r])=>c>=0&&c<WIDTH&&r>=0&&s.cols[c][r]===v);
    if(!same.length)break;
    // All equal direct neighbours are absorbed at once; each one doubles the tile.
    const result=v*2**same.length;
    s.cols[col][row]=result;
    for(const [c,r] of same.sort((a,b)=>b[1]-a[1])){s.cols[c].splice(r,1);if(c===col&&r<row)row--;}
    acc.chain++;acc.gain+=result;s.score+=result;s.peak=Math.max(s.peak,result);
    frames.push({cols:copy(s.cols),col,row,type:'merge',value:result,chain:acc.chain,gain:result});
  }
  s.peak=Math.max(s.peak,largest(s));
  const removed=resolve(s,frames,acc);
  s.moves++;s.current=Math.max(floor(s),s.next);s.next=draw(s,rng);
  return {state:s,frames,chain:acc.chain,gain:acc.gain,removed,over:over(s)};
}
/* Repair a loaded board without animation frames: apply pending retirements
   and merge any equal touching blocks left over from earlier versions. */
function repair(input){
  if(!valid(input))return input;
  const s=copy(input);
  s.peak=Math.max(s.peak,largest(s));
  resolve(s,null,{chain:0,gain:0});
  return s;
}
const api={WIDTH,HEIGHT,copy,largest,floor,draw,create,valid,over,drop,repair};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropEngine=api;
})(typeof window!=='undefined'?window:globalThis);
