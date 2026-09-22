"""Fixtures pytest: backend en sys.path y cliente Flask con get_db_connection falso."""
import sys
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
        elif "FROM RESERVA_HORAS WHERE USUARIO_ID" in upper:
            self._db._result = list(self._db.reservas)
        else:
            self._db._result = None

    def fetchone(self):
        return self._db._result

    def fetchall(self):
        result = self._db._result
        return list(result) if result is not None else []

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
