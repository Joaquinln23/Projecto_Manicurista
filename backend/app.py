"""API Flask de Caterina Artist: login, registro, reservas y healthcheck."""

import os
import hmac
import re
import secrets
import string
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from datetime import date, datetime, timedelta

app = Flask(__name__)
CORS(app)

# --- FUNCIÓN DE CONEXIÓN SEGURA ---
def get_db_connection():
    """Abre una conexión MySQL a partir de las variables de entorno."""
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 10994)),
        database=os.getenv('DB_NAME', 'defaultdb')
    )

# --- ASYNC EMAIL SENDER (via Resend) ---
# Required Render env vars: RESEND_API_KEY, EMAIL_RECEIVER, optional EMAIL_FROM
# (defaults to onboarding@resend.dev).
# Uses the Resend HTTPS API (port 443) because Render's free tier blocks
# outbound SMTP ports 25/465/587, so smtplib can never connect in production.
def enviar_correo_async(nombre, fecha, hora):
    """Sends the new-booking notice via Resend in a background thread."""
    api_key = os.getenv('RESEND_API_KEY')
    if not api_key:
        print("❌ Error enviando correo en segundo plano: missing RESEND_API_KEY")
        return

    remitente = os.getenv('EMAIL_FROM', 'onboarding@resend.dev')
    destinatario = os.getenv('EMAIL_RECEIVER')

    asunto = f"Nueva Reserva: {nombre}"
    cuerpo = f"Cliente: {nombre}\nFecha: {fecha}\nHora: {hora}"

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": remitente,
                "to": [destinatario],
                "subject": asunto,
                "text": cuerpo,
            },
            timeout=10,
        )
        if response.status_code == 200:
            print(f"✅ Correo enviado exitosamente para la reserva de: {nombre}")
        else:
            print(f"❌ Error enviando correo en segundo plano: status {response.status_code}: {response.text[:500]}")
    except Exception as e:
        print(f"❌ Error enviando correo en segundo plano: {e}")

# --- RUTAS DE USUARIO ---

