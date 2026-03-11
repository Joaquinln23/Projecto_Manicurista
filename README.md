# 💅 CaterinaArtist - Sistema de Reservas para Manicuristas

[![Estado del Despliegue](https://img.shields.io/website?label=Backend%20Status&url=https%3A%2F%2Fprojecto-manicurista.onrender.com%2Fhealthcheck)](https://projecto-manicurista.onrender.com/healthcheck)
[![Vistas del Repositorio](https://komarev.com/ghpvc/?username=Joaquinln23&repo=Projecto_Manicurista&color=pink)](https://github.com/Joaquinln23/Projecto_Manicurista)

Este proyecto **Full-Stack** fue diseñado y desarrollado para centralizar la gestión de citas de una manicurista independiente. Permite una experiencia fluida tanto para clientes habituales (con cuenta) como para clientes nuevos (invitados).

---

### 🚀 Ver Proyecto en Vivo

Puedes probar la aplicación funcionando en tiempo real a través del siguiente enlace:

👉 **[CaterinaArtist - Demo en Vivo (Netlify)](https://caterinaartist.netlify.app/)**

---

### ✨ Características Destacadas

* **🛡️ Autenticación y Seguridad:** Sistema de login y registro robusto con hashing de contraseñas (`PBKDF2`).
* **📱 Panel de Usuario:** Los clientes registrados pueden ver su historial de citas y próximas fechas agendadas en tiempo real.
* **⚡ Notificaciones Eficientes:** Implementación de hilos (`threading`) en Python para enviar correos de confirmación sin afectar la velocidad de respuesta del frontend.
* **📊 Base de Datos Escalable:** Uso de MySQL gestionado a través de **Aiven Cloud**, garantizando disponibilidad y respaldos.
* **🛠️ Validación Inteligente:** Control automático de cupos (máximo 5 reservas diarias) y restricción de fechas pasadas.

---

### 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend** | ![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54) ![Flask](https://img.shields.io/badge/flask-%23000.svg?style=for-the-badge&logo=flask&logoColor=white) |
| **Frontend** | ![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black) |
| **Cloud & DB** | ![MySQL](https://img.shields.io/badge/mysql-%2300f.svg?style=for-the-badge&logo=mysql&logoColor=white) ![Aiven](https://img.shields.io/badge/Aiven-%23FF4081.svg?style=for-the-badge&logo=aiven&logoColor=white) |
| **Hosting** | ![Render](https://img.shields.io/badge/Render-%23000.svg?style=for-the-badge&logo=render&logoColor=white) ![Netlify](https://img.shields.io/badge/netlify-%23000000.svg?style=for-the-badge&logo=netlify&logoColor=#00C7B7) |

---

### 📂 Estructura del Proyecto

```text
├── src/
│   ├── backend/          # Servidor Flask y Lógica de Negocio
│   └── frontend/         # Archivos HTML, CSS y JS (Desplegado en Netlify)
├── .env.example          # Guía para variables de entorno
└── README.md
