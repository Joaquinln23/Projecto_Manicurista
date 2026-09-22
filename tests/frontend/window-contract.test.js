import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadScript, repoRoot } from './helpers.js';

test('config.js define window.API_URL como única fuente', async () => {
  await loadScript('scripts/config.js');
  expect(typeof window.API_URL).toBe('string');
  expect(window.API_URL).toMatch(/^https:\/\//);
});

test('tras DOMContentLoaded, showMessage y cargarReservas son funciones de window', async () => {
  await loadScript('scripts/config.js');
  await loadScript('scripts/main.js');
  await loadScript('scripts/reservas.js');

  // Vacío para no disparar una carga de reservas real al iniciar
  localStorage.clear();
  document.dispatchEvent(new Event('DOMContentLoaded'));

  expect(typeof window.showMessage).toBe('function');
  expect(typeof window.cargarReservas).toBe('function');
});

test('main.js expone showMessage como alias explícito de window', async () => {
  await loadScript('scripts/main.js');
  expect(Object.prototype.hasOwnProperty.call(window, 'showMessage')).toBe(true);
  expect(typeof window.showMessage).toBe('function');
});

test('scripts/ contiene exactamente una asignación de API_URL', () => {
  const scriptsDir = resolve(repoRoot, 'scripts');
  const archivos = readdirSync(scriptsDir).filter((f) => f.endsWith('.js'));
  let total = 0;
  for (const archivo of archivos) {
    const codigo = readFileSync(resolve(scriptsDir, archivo), 'utf8');
    total += (codigo.match(/API_URL\s*=/g) || []).length;
  }
  expect(total).toBe(1);
});