# Registration validators (fidelizacion Unit 2, server side, authoritative).
# Single mirrored RUT rule, duplicated in scripts/login.js; legacy usuarios
# rows are exempt because only POST /register runs these checks.
_RUT_RE = re.compile(r"^(\d{7,8})-([\dK])$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def normalizar_rut(valor):
    """Strip dots/spaces and uppercase, mirroring the JS normalize step."""
    return re.sub(r"[.\s]", "", str(valor or "")).upper()


def validar_rut_chileno(valor):
    """Return True when the normalized RUT passes the modulo-11 check."""
    coincidencia = _RUT_RE.match(normalizar_rut(valor))
    if not coincidencia:
        return False
    numero, dv_recibido = coincidencia.groups()
    pesos = (2, 3, 4, 5, 6, 7)
    total = sum(int(d) * pesos[i % len(pesos)] for i, d in enumerate(reversed(numero)))
    resto = 11 - (total % 11)
    esperado = "0" if resto == 11 else "K" if resto == 10 else str(resto)
    return dv_recibido == esperado


def es_email_valido(valor):
    """Format-only email check; no MX, deliverability, or loop checks."""
    return bool(_EMAIL_RE.match(str(valor or "")))


# --- CUPONES DE BIENVENIDA (fidelizacion PR4) ---

# One 10% first-booking coupon per account, expiring 60 days after issue.
# Codes look like BIENV-XXXXXX (6 uppercase alphanumerics via secrets).
CUPON_BIENVENIDA_PREFIJO = "BIENV-"
CUPON_BIENVENIDA_VALOR_PCT = 10
CUPON_BIENVENIDA_VIGENCIA_DIAS = 60


def _nuevo_codigo_cupon():
    """Generate a BIENV-XXXXXX candidate code (UNIQUE collisions retried)."""
    alfabeto = string.ascii_uppercase + string.digits
    sufijo = "".join(secrets.choice(alfabeto) for _ in range(6))
    return f"{CUPON_BIENVENIDA_PREFIJO}{sufijo}"


def _cupon_por_codigo(cursor, codigo):
    """Fetch one coupon row by code (None when unknown)."""
    cursor.execute(
        "SELECT id, usuario_id, codigo, valor_pct, estado, expira_en,"
        " usado_en, reserva_id FROM cupones WHERE codigo = %s",
        (codigo,),
    )
    return cursor.fetchone()


def _cupones_de_usuario(cursor, usuario_id):
    """Fetch every coupon row owned by a user (newest first)."""
    cursor.execute(
        "SELECT codigo, valor_pct, estado, expira_en, usado_en"
        " FROM cupones WHERE usuario_id = %s ORDER BY id DESC",
        (usuario_id,),
    )
    return cursor.fetchall()

@app.route('/login', methods=['POST'])
def login():
    """Autentica por usuario o correo y devuelve datos básicos del usuario."""
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
    """Crea un usuario con contraseña hasheada."""
    data = request.json or {}
    # Authoritative registration gate: invalid RUT/email are rejected with
    # 400 before touching the database. Only new rows are checked, so legacy
    # usuarios rows with non-conforming data stay untouched.
    if not validar_rut_chileno(data.get('rut')):
        return jsonify({"success": False, "error": "Revisa tu RUT e inténtalo de nuevo"}), 400
    if not es_email_valido(data.get('email')):
        return jsonify({"success": False, "error": "Revisa tu correo, parece que le falta algo"}), 400
    hashed_password = generate_password_hash(data.get('password'))
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        consulta = "INSERT INTO usuarios (rut, nombreusuario, nombre, apellido, email, password) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(consulta, (data.get('rut'), data.get('nombreusuario'), data.get('nombre'), data.get('apellido'), data.get('email'), hashed_password))
        usuario_id = cursor.lastrowid
        # Welcome coupon (fidelizacion PR4): exactly one per account, issued
        # in the same connection right after the user row. Duplicate
        # registrations fail on the usuarios INSERT above, so no second
        # coupon is ever created. UNIQUE(codigo) collisions are retried.
        expira_cupon = date.today() + timedelta(days=CUPON_BIENVENIDA_VIGENCIA_DIAS)
        cupon = None
        for _intento in range(5):
            codigo = _nuevo_codigo_cupon()
            try:
                cursor.execute(
                    "INSERT INTO cupones"
                    " (usuario_id, codigo, valor_pct, estado, expira_en)"
                    " VALUES (%s, %s, %s, %s, %s)",
                    (usuario_id, codigo, CUPON_BIENVENIDA_VALOR_PCT, "activo", expira_cupon),
                )
                cupon = {
                    "codigo": codigo,
                    "valor_pct": CUPON_BIENVENIDA_VALOR_PCT,
                    "expira_en": expira_cupon.isoformat(),
                }
                break
            except Exception as err:
                if "Duplicate entry" not in str(err):
                    raise
        if cupon is None:
            raise RuntimeError("No se pudo generar un cupón único")
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "cupon": cupon})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

# --- RUTA DE RESERVAS ---

@app.route('/api/reserva_horas', methods=['POST'])
def crear_reserva():
    """Registra una reserva (máx. 5 por día) y dispara el correo asíncrono."""
    data = request.json
    usuario_id = data.get('usuario_id')
    
    # Limpieza de IDs nulos o indefinidos provenientes de JS
    if usuario_id in [None, 'null', 'undefined', '', 'None']:
        usuario_id = None
    
    nombre = data.get('nombre')
    fecha = data.get('fecha')
    hora = data.get('hora')
    # Optional welcome-coupon code (fidelizacion PR4). Empty means no coupon
    # and keeps the legacy booking path untouched.
    cupon_codigo = str(data.get('cupon_codigo') or '').strip().upper()

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

        # 1b. VALIDACIÓN DEL CUPÓN (opcional): must exist, stay unused and
        # unexpired, and belong to the booking owner. Any failure is a 400
        # with zero writes. Coupon rows are dicts, so they need a dict
        # cursor while the booking flow keeps its tuple cursor.
        if cupon_codigo:
            cursor_dic = conexion.cursor(dictionary=True)
            cupon = _cupon_por_codigo(cursor_dic, cupon_codigo)
            cursor_dic.close()
            if cupon is None:
                cursor.close()
                conexion.close()
                return jsonify({"success": False, "mensaje": "Ese cupón no existe, revísalo e inténtalo de nuevo"}), 400
            if str(cupon.get("estado")) != "activo":
                cursor.close()
                conexion.close()
                return jsonify({"success": False, "mensaje": "Ese cupón ya fue usado"}), 400
            if (_como_fecha(cupon.get("expira_en")) or date.today()) < date.today():
                cursor.close()
                conexion.close()
                return jsonify({"success": False, "mensaje": "Ese cupón ya venció"}), 400
            if usuario_id is None or str(cupon.get("usuario_id")) != str(usuario_id):
                cursor.close()
                conexion.close()
                return jsonify({"success": False, "mensaje": "Ese cupón pertenece a otra cuenta"}), 400

        # 2. INSERTAR RESERVA EN BD
        if cupon_codigo:
            consulta = "INSERT INTO reserva_horas (usuario_id, nombre, fecha, hora, cupon_codigo) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(consulta, (usuario_id, nombre, fecha, hora, cupon_codigo))
        else:
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
    """Lista las reservas de un usuario con fecha/hora listas para JSON."""
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

