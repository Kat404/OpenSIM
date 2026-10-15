#!/usr/bin/env python3
"""
T9.1 — Genera el dataset canónico verificado de ISIC-2010-224.

Fuentes (verificadas el 2026-10-07):
  F1  Retícula institucional, https://dsc.itmorelia.edu.mx/web/documentos/reticula_isc.pdf
      → HT-HP-CR por materia, semestre por COLUMNA, notas al pie de alias
  F2  SIM /estudiante/datos/reticula            → semestre autoritativo
  F3  SIM /reinscripcion/grupos                 → materias de especialidad y sus créditos
  F4  Grill del operador                        → seriación
  F5  Reglas de negocio del operador            → créditos complementarios, elegibilidad

Nada de este archivo se deduce: cada valor viene de una de las fuentes de arriba.
Los campos que no tienen fuente quedan explícitamente marcados, nunca rellenados.
"""

import collections
import json
import pathlib
import re
from collections.abc import Iterator

DATA_DIR = pathlib.Path(__file__).parent.parent / "docs/data"

# The only teacher value allowed in docs/data: a synthetic alias.
TEACHER_ALIAS_RE = re.compile(r"\ADOC-\d{3}\Z")

# --------------------------------------------------------------------------
# Materias del plan.  (código, alias, nombre, semestre, ht, hp, créditos)
# El semestre viene de F2 (SIM), que a su vez coincide con la columna de F1.
# --------------------------------------------------------------------------
CORE = [
    # --- Semestre 1 ---
    ("ACF-0901", ["ACF-2301"], "Cálculo Diferencial", 1, 3, 2, 5),
    ("AED-1285", ["SCD-1008"], "Fundamentos de Programación", 1, 2, 3, 5),
    ("ACA-0907", ["ACH-2307"], "Taller de Ética", 1, 0, 4, 4),
    ("AEF-1041", [], "Matemáticas Discretas", 1, 3, 2, 5),
    ("SCH-1024", [], "Taller de Administración", 1, 1, 3, 4),
    ("ACC-0906", [], "Fundamentos de Investigación", 1, 2, 2, 4),
    # --- Semestre 2 ---
    ("ACF-0902", [], "Cálculo Integral", 2, 3, 2, 5),
    ("AED-1286", ["SCD-1020"], "Programación Orientada a Objetos", 2, 2, 3, 5),
    ("AEC-1008", [], "Contabilidad Financiera", 2, 2, 2, 4),
    ("AEC-1058", [], "Química", 2, 2, 2, 4),
    ("ACF-0903", [], "Álgebra Lineal", 2, 3, 2, 5),
    ("AEF-1052", [], "Probabilidad y Estadística", 2, 3, 2, 5),
    # --- Semestre 3 ---
    ("ACF-0904", [], "Cálculo Vectorial", 3, 3, 2, 5),
    ("AED-1026", [], "Estructura de Datos", 3, 2, 3, 5),
    ("SCC-1005", [], "Cultura Empresarial", 3, 2, 2, 4),
    ("ACD-0908", [], "Desarrollo Sustentable", 3, 2, 3, 5),
    ("SCC-1013", [], "Investigación de Operaciones", 3, 2, 2, 4),
    ("SCF-1006", [], "Física General", 3, 3, 2, 5),
    # --- Semestre 4 ---
    ("ACF-0905", [], "Ecuaciones Diferenciales", 4, 3, 2, 5),
    ("SCC-1017", [], "Métodos Numéricos", 4, 2, 2, 4),
    ("SCD-1027", [], "Tópicos Avanzados de Programación", 4, 2, 3, 5),
    ("AEF-1031", [], "Fundamentos de Bases de Datos", 4, 3, 2, 5),
    ("SCD-1022", [], "Simulación", 4, 2, 3, 5),
    ("SCD-1018", [], "Principios Eléctricos y Aplicaciones Digitales", 4, 2, 3, 5),
    # --- Semestre 5 ---
    ("SCC-1010", [], "Graficación", 5, 2, 2, 4),
    ("AEC-1034", [], "Fundamentos de Telecomunicaciones", 5, 2, 2, 4),
    ("AEC-1061", [], "Sistemas Operativos", 5, 2, 2, 4),
    ("SCA-1025", [], "Taller de Base de Datos", 5, 0, 4, 4),
    ("SCC-1007", [], "Fundamentos de Ingeniería de Software", 5, 2, 2, 4),
    ("SCD-1003", [], "Arquitectura de Computadoras", 5, 2, 3, 5),
    # --- Semestre 6 ---
    ("AEB-1055", [], "Programación Web", 6, 1, 4, 5),
    ("SCD-1021", [], "Redes de Computadoras", 6, 2, 3, 5),
    ("SCA-1026", [], "Taller de Sistemas Operativos", 6, 0, 4, 4),
    ("SCB-1001", [], "Administración de Bases de Datos", 6, 1, 4, 5),
    ("SCD-1011", [], "Ingeniería de Software", 6, 2, 3, 5),
    ("SCC-1014", [], "Lenguajes de Interfaz", 6, 2, 2, 4),
    # --- Semestre 7 ---
    ("SCD-1004", [], "Conmutación y Enrutamiento en Redes de Datos", 7, 2, 3, 5),
    ("SCD-1015", [], "Lenguajes y Autómatas I", 7, 2, 3, 5),
    ("ACA-0909", [], "Taller de Investigación I", 7, 0, 4, 4),
    ("SCG-1009", [], "Gestión de Proyectos de Software", 7, 3, 3, 6),
    ("SCC-1023", [], "Sistemas Programables", 7, 2, 2, 4),
    # --- Semestre 8 ---
    ("SCC-1019", [], "Programación Lógica y Funcional", 8, 2, 2, 4),
    ("SCA-1002", [], "Administración de Redes", 8, 0, 4, 4),
    ("ACA-0910", [], "Taller de Investigación II", 8, 0, 4, 4),
    ("SCD-1016", [], "Lenguajes y Autómatas II", 8, 2, 3, 5),
    # --- Semestre 9 ---
    ("SCC-1012", [], "Inteligencia Artificial", 9, 2, 2, 4),
]

