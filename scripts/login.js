document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://projecto-manicurista.onrender.com';

    // Definición de elementos del DOM
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

    /* --- NOTA: SE ELIMINARON LAS LÍNEAS SUELTAS QUE CAUSABAN EL ERROR --- */

    // Comprobar el estado de autenticación
    function checkLoginStatus() {
        const usuarioId = localStorage.getItem('usuario_id');
        const usuarioNombre = localStorage.getItem('usuario_nombre');

        // Seleccionamos el botón de logout (asegúrate de que el ID sea correcto)
        const btnCerrarSesion = document.getElementById('btn-logout');

        if (!usuarioId || usuarioId === 'null' || usuarioId === 'undefined') {
            // USUARIO NO LOGUEADO
            if (btnCerrarSesion) btnCerrarSesion.classList.add('oculto'); 
            saludoUsuario.textContent = '';
            btnIngresar.style.display = 'inline-block';
            if (misReservasDiv) misReservasDiv.classList.add('oculto');
        } else {
            // USUARIO LOGUEADO
            if (btnCerrarSesion) btnCerrarSesion.classList.remove('oculto'); // QUITAMOS LA CLASE OCULTO
            saludoUsuario.textContent = `¡Hola! ${usuarioNombre}`;
            btnIngresar.style.display = 'none';
            if (misReservasDiv) misReservasDiv.classList.remove('oculto');

            // Cargar reservas desde la API
            if (typeof cargarReservas === 'function') {
                cargarReservas(usuarioId);
            }
        }
    }

    // Lógica de Login
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
                showMessage('¡Bienvenido, ' + data.nombre + '!', 'success');
                localStorage.setItem('usuario_id', data.id);
                localStorage.setItem('usuario_nombre', data.nombre);
                checkLoginStatus();
                modal.classList.add('oculto');
            } else {
                showMessage(data.error || 'Credenciales inválidas', 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showMessage('No se pudo conectar con el servidor', 'error');
        });
    });

    // Lógica de Registro
    registerBtn.addEventListener('click', function() {
        const payload = {
            rut: document.getElementById('register-rut').value,
            nombreusuario: document.getElementById('register-nombreusuario').value,
            nombre: document.getElementById('register-nombre').value,
            apellido: document.getElementById('register-apellido').value,
            email: document.getElementById('register-email').value,
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
                showMessage('¡Registro exitoso! Ya puedes iniciar sesión.', 'success');
                registerModal.classList.add('oculto');
            } else {
                showMessage(data.error || 'Error en el registro', 'error');
            }
        })
        .catch(() => showMessage('Error de conexión al registrar', 'error'));
    });

    // --- EVENTOS DE INTERFAZ ---
    btnIngresar.addEventListener('click', (e) => { 
        e.preventDefault(); 
        modal.classList.remove('oculto'); 
    });
    
    closeBtn.addEventListener('click', () => modal.classList.add('oculto'));
    
    abrirRegistroBtn.addEventListener('click', () => { 
        modal.classList.add('oculto'); 
        registerModal.classList.remove('oculto'); 
    });
    
    closeRegisterBtn.addEventListener('click', () => registerModal.classList.add('oculto'));
    
    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") { [modal, registerModal].forEach(m => m.classList.add('oculto')); }
    });

    btnCerrarSesion.addEventListener('click', () => {
        localStorage.clear();
        checkLoginStatus();
        showMessage('Sesión cerrada.', 'success');
    });

    checkLoginStatus();
});

// Cerrar modales al hacer clic fuera de ellos
window.onclick = function(event) {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');

    // Si el usuario hace clic justo en el fondo oscuro (el modal)
    if (event.target == loginModal) {
        loginModal.classList.add('oculto');
    }
    
    if (event.target == registerModal) {
        registerModal.classList.add('oculto');
    }
}