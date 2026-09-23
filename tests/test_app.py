"""Pruebas baseline del backend Flask (sin MySQL: get_db_connection se parchea)."""
from datetime import date, time
from pathlib import Path

from werkzeug.security import generate_password_hash

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"


def _paquetes(path: Path) -> list[str]:
    """Devuelve nombres de paquete de un requirements, sin comentarios ni vacíos."""
    if not path.exists():
        return []
    lineas = []
    for linea in path.read_text(encoding="utf-8").splitlines():
        limpio = linea.split("#", 1)[0].strip().lower()
        if limpio:
            lineas.append(limpio)
    return lineas


def test_pytest_fuera_de_requirements_produccion():
    """Matriz de amenazas: pytest solo en requirements-dev, nunca en requirements.txt de producción."""
    produccion = _paquetes(BACKEND_DIR / "requirements.txt")
    desarrollo = _paquetes(BACKEND_DIR / "requirements-dev.txt")

    assert not any(p == "pytest" or p.startswith("pytest==") or p.startswith("pytest>=") or p.startswith("pytest<=") or p.startswith("pytest~=") for p in produccion), (
        f"pytest no debe estar en requirements.txt de producción: {produccion}"
    )
    assert any(p == "pytest" or p.startswith("pytest==") or p.startswith("pytest>=") for p in desarrollo), (
        "pytest debe declararse en backend/requirements-dev.txt"
    )


def test_login_ok(client, fake_db):
    fake_db.user = {
        "id": 1,
        "nombre": "Ana",
        "password": generate_password_hash("secret123"),
    }
    res = client.post("/login", json={"usuario": "ana", "password": "secret123"})
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "nombre": "Ana", "id": 1}


def test_login_credenciales_invalidas(client, fake_db):
    fake_db.user = {
        "id": 1,
        "nombre": "Ana",
        "password": generate_password_hash("secret123"),
    }
    res = client.post("/login", json={"usuario": "ana", "password": "otra"})
    assert res.status_code == 401
    assert res.get_json()["success"] is False


def test_register_ok(client, fake_db):
    """Valid registration succeeds AND issues one 10% coupon (+60 days)."""
    from datetime import timedelta

    res = client.post(
        "/register",
        json={
            "rut": "12345678-5",
            "nombreusuario": "ana",
            "nombre": "Ana",
            "apellido": "Pérez",
            "email": "ana@example.com",
            "password": "secret123",
        },
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    cupon = data["cupon"]
    assert cupon["codigo"].startswith("BIENV-")
    assert len(cupon["codigo"]) == len("BIENV-XXXXXX")
    assert cupon["valor_pct"] == 10
    assert cupon["expira_en"] == (date.today() + timedelta(days=60)).isoformat()
    assert any("INSERT INTO USUARIOS" in sql.upper() for sql, _ in fake_db.executed)
    assert any("INSERT INTO CUPONES" in sql.upper() for sql, _ in fake_db.executed)
    assert len(fake_db.cupones) == 1


def test_register_rut_invalido_devuelve_400_sin_insert(client, fake_db):
    """Spec registration-validation: RUT failing mod-11 is rejected server-side."""
    res = client.post(
        "/register",
        json={
            "rut": "12345678-9",
            "nombreusuario": "ana",
            "nombre": "Ana",
            "apellido": "Pérez",
            "email": "ana@example.com",
            "password": "secret123",
        },
    )
    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert not any("INSERT INTO USUARIOS" in sql.upper() for sql, _ in fake_db.executed)


def test_register_email_malformado_devuelve_400_sin_insert(client, fake_db):
    """Spec registration-validation: format-only email gate rejects missing domain."""
    res = client.post(
        "/register",
        json={
            "rut": "12345678-5",
            "nombreusuario": "ana",
            "nombre": "Ana",
            "apellido": "Pérez",
            "email": "ana@correo",
            "password": "secret123",
        },
    )
    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert not any("INSERT INTO USUARIOS" in sql.upper() for sql, _ in fake_db.executed)


def test_reserva_cupo_agotado_devuelve_400(client, fake_db):
    fake_db.count = 5
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00", "usuario_id": 1},
    )
    assert res.status_code == 400
    assert res.get_json()["success"] is False


def test_reserva_usuario_id_null_string_se_vacia_none(client, fake_db):
    fake_db.count = 0
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00", "usuario_id": "null"},
    )
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    inserts = [params for sql, params in fake_db.executed if "INSERT INTO RESERVA_HORAS" in sql.upper()]
    assert inserts, "no se registró el INSERT de la reserva"
    assert inserts[0][0] is None


def test_reserva_ok(client, fake_db):
    fake_db.count = 0
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00", "usuario_id": 7},
    )
    assert res.status_code == 200
    assert res.get_json()["success"] is True


