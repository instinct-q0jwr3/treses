# treses

Juegos para el móvil, servidos con GitHub Pages:

- **2048** — https://instinct-q0jwr3.github.io/treses/2048.html
- **Ordenar líquidos** — https://instinct-q0jwr3.github.io/treses/tubos.html
- **Caminos de colores** — https://instinct-q0jwr3.github.io/treses/caminos.html
- **Sudoku** — https://instinct-q0jwr3.github.io/treses/sudoku.html

La raíz (https://instinct-q0jwr3.github.io/treses/) es el selector de juegos.
Las partidas y récords se guardan en el navegador del dispositivo.

## Caída de números

Implementación propia inspirada en Drop the Number. `drop.html`, `drop-ui.js` y motor puro `drop-engine.js`.
Tablero 5×6; caída por toque, vecinos iguales se absorben (cada vecino duplica), gravedad y cadenas.
Al alcanzar 1024 se retiran los 2, y el mínimo sube en cada potencia de dos posterior.
Variante tranquila sin caída automática, anuncios ni compras. Las columnas llenas se bloquean;
se pierde al llenarlas todas. Vista previa gratuita, deshacer un lanzamiento y guardado local independiente.
Pruebas: `node test/drop-engine.test.js`.

Fuentes de reglas consultadas: ficha App Store enlazada por el usuario (id1454637812),
ficha oficial de SUPERBOX en Google Play (`com.superbox.aos.fire2048`) y reseña de
https://www.godmindedgaming.com/reviews/drop_the_number.html. Sin código ni recursos del juego original.
