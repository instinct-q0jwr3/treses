# Juegos: 2048 y Desborde

Dos puzles para jugar en el navegador, con selector al entrar. Sin cuentas, sin anuncios, sin conexión necesaria tras la primera carga.

## Jugar

Abre https://instinct-q0jwr3.github.io/treses/ desde el móvil o el ordenador y elige juego. La partida y el récord de cada uno se guardan solos en el navegador.

### 2048

El clásico puzle: desliza las fichas y junta dos iguales para sumarlas (2 + 2 = 4, 4 + 4 = 8…) hasta llegar a **2048**.

- **Móvil**: desliza en cualquier dirección sobre el tablero.
- **Ordenador**: flechas del teclado o arrastra con el ratón.
- Tras cada movimiento aparece una ficha nueva (un 2 o, a veces, un 4). Si el tablero se llena sin movimientos posibles, la partida termina.

### Desborde

Una cuadrícula de 5 × 5 con números y flechas en los bordes.

- Toca una flecha para desplazar esa fila o columna una posición: **lo que sale por un lado vuelve por el otro**.
- Si en la fila o columna que has movido quedan **números iguales seguidos**, se juntan en uno solo con su suma: 2 + 2 = 4, 2 + 2 + 2 = 6.
- Los huecos se rellenan con las piezas siguientes, que ves arriba para planear.
- Sin reloj y con botón de deshacer. La meta es conseguir la ficha más alta.

## Desarrollo

- `index.html`: selector de juegos.
- `2048.html`: juego 2048 (autocontenido).
- `desborde.html` + `desborde-core.js`: juego Desborde; la lógica pura está en `desborde-core.js`.
- `tests/desborde-core.test.js`: tests de la lógica de Desborde, sin dependencias: `node tests/desborde-core.test.js`.
