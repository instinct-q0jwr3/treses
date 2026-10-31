"use strict";
const C = require("../desborde-core.js");

let failures = 0;
function ok(cond, msg){ if (!cond){ failures++; console.error("FALLO:", msg); } }
function eq(a, b, msg){ ok(a === b, msg + " (esperado " + JSON.stringify(b) + ", obtenido " + JSON.stringify(a) + ")"); }
function eqArr(a, b, msg){ ok(JSON.stringify(a) === JSON.stringify(b), msg + " (esperado " + JSON.stringify(b) + ", obtenido " + JSON.stringify(a) + ")"); }

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Rotacion con desborde
eqArr(C.rotateLine([1,2,3,4,5], 1), [5,1,2,3,4], "rota derecha: el ultimo entra por el principio");
eqArr(C.rotateLine([1,2,3,4,5], -1), [2,3,4,5,1], "rota izquierda: el primero entra por el final");

// 2. Colapso de parejas: la ficha queda en el extremo hacia el que se movio
let r = C.collapseLine([2,2,1,3,3], 1);
eqArr(r.line, [null,4,1,null,6], "parejas moviendo a la derecha quedan a la derecha");
eq(r.gained, 10, "puntos de 2+2 y 3+3");
r = C.collapseLine([2,2,1,3,3], -1);
eqArr(r.line, [4,null,1,6,null], "parejas moviendo a la izquierda quedan a la izquierda");
eq(r.gained, 10, "puntos iguales en la otra direccion");

// 3. Grupo de tres o mas suma todo (no potencias de dos)
r = C.collapseLine([2,2,2,1,1], 1);
eqArr(r.line, [null,null,6,null,2], "2+2+2=6 y 1+1=2");
eq(r.merges.length, 2, "dos grupos en la misma linea colapsan");
eq(r.gained, 8, "suma de ambos grupos");
r = C.collapseLine([3,3,3,3,3], 1);
eqArr(r.line, [null,null,null,null,15], "cinco iguales colapsan en uno de 15");
r = C.collapseLine([3,3,3,3,3], -1);
eqArr(r.line, [15,null,null,null,null], "cinco iguales a la izquierda");

// 4. Los dos extremos NO cuentan como vecinos para fusionar
r = C.collapseLine([2,1,3,1,2], 1);
eq(r.merges.length, 0, "extremos iguales no se juntan");
eq(r.gained, 0, "sin puntos sin grupos");

// 5. Movimiento de fila completo: rotacion + colapso + relleno desde la cola
let state = {
  board: [
    [1,2,2,3,1],
    [1,1,1,1,1],
    [3,1,2,3,2],
    [2,3,1,2,3],
    [1,2,3,1,2]
  ],
  queue: [9,8,7],
  score: 5
};
let rng = mulberry32(1);
let m = C.move(state, "row", 0, 1, rng);
// [1,2,2,3,1] rota a la derecha -> [1,1,2,2,3]; colapsan 1+1 y 2+2 -> [_,2,_,4,3]; relleno con cola
eqArr(m.state.board[0], [9,2,8,4,3], "fila 0: rota, colapsa las dos parejas a la derecha y rellena huecos con la cola en orden");
eq(m.gained, 6, "puntos del movimiento");
eq(m.state.score, 11, "puntuacion acumulada");
eq(m.state.queue.length, 3, "la cola se repone a 3");
eqArr(m.state.queue.slice(0,1), [7], "la cola avanza");
eqArr(m.merges[0].at, [0,1], "merge en coordenadas de tablero");
eq(m.merges[0].sum, 2, "suma del primer merge");
eqArr(m.fresh, [[0,0],[0,2]], "huecos rellenados");
eqArr(m.state.board[1], [1,1,1,1,1], "solo colapsa la linea movida: la fila 1 no se toca");
eqArr(state.board[0], [1,2,2,3,1], "el estado original no se muta");

// 6. Movimiento de columna
state = {
  board: [
    [1,2,3,1,2],
    [2,1,2,3,1],
    [3,2,1,2,3],
    [1,3,2,1,2],
    [2,1,3,2,1]
  ],
  queue: [9,9,9],
  score: 0
};
m = C.move(state, "col", 0, 1, rng); // columna [1,2,3,1,2] rota abajo -> [2,1,2,3,1], sin iguales
eq(m.gained, 0, "columna sin grupos no puntua");
eq(m.fresh.length, 0, "sin huecos no entran piezas");
eqArr(m.state.queue, [9,9,9], "cola intacta sin colapso");
eqArr(m.state.board.map(row => row[0]), [2,1,2,3,1], "columna rotada con desborde");
m = C.move(state, "col", 1, -1, rng); // columna [2,1,2,3,1] rota arriba -> [1,2,3,1,2], sin iguales
eq(m.gained, 0, "columna hacia arriba sin grupos");
state.board = [[2,0,0,0,0],[2,0,0,0,0],[1,0,0,0,0],[3,0,0,0,0],[2,0,0,0,0]];
m = C.move(state, "col", 0, -1, rng); // [2,2,1,3,2] arriba -> [2,1,3,2,2]: pareja de 2 al final queda arriba del grupo? dir=-1 -> extremo superior del grupo
eqArr(m.state.board.map(row => row[0]), [2,1,3,4,9], "columna: rotada y pareja colapsada hacia arriba del grupo (pos 3)");
eq(m.gained, 4, "puntos de la columna");

// 7. Partida nueva
rng = mulberry32(7);
const g = C.newGame(rng);
eq(g.board.length, 5, "tablero 5 filas");
ok(g.board.every(row => row.length === 5), "tablero 5 columnas");
g.board.forEach(row => row.forEach(v => ok(v >= 1 && v <= 3, "valor inicial 1..3")));
eq(g.queue.length, 3, "cola inicial de 3");
eq(g.score, 0, "puntos a cero");

// 8. maxTile
eq(C.maxTile([[1,2],[3,4]]), 4, "maxTile");
eq(C.maxTile(C.newGame(mulberry32(3)).board) <= 3, true, "maxTile inicial <= 3");

// 9. Partida jugable: muchos movimientos aleatorios no rompen nada
rng = mulberry32(99);
let s = C.newGame(rng);
for (let i = 0; i < 500; i++){
  const res = C.move(s, rng() < 0.5 ? "row" : "col", Math.floor(rng()*5), rng() < 0.5 ? 1 : -1, rng);
  s = res.state;
  ok(s.board.every(row => row.length === 5 && row.every(v => Number.isInteger(v) && v >= 1)), "tablero siempre lleno y valido (mov " + i + ")");
  eq(s.queue.length, 3, "cola siempre de 3 (mov " + i + ")");
}
ok(s.score > 0, "tras 500 movimientos hay puntos");

if (failures === 0) console.log("Todos los tests de Desborde pasan.");
else { console.error(failures + " tests fallaron"); process.exit(1); }
