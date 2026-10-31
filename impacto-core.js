/* Impacto - logica pura del juego (sin DOM). La usan impacto.html y tests/impacto-core.test.js
   Variante disenada 2026-10-31 con criterio delegado por el usuario ("itera tu, hazlo jugable"):
   - Tablero 10x10, valores que crecen sin ciclo (3 + 3 = 6).
   - Un movimiento desplaza una fila o columna UNA casilla; lo que sale por un lado entra por el otro.
   - Al soltar, los grupos de iguales que se toquen (4-conectados) se fusionan en su suma.
     Anclaje: oleada 1 en la linea movida (la mas alejada en la direccion del movimiento);
     desde la oleada 2, la celda de mas arriba y mas a la izquierda del grupo.
   - Puntos: fusionar DOSES suma la suma; cualquier otra fusion resta 1 punto.
     (Equilibrio medido 2026-10-31: con tablero grande toda jugada fusiona algo; restar
     la suma o las fichas hace la puntuacion insalvable hasta jugando bien. Con -1 por
     fusion, juego al azar pierde despacio y juego atento sube. La onda es la otra perdida.)
   - Impacto: cada fusion suelta una onda desde la casilla de la suma con radio
     (fichas fusionadas - 1); toda casilla dentro del radio baja 1 (minimo 1), salvo el ancla.
     La onda se aplica al final de la jugada y NUNCA fusiona: puede dejar iguales adyacentes
     preparados (o estropeados) para la jugada siguiente.
   - Relleno: menor valor que no coincida con vecinos ya ocupados, de arriba abajo y de
     izquierda a derecha. Salvaguarda: estado repetido o presupuesto de oleadas -> jugada revertida. */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.ImpactoCore = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var N = 10;
  var SAVE_KEY = "impacto-save-v1";
  var TARGET = 2;         // unico valor que suma puntos al fusionarse
  var WAVE_BUDGET = 200;  // presupuesto de oleadas por jugada; si se supera o se repite
                          // un estado, la jugada se revierte entera (recuperacion, no prueba).

  function spawnValue(rng){ return 1 + Math.floor(rng() * 4); } // 1..4

  // Tablero inicial sin iguales adyacentes.
  function newGame(rng){
    rng = rng || Math.random;
    var board = [];
    for (var r = 0; r < N; r++){
      var row = [];
      for (var c = 0; c < N; c++){
        var v;
        do { v = spawnValue(rng); }
        while ((c > 0 && row[c - 1] === v) || (r > 0 && board[r - 1][c] === v));
        row.push(v);
      }
      board.push(row);
    }
    return { board: board, score: 0, doses: 0 };
  }

  function cloneBoard(b){ return b.map(function(row){ return row.slice(); }); }

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

  function inMovedLine(cell, type, index){ return type === "row" ? cell[0] === index : cell[1] === index; }

  function anchorFor(group, wave, type, index, dir){
    if (wave === 1){
      var inLine = group.cells.filter(function(cell){ return inMovedLine(cell, type, index); });
      if (inLine.length){
        var best = inLine[0];
        for (var i = 1; i < inLine.length; i++){
          var cell = inLine[i];
          if (type === "row"){
            if ((dir > 0 && cell[1] > best[1]) || (dir < 0 && cell[1] < best[1])) best = cell;
          } else {
            if ((dir > 0 && cell[0] > best[0]) || (dir < 0 && cell[0] < best[0])) best = cell;
          }
        }
        return best;
      }
    }
    return group.cells[0];
  }

  // Aplica las ondas al tablero estable: radio Chebyshev (cuadrado) alrededor de cada ancla,
  // el ancla queda excluida, cada onda baja 1 (minimo 1); las ondas se acumulan si se solapan.
  function applyImpacts(board, events){
    var hits = {};
    for (var e = 0; e < events.length; e++){
      var at = events[e].at, radius = events[e].radius;
      for (var dr = -radius; dr <= radius; dr++){
        for (var dc = -radius; dc <= radius; dc++){
          if (dr === 0 && dc === 0) continue;
          var r = at[0] + dr, c = at[1] + dc;
          if (r < 0 || r >= N || c < 0 || c >= N) continue;
          var k = r + "," + c;
          board[r][c] = Math.max(1, board[r][c] - 1);
          hits[k] = (hits[k] || 0) + 1;
        }
      }
    }
    var cells = [];
    for (var key in hits){
      var p = key.split(",");
      cells.push({ r: +p[0], c: +p[1], times: hits[key] });
    }
    cells.sort(function(a, b){ return a.r - b.r || a.c - b.c; });
    return cells;
  }

  // Movimiento completo: rotacion + oleadas + ondas al final.
  function move(state, type, index, dir, budgetOverride){
    var budget = (budgetOverride === undefined || budgetOverride === null) ? WAVE_BUDGET : budgetOverride;
    var board = cloneBoard(state.board);
    var line = [], i, r, c;
    if (type === "row"){ line = board[index].slice(); for (i = 0; i < N; i++) board[index][i] = line[(((i - dir) % N) + N) % N]; }
    else { for (r = 0; r < N; r++) line.push(board[r][index]); for (r = 0; r < N; r++) board[r][index] = line[(((r - dir) % N) + N) % N]; }

    var steps = [{ board: cloneBoard(board), merges: [], fresh: [], fills: [], gained: 0 }];
    var wave = 0, gained = 0, doses = 0, impacts = [];
    var seen = {};
    seen[JSON.stringify(board)] = true;
    while (true){
      var groups = findGroups(board);
      if (!groups.length) break;
      wave++;
      if (wave > budget) return { reverted: true, state: { board: cloneBoard(state.board), score: state.score, doses: state.doses || 0 }, waves: wave, reason: "budget" };
      var merges = [], fresh = [], waveGained = 0, j, cell;
      for (var g = 0; g < groups.length; g++){
        var group = groups[g];
        var at = anchorFor(group, wave, type, index, dir);
        var sum = group.value * group.cells.length;
        for (j = 0; j < group.cells.length; j++){
          cell = group.cells[j];
          if (cell[0] === at[0] && cell[1] === at[1]) board[cell[0]][cell[1]] = sum;
          else { board[cell[0]][cell[1]] = null; fresh.push(cell); }
        }
        merges.push({ at: at, sum: sum, tile: sum, count: group.cells.length, value: group.value, cells: group.cells });
        waveGained += (group.value === TARGET) ? sum : -1; // doses suman la suma; otras fusiones cuestan 1
        if (group.value === TARGET) doses += group.cells.length;
        impacts.push({ at: at, radius: group.cells.length - 1 });
      }
      fresh.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
      var fills = [];
      for (j = 0; j < fresh.length; j++){
        cell = fresh[j];
        var bad = {};
        var nb = [[cell[0]+1,cell[1]],[cell[0]-1,cell[1]],[cell[0],cell[1]+1],[cell[0],cell[1]-1]];
        for (var k = 0; k < 4; k++){
          var nr = nb[k][0], nc = nb[k][1];
          if (nr >= 0 && nr < N && nc >= 0 && nc < N && board[nr][nc] !== null) bad[board[nr][nc]] = true;
        }
        var v = 1;
        while (bad[v]) v++;
        board[cell[0]][cell[1]] = v;
        fills.push({ at: cell, value: v });
      }
      gained += waveGained;
      steps.push({ board: cloneBoard(board), merges: merges, fresh: fresh, fills: fills, gained: waveGained });
      var key = JSON.stringify(board);
      if (seen[key]) return { reverted: true, state: { board: cloneBoard(state.board), score: state.score, doses: state.doses || 0 }, waves: wave, reason: "loop" };
      seen[key] = true;
    }
    // Ondas al final de la jugada: nunca fusionan, solo bajan valores.
    var impacted = applyImpacts(board, impacts);
    steps.push({ board: cloneBoard(board), merges: [], fresh: [], fills: [], gained: 0, impact: impacted });
    return {
      reverted: false,
      state: { board: board, score: state.score + gained, doses: (state.doses || 0) + doses },
      steps: steps, gained: gained, doses: doses, waves: wave
    };
  }

  return {
    N: N, SAVE_KEY: SAVE_KEY, TARGET: TARGET, WAVE_BUDGET: WAVE_BUDGET,
    newGame: newGame, cloneBoard: cloneBoard,
    findGroups: findGroups, anchorFor: anchorFor, applyImpacts: applyImpacts, move: move
  };
});
