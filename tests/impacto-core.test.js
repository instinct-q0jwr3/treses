/* Tests de impacto-core.js, sin dependencias: node tests/impacto-core.test.js
   Estrategia: se construye el tablero POST-rotacion con los grupos deseados (reparando
   colisiones con el fondo), se des-rota para obtener el tablero previo y se ejecuta move(). */
"use strict";
var C = require("../impacto-core.js");
var N = C.N, passed = 0, failed = 0;

function ok(cond, name){
  if (cond){ passed++; console.log("ok - " + name); }
  else { failed++; console.log("FALLO - " + name); }
}
function bg(){
  var b = [];
  for (var r = 0; r < N; r++){ var row = []; for (var c = 0; c < N; c++) row.push((r + c) % 4 + 1); b.push(row); }
  return b;
}
function rotate(b, type, index, dir){
  if (type === "row"){
    var line = b[index].slice();
    for (var i = 0; i < N; i++) b[index][i] = line[(((i - dir) % N) + N) % N];
  } else {
    var line = [];
    for (var r = 0; r < N; r++) line.push(b[r][index]);
    for (r = 0; r < N; r++) b[r][index] = line[(((r - dir) % N) + N) % N];
  }
  return b;
}
function sameBoard(a, b){
  for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (a[r][c] !== b[r][c]) return false;
  return true;
}
function groupKey(g){
  return g.value + ":" + g.cells.map(function(p){ return p[0] + "," + p[1]; }).join(";");
}

// wanted: [{value, cells:[[r,c]..]}] grupos exactos deseados tras rotar; protected: celdas intocables.
function craft(row, dir, wanted, protectedCells){
  var sim = bg();
  var wantedCells = {}, wantedKeys = {};
  wanted.forEach(function(g){
    g.cells.forEach(function(p){ wantedCells[p[0] + "," + p[1]] = true; sim[p[0]][p[1]] = g.value; });
    var sorted = { value: g.value, cells: g.cells.slice().sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; }) };
    wantedKeys[groupKey(sorted)] = true;
  });
  var prot = {};
  (protectedCells || []).forEach(function(p){ prot[p[0] + "," + p[1]] = true; sim[p[0]][p[1]] = p[2]; });
  function repairValue(cell, extraBad){ // pone un valor que no iguale vecinos ni extraBad
    for (var v = 1; v <= 8; v++){
      if (extraBad && extraBad[v]) continue;
      var bad = false;
      var nb = [[cell[0]+1,cell[1]],[cell[0]-1,cell[1]],[cell[0],cell[1]+1],[cell[0],cell[1]-1]];
      for (var q = 0; q < 4; q++){
        var nr = nb[q][0], nc = nb[q][1];
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && sim[nr][nc] === v) bad = true;
      }
      if (!bad){ sim[cell[0]][cell[1]] = v; return true; }
    }
    return false;
  }
  for (var iter = 0; iter < 800; iter++){
    var gs = C.findGroups(sim);
    var extras = gs.filter(function(g){ return !wantedKeys[groupKey(g)]; });
    var missing = Object.keys(wantedKeys).length !== gs.filter(function(g){ return wantedKeys[groupKey(g)]; }).length;
    var anchorClash = false;
    if (!extras.length && !missing){
      // la suma resultante no debe coincidir con vecinos ortogonales del ancla (evita oleada 2)
      wanted.forEach(function(g2){
        var sum = g2.value * g2.cells.length;
        var anchor = g2.cells[g2.cells.length - 1]; // dir=1: el mas a la derecha
        var bad = {}; bad[sum] = true;
        var nb = [[anchor[0]+1,anchor[1]],[anchor[0]-1,anchor[1]],[anchor[0],anchor[1]+1],[anchor[0],anchor[1]-1]];
        for (var q = 0; q < 4; q++){
          var nr = nb[q][0], nc = nb[q][1];
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          var k = nr + "," + nc;
          if (wantedCells[k] || prot[k]) continue;
          if (sim[nr][nc] === sum){ anchorClash = true; repairValue([nr, nc], bad); }
        }
      });
      if (!anchorClash) break;
    } else {
      if (!extras.length) return null;
      var g0 = extras[0], fixed = false;
      for (var j = 0; j < g0.cells.length && !fixed; j++){
        var cell = g0.cells[j], k = cell[0] + "," + cell[1];
        if (wantedCells[k] || prot[k]) continue;
        fixed = repairValue(cell, null);
      }
      if (!fixed) return null;
    }
    if (iter === 799) return null;
  }
  var pre = rotate(C.cloneBoard(sim), "row", row, -dir);
  return { pre: pre, sim: sim, row: row, dir: dir };
}

