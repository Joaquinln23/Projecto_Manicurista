// Este archivo manejará solo lo relacionado al menú y otras funciones generales (sin reservas)
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