def test_mis_reservas_formatea_fecha_y_hora(client, fake_db):
    fake_db.reservas = [
        {"id": 1, "nombre": "Ana", "fecha": date(2026, 9, 21), "hora": time(15, 30)}
    ]
    res = client.get("/api/mis_reservas/1")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    reserva = data["reservas"][0]
    assert reserva["fecha"] == "2026-09-21"
    assert reserva["hora"] == "15:30"


def test_healthcheck_ok(client, fake_db):
    res = client.get("/healthcheck")
    assert res.status_code == 200
    assert res.get_data(as_text=True) == "Conectado"


# --- LOYALTY POINTS (fidelizacion Phase 4) ---

# Loyalty vectors run against the FakeDB ledger from tests/conftest.py
# (offline only; production MySQL is never touched). The owner secret
# travels in the X-Owner-Secret header and is compared against the
# OWNER_ATTENDANCE_SECRET environment variable.

OWNER_SECRET = "test-owner-secret"
OWNER_HEADERS = {"X-Owner-Secret": OWNER_SECRET}


def _con_secret(monkeypatch):
    monkeypatch.setenv("OWNER_ATTENDANCE_SECRET", OWNER_SECRET)


def _reserva(fake_db, rid=10, usuario_id=7, duracion=1, estado=None):
    fake_db.reservas_by_id[rid] = {
        "id": rid,
        "usuario_id": usuario_id,
        "estado": estado,
        "duracion_horas": duracion,
    }
    return rid


def _movimiento(fake_db, mid, usuario_id=7, puntos=100, motivo="asistencia",
                expira_en=None, reserva_id=None):
    from datetime import timedelta

    fake_db.movimientos.append(
        {
            "id": mid,
            "usuario_id": usuario_id,
            "reserva_id": reserva_id,
            "puntos": puntos,
            "motivo": motivo,
            "expira_en": expira_en or (date.today() + timedelta(days=300)),
            "created_at": date.today(),
        }
    )


def test_asistencia_sin_secreto_devuelve_403_sin_escrituras(client, fake_db, monkeypatch):
    """Unauthorized accrual is rejected before any read or write."""
    _con_secret(monkeypatch)
    _reserva(fake_db)
    res = client.post("/api/asistencia", json={"reserva_id": 10})
    assert res.status_code == 403
    assert res.get_json()["success"] is False
    assert fake_db.movimientos == []
    assert fake_db.reservas_by_id[10]["estado"] is None


def test_asistencia_secreto_incorrecto_devuelve_403(client, fake_db, monkeypatch):
    """A wrong secret mismatches safely and records no movement."""
    _con_secret(monkeypatch)
    _reserva(fake_db)
    res = client.post(
        "/api/asistencia",
        json={"reserva_id": 10},
        headers={"X-Owner-Secret": "secreto-equivocado"},
    )
    assert res.status_code == 403
    assert fake_db.movimientos == []


def test_asistencia_sin_reserva_id_devuelve_400(client, fake_db, monkeypatch):
    """The attendance endpoint requires reserva_id (400 path)."""
    _con_secret(monkeypatch)
    res = client.post("/api/asistencia", json={}, headers=OWNER_HEADERS)
    assert res.status_code == 400
    assert res.get_json()["success"] is False


def test_asistencia_reserva_desconocida_devuelve_404(client, fake_db, monkeypatch):
    """Unknown booking ids return 404 with no ledger write."""
    _con_secret(monkeypatch)
    res = client.post(
        "/api/asistencia", json={"reserva_id": 999}, headers=OWNER_HEADERS
    )
    assert res.status_code == 404
    assert fake_db.movimientos == []


def test_asistencia_acredita_100_por_hora(client, fake_db, monkeypatch):
    """One attended hour credits a +100 movement expiring in 12 months."""
    _con_secret(monkeypatch)
    _reserva(fake_db, duracion=1)
    res = client.post(
        "/api/asistencia", json={"reserva_id": 10}, headers=OWNER_HEADERS
    )
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "puntos": 100}
    assert fake_db.reservas_by_id[10]["estado"] == "asistio"
    assert len(fake_db.movimientos) == 1
    movimiento = fake_db.movimientos[0]
    assert movimiento["puntos"] == 100
    assert movimiento["motivo"] == "asistencia"
    hoy = date.today()
    assert movimiento["expira_en"] == hoy.replace(year=hoy.year + 1)


def test_asistencia_dos_horas_acredita_200(client, fake_db, monkeypatch):
    """Credit scales linearly: 2 booked hours credit +200."""
    _con_secret(monkeypatch)
    _reserva(fake_db, rid=11, duracion=2)
    res = client.post(
        "/api/asistencia", json={"reserva_id": 11}, headers=OWNER_HEADERS
    )
    assert res.status_code == 200
    assert res.get_json()["puntos"] == 200


