/* Pares e impares - logica pura del juego (sin DOM). La usan paresimpares.html y
   tests/paresimpares-core.test.js
   Variante pedida por el usuario el 2026-10-31 ("jugar con los pares e impares"):
   - Tablero 4x4 siempre lleno, sembrado de 1, 2 y 3 (sin iguales tocandose al empezar).
   - Un movimiento desplaza UNA fila o columna UNA casilla; lo que sale por un lado
     entra por el otro. Cada arrastre gasta un movimiento, fusione o no.
   - Al soltar, los grupos de IGUALES que se toquen (4-conectados) se funden por PAREJAS
     en orden de lectura: impares SUMAN (1+1=2, 3+3=6), pares dejan su MITAD (2+2->1,
     6+6->3), en la casilla de mas arriba a la izquierda de cada pareja; si un grupo
     tiene un numero impar de fichas, la ultima se queda como estaba.
   - Cada hueco se rellena al instante segun la fusion que lo dejo (relleno "al reves",
     elegido por el usuario tras comparar ambos sentidos): donde SUMaste nace un 2,
     donde PARTIste nace un 1. Nunca nace nada mayor que 2: los valores viven entre
     1 y 6 y el ciclo 3+3=6 / 6+6->3 se recicla sin crecer.
   - RETO: 30 movimientos para sumar lo maximo. Puntos = valor de cada ficha resultante.
     Sin reloj. Fin al gastar el ultimo movimiento.
   - Todo es determinista: la previsualizacion del arrastre muestra exactamente lo que
     pasara. */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.ParesImparesCore = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var N = 4;
  var MOVES = 30;
  var SAVE_KEY = "paresimpares-save-v1";

  // Tablero inicial: clases de paridad en damero (los iguales nunca se tocan),
  // impares 1 o 3 al azar, pares siempre 2.
  function newGame(rng){
    rng = rng || Math.random;
    var phase = rng() < 0.5 ? 0 : 1;
    var board = [];
    for (var r = 0; r < N; r++){
      var row = [];
      for (var c = 0; c < N; c++){
        if ((r + c) % 2 === phase) row.push(rng() < 0.5 ? 1 : 3);
        else row.push(2);
      }
      board.push(row);
    }
    return { board: board, score: 0, movesLeft: MOVES };
  }

  function cloneBoard(b){ return b.map(function(row){ return row.slice(); }); }

  // Grupos 4-conectados de iguales con 2+ celdas, ordenados fila-columna (determinista).
  function findGroups(board){
    var seen = [], groups = [], r, c;
    for (r = 0; r < N; r++){ seen.push([]); for (c = 0; c < N; c++) seen[r].push(false); }
    for (r = 0; r < N; r++) for (c = 0; c < N; c++){
      if (seen[r][c]) continue;
      var v = board[r][c], stack = [[r, c]], cells = [];
      seen[r][c] = true;
      while (stack.length){
        var cur = stack.pop(), cr = cur[0], cc = cur[1];
        cells.push(cur);
        var nb = [[cr+1,cc],[cr-1,cc],[cr,cc+1],[cr,cc-1]];
        for (var k = 0; k < 4; k++){
          var nr = nb[k][0], nc = nb[k][1];
          if (nr >= 0 && nr < N && nc >= 0 && nc < N && !seen[nr][nc] && board[nr][nc] === v){
            seen[nr][nc] = true; stack.push([nr, nc]);
          }
        }
      }
      if (cells.length >= 2){
        cells.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
        groups.push({ cells: cells, value: v });
      }
    }
    groups.sort(function(a, b){ return a.cells[0][0] - b.cells[0][0] || a.cells[0][1] - b.cells[0][1]; });
    return groups;
  }

  // Aplica un movimiento completo: desplaza una casilla y resuelve UNA oleada de parejas.
  // Impares suman, pares dejan su mitad; cada hueco renace: 2 tras sumar, 1 tras partir.
  // Devuelve el estado final, las fusiones y los rellenos para animar/previsualizar.
  // Gasta un movimiento siempre. gameOver=true cuando se agota el ultimo movimiento.
  function move(state, type, index, dir){
    var board = cloneBoard(state.board), i, r, c;
    if (type === "row"){
      var line = board[index].slice();
      for (i = 0; i < N; i++) board[index][i] = line[(((i - dir) % N) + N) % N];
    } else {
      var col = [];
      for (r = 0; r < N; r++) col.push(board[r][index]);
      for (r = 0; r < N; r++) board[r][index] = col[(((r - dir) % N) + N) % N];
    }
    var shifted = cloneBoard(board);

    var merges = [], fills = [], gained = 0;
    var groups = findGroups(board);
    for (var g = 0; g < groups.length; g++){
      var group = groups[g];
      for (var p = 0; p + 1 < group.cells.length; p += 2){
        var a = group.cells[p], b = group.cells[p + 1];
        var summed = group.value % 2 === 1;
        var res = summed ? group.value * 2 : group.value / 2;
        board[a[0]][a[1]] = res;
        board[b[0]][b[1]] = null;
        merges.push({ at: a, tile: res, cells: [a, b], value: group.value, summed: summed });
        gained += res;
      }
      // si el grupo tiene un numero impar de fichas, la ultima se queda como estaba
    }
    for (var m = 0; m < merges.length; m++){
      var hole = merges[m].cells[1];
      var v = merges[m].summed ? 2 : 1;
      board[hole[0]][hole[1]] = v;
      fills.push({ at: hole, value: v });
    }
    var movesLeft = state.movesLeft - 1;
    return {
      state: { board: board, score: state.score + gained, movesLeft: movesLeft },
      shifted: shifted, merges: merges, fills: fills, gained: gained,
      gameOver: movesLeft <= 0
    };
  }

  return {
    N: N, MOVES: MOVES, SAVE_KEY: SAVE_KEY,
    newGame: newGame, cloneBoard: cloneBoard, findGroups: findGroups,
    move: move
  };
});
