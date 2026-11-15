(()=>{
'use strict';
const E=DropEngine, KEY='caida-numeros-save-v1', BEST='caida-numeros-best-v1';
const $=id=>document.getElementById(id);
let state=E.create(),previous=null,best=0,busy=false;
const colors=['#d884ac','#86af68','#59b8b0','#5e9cca','#9683c5','#d58866','#b4a08a','#e7ac48','#d76e86','#b28b4c','#6d9ea7','#8b94bb'];
const fmtExact=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);
// Past 2^53 the units are not exact any more: show a compact approximation instead of fake digits.
const fmt=n=>n<1e15?fmtExact(n):'≈ '+E.label(n,0);
function label(n){return E.label(n);}
function paint(el,n){el.textContent=label(n);el.style.background=colors[(Math.log2(n)-1)%colors.length];el.style.color='#fff';el.title=fmt(n);el.classList.toggle('long',label(n).length>4&&(el.classList.contains('mini')));}
let lastGood=null;
// Never overwrite a good save with a state that would not survive a round trip (null/Infinity).
function sound(x){try{const r=JSON.parse(JSON.stringify(x));return JSON.stringify(r)===JSON.stringify(x);}catch{return false;}}
function save(){try{const data={state,previous:E.valid(previous)?previous:null};if(E.valid(state)&&sound(data)&&E.valid(JSON.parse(JSON.stringify(state)))){localStorage.setItem(KEY,JSON.stringify(data));lastGood=data;}if(Number.isFinite(best)&&best>=0)localStorage.setItem(BEST,String(best));}catch{$('storageWarning').hidden=false;}}
try{const data=JSON.parse(localStorage.getItem(KEY));let healed=false;if(E.valid(data?.state)){state=E.repair(data.state);healed=JSON.stringify(state)!==JSON.stringify(data.state);previous=E.valid(data.previous)?data.previous:null;}best=Number(localStorage.getItem(BEST))||0;if(!Number.isFinite(best)||best<0)best=0;best=Math.max(best,Number.isFinite(state.score)?state.score:0);if(healed)save();}catch{ $('storageWarning').hidden=false; }
for(let i=0;i<30;i++){const cell=document.createElement('div');cell.className='well';$('grid').append(cell);}
for(let c=0;c<5;c++){const b=document.createElement('button');b.className='column';b.innerHTML='<span class="arrow" aria-hidden="true">↓</span>';b.addEventListener('click',()=>play(c));$('columns').append(b);}
function board(cols,frame){$('tiles').replaceChildren();cols.forEach((col,c)=>col.forEach((v,r)=>{const tile=document.createElement('div');tile.className='tile'+(label(v).length>5?' tiny':label(v).length>3?' small':'');tile.style.setProperty('--c',c);tile.style.setProperty('--r',r);paint(tile,v);if(frame&&c===frame.col&&r===frame.row)tile.classList.add(frame.type==='merge'?'pop':'fall');$('tiles').append(tile);}));}
function render(){board(state.cols);for(const [id,v] of [['score',state.score],['best',best]]){const el=$(id);el.textContent=v<1e10?fmt(v):E.label(v,0);el.title=fmt(v);}paint($('current'),state.current);paint($('next'),state.next);$('undo').disabled=busy||!previous;$('new').disabled=busy;[...$('columns').children].forEach((b,c)=>{b.disabled=busy||state.cols[c].length===E.HEIGHT;b.setAttribute('aria-label',`Columna ${c+1}. ${state.cols[c].length?state.cols[c].map(fmt).join(', ')+', de abajo arriba':'Vacía'}. ${b.disabled?'No disponible':'Soltar '+fmt(state.current)}`);});}
function lost(){if(!E.over(state))return;$('result').textContent=`${fmt(state.score)} puntos. Bloque mayor: ${fmt(state.peak)}.`;$('rescue').disabled=!previous;if(!$('gameover').open)$('gameover').showModal();}
let tipTimer=0;
function showValue(name,n){if(busy)return;const st=$('status'),keep=st.dataset.keep??st.textContent;st.dataset.keep=keep;st.textContent=`${name}: ${n<1e15?fmtExact(n):'≈ '+E.label(n,0)+' ('+n.toExponential(3).replace('.',',').replace('e+','e')+')'}`;clearTimeout(tipTimer);tipTimer=setTimeout(()=>{if(!busy)st.textContent=keep;delete st.dataset.keep;},4500);}
for(const [id,name,get] of [['current','Bloque actual',()=>state.current],['next','Siguiente bloque',()=>state.next],['score','Puntos',()=>state.score],['best','Récord',()=>best]]){const el=$(id),host=id==='score'||id==='best'?el.parentElement:el;host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label',name+': toca para ver el valor');host.addEventListener('click',()=>showValue(name,get()));host.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showValue(name,get());}});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function play(col){if(busy||$('confirm').open||$('gameover').open)return;const result=E.drop(state,col);if(!result)return;previous=E.copy(state);busy=true;render();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Commit atomically before animating, so leaving the page never loses a launch.
state=result.state;if(Number.isFinite(state.score))best=Math.max(best,state.score);save();
for(const f of result.frames){board(f.cols,f);$('status').textContent=f.type==='merge'?`${f.chain>1?'¡Cadena ×'+f.chain+'! ':''}+${fmt(f.gain)} puntos`:f.type==='clear'?`Se retiran los bloques menores de ${E.label(f.minimum)}.`:'↓';await delay(reduced?0:f.type==='drop'?190:240);}
busy=false;render();$('status').textContent=result.removed?`Nuevo nivel: ahora los bloques empiezan en ${E.label(E.floor(state))}.`:result.chain?`${result.chain>1?'¡Cadena de '+result.chain+' fusiones! ':''}+${fmt(result.gain)} puntos. Bloque mayor: ${fmt(state.peak)}.`:'Sin reloj. Piensa tu siguiente jugada.';lost();}
function undo(){if(busy||!previous)return;state=E.repair(previous);previous=null;if($('gameover').open)$('gameover').close();save();render();$('status').textContent='Último lanzamiento deshecho.';}
function fresh(){if(busy)return;if($('confirm').open)$('confirm').close();if($('gameover').open)$('gameover').close();state=E.create();previous=null;save();render();$('status').textContent='Sin reloj. Piensa tu siguiente jugada.';}
$('undo').onclick=undo;$('rescue').onclick=undo;$('new').onclick=()=>{$('confirm').showModal();};$('cancel').onclick=()=>{$('confirm').close();};$('restart').onclick=fresh;$('again').onclick=fresh;
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('button,summary,dialog'))return;if(/^[1-5]$/.test(e.key)){e.preventDefault();play(Number(e.key)-1);}});
render();lost();
})();