# --- PUNTOS DE FIDELIZACIÓN (Unit 3) ---

# Loyalty constants: 100 points per completed booked hour, each credit
# movement expires 12 months after creation. Redemption catalog is fixed.
PUNTOS_POR_HORA = 100
COSTO_CANJE = {"gift": 1000, "express": 500}
# Debit rows must never expire out of the balance (expired rows are
# excluded from the SUM), so canjes carry a far-future expiry date.
DEBITO_SIN_VENCIMIENTO = date(9999, 12, 31)


def _mas_doce_meses(hoy):
    """Return the same calendar day 12 months later (Feb 29 -> Feb 28)."""
    try:
        return hoy.replace(year=hoy.year + 1)
    except ValueError:
        return hoy.replace(year=hoy.year + 1, day=28)


def _como_fecha(valor):
    """Normalize a DATE/DATETIME/ISO-string column value to a date."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def _iso(valor):
    """Serialize a date/datetime value for JSON (None stays None)."""
    normalizada = _como_fecha(valor) if not isinstance(valor, str) else valor
    return normalizada.isoformat() if hasattr(normalizada, "isoformat") else normalizada


def _movimientos_de_usuario(cursor, usuario_id):
    """Fetch every ledger movement for a user (expiry is applied in Python)."""
    cursor.execute(
        "SELECT id, puntos, motivo, reserva_id, expira_en, created_at"
        " FROM puntos_movimientos WHERE usuario_id = %s ORDER BY id DESC",
        (usuario_id,),
    )
    return cursor.fetchall()


def _balance_y_historial(movimientos, hoy):
    """Compute balance as the SUM of unexpired movements plus history."""
    movimientos = [m for m in (movimientos or []) if isinstance(m, dict)]
    vigentes = [m for m in movimientos if (_como_fecha(m.get("expira_en")) or hoy) >= hoy]
    balance = sum(int(m.get("puntos") or 0) for m in vigentes)
    historial = [
        {
            "id": m.get("id"),
            "puntos": int(m.get("puntos") or 0),
            "motivo": m.get("motivo"),
            "reserva_id": m.get("reserva_id"),
            "expira_en": _iso(m.get("expira_en")),
            "created_at": _iso(m.get("created_at")),
        }
        for m in movimientos
    ]
    return balance, historial


def _secreto_owner_valido(provisto):
    """Compare the request header against the env-only owner secret."""
    esperado = os.getenv("OWNER_ATTENDANCE_SECRET", "")
    if not esperado:
        return False
    # Byte comparison: str compare_digest rejects non-ASCII input, bytes
    # (UTF-8) accept any header value and simply mismatch when wrong.
    return hmac.compare_digest(
        str(provisto or "").encode("utf-8"), esperado.encode("utf-8")
    )


@app.route('/api/asistencia', methods=['POST'])
def registrar_asistencia():
    """Mark a booking attended (owner only) and credit 100 pts per hour."""
    # Secret gate runs before any read or write: no match means 403 and
    # zero ledger or booking changes.
    if not _secreto_owner_valido(request.headers.get("X-Owner-Secret")):
        return jsonify({"success": False, "error": "No tienes permiso para marcar asistencia"}), 403
    data = request.json or {}
    reserva_id = data.get("reserva_id")
    if not reserva_id:
        return jsonify({"success": False, "error": "Falta la reserva que quieres marcar"}), 400
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, usuario_id, estado, duracion_horas"
            " FROM reserva_horas WHERE id = %s",
            (reserva_id,),
        )
        reserva = cursor.fetchone()
        if not reserva:
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "Esa reserva no existe"}), 404
        if reserva.get("estado") == "asistio":
            cursor.close()
            conexion.close()
            return jsonify({"success": True, "puntos": 0, "mensaje": "Esa reserva ya estaba marcada como asistida"})
        duracion = reserva.get("duracion_horas") or 1
        puntos = PUNTOS_POR_HORA * int(duracion)
        cursor.execute(
            "UPDATE reserva_horas SET estado = %s WHERE id = %s",
            ("asistio", reserva_id),
        )
        hoy = date.today()
        cursor.execute(
            "INSERT INTO puntos_movimientos"
            " (usuario_id, reserva_id, puntos, motivo, expira_en)"
            " VALUES (%s, %s, %s, %s, %s)",
            (reserva.get("usuario_id"), reserva_id, puntos, "asistencia", _mas_doce_meses(hoy)),
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "puntos": puntos})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@app.route('/api/puntos/<int:usuario_id>', methods=['GET'])
def obtener_puntos(usuario_id):
    """Return the unexpired SUM balance plus the full movement history."""
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        movimientos = _movimientos_de_usuario(cursor, usuario_id)
        cursor.close()
        conexion.close()
        balance, historial = _balance_y_historial(movimientos, date.today())
        return jsonify({"success": True, "balance": balance, "movimientos": historial})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@app.route('/api/canjes', methods=['POST'])
def crear_canje():
    """Redeem gift/express as a debit movement; insufficient balance refused."""
    data = request.json or {}
    usuario_id = data.get("usuario_id")
    tipo = str(data.get("tipo") or "").lower()
    if not usuario_id or tipo not in COSTO_CANJE:
        return jsonify({"success": False, "error": "Elige un canje válido: gift o express"}), 400
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        movimientos = _movimientos_de_usuario(cursor, usuario_id)
        balance, _ = _balance_y_historial(movimientos, date.today())
        costo = COSTO_CANJE[tipo]
        if balance < costo:
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "Aún no tienes puntos suficientes para ese canje"}), 400
        cursor.execute(
            "INSERT INTO puntos_movimientos"
            " (usuario_id, reserva_id, puntos, motivo, expira_en)"
            " VALUES (%s, %s, %s, %s, %s)",
            (usuario_id, None, -costo, f"canje_{tipo}", DEBITO_SIN_VENCIMIENTO),
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "balance": balance - costo})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@app.route('/api/cupones/<int:usuario_id>', methods=['GET'])
def obtener_cupones(usuario_id):
    """Return every welcome coupon owned by a user (newest first)."""
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        filas = _cupones_de_usuario(cursor, usuario_id)
        cursor.close()
        conexion.close()
        cupones = [
            {
                "codigo": f.get("codigo"),
                "valor_pct": int(f.get("valor_pct") or 0),
                "estado": f.get("estado"),
                "expira_en": _iso(f.get("expira_en")),
                "usado_en": _iso(f.get("usado_en")) if f.get("usado_en") else None,
            }
            for f in (filas or [])
        ]
        return jsonify({"success": True, "cupones": cupones})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@app.route('/api/cupones/usar', methods=['POST'])
def usar_cupon():
    """Mark a welcome coupon used (owner only, reusing the secret gate)."""
    # Secret gate runs before any read or write: no match means 403 and
    # zero coupon changes.
    if not _secreto_owner_valido(request.headers.get("X-Owner-Secret")):
        return jsonify({"success": False, "error": "No tienes permiso para marcar cupones"}), 403
    data = request.json or {}
    codigo = str(data.get("codigo") or "").strip().upper()
    if not codigo:
        return jsonify({"success": False, "error": "Falta el código del cupón"}), 400
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor(dictionary=True)
        cupon = _cupon_por_codigo(cursor, codigo)
        if cupon is None:
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "Ese cupón no existe"}), 404
        if str(cupon.get("estado")) != "activo":
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "Ese cupón ya fue usado"}), 409
        if (_como_fecha(cupon.get("expira_en")) or date.today()) < date.today():
            cursor.close()
            conexion.close()
            return jsonify({"success": False, "error": "Ese cupón ya venció"}), 400
        ahora = datetime.now()
        cursor.execute(
            "UPDATE cupones SET estado = %s, usado_en = %s WHERE codigo = %s",
            ("usado", ahora, codigo),
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"success": True, "codigo": codigo})
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500


@app.route('/healthcheck')
def health_check():
    """Comprueba la BD; devuelve 200 aunque la BD falle (healthcheck de Render)."""
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