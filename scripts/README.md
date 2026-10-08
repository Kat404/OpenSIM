# OpenSIM — Python tooling

Los scripts de `scripts/` se validan con **ruff** (lint + formato) y **ty** (tipos).
Ambos ya están en el PATH del sistema; **no se instalan** desde el proyecto.
`uv` se usa como package manager cuando hace falta aislar algo.

```bash
ruff check scripts/          # lint
ruff format scripts/         # formato
ty check scripts/            # tipos
```

## Reglas

- Línea máxima 100.
- Doble comilla.
- Sin `from __future__` salvo necesidad real (Python 3.11+ en este repo).
- Los scripts de datos deben **fallar fuerte**: nunca rellenan un campo sin fuente.

## PII: redacción de `docs/data/`

Los `docs/data/*.json` se extraen del SIM público y traen nombres de personal. Los repos
son públicos, así que **todo** valor de `teacher` debe ser un alias sintético `DOC-NNN`
antes de commitearse.

`build-verified-curriculum.py` lo impone: `load_docs()` redacta en memoria con
`redact_teachers()` (alias deterministas numerados sobre la unión alfabética de todos los
ficheros, así que un mismo nombre mapea al mismo alias en todas partes) y **falla fuerte**
si queda algún valor real. Correr el generador es entonces también la verificación de la
redacción.

Límite: la guarda cubre sólo `docs/data/*.json`. El dataset generado no tiene campo
`teacher`, así que no puede filtrar un nombre sea cual sea su entrada.
