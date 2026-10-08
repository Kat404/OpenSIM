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