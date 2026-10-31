/* Desborde - logica pura del juego (sin DOM). La usan desborde.html y tests/desborde-core.test.js */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.DesbordeCore = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var N = 5;          // cuadricula de N x N
  var QUEUE_LEN = 3;  // siguientes piezas visibles
  var SAVE_KEY = "desborde-save-v1";

  function spawnValue(rng){ return 1 + Math.floor(rng() * 3); } // 1, 2 o 3

  function refillQueue(queue, rng){
    var q = queue.slice();
    while (q.length < QUEUE_LEN) q.push(spawnValue(rng));
    return q;
  }

  function newGame(rng){
    rng = rng || Math.random;
    var board = [];
    for (var r = 0; r < N; r++){
      var row = [];
      for (var c = 0; c < N; c++) row.push(spawnValue(rng));
      board.push(row);
    }
    return { board: board, queue: refillQueue([], rng), score: 0 };
  }

  function cloneBoard(b){ return b.map(function(row){ return row.slice(); }); }

  function maxTile(board){
    var m = 0;
    for (var r = 0; r < board.length; r++)
      for (var c = 0; c < board[r].length; c++)
        if (board[r][c] > m) m = board[r][c];
    return m;
  }

  // Rota la linea una posicion. dir=+1: hacia indices mayores (derecha/abajo);
  // lo que sale por el final entra por el principio.
  function rotateLine(line, dir){
    var n = line.length, out = new Array(n);
    for (var i = 0; i < n; i++){
      var from = (((i - dir) % n) + n) % n;
      out[i] = line[from];
    }
    return out;
  }

  // Colapsa los grupos de iguales consecutivos de la linea (los dos extremos NO
  // cuentan como vecinos). La ficha resultante queda en el extremo del grupo
  // hacia el que se movio; el resto de posiciones del grupo quedan vacias (null).
  function collapseLine(line, dir){
    var n = line.length;
    var out = line.slice();
    var merges = [];
    var gained = 0;
    var i = 0;
    while (i < n){
      var j = i;
      while (j + 1 < n && line[j + 1] === line[i]) j++;
      var len = j - i + 1;
      if (len >= 2){
        var sum = line[i] * len;
        var at = dir > 0 ? j : i;
        for (var k = i; k <= j; k++) out[k] = null;
        out[at] = sum;
        merges.push({ from: i, to: j, at: at, value: line[i], count: len, sum: sum });
        gained += sum;
      }
      i = j + 1;
    }
    return { line: out, merges: merges, gained: gained };
  }

  function getLine(board, type, index){
    if (type === "row") return board[index].slice();
    var line = [];
    for (var r = 0; r < board.length; r++) line.push(board[r][index]);
    return line;
  }

  function setLine(board, type, index, line){
    if (type === "row"){ board[index] = line.slice(); return; }
    for (var r = 0; r < board.length; r++) board[r][index] = line[r];
  }

  // Aplica un movimiento: rota la fila/columna, colapsa sus grupos y rellena
  // los huecos con la cola de siguientes. Devuelve el nuevo estado y detalles
  // para animar (merges y fresh en coordenadas [fila, columna]).
  function move(state, type, index, dir, rng){
    rng = rng || Math.random;
    var board = cloneBoard(state.board);
    var queue = state.queue.slice();
    var rotated = rotateLine(getLine(board, type, index), dir);
    var res = collapseLine(rotated, dir);
    var filled = res.line.slice();
    var fresh = [];
    for (var i = 0; i < filled.length; i++){
      if (filled[i] === null){
        // un grupo de 5 genera 4 huecos: si la cola se agota, sale pieza nueva
        filled[i] = queue.length ? queue.shift() : spawnValue(rng);
        fresh.push(i);
      }
    }
    queue = refillQueue(queue, rng);
    setLine(board, type, index, filled);
    var toRC = function(p){ return type === "row" ? [index, p] : [p, index]; };
    return {
      state: { board: board, queue: queue, score: state.score + res.gained },
      gained: res.gained,
      merges: res.merges.map(function(m){
        return { at: toRC(m.at), sum: m.sum, count: m.count, value: m.value };
      }),
      fresh: fresh.map(toRC),
      type: type, index: index, dir: dir
    };
  }

  return {
    N: N, QUEUE_LEN: QUEUE_LEN, SAVE_KEY: SAVE_KEY,
    spawnValue: spawnValue, refillQueue: refillQueue,
    newGame: newGame, cloneBoard: cloneBoard, maxTile: maxTile,
    rotateLine: rotateLine, collapseLine: collapseLine,
    getLine: getLine, setLine: setLine, move: move
  };
});
