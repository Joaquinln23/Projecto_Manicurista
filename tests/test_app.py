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
    assert res.status_code == 200
    assert res.get_json() == {"success": True}
    assert any("INSERT INTO USUARIOS" in sql.upper() for sql, _ in fake_db.executed)


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
