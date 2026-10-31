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
function stable(board, msg){
  eq(C.findGroups(board).length, 0, msg + ": tablero estable, sin iguales adyacentes");
}

// 1. Ejemplo completo acordado con el usuario (adaptado a 5x5):
//    fila 2 = [2,4,1,4,7], al moverla a la derecha queda [7,2,4,1,4];
//    el 2 vertical de la columna 1 colapsa en 4 EN LA FILA MOVIDA y el hueco
//    de arriba recibe un 1; despues 4+4 -> 8 (ancla: ficha creada en oleada 1)
//    y la pareja de unos resultante -> 2. Todo en oleadas hasta estabilizar.
let board = [
  [4,5,2,6,7],
  [3,2,3,5,6],
  [2,4,1,4,7],
  [4,6,3,6,8],
  [5,7,4,7,9]
];
let m = C.move({ board, score: 0 }, "row", 2, 1);
eq(m.reverted, false, "ejemplo: la jugada no se revierte");
eq(m.steps.length, 4, "ejemplo: rotacion + 3 oleadas");
eqArr(m.steps[0].board[2], [7,2,4,1,4], "ejemplo: la fila rota con desborde (el 7 entra por la izquierda)");
eq(m.steps[1].merges.length, 1, "ejemplo: oleada 1 tiene una sola fusion");
eqArr(m.steps[1].merges[0].at, [2,1], "ejemplo: la suma queda en la fila movida");
eq(m.steps[1].merges[0].sum, 4, "ejemplo: 2+2=4");
eqArr(m.steps[1].fresh, [[1,1]], "ejemplo: el hueco de arriba recibe el 1");
eqArr(m.steps[1].board[2], [7,4,4,1,4], "ejemplo: tras oleada 1 la fila queda 7,4,4,1,4");
eqArr(m.steps[2].merges[0].at, [2,1], "ejemplo: oleada 2 ancla en la ficha que provoco la coincidencia");
eq(m.steps[2].merges[0].sum, 8, "ejemplo: 4+4=8");
eq(m.steps[3].merges[0].sum, 2, "ejemplo: oleada 3 junta la pareja de unos del relleno");
eq(m.gained, 14, "ejemplo: puntos 4+8+2");
eqArr(m.state.board[2], [7,8,2,1,4], "ejemplo: fila final");
stable(m.state.board, "ejemplo");
eq(m.state.score, 14, "ejemplo: puntuacion acumulada");

// 2. Grupo horizontal en la propia linea movida: ancla en el extremo hacia el que se movio
board = [
  [2,2,9,8,7],
  [1,3,4,5,6],
  [3,4,5,6,9],
  [4,5,6,9,8],
  [5,6,7,3,1]
];
m = C.move({ board, score: 0 }, "row", 0, 1); // rota a [7,2,2,9,8], pareja en cols 1-2
eqArr(m.steps[1].merges[0].at, [0,2], "moviendo a la derecha, la suma queda a la derecha del grupo");
m = C.move({ board, score: 0 }, "row", 0, -1); // rota a [2,9,8,7,2]... pareja? [2,9,8,7,2] no; usar otra
// columna hacia arriba: ancla arriba
board = [
  [3,1,2,4,5],
  [3,2,4,5,6],
  [4,3,5,6,7],
  [5,4,6,7,8],
  [6,5,7,8,9]
];
m = C.move({ board, score: 0 }, "col", 0, 1); // columna [3,3,4,5,6] rota abajo -> [6,3,3,4,5]: pareja en filas 1-2
eqArr(m.steps[1].merges[0].at, [2,0], "moviendo hacia abajo, la suma queda abajo del grupo");
m = C.move({ board, score: 0 }, "col", 0, -1); // rota arriba -> [3,4,5,6,3]: pareja en filas 0 y 4? no adyacente
eq(m.steps.length, 1, "sin grupos tras rotar: una sola etapa, sin fusiones");

// 3. Grupos cruzados (forma de cruz) se fusionan como UN solo grupo conectado
board = [
  [1,3,9,4,5],
  [3,2,8,5,6],
  [2,2,2,6,7],
  [4,3,5,7,2],
  [5,4,6,8,9]
];
// cruz de doses: (1,1),(2,0),(2,1),(2,2). Mover fila 4 no toca la cruz ni crea otra pareja.
m = C.move({ board, score: 0 }, "row", 4, 1);
eq(m.steps[1].merges.length, 1, "la cruz es un solo grupo conectado");
eq(m.steps[1].merges[0].count, 4, "cuenta las 4 celdas una sola vez");
eq(m.steps[1].merges[0].sum, 8, "suma total 2*4=8");
stable(m.state.board, "cruz");

