import os  # IMPORTANTE: Para leer las variables de Render
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)
CORS(app)

# --- FUNCIÓN DE CONEXIÓN SEGURA ---
def get_db_connection():
    """Establece conexión usando las variables de entorno de Render/Aiven."""
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 10994)),
        database=os.getenv('DB_NAME', 'defaultdb')
    )

# Función para enviar correo (se mantiene igual)
def enviar_correo_a_manicurista(nombre, fecha, hora):
    remitente = 'zonajah@gmail.com'
    destinatario = 'zonajah@gmail.com'
    contraseña = 'zrhr maml qwbe kjxz' 
    asunto = "Nueva Reserva de Hora"
    cuerpo = f"El cliente {nombre} ha reservado una hora el {fecha} a las {hora}."
    mensaje = MIMEMultipart()
    mensaje['From'] = remitente
    mensaje['To'] = destinatario
    mensaje['Subject'] = asunto
    mensaje.attach(MIMEText(cuerpo, 'plain'))
    try:
        servidor = smtplib.SMTP('smtp.gmail.com', 587)
        servidor.starttls()
        servidor.login(remitente, contraseña)
        servidor.send_message(mensaje)
        servidor.quit()
        print("✅ Correo enviado exitosamente.")
    except Exception as e:
        print("❌ Error enviando correo:", e)

# --- RUTAS ACTUALIZADAS ---

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    usuario = data.get('usuario')
    password = data.get('password')
    try:
        conexion = get_db_connection() # Usamos la nueva función
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM usuarios WHERE nombreusuario = %s OR email = %s", (usuario, usuario))
        user = cursor.fetchone()
        cursor.close()
        conexion.close()

        if user and check_password_hash(user["password"], password):
            return jsonify({"success": True, "nombre": user["nombre"], "id": user["id"]})
        else:
            return jsonify({"success": False, "error": "Usuario o contraseña incorrectos"}), 401
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    rut, nombreusuario = data.get('rut'), data.get('nombreusuario')
    nombre, apellido = data.get('nombre'), data.get('apellido')
    email, password = data.get('email'), data.get('password')
    try:
        hashed_password = generate_password_hash(password)
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE email = %s OR nombreusuario = %s", (email, nombreusuario))
        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "El correo o nombre de usuario ya existe."}), 400

        consulta = "INSERT INTO usuarios (rut, nombreusuario, nombre, apellido, email, password) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(consulta, (rut, nombreusuario, nombre, apellido, email, hashed_password))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "message": "Usuario registrado correctamente."})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

@app.route('/api/reserva_horas', methods=['POST'])
def crear_reserva():
    data = request.json
    usuario_id, nombre = data.get('usuario_id'), data.get('nombre')
    fecha, hora = data.get('fecha'), data.get('hora')
    if not usuario_id:
        return jsonify({"success": False, "mensaje": "Inicia sesión para reservar."}), 401
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT id FROM reserva_horas WHERE usuario_id = %s AND fecha = %s", (usuario_id, fecha))
        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "mensaje": "Ya tienes una reserva este día."}), 400
        
        cursor.execute("INSERT INTO reserva_horas (usuario_id, nombre, fecha, hora) VALUES (%s, %s, %s, %s)", (usuario_id, nombre, fecha, hora))
        conexion.commit()
        enviar_correo_a_manicurista(nombre, fecha, hora)
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "mensaje": "Reserva creada correctamente."})
    except Exception as err:
        return jsonify({"success": False, "mensaje": str(err)}), 500

@app.route('/api/mis_reservas/<int:usuario_id>', methods=['GET'])
def obtener_reservas(usuario_id):
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre, fecha, hora FROM reserva_horas WHERE usuario_id = %s ORDER BY fecha, hora", (usuario_id,))
        reservas = cursor.fetchall()
        cursor.close()
        conexion.close()
        for r in reservas:
            r['hora'] = str(r['hora']) # Evita error de JSON con objetos time
        return jsonify({"success": True, "reservas": reservas})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

if __name__ == '__main__':
    # En Render, la app se inicia con Gunicorn, pero esto sirve para pruebas locales
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))