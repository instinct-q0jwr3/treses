const assert=require('node:assert/strict'),E=require('../drop-engine');
function setup(cols,current=2){return {...E.create(()=>0),cols:[...cols,...Array.from({length:5-cols.length},()=>[])],current,next:4};}
let s=setup([]),r=E.drop(s,0,()=>0);assert.deepEqual(r.state.cols[0],[2]);assert.equal(s.cols[0].length,0);
r=E.drop(setup([[2]]),0,()=>0);assert.deepEqual(r.state.cols[0],[4]);assert.equal(r.gain,4);
r=E.drop(setup([[2],[]]),1,()=>0);assert.deepEqual(r.state.cols.slice(0,2),[[],[4]]);
r=E.drop(setup([[2],[2]]),1,()=>0);assert.deepEqual(r.state.cols.slice(0,2),[[2],[4]]); // left block is one row below, not adjacent
r=E.drop(setup([[8,2],[2],[8,2]]),1,()=>0);assert.deepEqual(r.state.cols.slice(0,3),[[8],[16],[8]]);assert.equal(r.chain,1);assert.equal(r.gain,16);
r=E.drop(setup([[16,8,4,2]]),0,()=>0);assert.deepEqual(r.state.cols[0],[32]);assert.equal(r.chain,4);assert.equal(r.gain,4+8+16+32);
s=setup([[512],[2,8]],512);s.peak=512;r=E.drop(s,0,()=>0);assert.equal(r.state.peak,1024);assert.equal(E.floor(r.state),4);assert.deepEqual(r.state.cols[1],[8]);assert.equal(r.removed,1);assert.ok(r.state.current>=4&&r.state.next>=4);
s=setup([[2,4,8,16,32,64]]);assert.equal(E.drop(s,0),null);assert.equal(E.over(s),false);assert.equal(E.drop(s,5),null);
s=setup(Array.from({length:5},()=>[2,4,8,16,32,64]));assert.ok(E.over(s));assert.equal(E.drop(s,4),null);
assert.equal(E.valid({...E.create(),cols:[[3],[],[],[],[]]}),false);assert.equal(E.valid(null),false);
// Regresión: una absorción lateral deja caer un bloque sobre otro igual (los dos 16 apilados de la captura)
r=E.drop(setup([[2],[16,2,16]]),0,()=>0);assert.deepEqual(r.state.cols.slice(0,2),[[8],[32]]);assert.equal(r.chain,2);assert.equal(r.gain,8+32);
// Bloque caído que queda junto a un igual de otra columna lejos del bloque activo
r=E.drop(setup([[2],[4,2,8],[4,8]]),0,()=>0);assert.deepEqual(r.state.cols.slice(0,3),[[64],[],[]]);assert.equal(r.chain,3);assert.equal(r.gain,8+8+64);
// La retirada de valores pequeños también puede juntar iguales al caer
s=setup([[4,2,4]]);s.peak=1024;s.current=8;r=E.drop(s,1,()=>0);assert.deepEqual(r.state.cols[0],[16]);assert.deepEqual(r.state.cols[1],[]);assert.equal(r.removed,1);assert.equal(r.chain,2);assert.equal(r.gain,8+16);
// repair() sana tableros guardados por la primera versión sin tocar el original
const broken=setup([[16,16],[256]]);broken.score=100;const fixed=E.repair(broken);
assert.deepEqual(fixed.cols.slice(0,2),[[32],[256]]);assert.equal(fixed.score,132);assert.deepEqual(broken.cols[0],[16,16]);
// Invariante: tras cualquier lanzamiento no quedan bloques iguales juntos en el tablero
function strays(cols){for(let c=0;c<5;c++)for(let r=0;r<cols[c].length;r++){if(cols[c][r+1]===cols[c][r])return true;if(c+1<5&&cols[c+1][r]===cols[c][r])return true;}return false;}
let seed=4637812;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let moves=0;for(let g=0;g<120;g++){s=E.create(rng);for(let i=0;i<800&&!E.over(s);i++){const legal=s.cols.map((c,i)=>c.length<6?i:-1).filter(i=>i>=0);const col=legal[Math.floor(rng()*legal.length)];const before=JSON.stringify(s);r=E.drop(s,col,rng);assert.equal(JSON.stringify(s),before);assert.ok(E.valid(r.state));assert.ok(r.state.score>=s.score);assert.ok(r.state.cols.every(c=>c.every(v=>v>=E.floor(r.state))));assert.equal(r.state.moves,s.moves+1);assert.ok(!strays(r.state.cols),'sin bloques iguales juntos tras el lanzamiento');s=r.state;moves++;}}
console.log('PASS: vertical, lateral, multiple, chains, gravity, milestone cleanup, full columns, immutability, validation and '+moves+' seeded random launches.');

// Display labels stay short for any finite value, including huge late-game ones.
{
  const assert=require('assert');const E=require('../drop-engine.js');
  for(let k=1;k<=1023;k++){const n=2**k;for(const m of [1,1.49,1.999]){const l=E.label(n*m<Infinity?n*m:n);assert(l.length<=7,l);assert(!/1000/.test(l),l);}}
  assert.strictEqual(E.label(2),'2');assert.strictEqual(E.label(137438953472),'137.4B');assert.strictEqual(E.label(8796093022208),'8.8T');
  assert.strictEqual(E.label(67506114885560,0),'67.5T');
  console.log('PASS: compact labels for every power of two up to 2^1023');
}
