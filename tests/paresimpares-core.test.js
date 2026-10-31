"use strict";
const C = require("../paresimpares-core.js");

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
function st(board, score, movesLeft){ return { board, score: score || 0, movesLeft: movesLeft === undefined ? 30 : movesLeft }; }
function noAdjacentEquals(b){
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++){
    if (r + 1 < 4 && b[r][c] === b[r+1][c]) return false;
    if (c + 1 < 4 && b[r][c] === b[r][c+1]) return false;
  }
  return true;
}

// 1. Tablero inicial: 4x4, valores 1/2/3, sin iguales adyacentes, 30 movimientos, 0 puntos.
for (let seed = 1; seed <= 200; seed++){
  const g = C.newGame(mulberry32(seed));
  eq(g.board.length, 4, "inicial 4 filas (semilla " + seed + ")");
  ok(g.board.every(r => r.length === 4), "inicial 4 columnas (semilla " + seed + ")");
  ok(g.board.flat().every(v => v === 1 || v === 2 || v === 3), "inicial solo 1/2/3 (semilla " + seed + ")");
  ok(noAdjacentEquals(g.board), "inicial sin iguales tocandose (semilla " + seed + ")");
  eq(g.movesLeft, 30, "inicial 30 movimientos (semilla " + seed + ")");
  eq(g.score, 0, "inicial 0 puntos (semilla " + seed + ")");
}

// 2. Fila a la derecha: pareja de 1s suma (1+1=2) y su hueco recibe un 2.
{
  const b = [[1,2,3,1],[2,3,4,1],[3,2,1,2],[2,1,2,1]];
  // fila 0 -> [1,1,2,3]; el resto del tablero queda sin contactos (verificado a mano)
  const r = C.move(st(b), "row", 0, 1);
  eq(r.merges.length, 1, "una sola fusion");
  ok(r.merges[0].summed, "1+1 es suma");
  eq(r.merges[0].tile, 2, "1+1=2");
  eq(r.gained, 2, "puntos de 1+1");
  eqArr(r.fills, [{ at: [0,1], value: 2 }], "donde sumaste nace un 2");
  eqArr(r.state.board[0], [2,2,2,3], "fila resultante");
  eq(r.state.movesLeft, 29, "gasta un movimiento");
  ok(!r.gameOver, "no acaba");
}

// 3. Columna hacia abajo con envoltura y sin fusiones.
{
  const b = [[2,2,1,2],[1,1,2,1],[2,2,3,2],[3,3,2,1]];
  // col 0 = [2,1,2,3] -> abajo -> [3,2,1,2] (lo de abajo entra por arriba)
  const r = C.move(st(b), "col", 0, 1);
  eqArr(r.state.board, [[3,2,1,2],[2,1,2,1],[1,2,3,2],[2,3,2,1]], "columna envuelve");
  eq(r.merges.length, 0, "sin fusiones");
  eq(r.gained, 0, "sin puntos");
  eq(r.fills.length, 0, "sin rellenos");
  eq(r.state.movesLeft, 29, "gasta movimiento igualmente");
}

// 4. Dos 6 juntos dejan un 3 y el hueco recibe un 1.
{
  const b = [[6,6,2,1],[2,1,3,2],[1,2,1,3],[3,2,1,2]];
  const r = C.move(st(b), "row", 3, 1); // mueve la fila 3; la pareja de 6 sigue ahi
  eq(r.merges.length, 1, "una fusion de 6s");
  ok(!r.merges[0].summed, "6+6 es partir");
  eq(r.merges[0].tile, 3, "6 y 6 dejan un 3");
  eqArr(r.merges[0].at, [0,0], "el 3 queda arriba a la izquierda");
  eq(r.state.board[0][0], 3, "tablero: el 3 en su casilla");
  eqArr(r.fills, [{ at: [0,1], value: 1 }], "donde partiste nace un 1");
  eq(r.state.board[0][1], 1, "hueco relleno con 1");
  eq(r.gained, 3, "puntos de partir 6");
}