def test_asistencia_repetida_es_idempotente(client, fake_db, monkeypatch):
    """Repeating attendance for the same booking never double-credits."""
    _con_secret(monkeypatch)
    _reserva(fake_db)
    primera = client.post(
        "/api/asistencia", json={"reserva_id": 10}, headers=OWNER_HEADERS
    )
    assert primera.get_json()["puntos"] == 100
    segunda = client.post(
        "/api/asistencia", json={"reserva_id": 10}, headers=OWNER_HEADERS
    )
    assert segunda.status_code == 200
    assert segunda.get_json()["puntos"] == 0
    assert len(fake_db.movimientos) == 1


def test_puntos_excluye_vencidos_del_balance(client, fake_db):
    """Expired movements contribute 0 to balance but stay in history."""
    from datetime import timedelta

    hoy = date.today()
    _movimiento(fake_db, 1, puntos=100, expira_en=hoy - timedelta(days=1))
    _movimiento(fake_db, 2, puntos=200, expira_en=hoy + timedelta(days=30))
    res = client.get("/api/puntos/7")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["balance"] == 200
    assert len(data["movimientos"]) == 2


def test_canje_gift_debita_1000(client, fake_db):
    """Gift redemption records a -1000 debit movement."""
    _movimiento(fake_db, 1, puntos=1000)
    res = client.post("/api/canjes", json={"usuario_id": 7, "tipo": "gift"})
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "balance": 0}
    debito = fake_db.movimientos[-1]
    assert debito["puntos"] == -1000
    assert debito["motivo"] == "canje_gift"
    assert debito["expira_en"] == date(9999, 12, 31)


def test_canje_express_debita_500(client, fake_db):
    """Express redemption records a -500 debit movement."""
    _movimiento(fake_db, 1, puntos=500)
    res = client.post("/api/canjes", json={"usuario_id": 7, "tipo": "express"})
    assert res.status_code == 200
    assert res.get_json()["balance"] == 0
    debito = fake_db.movimientos[-1]
    assert debito["puntos"] == -500
    assert debito["motivo"] == "canje_express"


def test_canje_saldo_insuficiente_rechazado_sin_escrituras(client, fake_db):
    """Balance below catalog cost is refused with zero ledger writes."""
    _movimiento(fake_db, 1, puntos=100)
    res = client.post("/api/canjes", json={"usuario_id": 7, "tipo": "express"})
    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert len(fake_db.movimientos) == 1
    assert not any(
        "INSERT INTO PUNTOS_MOVIMIENTOS" in sql.upper()
        for sql, _ in fake_db.executed
    )


def test_canje_tipo_desconocido_devuelve_400(client, fake_db):
    """Redemption outside the gift/express catalog is rejected (400 path)."""
    res = client.post("/api/canjes", json={"usuario_id": 7, "tipo": "vip"})
    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert fake_db.movimientos == []


def test_setup_db_ddl_rerun_idempotente():
    """Loyalty DDL is CREATE-IF-NOT-EXISTS plus an INFORMATION_SCHEMA-guarded
    column migration, so rerunning the setup script is always safe."""
    import sys

    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    import setup_db

    ddl = " ".join(setup_db.STATEMENTS)
    assert "CREATE TABLE IF NOT EXISTS puntos_movimientos" in ddl
    assert "CREATE TABLE IF NOT EXISTS cupones" in ddl
    assert dict(setup_db.COLUMNAS_RESERVA_HORAS) == {
        "estado": "VARCHAR(20) NULL",
        "duracion_horas": "INT NULL DEFAULT 1",
        "cupon_codigo": "VARCHAR(20) NULL",
    }

    # Offline double-run of the same guard semantics (never prod MySQL):
    # the second pass must add zero columns.
    esquema = {"id", "usuario_id", "nombre", "fecha", "hora"}
    alters = []
    for _run in range(2):
        for columna, _definicion in setup_db.COLUMNAS_RESERVA_HORAS:
            existe = columna in esquema  # mirrors the INFORMATION_SCHEMA check
            if not existe:
                esquema.add(columna)
                alters.append(columna)
    assert alters == ["estado", "duracion_horas", "cupon_codigo"]


# --- WELCOME COUPON (fidelizacion PR4) ---

# Coupon vectors run against the FakeDB cupones support in
# tests/conftest.py (offline only; production MySQL is never touched).
# The owner secret travels in the X-Owner-Secret header, reusing the
# attendance gate from Unit 3.


