import { loadScript } from './helpers.js';

// Elementos que login.js exige sin guarda al registrar sus listeners
document.body.innerHTML = `
  <button id="login-btn"></button>
  <button id="register-btn"></button>
`;

test('login.js tolera la ausencia de window.cargarReservas y la invoca cuando existe', async () => {
  localStorage.setItem('usuario_id', '42');
  localStorage.setItem('usuario_nombre', 'Ana');

  await loadScript('scripts/login.js');

  // Fase 1: reservas.js todavía no definió la función — el guard no debe fallar
  expect(() => document.dispatchEvent(new Event('DOMContentLoaded'))).not.toThrow();
  expect(window.cargarReservas).toBeUndefined();

  // Fase 2: con la función expuesta, login la invoca con el id del usuario
  const cargarReservas = vi.fn();
  window.cargarReservas = cargarReservas;
  document.dispatchEvent(new Event('DOMContentLoaded'));
  expect(cargarReservas).toHaveBeenCalledWith('42');
});
