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

console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS PASAN' : '\n' + fallos + ' PRUEBAS FALLAN');
process.exit(fallos === 0 ? 0 : 1);