// 4. Oleada 1 con grupo que no toca la linea movida: ancla arriba-izquierda (mismo escenario)
eqArr(m.steps[1].merges[0].at, [1,1], "grupo fuera de la linea: ancla determinista arriba-izquierda");

// 5. Reposicion fija de 1
board = [
  [2,1,3,4,5],
  [1,2,4,5,6],
  [3,4,5,6,7],
  [4,5,6,7,8],
  [5,6,7,8,9]
];
m = C.move({ board, score: 0 }, "row", 4, -1); // fila 4 a la izquierda: no crea ningun grupo
eq(m.steps.length, 1, "sin coincidencias no entran unos");
eq(m.gained, 0, "sin puntos sin fusiones");
board = [
  [7,2,3,4,5],
  [1,2,4,5,6],
  [3,4,5,6,7],
  [4,5,6,7,8],
  [5,6,7,8,9]
];
// pareja vertical de doses en (0,1)-(1,1), lejos de la fila movida
m = C.move({ board, score: 0 }, "row", 4, -1);
eq(m.steps[1].merges.length, 1, "una sola fusion en oleada 1");
eqArr(m.steps[1].merges[0].at, [0,1], "grupo fuera de la linea: ancla arriba-izquierda");
eq(m.steps[1].merges[0].sum, 4, "2+2=4");
eqArr(m.steps[1].fresh, [[1,1]], "un solo hueco");
eq(m.steps[1].board[1][1], 1, "el hueco recibe un 1 fijo");
stable(m.state.board, "relleno");

// 6. Salvaguarda: presupuesto de oleadas -> reversion completa y exacta
const before = { board: [[4,5,2,6,7],[3,2,3,5,6],[2,4,1,4,7],[4,6,3,6,8],[5,7,4,7,9]], score: 42 };
m = C.move(before, "row", 2, 1, 1);
eq(m.reverted, true, "presupuesto 1: la jugada se revierte");
eq(m.reason, "budget", "motivo presupuesto");
eq(m.state.score, 42, "reversion: puntos intactos");
eqArr(m.state.board, before.board, "reversion: tablero intacto");

// 7. Tablero inicial: sin iguales adyacentes, valores 1..3
let rng = mulberry32(7);
for (let i = 0; i < 200; i++){
  const g = C.newGame(rng);
  stable(g.board, "tablero inicial " + i);
  g.board.forEach(row => row.forEach(v => ok(v >= 1 && v <= 3, "valor inicial 1..3")));
  eq(g.score, 0, "puntos a cero");
}

// 8. Propiedad: muchas partidas aleatorias, invariante al inicio de cada turno
rng = mulberry32(99);
let maxWaves = 0, reverts = 0;
for (let g = 0; g < 100; g++){
  let s = C.newGame(rng);
  for (let i = 0; i < 300; i++){
    stable(s.board, "invariante turno " + i);
    const res = C.move(s, rng() < 0.5 ? "row" : "col", Math.floor(rng() * 5), rng() < 0.5 ? 1 : -1);
    if (res.reverted){ reverts++; continue; }
    if (res.waves > maxWaves) maxWaves = res.waves;
    s = res.state;
  }
  ok(s.score > 0, "la partida suma puntos");
}
console.log("  (propiedad: max oleadas " + maxWaves + ", reversiones " + reverts + ")");
ok(maxWaves <= C.WAVE_BUDGET, "oleadas dentro del presupuesto");

// 9. El estado de entrada nunca se muta
const orig = { board: [[2,2,3,4,5],[1,3,4,5,6],[3,4,5,6,7],[4,5,6,7,8],[5,6,7,8,9]], score: 7 };
const snapshot = JSON.stringify(orig);
C.move(orig, "row", 0, 1);
eq(JSON.stringify(orig), snapshot, "move no muta el estado de entrada");

if (failures === 0) console.log("Todos los tests de Desborde pasan.");
else { console.error(failures + " tests fallaron"); process.exit(1); }
