/**
 * config.js — Fuente única de la URL base del backend.
 * Asigna window.API_URL (contrato de ventana congelado) y la exporta
 * como default para los consumidores ES-module (main, login, reservas).
 */

// Fuente única de la URL base del backend (contrato de ventana congelado)
window.API_URL = 'https://projecto-manicurista.onrender.com';

// Export para consumidores ES-module; la ventana sigue siendo el contrato congelado
export default window.API_URL;
