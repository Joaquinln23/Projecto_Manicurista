/**
 * Suite helpers de la cinta: wrapOffset mantiene el loop sin saltos
 * (positivos y negativos) y la velocidad deja un ciclo desktop completo
 * en el rango calmado de ~45–60 s.
 */
import { wrapOffset, MARQUEE_SPEED_PX_PER_SEC } from '../../scripts/carousel.js';

test('wrapOffset y la velocidad resuelven el loop y el ritmo de la cinta', () => {
  expect(wrapOffset(0, 4480)).toBe(0);
  expect(wrapOffset(4480, 4480)).toBe(0);
  expect(wrapOffset(4481, 4480)).toBe(1);
  expect(wrapOffset(-1, 4480)).toBe(4479);
  expect(wrapOffset(5000.5, 4480)).toBeCloseTo(520.5);
  expect(wrapOffset(10, 0)).toBe(0);

  expect(MARQUEE_SPEED_PX_PER_SEC).toBeGreaterThan(0);
  const cycleSeconds = 4480 / MARQUEE_SPEED_PX_PER_SEC;
  expect(cycleSeconds).toBeGreaterThanOrEqual(45);
  expect(cycleSeconds).toBeLessThanOrEqual(60);
});
