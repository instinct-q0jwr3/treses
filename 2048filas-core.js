/* 2048 por filas - logica pura del juego (sin DOM). La usan 2048filas.html y tests/2048filas-core.test.js
   Variante pedida por el usuario el 2026-10-31: "un 2048 pero desplazando filas", con columnas tambien,
   y "pierdes cuando ya no quedan dos numeros iguales" en todo el tablero, aunque esten separados.
   - Tablero 4x4 lleno, valores potencias de 2. Sin reloj.
   - Un movimiento desplaza UNA fila o columna UNA casilla; lo que sale por un lado entra por el otro.
     Un movimiento que no fusiona nada es legal: solo prepara (desplaza).
   - Al soltar, los grupos de iguales que se toquen (4-conectados) se fusionan por PAREJAS en orden
     de lectura: cada pareja se convierte en el doble en su casilla de mas arriba a la izquierda;
     si un grupo tiene un numero impar de fichas, la ultima se queda como estaba.
   - Tras una jugada con fusion nace UNA sola ficha, en el hueco que deja la primera pareja: la MENOR
     potencia de 2 que no este ya en el tablero. Los demas huecos quedan VACIOS y se desplazan con
     su fila o columna. El relleno nunca crea duplicados; mantener viva la partida (que haya dos
     iguales) depende solo de tus fusiones. (Ajuste de balance 2026-10-31: antes cada hueco nacia
     con la menor potencia ausente, lo que llenaba el tablero de fichas enormes en pocos movimientos
     y disparaba los puntos; una sola ficha nueva por jugada mantiene la progresion tipo 2048.)
   - DERROTA: si tras resolver la jugada no quedan dos valores iguales entre las fichas del tablero
     (los huecos no cuentan), fin.
   - Todo es determinista: la previsualizacion del arrastre muestra exactamente lo que pasara. */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.Filas2048Core = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var N = 4;
  var SAVE_KEY = "filas2048-save-v1";

  function spawnStart(rng){ return rng() < 0.9 ? 2 : 4; }

  // Tablero inicial: sin iguales adyacentes (hay que mover para fusionar) y con al menos
  // un duplicado en algun lugar (si no, seria derrota inmediata).
  function newGame(rng){
    rng = rng || Math.random;
    while (true){
      var board = [];
      for (var r = 0; r < N; r++){
        var row = [];
        for (var c = 0; c < N; c++){
          var v;
          do { v = spawnStart(rng); }
          while ((c > 0 && row[c - 1] === v) || (r > 0 && board[r - 1][c] === v));
          row.push(v);
        }
        board.push(row);
      }
      if (hasDuplicate(board)) return { board: board, score: 0 };
    }
  }

  function cloneBoard(b){ return b.map(function(row){ return row.slice(); }); }

  function maxTile(board){
    var m = 0;
    for (var r = 0; r < board.length; r++)
      for (var c = 0; c < board[r].length; c++)
        if (board[r][c] > m) m = board[r][c];
    return m;
  }

  function hasDuplicate(board){
    var seen = {};
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      var v = board[r][c];
      if (v === null || v === undefined) continue; // los huecos no cuentan
      if (seen[v]) return true;
      seen[v] = true;
    }
    return false;
  }

  // Grupos 4-conectados de iguales con 2+ celdas, ordenados fila-columna (determinista).
  function findGroups(board){
    var seen = [], groups = [], r, c;
    for (r = 0; r < N; r++){ seen.push([]); for (c = 0; c < N; c++) seen[r].push(false); }
    for (r = 0; r < N; r++) for (c = 0; c < N; c++){
      if (seen[r][c]) continue;
      if (board[r][c] === null || board[r][c] === undefined){ seen[r][c] = true; continue; } // hueco
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

  // Menor potencia de 2 ausente del tablero (huecos ya ocupados ignorados como null).
  function smallestAbsent(board){
    var seen = {};
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++)
      if (board[r][c] !== null) seen[board[r][c]] = true;
    var v = 2;
    while (seen[v]) v *= 2;
    return v;
  }

  // Aplica un movimiento completo: desplaza una casilla y resuelve UNA oleada de parejas.
  // Devuelve el estado final, las fusiones y los rellenos para animar/previsualizar.
  // Si no fusiona nada, solo desplaza (gained 0). gameOver=true si el tablero resultante
  // se queda sin dos valores iguales en ninguna parte.
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

    var merges = [], fills = [], gained = 0, firstGap = null;
    var groups = findGroups(board);
    for (var g = 0; g < groups.length; g++){
      var group = groups[g];
      for (var p = 0; p + 1 < group.cells.length; p += 2){
        var a = group.cells[p], b = group.cells[p + 1];
        board[a[0]][a[1]] = group.value * 2;
        board[b[0]][b[1]] = null;
        if (!firstGap) firstGap = b;
        merges.push({ at: a, tile: group.value * 2, cells: [a, b], value: group.value });
        gained += group.value * 2;
      }
      // si el grupo tiene un numero impar de fichas, la ultima se queda como estaba
    }
    if (gained > 0){
      // Una sola ficha nueva por jugada (progresion tipo 2048): la menor potencia de 2
      // ausente, en el hueco de la primera pareja. El resto de huecos quedan vacios.
      var v = smallestAbsent(board);
      board[firstGap[0]][firstGap[1]] = v;
      fills.push({ at: [firstGap[0], firstGap[1]], value: v });
    }
    return {
      state: { board: board, score: state.score + gained },
      shifted: shifted, merges: merges, fills: fills, gained: gained,
      gameOver: gained > 0 && !hasDuplicate(board)
    };
  }

  return {
    N: N, SAVE_KEY: SAVE_KEY,
    newGame: newGame, cloneBoard: cloneBoard, maxTile: maxTile,
    hasDuplicate: hasDuplicate, findGroups: findGroups, smallestAbsent: smallestAbsent,
    move: move
  };
});
