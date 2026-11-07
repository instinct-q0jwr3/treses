// Pruebas del motor de "El inversor a ciegas". Ejecutar: node test/bolsa-engine.test.js
var E = require('../bolsa-engine.js');
var D = E.DATA;

var fallos = 0;
function ok(cond, msg) {
  if (cond) { console.log('  OK  ' + msg); }
  else { fallos++; console.log('FALLO ' + msg); }
}
function cerca(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (esperado ~' + b.toFixed(2) + ', obtenido ' + a.toFixed(2) + ')'); }

var ones = [], zeros = [], i;
for (i = 0; i < 24; i++) { ones.push(1); zeros.push(0); }

console.log('1. Comprar y mantener, sin gasto (forma cerrada calculada a mano)');
var bh0 = E.buyAndHold({ withdrawalAmount: 0 });
// 10.000 - 0,5% = 9.950 invertidos; multiplicador real del S&P 500 jun07..may09:
cerca(bh0.final, 9950 * D.closes[24] / D.closes[0], 0.5, 'valor final comprar/mantener sin gasto');
cerca(bh0.totalFees, 50, 0.01, 'comisiones = 0,5% de la entrada inicial');
// Caída máxima del índice: de 1549,38 (oct 2007) a 735,09 (feb 2009) = 52,56%
cerca(bh0.maxDrawdown, 1 - 735.09 / 1549.38, 0.001, 'caída máxima = caída real del índice (oct 2007 -> feb 2009)');

console.log('2. Primer mes a mano (todo al índice)');
var r1 = D.closes[1] / D.closes[0] - 1; // rentabilidad real jun 2007
cerca(bh0.rows[0].value, 9950 * (1 + r1), 0.01, 'mes 1: 9.950 x (1 + rentabilidad real jun 2007)');
cerca(bh0.rows[0].marketRet, r1, 1e-12, 'rentabilidad del mes 1 = cierres reales');

console.log('3. Sin anticipación del futuro: la decisión del mes 6 no cambia los meses 1-5');
var a = ones.slice(); a[5] = 0;
var b = ones.slice(); b[5] = 1;
var sa = E.simulate(a, { withdrawalAmount: 0 }), sb = E.simulate(b, { withdrawalAmount: 0 });
var iguales = true;
for (i = 0; i < 5; i++) if (Math.abs(sa.rows[i].value - sb.rows[i].value) > 1e-9) iguales = false;
ok(iguales, 'meses 1-5 idénticos cambie lo que cambie la decisión del mes 6');
ok(Math.abs(sa.rows[5].value - sb.rows[5].value) > 1, 'el mes 6 sí cambia con su decisión');

console.log('4. Todo en efectivo');
var ac = E.allCash();
cerca(ac.final, 8500, 0.01, 'final = 10.000 - 1.500 del gasto del mes 12');
cerca(ac.totalFees, 0, 1e-9, 'sin comisiones');
cerca(ac.maxDrawdown, 0, 1e-12, 'sin caída');
cerca(ac.flowReturn, 0, 1e-12, 'rentabilidad de la inversión = 0 % (el gasto no es pérdida)');
cerca(ac.totalReturn, -0.15, 1e-9, 'variación del saldo = -15 % (sí descuenta el gasto)');

console.log('5. Comprar y mantener con gasto del mes 12 (todo índice: venta forzosa con coste)');
var bh = E.buyAndHold();
ok(bh.flowReturn > bh.totalReturn, 'rentabilidad ajustada por flujos menos negativa que la variación del saldo');
// a mano: cada mes la base es el valor anterior menos comisiones y gasto de ese mes
var navEsp = 100;
for (i = 0; i < 24; i++) {
  var prev = i > 0 ? bh.rows[i - 1].value : D.startCapital;
  navEsp *= bh.rows[i].value / (prev - bh.rows[i].fee - bh.rows[i].withdrawn);
}
cerca(bh.flowReturn, navEsp / 100 - 1, 0.001, 'flowReturn coincide con el NAV compuesto a mano');
ok(bh.rows[11].withdrawn > 1499 && bh.rows[11].withdrawn <= 1500.01, 'se retiran 1.500 en el mes 12');
ok(bh.totalFees > 57, 'comisiones incluyen la entrada (50) y la venta forzosa (~7,5)');
ok(bh.final < bh0.final, 'el gasto reduce el valor final');

console.log('6. Mitad y mitad fijo queda entre los extremos');
var half = []; for (i = 0; i < 24; i++) half.push(0.5);
var sh = E.simulate(half);
ok(sh.final < ac.final && sh.final > bh.final, '50/50 termina entre efectivo e índice');
ok(sh.maxDrawdown < bh.maxDrawdown && sh.maxDrawdown > 0, '50/50 cae menos que todo-índice');

console.log('7. Coste de moverse visible y correcto');
var sw = zeros.slice(); sw[0] = 1; sw[1] = 0; // entrar todo mes 1, salir todo mes 2
var ss = E.simulate(sw, { withdrawalAmount: 0 });
cerca(ss.totalFees, 50 + 0.005 * (9950 * (1 + r1)), 0.5, 'comisión de salida = 0,5% del importe movido');

console.log('8. Datos');
ok(D.closes.length === 25, '25 cierres mensuales reales (mayo 2007 a mayo 2009)');
ok(D.events.length === 24 && D.realMonths.length === 24, '24 acontecimientos y 24 meses reales');
ok(D.closes[0] === 1530.62 && D.closes[24] === 919.14, 'cierres extremos correctos');

console.log('9. Estrategia mixta: el gasto no distorsiona la rentabilidad');
var mix = []; for (i = 0; i < 24; i++) mix.push(0.5);
var sm = E.simulate(mix);
ok(sm.flowReturn > sm.totalReturn, '50/50: flowReturn > variación del saldo');
ok(sm.flowReturn < 0 && sm.flowReturn > -0.35, '50/50: rentabilidad de inversión en rango razonable');


console.log('10. Optimizador: casos pequenos contra enumeracion completa independiente');
// Fuerza bruta sin poda ni cotas, con su propia copia de las reglas: si la poda del
// optimizador descartara algo mejorable, aqui saldria un valor distinto.
function pasoBruto(cash, idx, d, t, fee, wMonth, wAmount, r) {
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
function bruto(params) {
  var r = [];
  for (var i = 1; i <= params.nMonths; i++) r.push(params.closes[i] / params.closes[i - 1] - 1);
  var best = -Infinity, bestD = null, path = [];
  (function rec(t, cash, idx) {
    if (t > params.nMonths) {
      var v = cash + idx;
      if (v > best + 1e-9) { best = v; bestD = path.slice(); }
      return;
    }
    for (var j = 0; j < params.choices.length; j++) {
      var st = pasoBruto(cash, idx, params.choices[j], t, params.feeRate, params.withdrawalMonth, params.withdrawalAmount, r);
      path.push(params.choices[j]);
      rec(t + 1, st[0], st[1]);
      path.pop();
    }
  })(1, params.startCapital, 0);
  return { final: best, decisions: bestD };
}
var CH = [0, 0.25, 0.5, 0.75, 1];
function casoPeq(nombre, params, finalEsp, decEsp) {
  var o = E.optimize(params), b = bruto(params);
  cerca(o.final, b.final, 1e-6, nombre + ': optimize = enumeracion completa');
  if (finalEsp !== null) cerca(o.final, finalEsp, 0.01, nombre + ': valor esperado a mano');
  if (decEsp) ok(JSON.stringify(o.decisions) === JSON.stringify(decEsp), nombre + ': decisiones esperadas');
}
casoPeq('2 meses alcistas', { closes: [100, 110, 121], nMonths: 2, feeRate: 0.005, withdrawalMonth: 12, withdrawalAmount: 0, startCapital: 10000, choices: CH }, 12039.50, [1, 1]);
casoPeq('2 meses bajistas', { closes: [100, 90, 81], nMonths: 2, feeRate: 0.005, withdrawalMonth: 12, withdrawalAmount: 0, startCapital: 10000, choices: CH }, 10000, [0, 0]);
casoPeq('sube y baja', { closes: [100, 110, 99], nMonths: 2, feeRate: 0.005, withdrawalMonth: 12, withdrawalAmount: 0, startCapital: 10000, choices: CH }, 10890.28, [1, 0]);
casoPeq('gasto en mes bajista: mejor todo efectivo', { closes: [100, 90], nMonths: 1, feeRate: 0.005, withdrawalMonth: 1, withdrawalAmount: 1500, startCapital: 10000, choices: CH }, 8500, [0]);
casoPeq('mercado plano: moverse solo cuesta', { closes: [100, 100, 100], nMonths: 2, feeRate: 0.005, withdrawalMonth: 12, withdrawalAmount: 0, startCapital: 10000, choices: CH }, 10000, [0, 0]);
casoPeq('4 meses mixtos con gasto en el 3', { closes: [100, 105, 95, 105, 100], nMonths: 4, feeRate: 0.005, withdrawalMonth: 3, withdrawalAmount: 1500, startCapital: 10000, choices: CH }, null, null);
casoPeq('8 meses con datos reales y gasto en el 6', { closes: D.closes.slice(0, 9), nMonths: 8, feeRate: D.feeRate, withdrawalMonth: 6, withdrawalAmount: 1500, startCapital: 10000, choices: CH }, null, null);
casoPeq('sin gasto (importe 0)', { closes: [100, 105, 95, 105], nMonths: 3, feeRate: 0.005, withdrawalMonth: 2, withdrawalAmount: 0, startCapital: 10000, choices: CH }, null, null);

console.log('11. Optimo de la partida real (24 meses, reglas del juego)');
var opt = E.computeOptimal();
var optSim = E.simulate(opt.decisions);
ok(opt.decisions.length === 24, 'devuelve 24 decisiones');
var validas = opt.decisions.every(function (d) { return CH.indexOf(d) >= 0; });
ok(validas, 'todas las decisiones son de las 5 opciones del juego');
cerca(optSim.final, opt.final, 1e-6, 'simulate() reproduce el valor final del optimo');
cerca(optSim.withdrawnTotal, 1500, 0.01, 'el optimo tambien atiende el gasto del mes 12');
ok(opt.final > ac.final, 'supera a todo en efectivo (hubo meses ganadores)');
ok(opt.final > bh.final && opt.final > sh.final, 'supera a comprar-mantener y a 50/50');
var peor = true;
for (i = 0; i < 300; i++) {
  var rnd = [];
  for (var j = 0; j < 24; j++) rnd.push(CH[Math.floor(Math.random() * 5)]);
  if (E.simulate(rnd).final > opt.final + 1e-6) peor = false;
}
ok(peor, 'ninguna de 300 estrategias aleatorias la supera');
ok(opt.stats.pruned > 0 && opt.stats.nodes < 5000000, 'busqueda con poda acotada (' + opt.stats.nodes + ' nodos, ' + opt.stats.pruned + ' ramas descartadas)');
ok(optSim.maxDrawdown < 0.0001, 'quien conoce el futuro no llega a caer (caida maxima ~0)');
console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS PASAN' : '\n' + fallos + ' PRUEBAS FALLAN');
process.exit(fallos === 0 ? 0 : 1);
