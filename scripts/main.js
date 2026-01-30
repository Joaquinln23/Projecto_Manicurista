// Este archivo manejará solo lo relacionado al menú y otras funciones generales (sin reservas)
function showMessage(message, type = 'success') {
    // Eliminar alerta previa si existe
    const alertaPrevia = document.querySelector('.alert-message');
    if (alertaPrevia) alertaPrevia.remove();

    // Crear el contenedor de la alerta
    const messageBox = document.createElement('div');
    
    // Asignamos las clases dinámicas para el color (verde o rojo)
    // El tipo debe ser 'success' (verde) o 'error' (rojo)
    messageBox.className = `alert-message alert-${type}`;
    messageBox.textContent = message;

    document.body.appendChild(messageBox);

    // Desvanecer y eliminar después de 4 segundos
    setTimeout(() => {
        messageBox.classList.add('fade-out');
        setTimeout(() => {
            if(messageBox.parentNode) messageBox.remove();
        }, 500);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Interfaz cargada correctamente');

    // Menú hamburguesa
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('open');
        });

        // Cerrar menú al hacer clic en un enlace
        document.querySelectorAll('#main-nav a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
            });
        });
    }
});
