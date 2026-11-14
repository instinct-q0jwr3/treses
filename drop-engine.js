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
function drop(input,col,rng=Math.random){
  if(!valid(input)||!Number.isInteger(col)||col<0||col>=WIDTH||input.cols[col].length>=HEIGHT)return null;
  const s=copy(input), frames=[];let row=s.cols[col].length,chain=0,gain=0;
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
    chain++;gain+=result;s.score+=result;s.peak=Math.max(s.peak,result);
    frames.push({cols:copy(s.cols),col,row,type:'merge',value:result,chain,gain:result});
  }
  s.peak=Math.max(s.peak,largest(s));
  const min=floor(s);let removed=0;
  for(let c=0;c<WIDTH;c++){const before=s.cols[c].length;s.cols[c]=s.cols[c].filter(v=>v>=min);removed+=before-s.cols[c].length;}
  if(removed)frames.push({cols:copy(s.cols),type:'clear',minimum:min});
  s.moves++;s.current=Math.max(min,s.next);s.next=draw(s,rng);
  return {state:s,frames,chain,gain,removed,over:over(s)};
}
const api={WIDTH,HEIGHT,copy,largest,floor,draw,create,valid,over,drop};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropEngine=api;
})(typeof window!=='undefined'?window:globalThis);
