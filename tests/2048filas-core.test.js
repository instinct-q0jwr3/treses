"use strict";
const C = require("../2048filas-core.js");

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
// Tablero "tranquilo": todos los valores distintos, ningun desplazamiento crea contactos.
function quiet(){
  return [
    [2,     32,   64,    128],
    [256,   512,  1024,  2048],
    [4096,  8192, 16384, 32768],
    [65536, 131072, 262144, 524288]
  ];
}

// 1. Tablero inicial: 4x4, valores 2/4, sin iguales adyacentes, con algun duplicado.
let okCount = 0;
for (let seed = 1; seed <= 200; seed++){
  const g = C.newGame(mulberry32(seed));
  const good = g.board.length === C.N && g.board.every(r => r.length === C.N) &&
    g.board.every(r => r.every(v => v === 2 || v === 4)) &&
    C.findGroups(g.board).length === 0 && C.hasDuplicate(g.board) && g.score === 0;
  if (!good){ failures++; console.error("FALLO: newGame semilla " + seed); }
  else okCount++;
}
console.log("ok - newGame: 200 semillas con tablero valido (" + okCount + ")");

// 2. Desplazamiento circular de fila, una casilla, sin fusion posible.
{
  const st = { board: quiet(), score: 10 };
  const r = C.move(st, "row", 1, 1);
  eqArr(r.state.board[1], [2048,256,512,1024], "fila desplazada a la derecha con reintegro circular");
  eq(r.gained, 0, "sin fusion: 0 puntos");
  eq(r.merges.length, 0, "sin fusion: sin fusiones");
  eq(r.fills.length, 0, "sin fusion: no hay relleno");
  eq(r.gameOver, false, "sin fusion: nunca es derrota");
  eq(r.state.score, 10, "sin fusion: puntos intactos");
}
// 3. Desplazamiento circular de columna hacia arriba.
{
  const st = { board: quiet(), score: 0 };
  const r = C.move(st, "col", 0, -1);
  eqArr(r.state.board.map(row => row[0]), [256,4096,65536,2], "columna desplazada hacia arriba con reintegro circular");
  eq(r.gained, 0, "columna: sin fusion");
}

// 4. Pareja: se junta en 4 en la casilla de mas arriba a la izquierda; nace UNA ficha nueva
//    en el hueco de la pareja con la menor potencia ausente (2) y eso NO vuelve a fusionar
//    en la misma jugada.
{
  const b = quiet();
  b[0][1] = 2;      // pareja de doses en la fila 0
  b[3][3] = 64;     // otro duplicado lejano para seguir vivos
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 1, 1); // mueve una fila tranquila; la pareja ya estaba
  eq(r.gained, 4, "pareja de doses suma 4 puntos");
  eq(r.merges.length, 1, "una sola fusion");
  eqArr(r.merges[0].at, [0,0], "el doble queda en la casilla de mas arriba a la izquierda de la pareja");
  eq(r.merges[0].tile, 4, "2 + 2 = 4");
  eq(r.fills.length, 1, "un hueco rellenado");
  eqArr(r.fills[0].at, [0,1], "relleno en el hueco de la pareja");
  eq(r.fills[0].value, 2, "relleno: menor potencia ausente (2)");
  eq(r.state.board[0][1], 2, "tablero: 2 rellenado");
  eq(r.gameOver, false, "quedan dos 64: partida viva");
}

// 5. Grupo de tres: se junta una pareja y la tercera ficha se queda como estaba.
{
  const b = quiet();
  b[0][1] = 2; b[0][2] = 2; // trio de doses en la fila 0
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 1, 1);
  eq(r.merges.length, 1, "trio: una sola pareja se junta");
  eq(r.state.board[0][0], 4, "trio: 4 en la primera casilla");
  eq(r.state.board[0][2], 2, "trio: la tercera ficha se queda");
  eq(r.fills.length, 1, "trio: nace una sola ficha nueva");
  eq(r.fills[0].value, 8, "trio: relleno con la menor potencia ausente (2 y 4 ya estan)");
}

// 6. Grupo de cuatro en bloque: dos parejas, dos fusiones.
{
  const b = quiet();
  b[0][1] = 2; b[1][0] = 2; b[1][1] = 2; // bloque de doses en la esquina
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 2, 1);
  eq(r.merges.length, 2, "cuarteto: dos parejas");
  eq(r.gained, 8, "cuarteto: 4 + 4 puntos");
  eq(r.state.board[0][0], 4, "cuarteto: primera pareja fusionada");
  eq(r.state.board[1][0], 4, "cuarteto: segunda pareja fusionada");
  eq(r.gameOver, false, "cuarteto: quedan dos 4, partida viva");
}

