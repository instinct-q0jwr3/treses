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

// Display labels: SI prefixes, Spanish decimal comma, at most 7 characters for any finite value.
{
  const assert=require('assert');const E=require('../drop-engine.js');
  for(let k=1;k<=1023;k++){const n=2**k;for(const m of [1,1.49,1.999]){const l=E.label(n*m<Infinity?n*m:n);assert(l.length<=7,l);assert(!/1000/.test(l),l);assert(!/\./.test(l),l);}}
  assert.strictEqual(E.label(2),'2');assert.strictEqual(E.label(137438953472),'137,4G');assert.strictEqual(E.label(8796093022208),'8,8T');
  assert.strictEqual(E.label(67506114885560,0),'67,5T');assert.strictEqual(E.label(1e33),'1,0e33');
  console.log('PASS: compact labels with SI prefixes and decimal comma for every power of two up to 2^1023');
}
// Rules: new games use rules 2 (retirement floor steps every 2 levels); saves without `rules` keep rule 1.
{
  const assert=require('assert');const E=require('../drop-engine.js');
  const n=E.create(()=>0);assert.strictEqual(n.rules,2);
  const old={...n,rules:undefined};delete old.rules;
  for(const lg of [9,10,11,12,13,20,43]){
    old.peak=2**lg;n.peak=2**lg;
    assert.strictEqual(E.floor(old),2**(lg-8),'legacy floor');
    const f=Math.floor((lg-8)/2)*2;assert.strictEqual(E.floor(n),2**Math.max(1,f),'new floor');assert.ok(E.floor(n)<=E.floor(old));
  }
  assert.ok(E.valid(old));assert.strictEqual(E.repair(old).rules,undefined);
  // A legacy save keeps its rule across drops and undo-repair.
  const lg={...old,cols:[[2**40],[],[],[],[]],peak:2**43,current:2**40,next:2**38,score:6.7e13};
  const r=E.drop(lg,0,()=>0);assert.strictEqual(r.state.rules,undefined);
  // Block ceiling: equal 2^1000 blocks do not merge, and existing larger states load untouched.
  const big={...n,cols:[[2**1000],[],[],[],[]],peak:2**1000,current:2**1000,next:2,score:1e300};
  const b=E.drop(big,0,()=>0);assert.ok(b&&E.valid(b.state));assert.deepStrictEqual(b.state.cols[0],[2**1000,2**1000]);assert.ok(Number.isFinite(b.state.score)&&b.state.score===1e300);
  const huge={...n,cols:[[2**1023],[],[],[],[]],peak:2**1023,current:2**1023,next:2,score:1e308};
  assert.ok(E.valid(huge));const h=E.repair(huge);assert.deepStrictEqual(h.cols,huge.cols);assert.strictEqual(h.score,1e308);
  const hd=E.drop(huge,0,()=>0);assert.ok(Number.isFinite(hd.state.score)&&hd.state.score===1e308&&E.valid(hd.state)&&hd.state.cols[0].length===2);
  console.log('PASS: rules 1 preserved, rules 2 floor, 2^1000 ceiling and finite score without touching existing states');
}
