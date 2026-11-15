(()=>{
'use strict';
const E=DropEngine, KEY='caida-numeros-save-v1', BEST='caida-numeros-best-v1';
const $=id=>document.getElementById(id);
let state=E.create(),previous=null,best=0,busy=false;
const colors=['#d884ac','#86af68','#59b8b0','#5e9cca','#9683c5','#d58866','#b4a08a','#e7ac48','#d76e86','#b28b4c','#6d9ea7','#8b94bb'];
const fmt=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);
function label(n){return E.label(n);}
function paint(el,n){el.textContent=label(n);el.style.background=colors[(Math.log2(n)-1)%colors.length];el.style.color='#fff';el.title=fmt(n);el.classList.toggle('long',label(n).length>4&&(el.classList.contains('mini')));}
function save(){try{localStorage.setItem(KEY,JSON.stringify({state,previous}));localStorage.setItem(BEST,String(best));}catch{$('storageWarning').hidden=false;}}
try{const data=JSON.parse(localStorage.getItem(KEY));let healed=false;if(E.valid(data?.state)){state=E.repair(data.state);healed=JSON.stringify(state)!==JSON.stringify(data.state);previous=E.valid(data.previous)?data.previous:null;}best=Number(localStorage.getItem(BEST))||0;if(!Number.isFinite(best)||best<0)best=0;best=Math.max(best,state.score);if(healed)save();}catch{ $('storageWarning').hidden=false; }
for(let i=0;i<30;i++){const cell=document.createElement('div');cell.className='well';$('grid').append(cell);}
for(let c=0;c<5;c++){const b=document.createElement('button');b.className='column';b.innerHTML='<span class="arrow" aria-hidden="true">↓</span>';b.addEventListener('click',()=>play(c));$('columns').append(b);}
function board(cols,frame){$('tiles').replaceChildren();cols.forEach((col,c)=>col.forEach((v,r)=>{const tile=document.createElement('div');tile.className='tile'+(label(v).length>5?' tiny':label(v).length>3?' small':'');tile.style.setProperty('--c',c);tile.style.setProperty('--r',r);paint(tile,v);if(frame&&c===frame.col&&r===frame.row)tile.classList.add(frame.type==='merge'?'pop':'fall');$('tiles').append(tile);}));}
function render(){board(state.cols);for(const [id,v] of [['score',state.score],['best',best]]){const el=$(id);el.textContent=v<1e10?fmt(v):E.label(v,0);el.title=fmt(v);}paint($('current'),state.current);paint($('next'),state.next);$('undo').disabled=busy||!previous;$('new').disabled=busy;[...$('columns').children].forEach((b,c)=>{b.disabled=busy||state.cols[c].length===E.HEIGHT;b.setAttribute('aria-label',`Columna ${c+1}. ${state.cols[c].length?state.cols[c].map(fmt).join(', ')+', de abajo arriba':'Vacía'}. ${b.disabled?'No disponible':'Soltar '+fmt(state.current)}`);});}
function lost(){if(!E.over(state))return;$('result').textContent=`${fmt(state.score)} puntos. Bloque mayor: ${fmt(state.peak)}.`;$('rescue').disabled=!previous;if(!$('gameover').open)$('gameover').showModal();}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function play(col){if(busy||$('confirm').open||$('gameover').open)return;const result=E.drop(state,col);if(!result)return;previous=E.copy(state);busy=true;render();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Commit atomically before animating, so leaving the page never loses a launch.
state=result.state;best=Math.max(best,state.score);save();
for(const f of result.frames){board(f.cols,f);$('status').textContent=f.type==='merge'?`${f.chain>1?'¡Cadena ×'+f.chain+'! ':''}+${fmt(f.gain)} puntos`:f.type==='clear'?`Se retiran los bloques menores de ${fmt(f.minimum)}.`:'↓';await delay(reduced?0:f.type==='drop'?190:240);}
busy=false;render();$('status').textContent=result.removed?`Nuevo nivel: ahora los bloques empiezan en ${fmt(E.floor(state))}.`:result.chain?`${result.chain>1?'¡Cadena de '+result.chain+' fusiones! ':''}+${fmt(result.gain)} puntos. Bloque mayor: ${fmt(state.peak)}.`:'Sin reloj. Piensa tu siguiente jugada.';lost();}
function undo(){if(busy||!previous)return;state=E.repair(previous);previous=null;if($('gameover').open)$('gameover').close();save();render();$('status').textContent='Último lanzamiento deshecho.';}
function fresh(){if(busy)return;if($('confirm').open)$('confirm').close();if($('gameover').open)$('gameover').close();state=E.create();previous=null;save();render();$('status').textContent='Sin reloj. Piensa tu siguiente jugada.';}
$('undo').onclick=undo;$('rescue').onclick=undo;$('new').onclick=()=>{$('confirm').showModal();};$('cancel').onclick=()=>{$('confirm').close();};$('restart').onclick=fresh;$('again').onclick=fresh;
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('button,summary,dialog'))return;if(/^[1-5]$/.test(e.key)){e.preventDefault();play(Number(e.key)-1);}});
render();lost();
})();
