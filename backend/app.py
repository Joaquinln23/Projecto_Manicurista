import os
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

# --- FUNCIÓN PARA ENVIAR CORREO (CON TIMEOUT PARA EVITAR BLOQUEOS) ---
def enviar_correo_a_manicurista(nombre, fecha, hora):
    remitente = 'zonajah@gmail.com'
    destinatario = 'zonajah@gmail.com'
    contraseña = 'zrhr maml qwbe kjxz' 
    asunto = f"Nueva Reserva: {nombre}"
    cuerpo = f"El cliente {nombre} ha reservado para el {fecha} a las {hora}."
    
    mensaje = MIMEMultipart()
    mensaje['From'] = remitente
    mensaje['To'] = destinatario
    mensaje['Subject'] = asunto
    mensaje.attach(MIMEText(cuerpo, 'plain'))
    
    try:
        # Agregamos un timeout de 8 segundos para que el servidor no se quede "pegado"
        servidor = smtplib.SMTP('smtp.gmail.com', 587, timeout=8)
        servidor.starttls()
        servidor.login(remitente, contraseña)
        servidor.send_message(mensaje)
        servidor.quit()
        print(f"✅ Correo enviado con éxito para {nombre}")
    except Exception as e:
        # El error se imprime en los logs de Render, pero no detiene la respuesta al usuario
        print(f"⚠️ Error enviando correo: {e}")

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

# --- RUTA DE RESERVAS (SOPORTA INVITADOS Y LOGUEADOS) ---

@app.route('/api/reserva_horas', methods=['POST'])
def crear_reserva():
    data = request.json
    
    # Manejo de ID: Si es invitado, el frontend manda "null" o vacío. Lo convertimos a None real.
    usuario_id = data.get('usuario_id')
    if usuario_id in [None, 'null', 'undefined', '', 'None']:
        usuario_id = None
    
    nombre = data.get('nombre')
    fecha = data.get('fecha')
    hora = data.get('hora')
    
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # 1. VALIDACIÓN: Máximo 5 reservas totales por día
        cursor.execute("SELECT COUNT(*) FROM reserva_horas WHERE fecha = %s", (fecha,))
        total_dia = cursor.fetchone()[0]
        
        if total_dia >= 5:
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "mensaje": "Lo sentimos, ya no quedan cupos para este día."}), 400

        # 2. INSERTAR RESERVA (MySQL acepta None como NULL)
        consulta = "INSERT INTO reserva_horas (usuario_id, nombre, fecha, hora) VALUES (%s, %s, %s, %s)"
        cursor.execute(consulta, (usuario_id, nombre, fecha, hora))
        conexion.commit()
        
        # Cerramos conexión antes de pasar al correo para liberar recursos
        cursor.close()
        conexion.close()

        # 3. NOTIFICACIÓN (Independiente: si el correo falla, la reserva ya está guardada)
        try:
            enviar_correo_a_manicurista(nombre, fecha, hora)
        except:
            pass 
        
        return jsonify({"success": True, "mensaje": "Reserva creada exitosamente."})
    
    except Exception as err:
        print(f"❌ Error crítico en reserva: {err}")
        return jsonify({"success": False, "mensaje": f"Error en el servidor: {str(err)}"}), 500

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
            r['hora'] = str(r['hora'])
        return jsonify({"success": True, "reservas": reservas})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

@app.route('/healthcheck')
def health_check():
    return "Servidor corriendo", 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)