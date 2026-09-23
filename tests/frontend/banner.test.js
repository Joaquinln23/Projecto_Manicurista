/**
 * Suite promo banner + coupon copy (fidelizacion PR4): the hero-adjacent
 * strip and the registration-context block advertise the 10% welcome
 * coupon as static markup with zero backend interaction. The legacy
 * manual-discount mention renders nowhere; the booking area shows the
 * registration-promo mention in tuteo Chilean Spanish.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { repoRoot } from './helpers.js';

const html = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');

function bannerMarkup() {
  document.body.innerHTML = html;
  return {
    strip: document.querySelector('.promo-strip'),
    register: document.querySelector('.promo-register'),
    agenda: document.querySelector('#agenda'),
  };
}

test('hero-adjacent strip renders the 10% first-booking copy', () => {
  const { strip } = bannerMarkup();
  expect(strip).not.toBeNull();
  expect(strip.textContent).toMatch(/10% de descuento en tu primera reserva/);
  expect(strip.textContent).toMatch(/cupón/i);
});

test('registration-context block renders the coupon copy inside the modal', () => {
  const { register } = bannerMarkup();
  expect(register).not.toBeNull();
  expect(register.textContent).toMatch(/10% de descuento en tu primera reserva/);
  // Fuller block: title plus coupon note, inside the register modal
  expect(document.querySelector('#register-modal .promo-register')).not.toBeNull();
  expect(register.textContent).toMatch(/cupón del 10%/i);
});

test('manual-discount copy renders nowhere', () => {
  bannerMarkup();
  expect(html).not.toMatch(/manualmente/i);
  expect(html).not.toMatch(/menciónalo|mencionalo/i);
});

test('booking area shows the registration-promo mention', () => {
  const { agenda } = bannerMarkup();
  expect(agenda).not.toBeNull();
  expect(agenda.textContent).toMatch(/si te registras tendrás un cupón del 10% en tus primeras uñitas/i);
});

test('banner markup triggers zero backend interaction', () => {
  const { strip, register } = bannerMarkup();
  for (const node of [strip, register]) {
    expect(node.querySelectorAll('script').length).toBe(0);
    expect(node.innerHTML).not.toMatch(/fetch\s*\(|XMLHttpRequest|\/api\//);
  }
  // No new script modules were added for the banner
  expect(html).not.toMatch(/banner\.js/);
});
