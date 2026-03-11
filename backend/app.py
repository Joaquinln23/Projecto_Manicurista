import os
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

app = Flask(__name__)
CORS(app)

# --- FUNCIÓN DE CONEXIÓN SEGURA ---
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 10994)),
        database=os.getenv('DB_NAME', 'defaultdb')
    )

# --- FUNCIÓN ASÍNCRONA PARA ENVIAR CORREO ---
def enviar_correo_async(nombre, fecha, hora):
    remitente = os.getenv('EMAIL_USER')
    contraseña = os.getenv('EMAIL_PASSWORD')
    destinatario = os.getenv('EMAIL_RECEIVER')
    
    asunto = f"Nueva Reserva: {nombre}"
    cuerpo = f"Cliente: {nombre}\nFecha: {fecha}\nHora: {hora}"
    
    mensaje = MIMEMultipart()
    mensaje['From'] = remitente
    mensaje['To'] = destinatario
    mensaje['Subject'] = asunto
    mensaje.attach(MIMEText(cuerpo, 'plain'))
    
    try:
        # SMTP_SSL es más seguro y rápido para el puerto 465 de Gmail
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=10) as servidor:
            servidor.login(remitente, contraseña)
            servidor.send_message(mensaje)
            print(f"✅ Correo enviado exitosamente para la reserva de: {nombre}")
    except Exception as e:
        print(f"❌ Error enviando correo en segundo plano: {e}")

# --- RUTAS DE USUARIO ---

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    usuario = data.get('usuario')
    password = data.get('password')
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM usuarios WHERE nombreusuario = %s OR email = %s", (usuario, usuario))
        user = cursor.fetchone()
        cursor.close()
        conexion.close()

        if user and check_password_hash(user["password"], password):
            return jsonify({"success": True, "nombre": user["nombre"], "id": user["id"]})
        return jsonify({"success": False, "error": "Credenciales incorrectas"}), 401
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    hashed_password = generate_password_hash(data.get('password'))
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        consulta = "INSERT INTO usuarios (rut, nombreusuario, nombre, apellido, email, password) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(consulta, (data.get('rut'), data.get('nombreusuario'), data.get('nombre'), data.get('apellido'), data.get('email'), hashed_password))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

# --- RUTA DE RESERVAS ---

@app.route('/api/reserva_horas', methods=['POST'])
def crear_reserva():
    data = request.json
    usuario_id = data.get('usuario_id')
    
    # Limpieza de IDs nulos o indefinidos provenientes de JS
    if usuario_id in [None, 'null', 'undefined', '', 'None']:
        usuario_id = None
    
    nombre = data.get('nombre')
    fecha = data.get('fecha')
    hora = data.get('hora')
    
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # 1. VALIDACIÓN DE CUPOS (Máximo 5 por día)
        cursor.execute("SELECT COUNT(*) FROM reserva_horas WHERE fecha = %s", (fecha,))
        total_dia = cursor.fetchone()[0]
        
        if total_dia >= 5:
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "mensaje": "Lo sentimos, ya no quedan cupos para este día."}), 400

        # 2. INSERTAR RESERVA EN BD
        consulta = "INSERT INTO reserva_horas (usuario_id, nombre, fecha, hora) VALUES (%s, %s, %s, %s)"
        cursor.execute(consulta, (usuario_id, nombre, fecha, hora))
        conexion.commit()
        cursor.close()
        conexion.close()

        # 3. DISPARAR ENVÍO DE CORREO ASÍNCRONO
        # El hilo (thread) se encarga del correo mientras el servidor responde al cliente
        thread = threading.Thread(target=enviar_correo_async, args=(nombre, fecha, hora))
        thread.start()
        
        return jsonify({"success": True, "mensaje": "Reserva creada exitosamente."})
    
    except Exception as err:
        print(f"❌ Error crítico en reserva: {err}")
        return jsonify({"success": False, "mensaje": f"Error en el servidor: {str(err)}"}), 500

@app.route('/api/mis_reservas/<int:usuario_id>', methods=['GET'])
def obtener_reservas(usuario_id):
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre, fecha, hora FROM reserva_horas WHERE usuario_id = %s ORDER BY fecha DESC, hora DESC", (usuario_id,))
        reservas = cursor.fetchall()
        cursor.close()
        conexion.close()
        
        # Formatear objetos de fecha y hora para JSON
        for r in reservas:
            if r['fecha']:
                r['fecha'] = r['fecha'].strftime('%Y-%m-%d')
            r['hora'] = str(r['hora'])[:5] # Deja formato HH:MM
            
        return jsonify({"success": True, "reservas": reservas})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

@app.route('/healthcheck')
def health_check():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conexion.close()
        return "Conectado", 200
    except Exception as e:
        print(f"⚠️ Alerta: Error de BD en Healthcheck: {e}")
        return "Backend OK, BD Error", 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)