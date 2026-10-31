# Juegos: 2048, Desborde e Impacto

Tres puzles para jugar en el navegador, con selector al entrar. Sin cuentas, sin anuncios, sin conexión necesaria tras la primera carga.

## Jugar

Abre https://instinct-q0jwr3.github.io/treses/ desde el móvil o el ordenador y elige juego. La partida y el récord de cada uno se guardan solos en el navegador.

### 2048

El clásico puzle: desliza las fichas y junta dos iguales para sumarlas (2 + 2 = 4, 4 + 4 = 8…) hasta llegar a **2048**.

- **Móvil**: desliza en cualquier dirección sobre el tablero.
- **Ordenador**: flechas del teclado o arrastra con el ratón.
- Tras cada movimiento aparece una ficha nueva (un 2 o, a veces, un 4). Si el tablero se llena sin movimientos posibles, la partida termina.

### Desborde

Una cuadrícula de 5 × 5 con números.

- **Arrastra una fila o columna una casilla** (o toca sus flechas): lo que sale por un lado vuelve por el otro. Mientras arrastras no pasa nada; la jugada se fija al soltar.
- Al soltar, los **números iguales que queden tocándose** (en fila o en columna) se juntan en su suma: 2 + 2 = 4, 2 + 2 + 2 = 6. La primera suma se queda en la línea que moviste; en las oleadas siguientes, en la casilla de más arriba a la izquierda del grupo.
- Las fichas van del 1 al 7 **en ciclo**: si una suma pasa de 7, la ficha vuelve a empezar (4 + 4 = 8 → 1), aunque los puntos cuentan con la suma completa.
- Cada hueco se rellena con el **valor más pequeño que no repita vecino** y las nuevas coincidencias se juntan en **oleadas**, una tras otra, hasta que el tablero queda estable; solo entonces puedes mover otra vez.
- Sin reloj y con botón de deshacer. La meta es sumar puntos encadenando oleadas; el marcador de «Mejor jugada» guarda tu jugada más puntuable.
- Salvaguarda: si una cascada no se estabilizara, la jugada se revierte entera y se avisa.

### Impacto

Una cuadrícula de 10 × 10 en la que hay que **cazar doses**.

- **Arrastra una fila o columna una casilla**: lo que sale por un lado vuelve por el otro. Al soltar, los iguales que se toquen se juntan en su suma, sin límite (3 + 3 = 6).
- **Fusionar doses suma** la suma; fusionar cualquier otro número **resta 1 punto**.
- Cada fusión suelta una **onda**: baja 1 a las casillas de alrededor de la suma (cuantas más fichas se junten, más lejos llega, hasta dos anillos). La onda nunca fusiona, pero puede preparar la jugada siguiente o estropearla.
- Sin reloj, con deshacer y récord guardado. Salvaguarda: si una cascada no se estabilizara, la jugada se revierte entera y se avisa.

## Desarrollo

- `index.html`: selector de juegos.
- `2048.html`: juego 2048 (autocontenido).
- `desborde.html` + `desborde-core.js`: juego Desborde; la lógica pura está en `desborde-core.js`.
- `impacto.html` + `impacto-core.js`: juego Impacto; la lógica pura está en `impacto-core.js`.
- `tests/desborde-core.test.js`: tests de la lógica de Desborde, sin dependencias: `node tests/desborde-core.test.js`.
- `tests/impacto-core.test.js`: tests de la lógica de Impacto: `node tests/impacto-core.test.js`.
