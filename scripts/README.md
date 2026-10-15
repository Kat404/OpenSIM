# OpenSIM — Python tooling

Los scripts de `scripts/` se validan con **ruff** (lint + formato) y **ty** (tipos).
Ambos ya están en el PATH del sistema; **no se instalan** desde el proyecto.
`uv` se usa como package manager cuando hace falta aislar algo.

```bash
ruff check scripts/          # lint
ruff format scripts/         # formato
ty check scripts/            # tipos
```

## Seeds y credenciales (⚠ destructive)

Esto aplica al seed de la app (`src/lib/server/db/seed.ts`), no a los scripts de
`scripts/`.

### `db:seed:apply` destruye `student_credentials`

El seed escribe el perfil del estudiante de prueba con
`INSERT OR REPLACE INTO student_profiles`. En SQLite, `INSERT OR REPLACE` es un
**DELETE seguido de un INSERT**, y ese DELETE dispara todas las cascadas
declaradas sobre `student_profiles`. Una de ellas es
`student_credentials ON DELETE CASCADE`.

Consecuencia, verificada sobre un D1 local desechable:

```
student_credentials = 1   →  db:seed:apply  →  student_credentials = 0
```

**Qué credenciales se ven afectadas:** sólo las del número de control del
inscrito del fixture (`12345678`, el de `data/enrollment-fixture.json`). Una
credencial de cualquier otro número de control sobrevive intacta — por eso
`db:set-password`, cuyo valor por defecto es `99999999`, no se ve afectado por
defecto. Si en algún momento se aprovisiona la credencial del `12345678`
(`just db-set-password 12345678`), **sí** se pierde en cada seed.

**Orden obligatorio:** `db:set-password` va **después** de `db:seed:apply`,
`db:seed` o `db:reset`. Si se ejecuta al revés, el login queda sin credencial.
Es exactamente el orden en que `just test-e2e` encadena sus recetas.

### Idempotencia del resto de los datos

Desde el arreglo, repetir el seed converge a los mismos conteos en cada corrida
y `PRAGMA foreign_key_check` queda vacío. Sin el `DELETE` previo de
`course_schedule_blocks`, la segunda corrida fallaba con
`FOREIGN KEY constraint failed` y revertía la transacción completa.

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
