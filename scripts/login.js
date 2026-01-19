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

    // Función para mostrar mensajes personalizados
    function showMessage(message, type = 'info') {
        const messageBox = document.createElement('div');
        messageBox.classList.add('message-box', type); // Agregamos el tipo para estilos CSS
        messageBox.textContent = message;

        const closeBtn = document.createElement('span');
        closeBtn.classList.add('close-btn');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => messageBox.remove();
        messageBox.appendChild(closeBtn);

        document.body.appendChild(messageBox);
        setTimeout(() => { if(messageBox) messageBox.remove(); }, 5000);
    }

    // Comprobar el estado de autenticación
    function checkLoginStatus() {
        const usuarioId = localStorage.getItem('usuario_id');
        const usuarioNombre = localStorage.getItem('usuario_nombre');

        if (!usuarioId || usuarioId === 'null' || usuarioId === 'undefined') {
            btnCerrarSesion.style.display = 'none';
            saludoUsuario.textContent = '';
            btnIngresar.style.display = 'inline-block';
            if (misReservasDiv) misReservasDiv.classList.add('oculto');
        } else {
            btnCerrarSesion.style.display = 'inline-block';
            saludoUsuario.textContent = `¡Hola! ${usuarioNombre}`;
            btnIngresar.style.display = 'none';
            if (misReservasDiv) misReservasDiv.classList.remove('oculto');

            // Cargar reservas desde la API en la NUBE
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

        fetch(`${API_URL}/login`, { // Conexión a Render
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showMessage('¡Bienvenido, ' + data.nombre + '!');
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
            showMessage('No se pudo conectar con el servidor en la nube', 'error');
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

        fetch(`${API_URL}/register`, { // Conexión a Render
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

    // --- EVENTOS DE INTERFAZ (Modales y Teclas) ---
    btnIngresar.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('oculto'); });
    closeBtn.addEventListener('click', () => modal.classList.add('oculto'));
    abrirRegistroBtn.addEventListener('click', () => { modal.classList.add('oculto'); registerModal.classList.remove('oculto'); });
    closeRegisterBtn.addEventListener('click', () => registerModal.classList.add('oculto'));
    
    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") { [modal, registerModal].forEach(m => m.classList.add('oculto')); }
    });

    // Envío con Enter
    [modal, registerModal].forEach(m => {
        m.querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    m.querySelector('button[id$="-btn"]').click();
                }
            });
        });
    });

    btnCerrarSesion.addEventListener('click', () => {
        localStorage.clear();
        checkLoginStatus();
        showMessage('Sesión cerrada.');
    });

    checkLoginStatus();
});