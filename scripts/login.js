/**
 * login.js — Autenticación de la interfaz.
 * Login/registro vía API, estado de sesión en localStorage, guard de
 * window.cargarReservas y cierre de modales/sesión.
 */

// Importa la fuente única de API_URL y la función global de showMessage
import API_URL from './config.js';
import { showMessage } from './main.js';

// Registration validators (fidelizacion Unit 2, client side).
// Single mirrored RUT rule, duplicated in backend/app.py; the server is
// authoritative and the client only blocks the round-trip early.
export function normalizeRut(value) {
    return String(value ?? '').replace(/[.\s]/g, '').toUpperCase();
}

export function isValidRut(value) {
    const normalized = normalizeRut(value);
    const match = /^(\d{7,8})-([\dK])$/.exec(normalized);
    if (!match) return false;
    const weights = [2, 3, 4, 5, 6, 7];
    let sum = 0;
    const digits = match[1].split('').reverse();
    for (let i = 0; i < digits.length; i++) {
        sum += Number(digits[i]) * weights[i % weights.length];
    }
    const dv = 11 - (sum % 11);
    const expected = dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
    return match[2] === expected;
}

// Format-only email check (no MX/deliverability lookup, per spec).
export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ''));
}

document.addEventListener('DOMContentLoaded', function() {

    // 1. DEFINICIÓN DE ELEMENTOS DEL DOM
    const btnIngresar = document.getElementById('btn-ingresar');
    const modal = document.getElementById('login-modal');
    const closeBtn = document.getElementById('close-login');
    const loginBtn = document.getElementById('login-btn');
    const btnCerrarSesion = document.getElementById('btn-logout');
    const saludoUsuario = document.getElementById('saludo-usuario');
    const misReservasDiv = document.getElementById('mis-reservas');
    const registerModal = document.getElementById('register-modal');
    const closeRegisterBtn = document.getElementById('close-register');
    const abrirRegistroBtn = document.getElementById('abrir-registro');
    const registerBtn = document.getElementById('register-btn');

    // 2. COMPROBAR EL ESTADO DE AUTENTICACIÓN
    function checkLoginStatus() {
        const usuarioId = localStorage.getItem('usuario_id');
        const usuarioNombre = localStorage.getItem('usuario_nombre');

        // Normalización de valores nulos o indefinidos de localStorage
        const isLoggedIn = usuarioId && usuarioId !== 'null' && usuarioId !== 'undefined';

        if (!isLoggedIn) {
            // ESTADO: USUARIO NO LOGUEADO
            if (btnCerrarSesion) btnCerrarSesion.classList.add('oculto'); 
            if (saludoUsuario) saludoUsuario.textContent = '';
            if (btnIngresar) btnIngresar.style.display = 'inline-block';
            if (misReservasDiv) {
                misReservasDiv.classList.add('oculto');
                misReservasDiv.innerHTML = ''; // Limpieza de seguridad
            }
        } else {
            // ESTADO: USUARIO LOGUEADO
            if (btnCerrarSesion) btnCerrarSesion.classList.remove('oculto');
            if (saludoUsuario) saludoUsuario.textContent = `¡Hola! ${usuarioNombre}`;
            if (btnIngresar) btnIngresar.style.display = 'none';
            if (misReservasDiv) misReservasDiv.classList.remove('oculto');

            // Cargar reservas desde la API (Función definida en reservas.js)
            if (typeof window.cargarReservas === 'function') {
                window.cargarReservas(usuarioId);
            }
        }
    }

    // 3. LÓGICA DE LOGIN
    loginBtn.addEventListener('click', function() {
        const usuario = document.getElementById('login-usuario').value;
        const password = document.getElementById('login-password').value;

        if(!usuario || !password) return showMessage('Rellena todos los campos', 'error');

        fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('usuario_id', data.id);
                localStorage.setItem('usuario_nombre', data.nombre);
                checkLoginStatus();
                modal.classList.add('oculto');
                showMessage(`¡Bienvenido, ${data.nombre}!`, 'success');
            } else {
                showMessage(data.error || 'Credenciales inválidas', 'error');
            }
        })
        .catch(err => {
            console.error('Error en Login:', err);
            showMessage('No se pudo conectar con el servidor', 'error');
        });
    });

    // 4. LÓGICA DE REGISTRO
    registerBtn.addEventListener('click', function() {
        const rutValue = document.getElementById('register-rut').value;
        const emailValue = document.getElementById('register-email').value;

        // Client-side format gate; the server revalidates authoritatively.
        if (!isValidRut(rutValue)) return showMessage('Revisa tu RUT e inténtalo de nuevo', 'error');
        if (!isValidEmail(emailValue)) return showMessage('Revisa tu correo, parece que le falta algo', 'error');

        const payload = {
            rut: rutValue,
            nombreusuario: document.getElementById('register-nombreusuario').value,
            nombre: document.getElementById('register-nombre').value,
            apellido: document.getElementById('register-apellido').value,
            email: emailValue,
            password: document.getElementById('register-password').value
        };

        fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Welcome coupon (fidelizacion PR4): the register response
                // carries the fresh BIENV- code, so show it right away.
                if (data.cupon && data.cupon.codigo) {
                    showMessage(`¡Registro exitoso! Tu cupón del 10% es ${data.cupon.codigo}. Úsalo en tus primeras uñitas.`, 'success');
                } else {
                    showMessage('¡Registro exitoso! Ya puedes iniciar sesión.', 'success');
                }
                registerModal.classList.add('oculto');
            } else {
                showMessage(data.error || 'Error en el registro', 'error');
            }
        })
        .catch(() => showMessage('Error de conexión al registrar', 'error'));
    });

    // 5. EVENTOS DE INTERFAZ Y CIERRE DE SESIÓN
    btnIngresar?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        modal.classList.remove('oculto'); 
    });
    
    closeBtn?.addEventListener('click', () => modal.classList.add('oculto'));
    
    abrirRegistroBtn?.addEventListener('click', () => { 
        modal.classList.add('oculto'); 
        registerModal.classList.remove('oculto'); 
    });
    
    closeRegisterBtn?.addEventListener('click', () => registerModal.classList.add('oculto'));
    
    btnCerrarSesion?.addEventListener('click', () => {
        localStorage.clear();
        checkLoginStatus();
        showMessage('Sesión cerrada correctamente.', 'success');
    });

    // Cierre con tecla Escape
    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") {
            modal.classList.add('oculto');
            registerModal.classList.add('oculto');
        }
    });

    checkLoginStatus();
});

// 6. CERRAR MODALES AL HACER CLIC FUERA (GLOBAL)
window.addEventListener('click', function(event) {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');

    if (event.target === loginModal) loginModal.classList.add('oculto');
    if (event.target === registerModal) registerModal.classList.add('oculto');
});