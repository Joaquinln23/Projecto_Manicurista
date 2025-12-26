from flask import Flask, request, jsonify  # Importa Flask y utilidades para peticiones y respuestas JSON
from flask_cors import CORS  # Permite solicitudes desde otros orígenes (CORS)
import mysql.connector  # Conector para base de datos MySQL
from werkzeug.security import generate_password_hash, check_password_hash  # Para cifrar y verificar contraseñas
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)  # Crea la aplicación Flask
CORS(app)  # Habilita CORS para toda la app

# Función para enviar un correo electrónico a la manicurista
def enviar_correo_a_manicurista(nombre, fecha, hora):
    remitente = 'zonajah@gmail.com'
    destinatario = 'zonajah@gmail.com'  # correo real de la manicurista
    contraseña = 'tu_contraseña_de_aplicacion'  # usa una contraseña de aplicación si usas Gmail

    asunto = "Nueva Reserva de Hora"
    cuerpo = f"El cliente {nombre} ha reservado una hora el {fecha} a las {hora}."

    mensaje = MIMEMultipart()
    mensaje['From'] = remitente
    mensaje['To'] = destinatario
    mensaje['Subject'] = asunto
    mensaje.attach(MIMEText(cuerpo, 'plain'))

    try:
        # Configura el servidor SMTP de Gmail
        servidor = smtplib.SMTP('smtp.gmail.com', 587)
        servidor.starttls()  # Habilita la seguridad TLS
        servidor.login(remitente, contraseña)
        servidor.send_message(mensaje)
        servidor.quit()
        print("Correo enviado exitosamente.")
    except Exception as e:
        print("Error enviando correo:", e)

# Ruta para iniciar sesión
@app.route('/login', methods=['POST'])
def login():
    """Maneja el inicio de sesión de un usuario."""
    data = request.json  # Obtiene los datos enviados en formato JSON
    usuario = data.get('usuario')
    password = data.get('password')

    try:
        # Conexión a la base de datos
        conexion = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="proyecto_manicura"
        )
        cursor = conexion.cursor(dictionary=True)

        # Busca el usuario por nombre de usuario o correo electrónico
        cursor.execute("""
            SELECT * FROM usuarios 
            WHERE nombreusuario = %s OR email = %s
        """, (usuario, usuario))
        user = cursor.fetchone()

        cursor.close()
        conexion.close()

        # Verifica si el usuario existe y la contraseña es correcta
        if user and check_password_hash(user["password"], password):
            return jsonify({"success": True, "nombre": user["nombre"], "id": user["id"]})
        else:
            return jsonify({"success": False, "error": "Usuario o contraseña incorrectos"}), 401
    except mysql.connector.Error as err:
        # Manejo de errores de base de datos
        return jsonify({"success": False, "error": str(err)}), 500

# Ruta para registrar un nuevo usuario
@app.route('/register', methods=['POST'])
def register():
    """Maneja el registro de un nuevo usuario."""
    data = request.json
    rut = data.get('rut')
    nombreusuario = data.get('nombreusuario')
    nombre = data.get('nombre')
    apellido = data.get('apellido')
    email = data.get('email')
    password = data.get('password')

    try:
        hashed_password = generate_password_hash(password)  # Cifra la contraseña

        # Conexión a la base de datos
        conexion = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="proyecto_manicura"
        )
        cursor = conexion.cursor()

        # Verifica si el usuario ya existe por email o nombre de usuario
        cursor.execute("SELECT id FROM usuarios WHERE email = %s OR nombreusuario = %s", (email, nombreusuario))
        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "El correo o nombre de usuario ya está registrado."}), 400

        # Inserta el nuevo usuario en la base de datos
        consulta = """
            INSERT INTO usuarios (rut, nombreusuario, nombre, apellido, email, password)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(consulta, (rut, nombreusuario, nombre, apellido, email, hashed_password))
        conexion.commit()

        cursor.close()
        conexion.close()
        return jsonify({"success": True, "message": "Usuario registrado correctamente."})
    except mysql.connector.Error as err:
        # Manejo de errores de base de datos
        return jsonify({"success": False, "error": str(err)}), 500

# Ruta para crear una nueva reserva de hora
@app.route('/api/reserva_horas', methods=['POST'])
def crear_reserva():
    """Maneja la creación de una nueva reserva de hora."""
    data = request.json
    usuario_id = data.get('usuario_id')
    nombre = data.get('nombre')
    fecha = data.get('fecha')
    hora = data.get('hora')

    if not usuario_id:
        return jsonify({"success": False, "mensaje": "Debes iniciar sesión para reservar."}), 401

    try:
        # Conexión a la base de datos
        conexion = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="proyecto_manicura"
        )
        cursor = conexion.cursor()
        
        # Verifica si ya existe una reserva para el usuario en la misma fecha
        cursor.execute("""
            SELECT id FROM reserva_horas 
            WHERE usuario_id = %s AND fecha = %s
        """, (usuario_id, fecha))

        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "mensaje": "Ya tienes una reserva registrada para este día."}), 400
        
        # Inserta la reserva en la base de datos
        cursor.execute("""
            INSERT INTO reserva_horas (usuario_id, nombre, fecha, hora)
            VALUES (%s, %s, %s, %s)
        """, (usuario_id, nombre, fecha, hora))
        conexion.commit()

        # Envía el correo después de confirmar que se guardó en la base de datos
        enviar_correo_a_manicurista(nombre, fecha, hora)

        cursor.close()
        conexion.close()
        return jsonify({"success": True, "mensaje": "Reserva creada correctamente."})

    except mysql.connector.Error as err:
        # Manejo de errores de base de datos
        if err.errno == 1062:  # Código de error para duplicación
            return jsonify({"success": False, "mensaje": "Ya hay una reserva en esa fecha y hora."}), 400
        return jsonify({"success": False, "mensaje": str(err)}), 500
    

# Ruta para obtener las reservas de un usuario específico por su usuario_id
@app.route('/api/mis_reservas/<int:usuario_id>', methods=['GET'])
def obtener_reservas(usuario_id):
    """Obtiene todas las reservas asociadas a un usuario específico."""
    try:
        # Conexión a la base de datos
        conexion = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="proyecto_manicura"
        )
        cursor = conexion.cursor(dictionary=True)
        # Consulta las reservas asociadas al usuario, ordenadas por fecha y hora
        cursor.execute("""
            SELECT id, nombre, fecha, hora FROM reserva_horas 
            WHERE usuario_id = %s 
            ORDER BY fecha, hora
        """, (usuario_id,))
        reservas = cursor.fetchall()
        cursor.close()
        conexion.close()
        # Convertir el campo 'hora' a string para evitar problemas de serialización
        for reserva in reservas:
            if isinstance(reserva['hora'], (str, type(None))):
                continue
            reserva['hora'] = str(reserva['hora'])
        # Devuelve las reservas en formato JSON
        return jsonify({"success": True, "reservas": reservas})
    except mysql.connector.Error as err:
        # Manejo de errores de base de datos
        return jsonify({"success": False, "error": str(err)}), 500

# Punto de entrada principal de la aplicación
if __name__ == '__main__':
    app.run(debug=True)  # Ejecuta la aplicación en modo de depuración
    # Esto permite ver errores y cambios en tiempo real sin reiniciar el servidor