// 1. newGame
var g = C.newGame();
ok(g.board.length === N && g.board[0].length === N, "newGame es 10x10");
ok(g.board.every(function(row){ return row.every(function(v){ return v >= 1 && v <= 4; }); }), "newGame valores 1..4");
ok(C.findGroups(g.board).length === 0, "newGame sin iguales adyacentes");

// 2. Jugada limpia: sin grupos, rotacion circular exacta.
var c2 = null;
for (var r2 = 0; r2 < N && !c2; r2++) c2 = craft(r2, 1, [], []);
ok(!!c2, "tablero sin grupos tras rotar encontrado");
var res2 = C.move({ board: C.cloneBoard(c2.pre), score: 5, doses: 1 }, "row", c2.row, 1);
ok(!res2.reverted && res2.waves === 0 && res2.gained === 0 && res2.state.score === 5, "jugada limpia: sin oleadas ni puntos");
ok(sameBoard(res2.state.board, c2.sim), "rotacion circular exacta");

// 3. Pareja de doses: +4, ancla en linea movida, doses contados.
var c3 = craft(3, 1, [{ value: 2, cells: [[3, 4], [3, 5]] }], []);
ok(!!c3, "escenario pareja de doses");
var res3 = C.move({ board: C.cloneBoard(c3.pre), score: 10, doses: 0 }, "row", 3, 1);
ok(sameBoard(res3.steps[0].board, c3.sim), "la rotacion llega al tablero construido");
ok(!res3.reverted && res3.gained === 4 && res3.state.score === 14, "fusionar doses suma la suma (+4)");
ok(res3.state.doses === 2, "doses cazados contabilizados");
var m3 = res3.steps[1].merges[0];
ok(m3.at[0] === 3 && m3.at[1] === 5 && m3.tile === 4, "la suma queda en la linea movida, lo mas lejos en la direccion");

// 4. Pareja de treses: -6.
var c4 = craft(6, 1, [{ value: 3, cells: [[6, 2], [6, 3]] }], []);
ok(!!c4, "escenario pareja de treses");
var res4 = C.move({ board: C.cloneBoard(c4.pre), score: 10, doses: 0 }, "row", 6, 1);
ok(!res4.reverted && res4.gained === -1 && res4.state.score === 9, "fusionar otro valor resta 1 punto");
ok(res4.state.doses === 0, "otros valores no cuentan como doses");

// 5. Onda exacta: anillo radio 1 alrededor del ancla, ancla intacta, minimo 1.
var pre5 = res3.steps[res3.steps.length - 2].board;
var imp5 = res3.steps[res3.steps.length - 1].impact;
var ringOk = true;
for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++){
  if (dr === 0 && dc === 0) continue;
  var rr = m3.at[0] + dr, cc = m3.at[1] + dc;
  if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
  if (res3.state.board[rr][cc] !== Math.max(1, pre5[rr][cc] - 1)) ringOk = false;
}
ok(ringOk && imp5.length > 0, "la onda baja exactamente 1 al anillo (minimo 1)");
ok(res3.state.board[m3.at[0]][m3.at[1]] === 4, "el ancla no recibe su propia onda");
// y fuera del anillo nada cambia respecto al pre-impacto
var outsideOk = true;
var inRing = {};
imp5.forEach(function(h){ inRing[h.r + "," + h.c] = true; });
for (var r5 = 0; r5 < N; r5++) for (var c5 = 0; c5 < N; c5++){
  if (!inRing[r5 + "," + c5] && res3.state.board[r5][c5] !== pre5[r5][c5]) outsideOk = false;
}
ok(outsideOk, "fuera del anillo la onda no toca nada");

