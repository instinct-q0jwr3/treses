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
let seed=4637812;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let moves=0;for(let g=0;g<120;g++){s=E.create(rng);for(let i=0;i<800&&!E.over(s);i++){const legal=s.cols.map((c,i)=>c.length<6?i:-1).filter(i=>i>=0);const col=legal[Math.floor(rng()*legal.length)];const before=JSON.stringify(s);r=E.drop(s,col,rng);assert.equal(JSON.stringify(s),before);assert.ok(E.valid(r.state));assert.ok(r.state.score>=s.score);assert.ok(r.state.cols.every(c=>c.every(v=>v>=E.floor(r.state))));assert.equal(r.state.moves,s.moves+1);s=r.state;moves++;}}
console.log('PASS: vertical, lateral, multiple, chains, gravity, milestone cleanup, full columns, immutability, validation and '+moves+' seeded random launches.');
