/**
 * reservas.js — Agenda de reservas.
 * Fecha mínima en el formulario, carga de citas (window.cargarReservas)
 * y envío de nuevas reservas a la API. Consumidor de config.js/main.js.
 */

// Importa la fuente única de API_URL y la función global de showMessage
import API_URL from './config.js';
import { showMessage } from './main.js';

document.addEventListener('DOMContentLoaded', () => {

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

    // --- 2b. OPTIONAL COUPON FIELD (fidelizacion PR4) ---
    // Built here so index.html keeps every existing id/class untouched.
    if (formAgenda) {
        const botonesAgenda = formAgenda.querySelector('.form-buttons');
        if (botonesAgenda && !document.getElementById('cupon-codigo')) {
            const etiquetaCupon = document.createElement('label');
            etiquetaCupon.setAttribute('for', 'cupon-codigo');
            etiquetaCupon.textContent = 'Cupón de bienvenida (opcional):';
            const inputCupon = document.createElement('input');
            inputCupon.type = 'text';
            inputCupon.id = 'cupon-codigo';
            inputCupon.name = 'cupon_codigo';
            inputCupon.placeholder = 'BIENV-XXXXXX';
            inputCupon.autocomplete = 'off';
            formAgenda.insertBefore(etiquetaCupon, botonesAgenda);
            formAgenda.insertBefore(inputCupon, botonesAgenda);
        }
    }

    // --- 3. FUNCIÓN GLOBAL PARA CARGAR PUNTOS ---
    // Shows the loyalty balance + history from GET /api/puntos. The
    // #mis-puntos container is created on demand so index.html stays
    // untouched; every pre-existing element id/class is preserved.
    window.cargarPuntos = async function(id) {
        let divPuntos = document.getElementById('mis-puntos');
        if (!divPuntos && divReservas && divReservas.parentNode) {
            divPuntos = document.createElement('section');
            divPuntos.id = 'mis-puntos';
            divPuntos.className = 'mis-puntos';
            divReservas.parentNode.insertBefore(divPuntos, divReservas);
        }
        if (!id || !divPuntos) return;

        try {
            const response = await fetch(`${API_URL}/api/puntos/${id}`);
            const data = await response.json();

            divPuntos.innerHTML = '';
            if (!data.success) return;

            const titulo = document.createElement('h3');
            titulo.textContent = 'Mis Puntos';
            divPuntos.appendChild(titulo);

            const balance = document.createElement('p');
            balance.className = 'puntos-balance';
            balance.textContent = `Tienes ${data.balance} puntos. ¡Sigue agendando horas para sumar más!`;
            divPuntos.appendChild(balance);

            if (data.movimientos && data.movimientos.length > 0) {
                const lista = document.createElement('ul');
                lista.className = 'lista-puntos';

                data.movimientos.forEach(movimiento => {
                    const item = document.createElement('li');
                    const signo = movimiento.puntos >= 0 ? '+' : '';
                    const detalle = movimiento.motivo === 'asistencia'
                        ? 'por hora asistida'
                        : `canje ${String(movimiento.motivo).replace('canje_', '')}`;
                    item.textContent = `${signo}${movimiento.puntos} puntos ${detalle} (vence: ${movimiento.expira_en || 'sin fecha'})`;
                    lista.appendChild(item);
                });

                divPuntos.appendChild(lista);
            } else {
                const mensajeVacio = document.createElement('p');
                mensajeVacio.textContent = 'Aún no tienes puntos. Tus horas asistidas suman 100 puntos cada una.';
                divPuntos.appendChild(mensajeVacio);
            }
        } catch (error) {
            console.error('Error cargando puntos:', error);
        }
    };

    // --- 3b. FUNCIÓN GLOBAL PARA MOSTRAR CUPONES ---
    // Fetches GET /api/cupones/<id> and renders the welcome codes in a
    // section created on demand before #mis-reservas (same pattern as the
    // points section); fetch errors never break the booking list.
    window.cargarCupones = async function(id) {
        let divCupones = document.getElementById('mis-cupones');
        if (!divCupones && divReservas && divReservas.parentNode) {
            divCupones = document.createElement('section');
            divCupones.id = 'mis-cupones';
            divCupones.className = 'mis-cupones';
            divReservas.parentNode.insertBefore(divCupones, divReservas);
        }
        if (!id || !divCupones) return;

        try {
            const response = await fetch(`${API_URL}/api/cupones/${id}`);
            const data = await response.json();

            divCupones.innerHTML = '';
            if (!data.success || !data.cupones || data.cupones.length === 0) return;

            const titulo = document.createElement('h3');
            titulo.textContent = 'Mi Cupón de Bienvenida';
            divCupones.appendChild(titulo);

            data.cupones.forEach(cupon => {
                const linea = document.createElement('p');
                linea.className = 'cupon-linea';
                if (cupon.estado === 'activo') {
                    linea.textContent = `Tu cupón del 10% es ${cupon.codigo} y vence el ${cupon.expira_en}. Úsalo en tus primeras uñitas.`;
                } else {
                    linea.textContent = `Tu cupón ${cupon.codigo} ya fue usado. ¡Gracias por preferirnos!`;
                }
                divCupones.appendChild(linea);
            });
        } catch (error) {
            console.error('Error cargando cupones:', error);
        }
    };

    // --- 4. FUNCIÓN GLOBAL PARA CARGAR RESERVAS ---
    // La asignamos a window para que sea accesible desde login.js
    window.cargarReservas = async function(id) {
        if (!id || !divReservas) return;

        // Loyalty balance and welcome coupon load alongside the booking list.
        window.cargarPuntos(id);
        window.cargarCupones(id);
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

    // --- 5. MANEJO DEL ENVÍO DEL FORMULARIO ---
    if (formAgenda) {
        formAgenda.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nombre = document.getElementById('nombre').value;
            const fecha = document.getElementById('fecha').value;
            const hora = document.getElementById('hora').value;
            const campoCupon = document.getElementById('cupon-codigo');
            const cuponCodigo = campoCupon ? campoCupon.value.trim().toUpperCase() : '';
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
                        usuario_id: currentUsuarioId,
                        cupon_codigo: cuponCodigo || null
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