// 7. Iguales en diagonal no se tocan: no fusionan.
{
  const b = quiet();
  b[1][1] = 2; // diagonal con el 2 de (0,0)
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 2, 1);
  eq(r.gained, 0, "diagonales no fusionan");
  eq(r.merges.length, 0, "diagonales: sin fusiones");
}

// 8. Derrota: la unica pareja del tablero se fusiona y el relleno no crea duplicados.
{
  const st = { board: [
    [2,2,8,16],
    [32,64,128,256],
    [512,1024,2048,4096],
    [8192,16384,32768,65536]
  ], score: 0 };
  const r = C.move(st, "row", 1, 1);
  eq(r.gained, 4, "derrota: la pareja fusiona y puntua");
  eq(C.hasDuplicate(r.state.board), false, "derrota: tablero sin dos iguales");
  eq(r.gameOver, true, "derrota: gameOver al quedarse sin duplicados");
}

// 9. Determinismo total: misma entrada, misma salida.
{
  const b = quiet();
  b[0][1] = 2; b[3][3] = 64;
  const st = { board: b, score: 7 };
  const a = C.move(st, "col", 0, 1);
  const c = C.move(st, "col", 0, 1);
  eq(JSON.stringify(a), JSON.stringify(c), "move es determinista");
}

// 10. move no muta el estado de entrada.
{
  const st = { board: quiet(), score: 3 };
  const snapshot = JSON.stringify(st);
  C.move(st, "row", 0, -1);
  eq(JSON.stringify(st), snapshot, "move no muta el estado de entrada");
}


// 11. Jugada con dos parejas: solo nace UNA ficha (en el hueco de la primera); el otro hueco
//     queda vacio y los huecos no cuentan para la derrota ni para los grupos.
{
  const b = quiet();
  b[0][1] = 2; b[1][0] = 2; b[1][1] = 2; // bloque de cuatro doses: dos parejas
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 2, 1);
  eq(r.merges.length, 2, "drenaje: dos parejas fusionan");
  eq(r.fills.length, 1, "drenaje: nace una sola ficha nueva por jugada");
  eqArr(r.fills[0].at, [0, 1], "drenaje: la ficha nueva nace en el hueco de la primera pareja");
  eq(r.state.board[1][1], null, "drenaje: el hueco de la segunda pareja queda vacio");
  eq(r.gameOver, false, "drenaje: quedan dos 4, partida viva");
}

// 12. Los huecos se desplazan con la linea y no fusionan entre si.
{
  const b = quiet();
  b[0][0] = null; b[3][3] = 64; // un hueco y un duplicado lejano para seguir vivos
  const st = { board: b, score: 0 };
  const r = C.move(st, "row", 0, 1); // desplaza la fila con el hueco
  eq(r.state.board[0][1], null, "hueco: se desplaza con la fila");
  eq(r.gained, 0, "hueco: los huecos no fusionan");
  eq(r.fills.length, 0, "hueco: sin fusion no nace ficha");
  const r2 = C.move({ board: [
    [null,null,8,16],
    [32,64,128,256],
    [512,1024,2048,4096],
    [8192,16384,32768,65536]
  ], score: 0 }, "row", 1, 1);
  eq(r2.gained, 0, "hueco: dos huecos adyacentes no son una pareja");
}

// 13. Derrota con huecos: la ultima pareja fusiona, la ficha nueva es distinta de todo
//     y los huecos no salvan la partida.
{
  const st = { board: [
    [2,2,null,16],
    [32,64,128,256],
    [512,1024,2048,4096],
    [8192,16384,32768,65536]
  ], score: 0 };
  const r = C.move(st, "row", 1, 1);
  eq(r.gained, 4, "derrota con huecos: la pareja puntua");
  eq(C.hasDuplicate(r.state.board), false, "derrota con huecos: sin dos iguales entre fichas");
  eq(r.gameOver, true, "derrota con huecos: gameOver");
}

if (failures === 0) console.log("Todos los tests de 2048 por filas pasan.");
else { console.error(failures + " tests fallaron"); process.exit(1); }
