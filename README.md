# Juegos: 2048 y Prisma

Dos puzles para jugar en el navegador, con selector al entrar. Sin cuentas, sin anuncios, sin conexión necesaria tras la primera carga.

## Jugar

Abre https://instinct-q0jwr3.github.io/treses/ desde el móvil o el ordenador y elige juego. La partida y el récord de cada uno se guardan solos en el navegador.

### 2048

El clásico puzle: desliza las fichas y junta dos iguales para sumarlas (2 + 2 = 4, 4 + 4 = 8…) hasta llegar a **2048**.

- **Móvil**: desliza en cualquier dirección sobre el tablero.
- **Ordenador**: flechas del teclado o arrastra con el ratón.
- Tras cada movimiento aparece una ficha nueva (un 2 o, a veces, un 4). Si el tablero se llena sin movimientos posibles, la partida termina.

### Prisma

Un panal hexagonal con fichas de colores, números y formas.

- Toca una ficha y **arrastra con un dedo** trazando una cadena de vecinas.
- Cada enlace vale si las dos fichas comparten **color, número o forma**… pero tiene que ser una coincidencia **distinta** a la del enlace anterior.
- Suelta con 3 o más fichas para sumar: cuanto más larga y variada la cadena, más puntos.
- Sin reloj. Si no quedan jugadas, el panal se mezcla solo.

## Desarrollo

- `index.html`: selector de juegos.
- `2048.html`: juego 2048 (autocontenido).
- `prisma.html` + `prisma-core.js`: juego Prisma; la lógica pura está en `prisma-core.js`.
- `tests/prisma-core.test.js`: tests de la lógica de Prisma, sin dependencias: `node tests/prisma-core.test.js`.
