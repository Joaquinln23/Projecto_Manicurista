"""Pruebas baseline del backend Flask (sin MySQL: get_db_connection se parchea)."""
from pathlib import Path

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
