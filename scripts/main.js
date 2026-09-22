/**
 * main.js — Núcleo de la interfaz.
 * Define showMessage (alertas dinámicas), lo expone en window y como
 * export de módulo, y gestiona el menú hamburguesa y el estado
 * scrolled del header.
 */

// Función para mostrar alertas dinámicas (Éxito/Error)
function showMessage(message, type = 'success') {
    const alertaPrevia = document.querySelector('.alert-message');
    if (alertaPrevia) alertaPrevia.remove();

    const messageBox = document.createElement('div');
    messageBox.className = `alert-message alert-${type}`;
    messageBox.textContent = message;

    document.body.appendChild(messageBox);

    setTimeout(() => {
        messageBox.classList.add('fade-out');
        setTimeout(() => {
            if(messageBox.parentNode) messageBox.remove();
        }, 500);
    }, 4000);
}

// Exponer showMessage en window (contrato de ventana congelado)
window.showMessage = showMessage;

// Exportar showMessage para consumidores ES-module (reservas.js, login.js)
export { showMessage };

document.addEventListener('DOMContentLoaded', function() {
    console.log('Interfaz cargada correctamente');

    // Cambiamos getElementById por querySelector para usar la clase del CSS
    const menuToggle = document.querySelector('.menu-toggle'); 
    const mainNav = document.querySelector('#main-nav');

    if (menuToggle && mainNav) {
        // Abrir/Cerrar menú al hacer clic en la hamburguesa
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Evita que el clic se propague
            mainNav.classList.toggle('open');
        });

        // Cerrar menú al hacer clic en cualquier enlace
        const navLinks = document.querySelectorAll('#main-nav a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
            });
        });

        // Opcional: Cerrar el menú si haces clic fuera de él (Mejora la experiencia)
        document.addEventListener('click', (e) => {
            if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
                mainNav.classList.remove('open');
            }
        });
    }
    // Header: barra negra al inicio, transparente al hacer scroll
    const header = document.querySelector('.main-header');
    if (header) {
        const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 40);
        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }
});