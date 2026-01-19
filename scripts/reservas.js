document.addEventListener('DOMContentLoaded', () => {
    // 1. URL DE TU BACKEND EN RENDER
    const API_URL = 'https://projecto-manicurista.onrender.com';

    // Referencias a elementos del DOM
    const formAgenda = document.getElementById('form-agenda');
    const mensaje = document.getElementById('mensaje-confirmacion');
    const divReservas = document.getElementById('mis-reservas');

    // Función para mostrar mensajes personalizados
    function showMessage(message, type = 'info') {
        const messageBox = document.createElement('div');
        messageBox.classList.add('message-box', type);
        messageBox.textContent = message;

        const closeBtn = document.createElement('span');
        closeBtn.classList.add('close-btn');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => messageBox.remove();
        messageBox.appendChild(closeBtn);

        document.body.appendChild(messageBox);
        setTimeout(() => { if(messageBox) messageBox.remove(); }, 5000);
    }

    // Obtiene el ID del usuario desde localStorage
    function getUsuarioId() {
        const id = localStorage.getItem('usuario_id');
        return id && !['undefined', 'null', ''].includes(id.trim()) ? id.trim() : null;
    }

    const usuarioId = getUsuarioId();

    // Comprueba el estado de la sesión al cargar
    if (usuarioId) {
        if (divReservas) divReservas.classList.remove('oculto');
        cargarReservas(usuarioId);
    } else {
        if (divReservas) divReservas.classList.add('oculto');
    }

    // Maneja el envío del formulario (POST a Render)
    formAgenda.addEventListener('submit', async function(e) {
        e.preventDefault();

        const currentUsuarioId = getUsuarioId();
        if (!currentUsuarioId) {
            showMessage('Debes iniciar sesión para reservar.', 'error');
            return;
        }

        const nombre = document.getElementById('nombre').value;
        const fecha = document.getElementById('fecha').value;
        const hora = document.getElementById('hora').value;

        try {
            // CAMBIO: Ahora apunta a Render
            const response = await fetch(`${API_URL}/api/reserva_horas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, fecha, hora, usuario_id: currentUsuarioId })
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.mensaje, 'success');
                formAgenda.reset();
                cargarReservas(currentUsuarioId);
            } else {
                showMessage(data.mensaje || 'Error al crear la reserva', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Error de conexión con el servidor en la nube.', 'error');
        }
    });

    // Función para cargar las reservas (GET desde Render)
    async function cargarReservas(id) {
        try {
            // CAMBIO: Ahora apunta a Render
            const response = await fetch(`${API_URL}/api/mis_reservas/${id}`);
            const data = await response.json();

            if (!divReservas) return;
            divReservas.innerHTML = '';

            if (data.success && data.reservas.length > 0) {
                const titulo = document.createElement('h3');
                titulo.textContent = 'Mis Reservas';
                divReservas.appendChild(titulo);
                
                const lista = document.createElement('ul');
                data.reservas.forEach(reserva => {
                    const item = document.createElement('li');
                    
                    // Formateo de fecha
                    const fechaObj = new Date(reserva.fecha + 'T00:00:00'); // T00:00:00 evita desfase de zona horaria
                    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    const diaNombre = diasSemana[fechaObj.getDay()];
                    const dia = fechaObj.getDate().toString().padStart(2, '0');
                    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
                    const anio = fechaObj.getFullYear();
                    
                    const fechaFormateada = `${diaNombre}, ${dia}-${mes}-${anio}`;
                    item.textContent = `${fechaFormateada}, ${reserva.hora.substring(0, 5)} - ${reserva.nombre}`;
                    
                    lista.appendChild(item);
                });
                
                divReservas.appendChild(lista);
            } else {
                const mensajeVacio = document.createElement('p');
                mensajeVacio.textContent = 'No tienes reservas actuales.';
                divReservas.appendChild(mensajeVacio);
            }
        } catch (error) {
            console.error('Error cargando reservas:', error);
            // No mostramos error intrusivo aquí para no molestar la navegación
        }
    }
});