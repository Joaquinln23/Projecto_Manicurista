document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const formAgenda = document.getElementById('form-agenda');
    const mensaje = document.getElementById('mensaje-confirmacion');
    const divReservas = document.getElementById('mis-reservas');

    // Obtiene el ID del usuario desde localStorage
    function getUsuarioId() {
    const id = localStorage.getItem('usuario_id');
    return id && !['undefined', 'null', ''].includes(id.trim()) ? id.trim() : null;
}
    // Obtiene el ID del usuario logueado
    const usuarioId = getUsuarioId();

    if (usuarioId) {
        divReservas.classList.remove('oculto');
        cargarReservas(usuarioId);
    } else {
        divReservas.classList.add('oculto');
    }

    // Cierra la sesión
function cerrarSesion() {
    localStorage.removeItem('usuario_id');
    localStorage.removeItem('usuario_nombre'); // si también lo guardas
    document.getElementById('mis-reservas').classList.add('oculto'); // oculta el div
    window.location.href = 'index.html'; // o redirige donde quieras
}


    // Maneja el envío del formulario para crear una nueva reserva
    formAgenda.addEventListener('submit', async function(e) {
        e.preventDefault(); // Evita el envío tradicional del formulario

        const usuarioId = getUsuarioId();

        if (!usuarioId) {
            alert('Debes iniciar sesión para reservar.');
            return;
        }
        // Obtiene los valores de los campos del formulario
        const nombre = document.getElementById('nombre').value;
        const fecha = document.getElementById('fecha').value;
        const hora = document.getElementById('hora').value;

        // Envía la reserva al backend usando fetch
        const response = await fetch('http://localhost:5000/api/reserva_horas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, fecha, hora, usuario_id: usuarioId })
        });

        const data = await response.json();

        if (data.success) {
            // Si la reserva fue exitosa, muestra mensaje y recarga las reservas
            mensaje.textContent = data.mensaje;
            mensaje.classList.remove('oculto');
            formAgenda.reset();
            cargarReservas(usuarioId);
        } else {
            // Si hubo error, muestra mensaje de error
            mensaje.textContent = data.mensaje || 'Error al crear la reserva';
            mensaje.classList.remove('oculto');
        }
    });

    // Función para cargar las reservas del usuario y mostrarlas en pantalla
    async function cargarReservas(usuarioId) {
    const response = await fetch(`http://localhost:5000/api/mis_reservas/${usuarioId}`);
    const data = await response.json();

    // Limpia contenido anterior
    divReservas.innerHTML = '';

    if (data.success && data.reservas.length > 0) {
        divReservas.innerHTML = '<h3>Mis Reservas</h3>';
        const lista = document.createElement('ul');
        data.reservas.forEach(reserva => {
    const item = document.createElement('li');

    const fechaObj = new Date(reserva.fecha);
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaNombre = diasSemana[fechaObj.getDay()];
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();

    const fechaFormateada = `${diaNombre}, ${dia}-${mes}-${anio}`;
    item.textContent = `${fechaFormateada}, ${reserva.hora} - ${reserva.nombre}`;

    lista.appendChild(item);
});

        divReservas.appendChild(lista);
    } else {
        // No mostrar nada si no hay reservas o si la respuesta fue fallida
        // O si quieres mostrar algo discreto:
        // divReservas.innerHTML = '<p>No tienes reservas actuales.</p>';
    }
}        
});