# Asignaturas transversales TecNM (F2). No dan créditos reticulares (F5):
# generan CRÉDITO COMPLEMENTARIO.
TRANSVERSAL = [
    ("ITM-100", "Tutoría", 1, 0),
    ("ITM-104", "Actividades Físicas para la Salud y la Prevención", 1, 0),
    ("ITM-105", "Apreciación de Artes y Diversidad Cultural", 2, 0),
    ("ITM-101", "Actividades Complementarias", 7, 0),
    ("ITM-102", "Servicio Social", 8, 10),
    ("ITM-103", "Residencia Profesional", 9, 10),
]

# Módulos de especialidad (F3). 5 celdas de "ESPECIALIDAD 5 cred" en F1 = 25 cr.
SPECIALTY_CODES = {
    "TDD": "ISIE-TDD-2026-01",  # Desarrollo de Software
    "SID": "ISIE-SID-2026-01",  # Ciberseguridad
    "TND": "ISIE-TND-2026-01",  # Nube
}

# --------------------------------------------------------------------------
# Seriación (F4).  El operador dictó las cadenas y qué NO va seriada.
# --------------------------------------------------------------------------
SERIALIZED = {
    # Cálculo
    "ACF-0901": [],
    "ACF-0902": ["ACF-0901"],
    "ACF-0904": ["ACF-0902"],
    # Programación
    "AED-1285": [],
    "AED-1286": ["AED-1285"],
    "AED-1026": ["AED-1286"],
    "SCD-1027": ["AED-1026"],
    # Bases de datos
    "AEF-1031": [],
    "SCA-1025": ["AEF-1031"],
    "SCB-1001": ["SCA-1025"],
    # Ingeniería de software
    "SCC-1007": [],
    "SCD-1011": ["SCC-1007"],
    "SCG-1009": ["SCD-1011"],
    # Redes
    "AEC-1034": [],
    "SCD-1021": ["AEC-1034"],
    "SCD-1004": ["SCD-1021"],
    "SCA-1002": ["SCD-1004"],
    # Autómatas
    "SCD-1015": [],
    "SCD-1016": ["SCD-1015"],
    # Interfaz -> programables
    "SCC-1014": [],
    "SCC-1023": ["SCC-1014"],
}
INDEPENDENT = {
    "ACA-0907",
    "AEF-1041",
    "SCH-1024",
    "ACC-0906",  # S1 sin flecha
    "AEC-1008",
    "AEC-1058",
    "ACF-0903",
    "AEF-1052",  # S2 sin flecha
    "SCC-1005",
    "ACD-0908",
    "SCC-1013",
    "SCF-1006",  # S3 sin flecha
    "ACF-0905",  # Ecuaciones Diferenciales
    "SCD-1022",  # Simulación
    "SCC-1010",  # Graficación
    "AEB-1055",  # Programación Web
    "SCC-1019",  # Prog. Lógica y Funcional
}

