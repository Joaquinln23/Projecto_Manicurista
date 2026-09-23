"""
Configuración puntual: crea el esquema de la aplicación en el servicio
MySQL de Aiven.

Uso:
    python3 backend/setup_db.py

Solicita interactivamente la contraseña de avnadmin (nunca se guarda ni
se registra en logs).
"""
import getpass

import mysql.connector

HOST = "caterinaartist-mysql-caterinartist.f.aivencloud.com"
PORT = 10994
USER = "avnadmin"
DATABASE = "defaultdb"

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rut VARCHAR(20) NOT NULL,
        nombreusuario VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(50) NOT NULL,
        apellido VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reserva_horas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NULL,
        nombre VARCHAR(100) NOT NULL,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
    """,
    # Loyalty ledger (fidelizacion Unit 3): append-only movements. Balance is
    # always the SUM of unexpired movements; debit rows (canjes) carry a
    # far-future expiry so they never drop out of the balance.
    """
    CREATE TABLE IF NOT EXISTS puntos_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        reserva_id INT NULL,
        puntos INT NOT NULL,
        motivo VARCHAR(30) NOT NULL,
        expira_en DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
    """,
    # Welcome coupon (fidelizacion PR4): exactly one per account, guarded by
    # UNIQUE(usuario_id) and UNIQUE(codigo). Bookings link via cupon_codigo.
    """
    CREATE TABLE IF NOT EXISTS cupones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL UNIQUE,
        codigo VARCHAR(20) NOT NULL UNIQUE,
        valor_pct INT NOT NULL DEFAULT 10,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        expira_en DATE NOT NULL,
        usado_en TIMESTAMP NULL,
        reserva_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
    """,
]

# Nullable booking-completion columns (fidelizacion Unit 3). Legacy
# reserva_horas rows are unaffected: NULL estado means "not attended".
# cupon_codigo (fidelizacion PR4) links an optional welcome coupon.
COLUMNAS_RESERVA_HORAS = [
    ("estado", "VARCHAR(20) NULL"),
    ("duracion_horas", "INT NULL DEFAULT 1"),
    ("cupon_codigo", "VARCHAR(20) NULL"),
]


def main() -> None:
    password = getpass.getpass("Password de avnadmin (Aiven): ")
    conn = mysql.connector.connect(
        host=HOST,
        port=PORT,
        user=USER,
        password=password,
        database=DATABASE,
    )
    try:
        cursor = conn.cursor()
        for statement in STATEMENTS:
            cursor.execute(statement)
        conn.commit()

        # Idempotent column migration: MySQL has no ADD COLUMN IF NOT EXISTS,
        # so add each missing column only when INFORMATION_SCHEMA lacks it.
        # Rerunning this script is always safe.
        for columna, definicion in COLUMNAS_RESERVA_HORAS:
            cursor.execute(
                """
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'reserva_horas'
                AND COLUMN_NAME = %s
                """,
                (DATABASE, columna),
            )
            existe = cursor.fetchone()[0]
            if not existe:
                cursor.execute(
                    f"ALTER TABLE reserva_horas ADD COLUMN {columna} {definicion}"
                )
        conn.commit()

        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        print("\nTablas en defaultdb:")
        for table in tables:
            print(f"  - {table}")
        cursor.close()
        print("\nEsquema listo.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
