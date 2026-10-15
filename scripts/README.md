# OpenSIM — Python tooling

Los scripts de `scripts/` se validan con **ruff** (lint + formato) y **ty** (tipos).
Ambos ya están en el PATH del sistema; **no se instalan** desde el proyecto.
`uv` se usa como package manager cuando hace falta aislar algo.

```bash
ruff check scripts/          # lint
ruff format scripts/         # formato
ty check scripts/            # tipos
```

## Seeds y credenciales

Esto aplica al seed de la app (`src/lib/server/db/seed.ts`), no a los scripts de
`scripts/`.

### La credencial sobrevive al seed

`student_credentials` declara `ON DELETE CASCADE` sobre `student_profiles`, así que
cualquier statement que **borre** la fila del perfil se lleva la credencial. El seed
escribe el perfil del estudiante del fixture (`12345678`, el de
`data/enrollment-fixture.json`) con
`INSERT … ON CONFLICT(control_number) DO UPDATE`, que **actualiza la fila existente**
en vez de borrarla: no dispara ninguna cascada y la credencial sobrevive.

Verificado sobre el D1 local: aprovisionar la credencial del `12345678`, correr
`db:seed:apply` y volver a contar deja la fila ahí, cuántas veces se repita.

```
student_credentials (control 12345678)  →  db:seed:apply  →  student_credentials (control 12345678)
```

Con el `INSERT OR REPLACE` anterior (SQLite lo ejecuta como DELETE + INSERT) la misma
secuencia terminaba en `student_credentials = 0`. Por eso `db:set-password` ya no
depende del orden: puede correr antes o después del seed.

```bash
pnpm run db:set-password            # credencial por defecto, control 99999999
pnpm run db:set-password 12345678   # la del fixture (ojo: `just` no acepta argumentos)
```

`just db-set-password <n>` **no** funciona: `just` interpreta el argumento como el
nombre de otra receta y falla con `justfile does not contain recipe`. Para pasar
número de control o contraseña hay que invocar el script de pnpm.

### ⚠ `db-reset` sí destruye

`just db-reset` (y `just test-e2e-fresh`, que lo encadena) borra
`.wrangler/state/v3/d1` por completo: se va la base local entera, con cualquier dato
que no venga del seed. Eso es legítimo cuando lo que se quiere es una base limpia,
pero no es un paso de verificación routineario. Para correr una suite sin perder
estado local usa `just test-e2e`, que no resetea nada.

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