# --------------------------------------------------------------------------
# Créditos complementarios (F5). Regla dura de negocio.
# --------------------------------------------------------------------------
COMPLEMENTARY = {
    "requiredForGraduation": 5,
    "unlocksServiceSocial": True,
    "source": "ITM-100, ITM-104, ITM-105 y horas de ITM-101",
    "reticularCredits": False,
}
SPECIALTY_RULE = {
    "minSemester": 6,
    "minReticularCredits": 146,
    "note": "Regla comunicada por el operador para ISIC-2010-224 en v1. "
    "No se conoce el equivalente de otras carreras.",
}


# --------------------------------------------------------------------------
def slug(code: str) -> str:
    return code.lower().replace("-", "-")


def _teacher_rows(doc: dict) -> Iterator[dict]:
    """Yield every row of a docs/data document that carries a teacher field.

    The SIM exports nest their rows under different keys ("groups",
    "subjects"), so walk the lists instead of hard-coding one.
    """
    for value in doc.values():
        if isinstance(value, list):
            for row in value:
                if isinstance(row, dict) and isinstance(row.get("teacher"), str):
                    yield row


def redact_teachers(docs: list[dict]) -> list[str]:
    """Replace every teacher value in place with a stable ``DOC-NNN`` alias.

    Aliases are numbered from the alphabetically sorted union of every file, so
    the same name maps to the same alias in both exports and across runs.
    Already-aliased values are left untouched, which keeps the pass idempotent.
    Returns the real names it replaced so the caller can fail strong on them.
    """
    real = sorted(
        {
            row["teacher"]
            for doc in docs
            for row in _teacher_rows(doc)
            if not TEACHER_ALIAS_RE.match(row["teacher"])
        }
    )
    aliases = dict(zip(real, (f"DOC-{i:03d}" for i in range(1, len(real) + 1)), strict=True))
    replaced = []
    for doc in docs:
        for row in _teacher_rows(doc):
            name = row["teacher"]
            if name in aliases:
                replaced.append(name)
                row["teacher"] = aliases[name]
    return sorted(set(replaced))


def load_docs() -> dict[str, dict]:
    """Load every docs/data JSON export with its teacher values redacted.

    Limit: this redacts what this process reads. The committed files on disk are
    the artifact that actually carries names, so a real name still aborts the run
    instead of silently flowing into a regenerated dataset.
    """
    docs = {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(DATA_DIR.glob("*.json"))
    }
    leaked = redact_teachers(list(docs.values()))
    if leaked:
        raise SystemExit(
            f"docs/data holds {len(leaked)} unredacted teacher value(s): {leaked[:5]} — "
            "redact the export to DOC-NNN aliases before committing it"
        )
    return docs


def load_specialty_subjects(groups: dict):
    """Lee las materias de especialidad del catálogo de grupos del SIM."""
    seen = {}
    for g in groups["groups"]:
        pre = g["code"][:3]
        if pre not in SPECIALTY_CODES:
            continue
        seen.setdefault(g["code"], {"code": g["code"], "name": g["name"], "credits": g["credits"]})
    return [seen[k] for k in sorted(seen)]


