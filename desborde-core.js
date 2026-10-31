/* Desborde - logica pura del juego (sin DOM). La usan desborde.html y tests/desborde-core.test.js
   Reglas acordadas con el usuario (variante aprobada el 2026-10-31):
   - Tablero 5x5 con valores del 1 al 7 en ciclo: si una suma pasa de 7, vuelve al principio
     (8 -> 1, 9 -> 2, ...). Al empezar cada turno nunca hay dos iguales adyacentes.
   - Un movimiento desplaza una fila o columna UNA casilla; lo que sale por un lado entra por el otro.
   - Al soltar, los grupos de iguales que se toquen (4-conectados) se fusionan en su suma (con ciclo).
     Si varios grupos se cruzan, todo el grupo conectado se fusiona en una ficha.
   - Oleada 1: la suma queda en la celda del grupo que esta en la linea movida; si hay varias, en la
     mas alejada en la direccion del movimiento. Desde la oleada 2: en la celda de mas arriba y mas
     a la izquierda del grupo (ajuste aprobado por el usuario el 2026-10-31 tras medir bucles).
   - Cada hueco se rellena, de arriba abajo y de izquierda a derecha, con el MENOR valor que no
     coincida con sus vecinos ya ocupados: el relleno nunca crea parejas; solo las fichas fusionadas
     pueden provocar las oleadas siguientes. Cascadas hasta estabilizar antes de otro movimiento.
   - Sin reloj, sin game over, con deshacer. Puntos: la suma completa de cada fusion, aunque la ficha
     vuelva al principio del ciclo. */
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.DesbordeCore = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  "use strict";

  var N = 5;
  var SAVE_KEY = "desborde-save-v2";
  var MOD = 7;            // ciclo de valores 1..MOD
  var WAVE_BUDGET = 200;  // presupuesto de oleadas por jugada; maximo observado en simulacion: 37.
                          // Si se supera o se repite un estado, la jugada se revierte entera.

  function spawnValue(rng){ return 1 + Math.floor(rng() * 3); } // 1, 2 o 3

  // Tablero inicial sin iguales adyacentes (invariante de inicio de turno).
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
    return { board: board, score: 0 };
  }

  function cloneBoard(b){ return b.map(function(row){ return row.slice(); }); }

  function maxTile(board){
    var m = 0;
    for (var r = 0; r < board.length; r++)
      for (var c = 0; c < board[r].length; c++)
        if (board[r][c] > m) m = board[r][c];
    return m;
  }

  // Grupos 4-conectados de iguales con 2+ celdas. Celdas y grupos ordenados
  // fila-columna para que todo lo demas sea determinista.
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

  // Celda donde queda la suma. Ver reglas en la cabecera.
  function anchorFor(group, wave, type, index, dir, created){
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
    // Desde la segunda oleada: la celda de mas arriba y mas a la izquierda del grupo
    // (cells ya viene ordenado fila-columna). Ajuste aprobado por el usuario: con anclaje
    // en la ficha provocadora ~1,5% de jugadas entraban en bucle; con esta, 0,07% en simulacion.
    return group.cells[0];
  }

  // Aplica un movimiento completo: rota una casilla y resuelve todas las oleadas.
  // Devuelve estado final estable y los pasos para animar (steps[0] = tablero rotado).
  // Salvaguarda: si una cascada repite un estado del tablero (bucle determinista) o supera
  // el presupuesto de oleadas, la jugada se revierte entera al estado estable anterior
  // (reverted=true, sin tocar puntos ni tablero). No es una prueba de terminacion: es una
  // recuperacion segura que nunca deja pares activos ni congela la partida.
  function move(state, type, index, dir, budgetOverride){
    var budget = budgetOverride || WAVE_BUDGET;
    var board = cloneBoard(state.board);
    var line = [], i, r, c;
    if (type === "row"){ line = board[index].slice(); for (i = 0; i < N; i++) board[index][i] = line[(((i - dir) % N) + N) % N]; }
    else { for (r = 0; r < N; r++) line.push(board[r][index]); for (r = 0; r < N; r++) board[r][index] = line[(((r - dir) % N) + N) % N]; }

    var steps = [{ board: cloneBoard(board), merges: [], fresh: [], gained: 0 }];
    var created = {}, wave = 0, gained = 0;
    var seen = {};
    seen[JSON.stringify(board)] = true;
    while (true){
      var groups = findGroups(board);
      if (!groups.length) break;
      wave++;
      if (wave > budget) return { reverted: true, state: { board: cloneBoard(state.board), score: state.score }, waves: wave, reason: "budget" };
      var merges = [], fresh = [], waveGained = 0, newCreated = [], j, cell;
      for (var g = 0; g < groups.length; g++){
        var group = groups[g];
        var at = anchorFor(group, wave, type, index, dir, created);
        var sum = group.value * group.cells.length;
        var wrapped = ((sum - 1) % MOD) + 1;
        for (j = 0; j < group.cells.length; j++){
          cell = group.cells[j];
          if (cell[0] === at[0] && cell[1] === at[1]) board[cell[0]][cell[1]] = wrapped;
          else { board[cell[0]][cell[1]] = null; fresh.push(cell); }
        }
        newCreated.push(at);
        merges.push({ at: at, sum: sum, tile: wrapped, count: group.cells.length, value: group.value, cells: group.cells });
        waveGained += sum; // puntos con la suma completa, aunque la ficha vuelva al principio del ciclo
      }
      // Relleno: menor valor que no coincida con vecinos ya ocupados, en orden fila-columna.
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
        while (bad[v]) v++; // siempre existe: MOD=7 > 4 vecinos
        board[cell[0]][cell[1]] = v;
        fills.push({ at: cell, value: v });
      }
      var createdMap = {};
      for (j = 0; j < newCreated.length; j++) createdMap[newCreated[j][0] + "," + newCreated[j][1]] = true;
      created = createdMap;
      gained += waveGained;
      steps.push({ board: cloneBoard(board), merges: merges, fresh: fresh, fills: fills, gained: waveGained });
      var key = JSON.stringify(board);
      if (seen[key]) return { reverted: true, state: { board: cloneBoard(state.board), score: state.score }, waves: wave, reason: "loop" };
      seen[key] = true;
    }
    return {
      reverted: false,
      state: { board: board, score: state.score + gained },
      steps: steps, gained: gained, waves: wave
    };
  }

  return {
    N: N, SAVE_KEY: SAVE_KEY, MOD: MOD, WAVE_BUDGET: WAVE_BUDGET,
    newGame: newGame, cloneBoard: cloneBoard, maxTile: maxTile,
    findGroups: findGroups, anchorFor: anchorFor, move: move
  };
});
