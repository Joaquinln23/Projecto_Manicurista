/**
 * Suite showMessage: demuestra que la alerta se crea con el texto y tipo
 * dados y que no quedan duplicadas al encadenar mensajes (helper DOM).
 */
import { loadScript } from './helpers.js';

await loadScript('scripts/main.js');

beforeEach(() => {
  document.body.innerHTML = '';
});

test('showMessage crea .alert-message con el texto y el tipo dados', () => {
  window.showMessage('Reserva confirmada', 'success');

  const alerta = document.querySelector('.alert-message');
  expect(alerta).not.toBeNull();
  expect(alerta.textContent).toBe('Reserva confirmada');
  expect(alerta.classList.contains('alert-message')).toBe(true);
  expect(alerta.classList.contains('alert-success')).toBe(true);
});

test('showMessage elimina la alerta previa (sin duplicados)', () => {
  window.showMessage('Primera alerta', 'success');
  window.showMessage('Segunda alerta', 'error');

  const alertas = document.querySelectorAll('.alert-message');
  expect(alertas).toHaveLength(1);
  expect(alertas[0].textContent).toBe('Segunda alerta');
  expect(alertas[0].classList.contains('alert-error')).toBe(true);
});