// 5. Dos 2 juntos dejan un 1 (partir hasta el fondo) y el hueco recibe un 1.
{
  const b = [[2,2,3,1],[1,3,1,2],[3,1,2,3],[2,3,1,1]];
  const r = C.move(st(b), "row", 3, 1);
  eq(r.merges.length, 1, "una fusion de 2s");
  ok(!r.merges[0].summed, "2+2 es partir");
  eq(r.merges[0].tile, 1, "2 y 2 dejan un 1");
  eqArr(r.fills, [{ at: [0,1], value: 1 }], "hueco del 2 relleno con 1");
  eq(r.gained, 1, "puntos de partir 2");
}

// 6. Grupo de tres iguales: se funden dos y queda una.
{
  const b = [[3,3,3,2],[2,1,2,1],[1,2,1,3],[3,2,1,2]];
  const r = C.move(st(b), "row", 3, 1);
  eq(r.merges.length, 1, "tres 3: una sola pareja");
  eq(r.state.board[0][0], 6, "la pareja suma 6");
  eq(r.state.board[0][2], 3, "la tercera se queda");
  eqArr(r.fills, [{ at: [0,1], value: 2 }], "hueco de la suma recibe 2");
  eq(r.gained, 6, "puntos de 3+3");
}

// 7. Varias parejas a la vez: cada hueco segun su fusion.
{
  const b = [[3,3,2,2],[2,1,3,1],[1,2,1,3],[3,2,1,2]];
  const r = C.move(st(b), "row", 3, 1);
  eq(r.merges.length, 2, "dos parejas");
  eq(r.gained, 7, "puntos: 6 de la suma + 1 de la mitad");
  eq(r.fills.length, 2, "dos rellenos");
  eq(r.fills[0].value, 2, "hueco de suma -> 2");
  eq(r.fills[1].value, 1, "hueco de partir -> 1");
  eqArr(r.state.board[0], [6,2,1,1], "fila resuelta");
}

// 8. Movimiento sin fusion: solo desplaza, gasta movimiento, sin puntos ni rellenos.
{
  const b = [[2,2,1,2],[1,1,2,1],[2,2,3,2],[3,3,2,1]];
  const r = C.move(st(b), "col", 0, 1);
  eq(r.gained, 0, "sin fusion no suma");
  eq(r.merges.length, 0, "sin fusiones");
  eq(r.fills.length, 0, "sin rellenos");
  eq(r.state.movesLeft, 29, "gasta movimiento igualmente");
  ok(!r.gameOver, "no acaba a los 29");
}

// 9. Fin del reto: la jugada 30 cierra la partida.
{
  const b = [[2,2,1,2],[1,1,2,1],[2,2,3,2],[3,3,2,1]];
  const r = C.move(st(b, 250, 1), "col", 0, 1);
  ok(r.gameOver, "gameOver al agotar movimientos");
  eq(r.state.movesLeft, 0, "quedan 0");
}

// 10. Determinismo total (clave para la previsualizacion).
{
  const g = C.newGame(mulberry32(7));
  const a = C.move(g, "col", 2, -1);
  const b2 = C.move(g, "col", 2, -1);
  eqArr(a.state, b2.state, "mismo estado y jugada, mismo resultado");
  eqArr(a.fills, b2.fills, "rellenos deterministas");
}

// 11. Techo de valores: nunca pasa de 6 en partidas completas con bot aleatorio; sin huecos.
{
  const rng = mulberry32(42);
  for (let g = 0; g < 50; g++){
    let s = C.newGame(rng);
    let max = 3;
    while (s.movesLeft > 0){
      const t = rng() < 0.5 ? "row" : "col";
      const i = Math.floor(rng() * 4), d = rng() < 0.5 ? 1 : -1;
      s = C.move(s, t, i, d).state;
      for (const row of s.board) for (const v of row){ ok(v >= 1, "sin huecos ni ceros"); if (v > max) max = v; }
    }
    ok(max <= 6, "techo 6 en partida " + g + " (max visto " + max + ")");
    ok(s.score > 0, "la partida suma puntos");
  }
}

// 12. El tablero inicial siempre trae al menos dos 3 (sin 3s no hay 6 y el juego queda plano).
{
  for (let seed = 100; seed < 400; seed++){
    const g = C.newGame(mulberry32(seed));
    const threes = g.board.flat().filter(v => v === 3).length;
    ok(threes >= 2, "al menos dos 3 al inicio (semilla " + seed + ", vistos " + threes + ")");
  }
}

if (failures){ console.error(failures + " fallos"); process.exit(1); }
console.log("OK - tests de paresimpares-core");

