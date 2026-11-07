/* El inversor a ciegas — motor de simulación.
 * Datos: S&P 500 (^GSPC), cierres mensuales, índice de precios (sin dividendos).
 * Fuente: Yahoo Finance, histórico ^GSPC (https://finance.yahoo.com/quote/%5EGSPC/history).
 * Época de la partida 1: junio 2007 – mayo 2009 (24 meses).
 * UMD: usable desde el navegador (window.BolsaEngine) y desde node (module.exports) para pruebas.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BolsaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var DATA = {
    startCapital: 10000,
    feeRate: 0.005,          // parámetro del juego, no una tarifa real
    withdrawalMonth: 12,     // gasto previsto al inicio del mes 12
    withdrawalAmount: 1500,
    goal: 7500,
    nMonths: 24,
    // Cierres mensuales reales del S&P 500: mayo 2007 .. mayo 2009 (25 puntos).
    closes: [1530.62, 1503.35, 1455.27, 1473.99, 1526.75, 1549.38,
             1481.14, 1468.36, 1378.55, 1330.63, 1322.70, 1385.59,
             1400.38, 1280.00, 1267.38, 1282.83, 1166.36, 968.75,
             896.24, 903.25, 825.88, 735.09, 797.87, 872.81, 919.14],
    // Mes real de cada turno (para el repaso final; oculto durante la partida).
    realMonths: ['jun 2007', 'jul 2007', 'ago 2007', 'sep 2007', 'oct 2007', 'nov 2007',
                 'dic 2007', 'ene 2008', 'feb 2008', 'mar 2008', 'abr 2008', 'may 2008',
                 'jun 2008', 'jul 2008', 'ago 2008', 'sep 2008', 'oct 2008', 'nov 2008',
                 'dic 2008', 'ene 2009', 'feb 2009', 'mar 2009', 'abr 2009', 'may 2009'],
    // Acontecimientos reales de cada mes, redactados sin nombres propios para no desvelar la época.
    // Se muestran DESPUÉS de resolver el mes: nunca dan información del futuro.
    events: [
      'Dos fondos de inversión de un gran banco, cargados de hipotecas de alto riesgo, admiten estar en serios problemas.',
      'Las bolsas corrigen con fuerza a final de mes por el miedo al crédito hipotecario.',
      'Un gran banco europeo congela tres fondos por no poder valorar sus activos. Los bancos centrales inyectan liquidez de emergencia.',
      'Un banco británico sufre una retirada masiva de depósitos y necesita apoyo público. El banco central americano baja tipos medio punto.',
      'El mercado marca un nuevo máximo histórico, mientras los bancos anuncian miles de millones en pérdidas hipotecarias.',
      'Dimite el presidente de uno de los mayores bancos del mundo tras enormes depreciaciones.',
      'Los bancos centrales coordinan subastas de liquidez. El mercado sigue nervioso.',
      'Lunes negro en las bolsas mundiales. Al día siguiente, el banco central recorta tipos 0,75 puntos de emergencia, fuera de calendario.',
      'El Gobierno americano firma un plan de estímulo de 152.000 millones. Reino Unido nacionaliza un banco hipotecario.',
      'Uno de los cinco grandes bancos de inversión se hunde en días y es vendido a precio simbólico con aval público.',
      'El FMI calcula que las pérdidas de la crisis pueden acercarse al billón de dólares. Las bolsas rebotan con alivio.',
      'El petróleo roza los 130 dólares el barril. La inflación preocupa tanto como el crédito.',
      'El petróleo supera los 140 dólares y las bolsas caen con fuerza otra vez.',
      'Quiebra un banco regional americano y cunde el pánico sobre los dos gigantes hipotecarios semipúblicos.',
      'Mes de relativa calma en el mercado, con el foco en el sector inmobiliario.',
      'Terremoto: el Estado se hace con los gigantes hipotecarios, un banco de inversión de 158 años se declara en quiebra y la mayor aseguradora es rescatada en horas.',
      'Pánico global: el peor mes en décadas. Los gobiernos recapitalizan bancos y el banco central baja tipos al 1 %.',
      'El mercado toca mínimos de 11 años. Otro gran banco necesita un rescate masivo.',
      'El banco central lleva los tipos prácticamente a cero. Estalla un fraude piramidal histórico de 50.000 millones.',
      'Cambio de presidente en EE UU. La banca sigue necesitando ayudas y el mercado cae con fuerza otro mes.',
      'Se firma un plan de estímulo de 787.000 millones. El Estado toma una gran participación en un banco rescatado.',
      'El mercado toca fondo un día 9, en mínimos de 12 años, y rebota con violencia. El banco central anuncia compras masivas de bonos.',
      'El rebote continúa: el mejor mes en años. Los resultados bancarios empiezan a dar tregua.',
      'Las autoridades publican las pruebas de estrés de los grandes bancos. El mercado encadena su tercer mes de subidas.'
    ],
    reveal: {
      title: 'Era junio de 2007 a mayo de 2009: la gran crisis financiera',
      text: 'El índice era el S&P 500. En esos 24 meses perdió alrededor de un 40 % (índice de precios, sin dividendos): tocó máximo histórico en octubre de 2007, se hundió tras la quiebra de Lehman Brothers en septiembre de 2008 y tocó fondo el 9 de marzo de 2009, en mínimos de 12 años.',
      sources: [
        { label: 'Datos del índice: S&P 500 (^GSPC), cierres mensuales — Yahoo Finance', url: 'https://finance.yahoo.com/quote/%5EGSPC/history' },
        { label: 'Cronología: Crisis financiera de 2007-2008 — Wikipedia', url: 'https://es.wikipedia.org/wiki/Crisis_financiera_de_2008' }
      ]
    }
  };

  // decisions: array de 24 fracciones (0..1) objetivo en el fondo índice,
  // aplicadas al INICIO de cada mes, antes de conocer la rentabilidad de ese mes.
  function simulate(decisions, opts) {
    opts = opts || {};
    var fee = DATA.feeRate;
    var wMonth = opts.withdrawalMonth !== undefined ? opts.withdrawalMonth : DATA.withdrawalMonth;
    var wAmount = opts.withdrawalAmount !== undefined ? opts.withdrawalAmount : DATA.withdrawalAmount;
    var cash = DATA.startCapital, idx = 0, totalFees = 0, withdrawnTotal = 0;
    var rows = [];
    var nav = 100, peak = 100, maxDD = 0;
    var navSeries = [100];
    var n = Math.min(decisions.length, DATA.nMonths);
    for (var t = 1; t <= n; t++) {
      var V = cash + idx;
      var d = Math.min(1, Math.max(0, decisions[t - 1]));
      var targetIdx = d * V;
      var moved = Math.abs(targetIdx - idx);
      var f = moved * fee;
      totalFees += f;
      idx = targetIdx;
      cash = V - idx;
      if (cash >= f) cash -= f; else { idx -= (f - cash); cash = 0; }
      var wout = 0, monthFee = f;
      if (t === wMonth && wAmount > 0) {
        var need = wAmount;
        wout = Math.min(cash, need); cash -= wout; need -= wout;
        if (need > 1e-9) {
          var s = Math.min(idx, need);
          idx -= s; wout += s;
          var wf = s * fee; totalFees += wf; monthFee += wf;
          if (cash >= wf) cash -= wf; else { idx -= (wf - cash); cash = 0; }
        }
        withdrawnTotal += wout;
      }
      var base = cash + idx; // valor tras decisiones, costes y gasto, antes del mes
      var r = DATA.closes[t] / DATA.closes[t - 1] - 1;
      idx *= (1 + r);
      var Vend = cash + idx;
      var ret = base > 1e-9 ? Vend / base - 1 : 0;
      nav *= (1 + ret);
      if (nav > peak) peak = nav;
      var dd = (peak - nav) / peak;
      if (dd > maxDD) maxDD = dd;
      rows.push({ t: t, cash: cash, idx: idx, value: Vend, fee: monthFee, withdrawn: wout, marketRet: r, nav: nav });
      navSeries.push(nav);
    }
    var final = cash + idx;
    return {
      rows: rows,
      final: final,
      // Variación del saldo: incluye el gasto retirado. NO es la rentabilidad de la inversión.
      totalReturn: final / DATA.startCapital - 1,
      // Rentabilidad de la inversión ajustada por flujos: el gasto retirado no cuenta como pérdida.
      flowReturn: nav / 100 - 1,
      maxDrawdown: maxDD,
      totalFees: totalFees,
      withdrawnTotal: withdrawnTotal,
      navSeries: navSeries,
      goalMet: final >= DATA.goal
    };
  }

  function buyAndHold(opts) {
    var d = []; for (var i = 0; i < DATA.nMonths; i++) d.push(1);
    return simulate(d, opts);
  }
  function allCash(opts) {
    var d = []; for (var i = 0; i < DATA.nMonths; i++) d.push(0);
    return simulate(d, opts);
  }


  /* Búsqueda de la mejor estrategia posible CONOCIENDO el futuro (solo para la revelación final).
   * optimize(params): búsqueda exhaustiva con poda por cota teórica.
   *   params: { closes (n+1 puntos), nMonths, feeRate, withdrawalMonth, withdrawalAmount,
   *             startCapital, choices (fracciones permitidas) }
   * La poda solo descarta una rama cuando ni regalando las comisiones y acertando el mejor
   * movimiento posible cada mes restante podría superar la mejor solución ya encontrada,
   * así que el resultado es el óptimo exacto bajo estas reglas (verificado en test/ con
   * enumeración completa sin poda en casos pequeños).
   * Devuelve { decisions, final, stats:{nodes, leaves, pruned} }.
   */
  function optimize(params) {
    var closes = params.closes, n = params.nMonths, fee = params.feeRate;
    var wMonth = params.withdrawalMonth, wAmount = params.withdrawalAmount;
    if (wMonth > n || wMonth < 1) wAmount = 0;   // gasto fuera del horizonte: no aplica
    var choices = params.choices;
    var r = [], m = [], i, t, k;
    for (i = 1; i <= n; i++) { r.push(closes[i] / closes[i - 1] - 1); m.push(Math.max(1, 1 + r[i - 1])); }
    var P = []; P[n + 1] = 1;              // P[t] = mejor multiplicador posible de los meses t..n
    for (t = n; t >= 1; t--) P[t] = P[t + 1] * m[t - 1];
    function bound(t, V) {                 // cota optimista del valor final desde el inicio del mes t con valor V
      if (t > n) return V;
      if (t > wMonth || wAmount <= 0) return V * P[t];
      var pre = 1;                          // crecimiento optimista hasta el mes del gasto (excluido)
      for (k = t; k < wMonth; k++) pre *= m[k - 1];
      return Math.max(0, V * pre - wAmount) * m[wMonth - 1] * P[wMonth + 1];
    }
    function step(cash, idx, d, t) {        // misma transición mensual que simulate()
      var V = cash + idx;
      var target = d * V;
      var f = Math.abs(target - idx) * fee;
      idx = target; cash = V - idx;
      if (cash >= f) cash -= f; else { idx -= (f - cash); cash = 0; }
      if (t === wMonth && wAmount > 0) {
        var need = wAmount;
        var wout = Math.min(cash, need); cash -= wout; need -= wout;
        if (need > 1e-9) {
          var s = Math.min(idx, need);
          idx -= s;
          var wf = s * fee;
          if (cash >= wf) cash -= wf; else { idx -= (wf - cash); cash = 0; }
        }
      }
      idx *= (1 + r[t - 1]);
      return [cash, idx];
    }
    var stats = { nodes: 0, leaves: 0, pruned: 0 };
    var best = -Infinity, bestPath = null, path = [];
    function solve(t, cash, idx) {
      stats.nodes++;
      if (t > n) {
        stats.leaves++;
        var v = cash + idx;
        if (v > best + 1e-9) { best = v; bestPath = path.slice(); }
        return;
      }
      if (bound(t, cash + idx) <= best + 1e-6) { stats.pruned++; return; }
      var kids = [], j;
      for (j = 0; j < choices.length; j++) {
        var st = step(cash, idx, choices[j], t);
        kids.push({ d: choices[j], cash: st[0], idx: st[1], b: bound(t + 1, st[0] + st[1]) });
      }
      kids.sort(function (a, b) { return b.b - a.b; });   // primero lo más prometedor: buena solución temprano
      for (j = 0; j < kids.length; j++) {
        path.push(kids[j].d);
        solve(t + 1, kids[j].cash, kids[j].idx);
        path.pop();
      }
    }
    solve(1, params.startCapital, 0);
    return { decisions: bestPath, final: best, stats: stats };
  }

  // Óptimo de la partida real: las 5 opciones de los botones, reglas y datos del juego.
  function computeOptimal() {
    return optimize({
      closes: DATA.closes, nMonths: DATA.nMonths, feeRate: DATA.feeRate,
      withdrawalMonth: DATA.withdrawalMonth, withdrawalAmount: DATA.withdrawalAmount,
      startCapital: DATA.startCapital, choices: [0, 0.25, 0.5, 0.75, 1]
    });
  }

  return { DATA: DATA, simulate: simulate, buyAndHold: buyAndHold, allCash: allCash, optimize: optimize, computeOptimal: computeOptimal };
});