// 6. Trio de doses: radio 2.
var c6 = craft(1, 1, [{ value: 2, cells: [[1, 4], [1, 5], [1, 6]] }], []);
ok(!!c6, "escenario trio de doses");
var res6 = C.move({ board: C.cloneBoard(c6.pre), score: 0, doses: 0 }, "row", 1, 1);
var a6 = res6.steps[1].merges[0].at;
var expected6 = 0;
for (var dr6 = -2; dr6 <= 2; dr6++) for (var dc6 = -2; dc6 <= 2; dc6++){
  if (dr6 === 0 && dc6 === 0) continue;
  if (a6[0] + dr6 >= 0 && a6[0] + dr6 < N && a6[1] + dc6 >= 0 && a6[1] + dc6 < N) expected6++;
}
ok(res6.steps[res6.steps.length - 1].impact.length === expected6, "trio: onda de radio 2 (" + expected6 + " casillas)");
ok(res6.gained === 6, "trio de doses suma 6");

// 7. Minimo 1.
var c7 = craft(5, 1, [{ value: 2, cells: [[5, 4], [5, 5]] }], []);
var res7 = C.move({ board: C.cloneBoard(c7.pre), score: 0, doses: 0 }, "row", 5, 1);
ok(res7.state.board.every(function(row){ return row.every(function(v){ return v >= 1; }); }), "la onda nunca baja de 1");

// 8. La onda prepara (no fusiona): un 3 del anillo con un 2 vecino quedan 2+2 adyacentes.
var c8 = null, a8 = null, A8 = null, B8 = null;
for (var tryc = 1; tryc <= 6 && !c8; tryc++){
  var anchorGuess = [4, tryc + 1]; // ancla de la pareja [[4,tryc],[4,tryc+1]] con dir 1
  var A = [anchorGuess[0] + 1, anchorGuess[1] + 1];       // dentro del anillo
  var B = [anchorGuess[0] + 1, anchorGuess[1] + 2];       // vecino fuera del anillo
  if (B[1] >= N) continue;
  var attempt = craft(4, 1, [{ value: 2, cells: [[4, tryc], [4, tryc + 1]] }], [[A[0], A[1], 3], [B[0], B[1], 2]]);
  if (attempt){ c8 = attempt; a8 = anchorGuess; A8 = A; B8 = B; }
}
ok(!!c8, "escenario de onda preparatoria construido");
if (c8){
  var res8 = C.move({ board: C.cloneBoard(c8.pre), score: 0, doses: 0 }, "row", 4, 1);
  var vA = res8.state.board[A8[0]][A8[1]], vB = res8.state.board[B8[0]][B8[1]];
  ok(vA === 2 && vB === 2, "la onda iguala: 3->2 junto a un 2");
  var gs8 = C.findGroups(res8.state.board);
  var prepared = gs8.some(function(gg){
    return gg.value === 2 && gg.cells.some(function(p){ return p[0] === A8[0] && p[1] === A8[1]; }) &&
      gg.cells.some(function(p){ return p[0] === B8[0] && p[1] === B8[1]; });
  });
  ok(prepared, "los doses preparados NO fusionan en la misma jugada");
  var res8b = C.move(res8.state, "col", 0, 1);
  var fired = false;
  for (var si = 1; si < res8b.steps.length; si++){
    res8b.steps[si].merges.forEach(function(mm){ if (mm.value === 2) fired = true; });
  }
  ok(fired, "los doses preparados fusionan en la jugada siguiente");
}

// 9. Salvaguarda por presupuesto.
var res9 = C.move({ board: C.cloneBoard(c3.pre), score: 7, doses: 1 }, "row", 3, 1, 0);
ok(res9.reverted === true && res9.reason === "budget", "presupuesto 0 -> jugada revertida");
ok(res9.state.score === 7 && res9.state.doses === 1, "la reversion no toca puntos ni doses");

console.log("\n" + passed + " ok, " + failed + " fallos");
process.exit(failed ? 1 : 0);
