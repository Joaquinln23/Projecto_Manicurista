document.addEventListener('DOMContentLoaded', function() {
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

    // Función para mostrar mensajes personalizados en un modal
    function showMessage(message, type = 'info') {
        const messageBox = document.createElement('div');
        messageBox.classList.add('message-box');
        messageBox.textContent = message;

        const closeBtn = document.createElement('span');
        closeBtn.classList.add('close-btn');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => messageBox.remove();
        messageBox.appendChild(closeBtn);

        document.body.appendChild(messageBox);
        
        // Ocultar automáticamente después de 5 segundos
        setTimeout(() => {
            messageBox.remove();
        }, 5000);
    }

    // Comprobar el estado de autenticación al cargar la página
    function checkLoginStatus() {
        const usuarioId = localStorage.getItem('usuario_id');
        const usuarioNombre = localStorage.getItem('usuario_nombre');

        if (!usuarioId || usuarioId === 'null' || usuarioId === 'undefined' || usuarioId.trim() === '') {
            // Usuario no logueado
            btnCerrarSesion.style.display = 'none';
            saludoUsuario.textContent = '';
            btnIngresar.style.display = 'inline-block';
            if (misReservasDiv) {
                misReservasDiv.classList.add('oculto');
            }
        } else {
            // Usuario logueado
            btnCerrarSesion.style.display = 'inline-block';
            saludoUsuario.textContent = `¡Hola! ${usuarioNombre}`;
            btnIngresar.style.display = 'none';

            if (misReservasDiv) {
                misReservasDiv.classList.remove('oculto');
            }

            // Cargar reservas si la función está disponible
            if (typeof cargarReservas === 'function') {
                cargarReservas(usuarioId);
            }
        }
    }

    // Lógica para el modal de inicio de sesión
    btnIngresar.addEventListener('click', function(e) {
        e.preventDefault();
        modal.classList.remove('oculto');
    });

    closeBtn.addEventListener('click', function() {
        modal.classList.add('oculto');
    });

    document.addEventListener('keyup', function(e) {
        if (e.key === "Escape") {
            modal.classList.add('oculto');
            registerModal.classList.add('oculto');
        }
    });

    loginBtn.addEventListener('click', function() {
        const usuario = document.getElementById('login-usuario').value;
        const password = document.getElementById('login-password').value;

        fetch('http://localhost:5000/login', {
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
                checkLoginStatus(); // Actualiza el estado de la UI
                modal.classList.add('oculto');
            } else {
                showMessage(data.error || 'Usuario o contraseña incorrectos', 'error');
            }
        })
        .catch(() => {
            showMessage('Error de conexión con el servidor 1', 'error');
        });
    });

    // Lógica para el modal de registro
    abrirRegistroBtn.addEventListener('click', function() {
        modal.classList.add('oculto');
        registerModal.classList.remove('oculto');
    });

    closeRegisterBtn.addEventListener('click', function() {
        registerModal.classList.add('oculto');
    });

    registerBtn.addEventListener('click', function() {
        const rut = document.getElementById('register-rut').value;
        const nombreusuario = document.getElementById('register-nombreusuario').value;
        const nombre = document.getElementById('register-nombre').value;
        const apellido = document.getElementById('register-apellido').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        fetch('http://localhost:5000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rut, nombreusuario, nombre, apellido, email, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showMessage('¡Usuario registrado correctamente!', 'success');
                registerModal.classList.add('oculto');
            } else {
                showMessage(data.error || 'Error al registrar usuario', 'error');
            }
        })
        .catch(() => {
            showMessage('Error de conexión con el servidor 2', 'error');
        });
    });

    // Envío con Enter (login y registro)
    document.querySelectorAll('#login-modal input').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('login-btn').click();
            }
        });
    });

    document.querySelectorAll('#register-modal input').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('register-btn').click();
            }
        });
    });

    // Lógica para cerrar sesión
    btnCerrarSesion.addEventListener('click', function() {
        localStorage.clear();
        checkLoginStatus(); // Actualiza el estado de la UI
        showMessage('Sesión cerrada correctamente.');
    });

    // Llama a la función al inicio para verificar el estado de la sesión
    checkLoginStatus();
});