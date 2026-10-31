/* Prisma - logica pura del juego (sin DOM). La usan prisma.html y tests/prisma-core.test.js */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.PrismaCore = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var R = 3; // radio del panal: 37 casillas
  var MIN_CHAIN = 3;
  var COLORS = ["coral", "ambar", "verde", "azul", "violeta"];
  var NUMS = [1, 2, 3, 4, 5];
  var SHAPES = ["circulo", "triangulo", "cuadrado", "rombo", "estrella"];
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

  function key(q, r){ return q + "," + r; }
  function parseKey(k){ var p = k.split(","); return [Number(p[0]), Number(p[1])]; }

  var CELLS = [];
  (function(){
    for (var q = -R; q <= R; q++){
      var r1 = Math.max(-R, -q - R), r2 = Math.min(R, -q + R);
      for (var r = r1; r <= r2; r++) CELLS.push([q, r]);
    }
  })();
  var CELL_SET = {};
  CELLS.forEach(function(c){ CELL_SET[key(c[0], c[1])] = true; });

  function neighbors(k){
    var qr = parseKey(k), out = [];
    for (var i = 0; i < DIRS.length; i++){
      var nk = key(qr[0] + DIRS[i][0], qr[1] + DIRS[i][1]);
      if (CELL_SET[nk]) out.push(nk);
    }
    return out;
  }

  function pick(arr, rng){ return arr[Math.floor(rng() * arr.length)]; }
  function randomTile(rng){
    return { color: pick(COLORS, rng), num: pick(NUMS, rng), shape: pick(SHAPES, rng) };
  }

  // Atributos que comparten dos fichas.
  function sharedAttrs(a, b){
    var out = [];
    if (a.color === b.color) out.push("color");
    if (a.num === b.num) out.push("num");
    if (a.shape === b.shape) out.push("shape");
    return out;
  }

  // Elige el atributo del enlace: compartido y distinto del enlace anterior.
  // Si hay varios, prefiere el que deja continuar la cadena.
  function chooseAttr(board, keys, k, shared, prevAttr){
    var cand = [];
    for (var i = 0; i < shared.length; i++){
      if (shared[i] !== prevAttr) cand.push(shared[i]);
    }
    if (!cand.length) return null;
    if (cand.length === 1) return cand[0];
    var nextKeys = keys.concat([k]);
    for (var c = 0; c < cand.length; c++){
      var ns = neighbors(k);
      for (var j = 0; j < ns.length; j++){
        var nk = ns[j];
        if (nextKeys.indexOf(nk) !== -1) continue;
        var s2 = sharedAttrs(board[k], board[nk]);
        for (var l = 0; l < s2.length; l++){
          if (s2[l] !== cand[c]) return cand[c];
        }
      }
    }
    return cand[0];
  }

  // Intenta anadir la casilla k a la cadena (keys + attrs de enlaces ya usados).
  function appendInfo(board, keys, attrs, k){
    if (!board[k]) return { ok: false, reason: "vacia" };
    if (keys.indexOf(k) !== -1) return { ok: false, reason: "repetida" };
    var last = keys[keys.length - 1];
    if (neighbors(last).indexOf(k) === -1) return { ok: false, reason: "no-vecina" };
    var prevAttr = attrs.length ? attrs[attrs.length - 1] : null;
    var shared = sharedAttrs(board[last], board[k]);
    var attr = chooseAttr(board, keys, k, shared, prevAttr);
    if (!attr) return { ok: false, reason: "mismo-atributo" };
    return { ok: true, attr: attr };
  }

  // Puntuacion: largo de la cadena y variedad de atributos usados.
  function scoreFor(len, attrs){
    var base = 5 * len * (len - 1);
    var seen = {};
    attrs.forEach(function(a){ seen[a] = true; });
    if (Object.keys(seen).length >= 3) base = Math.round(base * 1.5);
    return base;
  }

  // Quita las fichas de removedKeys, deja caer las de arriba y repone nuevas.
  // Devuelve el tablero nuevo, los movimientos (de->a) y las fichas creadas.
  function applyRemoval(board, removedKeys, rng){
    var removed = {};
    removedKeys.forEach(function(k){ removed[k] = true; });
    var byQ = {};
    CELLS.forEach(function(c){
      var q = c[0];
      if (!byQ[q]) byQ[q] = [];
      byQ[q].push(key(c[0], c[1]));
    });
    var moves = [], spawns = [], next = {};
    Object.keys(byQ).forEach(function(q){
      var col = byQ[q].slice().sort(function(a, b){ return parseKey(a)[1] - parseKey(b)[1]; });
      var surv = col.filter(function(k){ return !removed[k]; });
      var nGone = col.length - surv.length;
      surv.forEach(function(k, i){
        var to = col[nGone + i];
        next[to] = board[k];
        if (to !== k) moves.push({ from: k, to: to });
      });
      for (var i = 0; i < nGone; i++){
        var t = randomTile(rng);
        next[col[i]] = t;
        spawns.push({ to: col[i], tile: t, order: i });
      }
    });
    return { board: next, moves: moves, spawns: spawns };
  }

  // Hay alguna jugada posible (cadena de 3 con atributos alternos)?
  function hasAnyMove(board){
    for (var i = 0; i < CELLS.length; i++){
      var k = key(CELLS[i][0], CELLS[i][1]);
      var ns = neighbors(k);
      for (var j = 0; j < ns.length; j++){
        var m = ns[j];
        var s1 = sharedAttrs(board[k], board[m]);
        if (!s1.length) continue;
        var ns2 = neighbors(m);
        for (var l = 0; l < ns2.length; l++){
          var n2 = ns2[l];
          if (n2 === k) continue;
          var s2 = sharedAttrs(board[m], board[n2]);
          for (var a = 0; a < s1.length; a++){
            for (var b = 0; b < s2.length; b++){
              if (s1[a] !== s2[b]) return true;
            }
          }
        }
      }
    }
    return false;
  }

  function reshuffle(board, rng){
    var tiles = CELLS.map(function(c){ return board[key(c[0], c[1])]; });
    var out = {};
    for (var attempt = 0; attempt < 80; attempt++){
      for (var i = tiles.length - 1; i > 0; i--){
        var j = Math.floor(rng() * (i + 1));
        var tmp = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tmp;
      }
      out = {};
      CELLS.forEach(function(c, i){ out[key(c[0], c[1])] = tiles[i]; });
      if (hasAnyMove(out)) return out;
    }
    return out;
  }

  function newBoard(rng){
    var board = {};
    CELLS.forEach(function(c){ board[key(c[0], c[1])] = randomTile(rng); });
    if (!hasAnyMove(board)) board = reshuffle(board, rng);
    return board;
  }

  function validTile(t){
    return !!t && COLORS.indexOf(t.color) !== -1 && NUMS.indexOf(t.num) !== -1 && SHAPES.indexOf(t.shape) !== -1;
  }

  return {
    R: R, MIN_CHAIN: MIN_CHAIN, COLORS: COLORS, NUMS: NUMS, SHAPES: SHAPES,
    CELLS: CELLS, CELL_SET: CELL_SET,
    key: key, parseKey: parseKey, neighbors: neighbors,
    randomTile: randomTile, sharedAttrs: sharedAttrs, appendInfo: appendInfo,
    scoreFor: scoreFor, applyRemoval: applyRemoval,
    hasAnyMove: hasAnyMove, reshuffle: reshuffle, newBoard: newBoard, validTile: validTile
  };
});
