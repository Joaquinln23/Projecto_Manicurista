document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const formAgenda = document.getElementById('form-agenda');
    const mensaje = document.getElementById('mensaje-confirmacion');
    const divReservas = document.getElementById('mis-reservas');

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

    // Obtiene el ID del usuario desde localStorage
    function getUsuarioId() {
        const id = localStorage.getItem('usuario_id');
        return id && !['undefined', 'null', ''].includes(id.trim()) ? id.trim() : null;
    }

    // Obtiene el ID del usuario logueado
    const usuarioId = getUsuarioId();

    // Comprueba el estado de la sesión al cargar la página y muestra las reservas si hay un usuario logueado
    if (usuarioId) {
        divReservas.classList.remove('oculto');
        cargarReservas(usuarioId);
    } else {
        divReservas.classList.add('oculto');
    }

    // Maneja el envío del formulario para crear una nueva reserva
    formAgenda.addEventListener('submit', async function(e) {
        e.preventDefault(); // Evita el envío tradicional del formulario

        const usuarioId = getUsuarioId();

        if (!usuarioId) {
            showMessage('Debes iniciar sesión para reservar.', 'error');
            return;
        }

        // Obtiene los valores de los campos del formulario
        const nombre = document.getElementById('nombre').value;
        const fecha = document.getElementById('fecha').value;
        const hora = document.getElementById('hora').value;

        // Envía la reserva al backend usando fetch
        try {
            const response = await fetch('http://localhost:5000/api/reserva_horas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, fecha, hora, usuario_id: usuarioId })
            });

            const data = await response.json();

            if (data.success) {
                // Si la reserva fue exitosa, muestra mensaje y recarga las reservas
                showMessage(data.mensaje, 'success');
                formAgenda.reset();
                cargarReservas(usuarioId);
            } else {
                // Si hubo error, muestra mensaje de error
                showMessage(data.mensaje || 'Error al crear la reserva', 'error');
            }
        } catch (error) {
            showMessage('Error de conexión con el servidor.', 'error');
        }
    });

    // Función para cargar las reservas del usuario y mostrarlas en pantalla
    async function cargarReservas(usuarioId) {
        try {
            const response = await fetch(`http://localhost:5000/api/mis_reservas/${usuarioId}`);
            const data = await response.json();

            // Limpia el contenido anterior del div de reservas
            divReservas.innerHTML = '';

            if (data.success && data.reservas.length > 0) {
                const titulo = document.createElement('h3');
                titulo.textContent = 'Mis Reservas';
                divReservas.appendChild(titulo);
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
                // Muestra un mensaje si no hay reservas
                const mensajeVacio = document.createElement('p');
                mensajeVacio.textContent = 'No tienes reservas actuales.';
                divReservas.appendChild(mensajeVacio);
            }
        } catch (error) {
            showMessage('Error al cargar las reservas.', 'error');
        }
    }
});