document.addEventListener('DOMContentLoaded', function() {
    const btnIngresar = document.getElementById('btn-ingresar');
    const modal = document.getElementById('login-modal');
    const closeBtn = document.getElementById('close-login');
    const loginBtn = document.getElementById('login-btn');
    const btnCerrarSesion = document.getElementById('btn-logout'); // Usas este botón
    const saludoUsuario = document.getElementById('saludo-usuario');

    const usuarioId = localStorage.getItem('usuario_id');
    const usuarioNombre = localStorage.getItem('usuario_nombre');

    // Mostrar/ocultar botones según login
    if (!usuarioId || usuarioId === 'null' || usuarioId === 'undefined' || usuarioId.trim() === '') {
        btnCerrarSesion.style.display = 'none';
        saludoUsuario.textContent = '';
    } else {
        btnCerrarSesion.style.display = 'inline-block';
        saludoUsuario.textContent = `¡Hola! ${usuarioNombre}`;
        btnIngresar.style.display = 'none';

        // Mostrar el div de reservas si aplica
        const misReservasDiv = document.getElementById('mis-reservas');
        if (misReservasDiv) {
            misReservasDiv.classList.remove('oculto');
        }

        if (typeof cargarReservas === 'function') {
            cargarReservas(usuarioId);
        }
    }

    // Lógica del login
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
                alert('¡Bienvenido, ' + data.nombre + '!');
                saludoUsuario.textContent = `¡Hola! ${data.nombre}`;
                btnIngresar.style.display = 'none';
                btnCerrarSesion.style.display = 'inline-block';
                modal.classList.add('oculto');

                localStorage.setItem('usuario_id', data.id);
                localStorage.setItem('usuario_nombre', data.nombre);

                const misReservasDiv = document.getElementById('mis-reservas');
                if (misReservasDiv) {
                    misReservasDiv.classList.remove('oculto');
                }

                if (typeof cargarReservas === 'function') {
                    cargarReservas(data.id);
                }
            } else {
                alert(data.error || 'Usuario o contraseña incorrectos');
            }
        })
        .catch(() => {
            alert('Error de conexión con el servidor');
        });
    });

    // Modal de registro
    document.getElementById('abrir-registro').addEventListener('click', function() {
        document.getElementById('login-modal').classList.add('oculto');
        document.getElementById('register-modal').classList.remove('oculto');
    });

    document.getElementById('close-register').addEventListener('click', function() {
        document.getElementById('register-modal').classList.add('oculto');
    });

    document.getElementById('register-btn').addEventListener('click', function() {
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
                alert('¡Usuario registrado correctamente!');
                document.getElementById('register-modal').classList.add('oculto');
            } else {
                alert(data.error || 'Error al registrar usuario');
            }
        })
        .catch(() => {
            alert('Error de conexión con el servidor');
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

    // Cerrar sesión
    btnCerrarSesion.addEventListener('click', function() {
        localStorage.clear();
        saludoUsuario.textContent = '';
        btnIngresar.style.display = 'inline-block';
        btnCerrarSesion.style.display = 'none';

        const misReservasDiv = document.getElementById('mis-reservas');
        if (misReservasDiv) {
            misReservasDiv.classList.add('oculto');
        }
    });
});
