document.addEventListener('DOMContentLoaded', () => {
    // URL BACKEND EN RENDER
    const API_URL = 'https://projecto-manicurista.onrender.com';

    // Referencias a elementos del DOM
    const formAgenda = document.getElementById('form-agenda');
    const divReservas = document.getElementById('mis-reservas');

    //mostrar mensajes personalizados
    showMessage(data.mensaje || '¡Reserva confirmada!', 'success');
    showMessage(data.mensaje || 'Error al crear la reserva', 'error');
    showMessage('Por favor, completa todos los campos.', 'error');

    // Obtiene el ID del usuario desde localStorage (si existe)
    function getUsuarioId() {
        const id = localStorage.getItem('usuario_id');
        return id && !['undefined', 'null', ''].includes(id.trim()) ? id.trim() : null;
    }

    const usuarioId = getUsuarioId();

    // Solo mostramos la sección "Mis Reservas" si hay un usuario logueado
    if (usuarioId) {
        if (divReservas) {
            divReservas.classList.remove('oculto');
            cargarReservas(usuarioId);
        }
    } else {
        if (divReservas) divReservas.classList.add('oculto');
    }

    // --- MANEJO DEL ENVÍO DEL FORMULARIO (Invitados + Logueados) ---
    formAgenda.addEventListener('submit', async function(e) {
        e.preventDefault();

        const currentUsuarioId = getUsuarioId(); // Intentamos capturar el ID si existe
        
        // Captura de valores del formulario
        const nombre = document.getElementById('nombre').value;
        const fecha = document.getElementById('fecha').value;
        const hora = document.getElementById('hora').value;

        // Validación básica de campos vacíos
        if(!nombre || !fecha || !hora) {
            return showMessage('Por favor, completa todos los campos.', 'error');
        }

        try {
            const response = await fetch(`${API_URL}/api/reserva_horas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    nombre: nombre, 
                    fecha: fecha, 
                    hora: hora, 
                    usuario_id: currentUsuarioId // Si es null, el Backend lo tratará como invitado
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.mensaje, 'success');
                formAgenda.reset();
                // Si el usuario está logueado, actualizamos su lista de reservas personal
                if (currentUsuarioId) {
                    cargarReservas(currentUsuarioId);
                }
            } else {
                // Aquí se mostrará el mensaje de "cupos agotados" (máximo 5) que configuramos en Python
                showMessage(data.mensaje || 'Error al crear la reserva', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Error de conexión con el servidor o límite diario alcanzado.', 'error');
        }
    });

    // Función para cargar las reservas personales (Solo para logueados)
    async function cargarReservas(id) {
        try {
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
                    
                    // Formateo de fecha para evitar desfases
                    const fechaObj = new Date(reserva.fecha + 'T00:00:00');
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
                mensajeVacio.textContent = 'No tienes reservas registradas con tu cuenta.';
                divReservas.appendChild(mensajeVacio);
            }
        } catch (error) {
            console.error('Error cargando reservas:', error);
        }
    }
});