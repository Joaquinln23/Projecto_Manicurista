"""Fixtures pytest: backend en sys.path y cliente Flask con get_db_connection falso."""
import sys
from datetime import date
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class FakeCursor:
    """Cursor falso que responde según la consulta SQL ejecutada."""

    def __init__(self, db, dictionary=False):
        self._db = db
        self.dictionary = dictionary

    def execute(self, sql, params=None):
        self._db.executed.append((sql, params))
        upper = sql.upper()
        if "COUNT(*)" in upper:
            self._db._result = (self._db.count,)
        elif "SELECT * FROM USUARIOS" in upper:
            self._db._result = self._db.user
        elif "SELECT 1" in upper:
            self._db._result = (1,)
        elif "INSERT INTO USUARIOS" in upper:
            rut, nombreusuario, nombre, apellido, email, password = params
            if email in self._db.users_by_email or nombreusuario in self._db.users_by_nombreusuario:
                raise Exception(f"Duplicate entry '{email}' for key 'usuarios.email'")
            usuario = {
                "id": self._db.next_user_id,
                "rut": rut,
                "nombreusuario": nombreusuario,
                "nombre": nombre,
                "apellido": apellido,
                "email": email,
                "password": password,
            }
            self._db.next_user_id += 1
            self._db.users.append(usuario)
            self._db.users_by_email[email] = usuario
            self._db.users_by_nombreusuario[nombreusuario] = usuario
            self._db.lastrowid = usuario["id"]
            self._db._result = None
        elif "INSERT INTO CUPONES" in upper:
            usuario_id, codigo, valor_pct, estado, expira_en = params
            if codigo in self._db.cupones_by_codigo or any(
                c["usuario_id"] == usuario_id for c in self._db.cupones
            ):
                raise Exception(f"Duplicate entry '{codigo}' for key 'cupones.codigo'")
            cupon = {
                "id": self._db.next_cupon_id,
                "usuario_id": usuario_id,
                "codigo": codigo,
                "valor_pct": valor_pct,
                "estado": estado,
                "expira_en": expira_en,
                "usado_en": None,
                "reserva_id": None,
                "created_at": date.today(),
            }
            self._db.next_cupon_id += 1
            self._db.cupones.append(cupon)
            self._db.cupones_by_codigo[codigo] = cupon
            self._db._result = None
        elif "FROM CUPONES WHERE CODIGO" in upper:
            codigo = params[0] if params else None
            self._db._result = self._db.cupones_by_codigo.get(codigo)
        elif "FROM CUPONES WHERE USUARIO_ID" in upper:
            uid = params[0] if params else None
            self._db._result = [c for c in self._db.cupones if c["usuario_id"] == uid]
        elif "UPDATE CUPONES SET ESTADO" in upper:
            estado, usado_en, codigo = params
            if codigo in self._db.cupones_by_codigo:
                self._db.cupones_by_codigo[codigo]["estado"] = estado
                self._db.cupones_by_codigo[codigo]["usado_en"] = usado_en
            self._db._result = None
        elif "INSERT INTO RESERVA_HORAS" in upper:
            self._db.reservas_creadas.append({"id": self._db.next_reserva_id, "params": params})
            self._db.next_reserva_id += 1
            self._db.lastrowid = self._db.next_reserva_id - 1
            self._db._result = None
        elif "INSERT INTO PUNTOS_MOVIMIENTOS" in upper:
            usuario_id, reserva_id, puntos, motivo, expira_en = params
            movimiento = {
                "id": self._db.next_movimiento_id,
                "usuario_id": usuario_id,
                "reserva_id": reserva_id,
                "puntos": puntos,
                "motivo": motivo,
                "expira_en": expira_en,
                "created_at": date.today(),
            }
            self._db.next_movimiento_id += 1
            self._db.movimientos.append(movimiento)
            self._db._result = None
        elif "FROM PUNTOS_MOVIMIENTOS WHERE USUARIO_ID" in upper:
            uid = params[0] if params else None
            self._db._result = [m for m in self._db.movimientos if m["usuario_id"] == uid]
        elif "FROM RESERVA_HORAS WHERE USUARIO_ID" in upper:
            self._db._result = list(self._db.reservas)
        elif "FROM RESERVA_HORAS WHERE ID" in upper:
            rid = params[0] if params else None
            self._db._result = self._db.reservas_by_id.get(rid)
        elif "UPDATE RESERVA_HORAS SET ESTADO" in upper:
            estado, rid = params
            if rid in self._db.reservas_by_id:
                self._db.reservas_by_id[rid]["estado"] = estado
            self._db._result = None
        else:
            self._db._result = None

    def fetchone(self):
        return self._db._result

    def fetchall(self):
        result = self._db._result
        return list(result) if result is not None else []

    @property
    def lastrowid(self):
        return self._db.lastrowid

    def close(self):
        pass


class FakeConnection:
    """Conexión falsa: commit/close de cortina, cursor dirigido al FakeDB."""

    def __init__(self, db):
        self._db = db

    def cursor(self, **kwargs):
        return FakeCursor(self._db, dictionary=kwargs.get("dictionary", False))

    def commit(self):
        pass

    def close(self):
        pass


class FakeDB:
    """Base de datos falsa configurable por prueba (sin MySQL)."""

    def __init__(self):
        self.user = None
        self.count = 0
        self.reservas = []
        self.executed = []
        self._result = None
        # Loyalty ledger (fidelizacion Unit 3): append-only movements plus
        # reserva_horas rows keyed by id with estado/duracion_horas columns.
        self.movimientos = []
        self.reservas_by_id = {}
        self.next_movimiento_id = 1
        # Welcome coupons (fidelizacion PR4): usuarios inserts are tracked
        # for duplicate rejection + lastrowid, cupones for issuance/linkage
        # vectors, reservas_creadas records booking INSERT params.
        self.users = []
        self.users_by_email = {}
        self.users_by_nombreusuario = {}
        self.next_user_id = 1
        self.lastrowid = None
        self.cupones = []
        self.cupones_by_codigo = {}
        self.next_cupon_id = 1
        self.reservas_creadas = []
        self.next_reserva_id = 1

    def __call__(self):
        return FakeConnection(self)


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def client(monkeypatch, fake_db):
    """Cliente de prueba con get_db_connection y envío de correo parcheados."""
    import app as app_module

    app_module.app.config["TESTING"] = True
    monkeypatch.setattr(app_module, "get_db_connection", fake_db)
    monkeypatch.setattr(app_module, "enviar_correo_async", lambda *a, **k: None)
    with app_module.app.test_client() as test_client:
        yield test_client