def _cupon(fake_db, codigo="BIENV-ABC123", usuario_id=7, estado="activo",
           expira_en=None, usado_en=None):
    from datetime import timedelta

    cupon = {
        "id": fake_db.next_cupon_id,
        "usuario_id": usuario_id,
        "codigo": codigo,
        "valor_pct": 10,
        "estado": estado,
        "expira_en": expira_en or (date.today() + timedelta(days=30)),
        "usado_en": usado_en,
        "reserva_id": None,
        "created_at": date.today(),
    }
    fake_db.next_cupon_id += 1
    fake_db.cupones.append(cupon)
    fake_db.cupones_by_codigo[codigo] = cupon
    return cupon


def _registro_valido(usuario="ana", email="ana@example.com"):
    return {
        "rut": "12345678-5",
        "nombreusuario": usuario,
        "nombre": "Ana",
        "apellido": "Pérez",
        "email": email,
        "password": "secret123",
    }


def test_register_duplicado_no_crea_segundo_cupon(client, fake_db):
    """A duplicate registration is rejected and yields no second coupon."""
    primera = client.post("/register", json=_registro_valido())
    assert primera.status_code == 200
    assert len(fake_db.cupones) == 1
    segunda = client.post("/register", json=_registro_valido(usuario="ana2"))
    assert segunda.status_code == 500
    assert segunda.get_json()["success"] is False
    assert len(fake_db.cupones) == 1


def test_reserva_con_cupon_valido_guarda_codigo(client, fake_db):
    """A booking with a valid unused coupon persists the code."""
    fake_db.count = 0
    _cupon(fake_db)
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00",
              "usuario_id": 7, "cupon_codigo": "bienv-abc123"},
    )
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    assert fake_db.reservas_creadas, "no se registró el INSERT de la reserva"
    assert fake_db.reservas_creadas[0]["params"][4] == "BIENV-ABC123"


def test_reserva_con_cupon_desconocido_devuelve_400_sin_insert(client, fake_db):
    """An unknown coupon code is rejected with zero writes."""
    fake_db.count = 0
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00",
              "usuario_id": 7, "cupon_codigo": "BIENV-NOEXISTE"},
    )
    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert fake_db.reservas_creadas == []


def test_reserva_con_cupon_de_otra_cuenta_devuelve_400(client, fake_db):
    """A coupon owned by another account cannot be linked (400, no write)."""
    fake_db.count = 0
    _cupon(fake_db, usuario_id=8)
    res = client.post(
        "/api/reserva_horas",
        json={"nombre": "Ana", "fecha": "2026-10-01", "hora": "10:00",
              "usuario_id": 7, "cupon_codigo": "BIENV-ABC123"},
    )
    assert res.status_code == 400
    assert fake_db.reservas_creadas == []


def test_cupones_listar_recupera_codigo(client, fake_db):
    """The account view retrieves the owned coupon code."""
    _cupon(fake_db)
    res = client.get("/api/cupones/7")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert len(data["cupones"]) == 1
    assert data["cupones"][0]["codigo"] == "BIENV-ABC123"
    assert data["cupones"][0]["valor_pct"] == 10
    assert data["cupones"][0]["estado"] == "activo"


def test_cupon_usar_ok_marca_usado(client, fake_db, monkeypatch):
    """The owner marks a valid coupon used exactly once."""
    _con_secret(monkeypatch)
    _cupon(fake_db)
    res = client.post(
        "/api/cupones/usar", json={"codigo": "BIENV-ABC123"}, headers=OWNER_HEADERS
    )
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "codigo": "BIENV-ABC123"}
    assert fake_db.cupones_by_codigo["BIENV-ABC123"]["estado"] == "usado"
    assert fake_db.cupones_by_codigo["BIENV-ABC123"]["usado_en"] is not None


def test_cupon_usar_sin_secreto_devuelve_403_sin_cambios(client, fake_db, monkeypatch):
    """Mark-used without the secret is rejected before any read or write."""
    _con_secret(monkeypatch)
    _cupon(fake_db)
    res = client.post("/api/cupones/usar", json={"codigo": "BIENV-ABC123"})
    assert res.status_code == 403
    assert res.get_json()["success"] is False
    assert fake_db.cupones_by_codigo["BIENV-ABC123"]["estado"] == "activo"
    assert not any(
        "UPDATE CUPONES" in sql.upper() for sql, _ in fake_db.executed
    )


def test_cupon_usar_reutilizado_devuelve_409_sin_cambios(client, fake_db, monkeypatch):
    """An already-used coupon is refused with no state change."""
    _con_secret(monkeypatch)
    _cupon(fake_db, estado="usado")
    res = client.post(
        "/api/cupones/usar", json={"codigo": "BIENV-ABC123"}, headers=OWNER_HEADERS
    )
    assert res.status_code == 409
    assert res.get_json()["success"] is False
    assert fake_db.cupones_by_codigo["BIENV-ABC123"]["estado"] == "usado"
    assert not any(
        "UPDATE CUPONES" in sql.upper() for sql, _ in fake_db.executed
    )
