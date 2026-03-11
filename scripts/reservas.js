document.addEventListener('DOMContentLoaded', () => {
    // URL BACKEND EN RENDER
    const API_URL = 'https://projecto-manicurista.onrender.com';

    // Referencias a elementos del DOM
    const formAgenda = document.getElementById('form-agenda');
    const divReservas = document.getElementById('mis-reservas');
    const fechaInput = document.getElementById('fecha');

    // --- 1. VALIDACIÓN DE FECHA MÍNIMA ---
    if (fechaInput) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        
        const fechaMinima = `${yyyy}-${mm}-${dd}`;
        fechaInput.setAttribute('min', fechaMinima);
    }

    // --- 2. OBTENER ID DEL USUARIO ---
    function getUsuarioId() {
        const id = localStorage.getItem('usuario_id');
        return id && !['undefined', 'null', ''].includes(id.trim()) ? id.trim() : null;
    }

    // --- 3. FUNCIÓN GLOBAL PARA CARGAR RESERVAS ---
    // La asignamos a window para que sea accesible desde login.js
    window.cargarReservas = async function(id) {
        if (!id || !divReservas) return;

        try {
            const response = await fetch(`${API_URL}/api/mis_reservas/${id}`);
            const data = await response.json();

            divReservas.innerHTML = ''; // Limpiar contenido previo
            divReservas.classList.remove('oculto');

            if (data.success && data.reservas.length > 0) {
                const titulo = document.createElement('h3');
                titulo.textContent = 'Mis Próximas Citas';
                divReservas.appendChild(titulo);
                
                const lista = document.createElement('ul');
                lista.className = 'lista-reservas'; // Puedes darle estilos en tu CSS

                data.reservas.forEach(reserva => {
                    const item = document.createElement('li');
                    
                    // Formateo de fecha para evitar desfase de zona horaria
                    const fechaObj = new Date(reserva.fecha + 'T00:00:00');
                    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    const diaNombre = diasSemana[fechaObj.getDay()];
                    const dia = fechaObj.getDate().toString().padStart(2, '0');
                    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
                    const anio = fechaObj.getFullYear();
                    
                    const fechaFormateada = `${diaNombre}, ${dia}-${mes}-${anio}`;
                    // Usamos innerHTML para resaltar la hora en negrita
                    item.innerHTML = `<strong>${fechaFormateada}</strong> a las <strong>${reserva.hora.substring(0, 5)}</strong> - ${reserva.nombre}`;
                    
                    lista.appendChild(item);
                });
                
                divReservas.appendChild(lista);
            } else {
                const mensajeVacio = document.createElement('p');
                mensajeVacio.textContent = 'Aún no tienes citas agendadas.';
                divReservas.appendChild(mensajeVacio);
            }
        } catch (error) {
            console.error('Error cargando reservas:', error);
        }
    };

    // --- 4. MANEJO DEL ENVÍO DEL FORMULARIO ---
    if (formAgenda) {
        formAgenda.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nombre = document.getElementById('nombre').value;
            const fecha = document.getElementById('fecha').value;
            const hora = document.getElementById('hora').value;
            const currentUsuarioId = getUsuarioId();

            if(!nombre || !fecha || !hora) {
                return showMessage('Por favor, completa todos los campos.', 'error');
            }

            const btnSubmit = formAgenda.querySelector('button[type="submit"]');
            const originalText = btnSubmit.textContent;
            btnSubmit.textContent = 'Procesando...';
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${API_URL}/api/reserva_horas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        nombre, 
                        fecha, 
                        hora, 
                        usuario_id: currentUsuarioId 
                    })
                });

                const data = await response.json();

                if (data.success) {
                    showMessage(data.mensaje || '¡Reserva confirmada!', 'success');
                    formAgenda.reset();
                    // Si el usuario está logueado, actualizamos la lista sin recargar
                    if (currentUsuarioId) {
                        window.cargarReservas(currentUsuarioId);
                    }
                } else {
                    showMessage(data.mensaje || 'Error al crear la reserva', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Error de conexión con el servidor.', 'error');
            } finally {
                btnSubmit.textContent = originalText;
                btnSubmit.disabled = false;
            }
        });
    }

    // Ejecución inicial: Si el usuario ya inició sesión previamente
    const usuarioIdInicial = getUsuarioId();
    if (usuarioIdInicial) {
        window.cargarReservas(usuarioIdInicial);
    }
});