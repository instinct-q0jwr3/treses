"use strict";
const C = require("../prisma-core.js");

let failures = 0;
function ok(cond, msg){ if (!cond){ failures++; console.error("FALLO:", msg); } }
function eq(a, b, msg){ ok(a === b, msg + " (esperado " + b + ", obtenido " + a + ")"); }

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Geometria del panal
eq(C.CELLS.length, 37, "37 casillas");
let counts = {};
C.CELLS.forEach(c => {
  const k = C.key(c[0], c[1]);
  const ns = C.neighbors(k);
  ok(ns.length >= 3 && ns.length <= 6, "vecinos entre 3 y 6 en " + k);
  counts[ns.length] = (counts[ns.length] || 0) + 1;
  ns.forEach(n => ok(C.neighbors(n).indexOf(k) !== -1, "adyacencia simetrica " + k + "<->" + n));
});
eq(counts[3], 6, "6 esquinas con 3 vecinos");
eq(counts[6], 19, "19 interiores con 6 vecinos");

// 2. Tablero nuevo: lleno, valido y con jugadas
const rng = mulberry32(42);
let b = C.newBoard(rng);
eq(Object.keys(b).length, 37, "tablero lleno");
Object.keys(b).forEach(k => { ok(C.CELL_SET[k], "casilla valida " + k); ok(C.validTile(b[k]), "ficha valida " + k); });
ok(C.hasAnyMove(b), "tablero nuevo tiene jugadas");

// 3. Reglas de la cadena
// A=(0,0), B=(1,0), C2=(1,-1): B vecino de A, C2 vecino de B y de A? (1,-1) es vecino de (0,0) tambien.
const A = "0,0", B = "1,0", D = "2,-1"; // D vecino de B y de (1,-1); no vecino de A
const tb = {};
C.CELLS.forEach(c => { tb[C.key(c[0], c[1])] = { color: "azul", num: 3, shape: "rombo" }; });
tb[A] = { color: "coral", num: 1, shape: "circulo" };
tb[B] = { color: "coral", num: 2, shape: "triangulo" };   // comparte solo color con A
tb[D] = { color: "verde", num: 2, shape: "estrella" };    // comparte solo num con B
tb["0,-1"] = { color: "coral", num: 5, shape: "cuadrado" }; // vecino de A, comparte color
let info = C.appendInfo(tb, [A], [], B);
ok(info.ok && info.attr === "color", "primer enlace por color");
info = C.appendInfo(tb, [A, B], ["color"], D);
ok(info.ok && info.attr === "num", "segundo enlace por numero");
// repetir el mismo atributo (color) despues de color: no vale
info = C.appendInfo(tb, [A, B], ["color"], "1,-1");
ok(!info.ok, "(1,-1) no es vecina de B");
// casilla ya en la cadena
info = C.appendInfo(tb, [A, B], ["color"], A);
ok(!info.ok && info.reason === "repetida", "no repetir casilla");
// mismo atributo dos veces seguidas: (0,-1) solo comparte color con A
info = C.appendInfo(tb, ["0,-1", A], ["color"], B);
ok(!info.ok && info.reason === "mismo-atributo", "no repetir atributo de enlace");

// 4. Puntuacion
eq(C.scoreFor(3, ["color", "num"]), 30, "cadena de 3");
eq(C.scoreFor(4, ["color", "num"]), 60, "cadena de 4");
eq(C.scoreFor(4, ["color", "num", "shape"]), 90, "cadena variada x1.5");

// 5. Gravedad: columna q=0 tiene r=-3..3; quitamos la central y cae lo de arriba
const rng2 = mulberry32(7);
const b2 = C.newBoard(rng2);
const colQ0 = ["0,-3", "0,-2", "0,-1", "0,0", "0,1", "0,2", "0,3"];
const before = colQ0.map(k => b2[k]);
const res = C.applyRemoval(b2, ["0,-1"], rng2);
eq(Object.keys(res.board).length, 37, "tablero sigue lleno tras quitar");
eq(res.spawns.length, 1, "nace 1 ficha");
eq(res.spawns[0].to, "0,-3", "la nueva entra por arriba");
eq(res.board["0,-1"], before[1], "cae la de arriba (0,-2)->(0,-1)");
eq(res.board["0,-2"], before[0], "cae la de arriba (0,-3)->(0,-2)");
eq(res.board["0,0"], before[3], "la de debajo del hueco no se mueve");
eq(res.board["0,1"], before[4], "las de abajo no se mueven");
eq(res.board["0,3"], before[6], "la ultima no se mueve");
ok(res.moves.some(m => m.from === "0,-3" && m.to === "0,-2"), "movimiento de caida registrado");

// 6. Tablero sin jugadas: todos coral; num y forma sin vecinos repetidos
const nb = {};
C.CELLS.forEach(c => {
  const q = c[0], r = c[1];
  nb[C.key(q, r)] = {
    color: "coral",
    num: (((q + 2 * r) % 5) + 5) % 5 + 1,
    shape: C.SHAPES[(((2 * q + r) % 5) + 5) % 5]
  };
});
// comprobar que vecinos solo comparten color
C.CELLS.forEach(c => {
  const k = C.key(c[0], c[1]);
  C.neighbors(k).forEach(n => {
    const s = C.sharedAttrs(nb[k], nb[n]);
    ok(s.length === 1 && s[0] === "color", "vecinos solo comparten color " + k + " " + n);
  });
});
ok(!C.hasAnyMove(nb), "tablero bloqueado sin jugadas");
const rb = C.reshuffle(nb, mulberry32(99));
ok(C.hasAnyMove(rb), "la mezcla deja jugadas");
eq(Object.keys(rb).length, 37, "mezcla conserva 37 fichas");

// 7. Partidas aleatorias: 300 rondas sin romperse
const rng3 = mulberry32(2026);
let g = C.newBoard(rng3);
for (let round = 0; round < 300; round++){
  if (!C.hasAnyMove(g)) g = C.reshuffle(g, rng3);
  // paseo aleatorio para construir una cadena valida
  const start = C.CELLS[Math.floor(rng3() * C.CELLS.length)];
  const keys = [C.key(start[0], start[1])], attrs = [];
  while (true){
    const last = keys[keys.length - 1];
    const opts = C.neighbors(last).filter(n => C.appendInfo(g, keys, attrs, n).ok);
    if (!opts.length) break;
    if (keys.length >= 3 && rng3() < 0.35) break;
    const nk = opts[Math.floor(rng3() * opts.length)];
    keys.push(nk);
    attrs.push(C.appendInfo(g, keys.slice(0, -1), attrs, nk).attr);
  }
  if (keys.length < 3) { round--; continue; }
  const out = C.applyRemoval(g, keys, rng3);
  g = out.board;
  eq(Object.keys(g).length, 37, "ronda " + round + ": tablero lleno");
  Object.keys(g).forEach(k => ok(C.validTile(g[k]), "ronda " + round + ": ficha valida " + k));
}
console.log(failures === 0 ? "OK: todos los tests pasan" : ("FALLOS: " + failures));
process.exit(failures ? 1 : 0);
