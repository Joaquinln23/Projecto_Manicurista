/**
 * Suite helpers del carrusel: snapToNearest redondea a la tarjeta más
 * cercana y wrapIndex mantiene el looping sin saltos (positivos y negativos).
 */
import { snapToNearest, wrapIndex } from '../../scripts/carousel.js';

test('snapToNearest y wrapIndex resuelven el snap y el looping del carrusel', () => {
  expect(snapToNearest(2.4)).toBe(2);
  expect(snapToNearest(2.6)).toBe(3);
  expect(snapToNearest(-1.6)).toBe(-2);
  expect(wrapIndex(10, 10)).toBe(0);
  expect(wrapIndex(-1, 10)).toBe(9);
  expect(wrapIndex(23, 10)).toBe(3);
  expect(wrapIndex(0, 10)).toBe(0);
});