def build(groups: dict):
    subjects, prereqs = [], []

    for code, aliases, name, sem, ht, hp, cr in CORE:
        if code in INDEPENDENT:
            state, reqs = "INDEPENDENT", []
        elif code in SERIALIZED:
            state, reqs = "SERIALIZED", SERIALIZED[code]
        else:
            state, reqs = "UNKNOWN", []
        subjects.append(
            {
                "canonicalId": slug(code),
                "code": code,
                "aliases": aliases,
                "name": name,
                "semester": sem,
                "ht": ht,
                "hp": hp,
                "credits": cr,
                "area": None,
                "specialtyCode": None,
                "seriationState": state,
                "component": "GENERIC",
            }
        )
        for r in reqs:
            prereqs.append({"subject": code, "prerequisite": r})

    for code, name, sem, cr in TRANSVERSAL:
        subjects.append(
            {
                "canonicalId": slug(code),
                "code": code,
                "aliases": [],
                "name": name,
                "semester": sem,
                "ht": 0,
                "hp": 0,
                "credits": cr,
                "area": None,
                "specialtyCode": None,
                "seriationState": "INDEPENDENT",
                "component": "COMPLEMENTARY" if cr == 0 else "PRACTICE",
            }
        )

    for s in load_specialty_subjects(groups):
        pre = s["code"][:3]
        subjects.append(
            {
                "canonicalId": slug(s["code"]),
                "code": s["code"],
                "aliases": [],
                "name": s["name"],
                "semester": None,
                "ht": None,
                "hp": None,
                "credits": s["credits"],
                "area": None,
                "specialtyCode": SPECIALTY_CODES[pre],
                "seriationState": "UNKNOWN",
                "component": "SPECIALTY",
            }
        )

    doc = {
        "version": "ISIC-2010-224-VERIFIED-2026-10-07",
        "careerCode": "ISIC-2010-224",
        "careerName": "Ingeniería en Sistemas Computacionales",
        "institution": "Instituto Tecnológico de Morelia",
        "planName": "Plan de estudios por competencias actualizado 2016 (2017)",
        "modality": "ESCOLARIZADA",
        "totalSemesters": 9,
        "declaredTotalCredits": 260,
        "sources": {
            "F1": "https://dsc.itmorelia.edu.mx/web/documentos/reticula_isc.pdf (sha256 5a3140cd…a11a60a)",
            "F2": "SIM /estudiante/datos/reticula",
            "F3": "SIM /reinscripcion/grupos",
            "F4": "Grill del operador (seriación)",
            "F5": "Reglas de negocio del operador (complementarios, especialidad)",
        },
        "specialties": [
            {
                "code": SPECIALTY_CODES["TDD"],
                "name": "Desarrollo de Software",
                "declaredCredits": 25,
            },
            {
                "code": SPECIALTY_CODES["SID"],
                "name": "Ciberseguridad",
                "declaredCredits": 25,
            },
            {"code": SPECIALTY_CODES["TND"], "name": "Nube", "declaredCredits": None},
        ],
        "specialtyEligibility": SPECIALTY_RULE,
        "complementaryCredits": COMPLEMENTARY,
        "subjects": subjects,
        "prerequisites": prereqs,
    }
    return doc


if __name__ == "__main__":
    doc = build(load_docs()["sim-grupos-oferta"])
    out = (
        pathlib.Path(__file__).parent.parent
        / "src/lib/server/db/data/curriculum-isic-2010-224.json"
    )
    out.write_text(json.dumps(doc, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")

    # ---- reconciliación honesta ----
    by_comp = collections.Counter()
    cr_by_comp = collections.Counter()
    for s in doc["subjects"]:
        by_comp[s["component"]] += 1
        cr_by_comp[s["component"]] += s["credits"] or 0
    print(f"escrito {out}  ({out.stat().st_size} bytes)")
    print("\nmaterias por componente:")
    for c in ("GENERIC", "COMPLEMENTARY", "PRACTICE", "SPECIALTY"):
        print(f"  {c:14s} {by_comp[c]:3d} materias  {cr_by_comp[c]:4d} cr")
    # El dataset es un CATALOGO (incluye las 3 especialidades), no la ruta de un
    # estudiante. La reconciliacion valida es la de UNA sola especialidad.
    generic, practice, comp = (
        cr_by_comp["GENERIC"],
        cr_by_comp["PRACTICE"],
        cr_by_comp["COMPLEMENTARY"],
    )
    print(
        f"\n  estructura generica       = {generic}   declarado en el PDF = 210   delta = {generic - 210}"
    )
    print(f"  practica (servicio+resid) = {practice}   declarado = 10 + 10")
    print(f"  complemento              = {comp}   (0 cr reticulares, dan complementarios)")
    for sp in doc["specialties"]:
        n = sum(1 for s in doc["subjects"] if s["specialtyCode"] == sp["code"])
        cr = sum(s["credits"] or 0 for s in doc["subjects"] if s["specialtyCode"] == sp["code"])
        ruta = generic + practice + cr + 5
        print(
            f"  ruta del estudiante con {sp['name']:22s} = {generic}+{practice}+{cr}+5 = {ruta}   declarado 260   delta = {ruta - 260}"
        )

    per_sem = collections.Counter()
    for s in doc["subjects"]:
        if s["semester"]:
            per_sem[s["semester"]] += s["credits"] or 0
    print("\ncreditos por semestre:", {k: per_sem[k] for k in sorted(per_sem)})
    print(
        "total impreso en el PDF :",
        {1: 27, 2: 28, 3: 28, 4: 29, 5: 24, 6: 29, 7: 30, 8: 26, 9: 24},
    )

    st = collections.Counter(s["seriationState"] for s in doc["subjects"])
    print("\nseriacion:", dict(st), "| aristas:", len(doc["prerequisites"]))
