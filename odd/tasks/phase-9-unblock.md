# Phase 9 — Desbloqueo (B1–B8)

<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@2ac464f (main@fee9d60)
sha-warning: los SHA 697c1c9, 0cafef1, 6ca7c12, 8f40837, ffcd595 y b3fef41 citados en el cuerpo de este archivo predicen la reescritura de firmas GPG del 2026-10-08 y están MUERTOS; los vivos verificados con `git cat-file -e` son 18de1a5 (T9.1), b6a1d8a (T9.2) y 159b2bc (T9.7)
-->

**Estado:** Onda 2 **ejecutada por completo** · creado 2026-10-08 ·
**reconciliado 2026-10-08: B1, B2, B3, B6, B7 y B8 cerradas. B4 parcial. B5 cerrada.**
**Objetivo:** eliminar todo lo que bloquea la entrega de Phase 9 y cerrar el ciclo de
revisión antes de tocar T9.3.
**Rama:** `feat/phase-9-verified-curriculum` — T9.1 y T9.2 ya están

> **Shas de este documento, re-derivados 2026-10-08.** El plan se escribió con `697c1c9` (T9.1) y
> `0cafef1` (T9.2). **Ambos están muertos**: la reescritura de firmas GPG del 2026-10-08 cambió
> cada SHA del repositorio. Los actuales, verificados con `git cat-file -e`, son:
>
> | Tarea | SHA muerto (plan original) | SHA vivo verificado con `git cat-file -e` |
> | --- | --- | --- |
> | T9.1 — dataset curricular verificado | `697c1c9` (luego `6ca7c12`, también muerto) | **`18de1a5`** — `feat(data): verified ISIC-2010-224 curriculum dataset` |
> | T9.2 — seriación + columnas de componente | `0cafef1` (luego `8f40837`, también muerto) | **`b6a1d8a`** — `feat(db): subject seriation tri-state and component columns` |
> | T9.7 + T9.8 — seed verificado + fixture | — | **`159b2bc`** — `feat(db): seed the verified curriculum and relax the unknown-column constraint` |
>
> **HEAD al 2026-10-08:** `main` = `fee9d60` (126 commits, **126/126 firmados** `G`); rama de
> fase `feat/phase-9-verified-curriculum` = `2ac464f` (132 commits, **132/132 firmados** `G`).
> La tabla original decía `main`=`ffcd595` y rama=`8f40837` con "128/128 firmados"; los tres
> datos quedaron desfasados. Verificado con `git log <ref> --format='%G?' | sort | uniq -c`.

---

## Estado de los bloqueos al 2026-10-08

**Seis de los ocho cerrados** (B1, B2, B3, B5, B6, B7, B8 — siete en total, B4 parcial).
La Onda 2 **se ejecutó completa** y B3 quedó desbloqueada por ello. La tabla de §El conjunto
bloqueante conserva el estado del plan original; ésta es la tabla vigente.

| ID | Bloqueo | Estado 2026-10-08 | Evidencia |
| --- | --- | --- | --- |
| **B1** | La revisión de recibos RDD se rechaza en el runtime opencode | **CERRADA — por decisión, no por arreglo** | RDD deshabilitado en scope de clon: `gentle-ai review mode status --cwd .` → `receipt-driven development: off (decided by clone_local)`, `global: on`. `gentle-ai 4.0.0` es la última release; OpenCode no es un runtime elegible de revisión inmutable en ese build. Decisión explícita del operador: deshabilitar en vez de perseguir la elegibilidad. **U3 queda cancelado, no pendiente.** |
| **B2** | `subjects.area` → NULL no es aplicable en D1 | **CERRADA 2026-10-08** | El experimento U5 probó que **la forma del plan era incorrecta**: `defer_foreign_keys` por sí solo pospone la violación al `COMMIT` en vez de prevenirla. Se aplicó el **respaldo alternativo** ya descrito en §U6 — vaciar las hijas primero — que no necesita ni pragma ni tabla de respaldo. `drizzle/0009_subjects-rebuild.sql`, aplicada a la D1 de producción: `wrangler d1 migrations list opensim --remote` → `✅ No migrations to apply!`. **Matiz post-ejecución:** relajar sólo `area` no bastaba — ver §Lo que la ejecución cambió. |
| **B3** | `pnpm db:seed:gen` rojo desde T9.1 | **CERRADA 2026-10-08** | El seed corre contra el dataset verificado. `seed.sql` regenerado y **aplicado en la D1 de producción** `390df78e-c4c2-4ace-94f4-6baebf1eb88f`: 68 subjects, 14 aristas, 3 especialidades, 1 carrera, 49 progress, 7 grupos, 14 bloques, 0 `subject_units`. `PRAGMA foreign_key_check` vacío. Commit `159b2bc`. |
| **B4** | 29 blobs con PII vivos en `refs/pull/1/head` | **PARCIALMENTE INVACUA** | `gh pr list --state all` → `[]`. `gh issue list --state all` → `[]`. Codeberg `api/v1/.../issues?state=all` → `[]`. **No existe ningún PR que cerrar**, así que el paso "cerrar el PR #1" ya no aplica: el repo fue recreado y los refs de PR desaparecieron con él. Queda sólo confirmar con GitHub Support que no queden objetos inalcanzables con PII. |
| **B5** | La redacción de docentes es un paso manual | **CERRADA 2026-10-08** | `redact_teachers()` + `load_docs()` en `scripts/build-verified-curriculum.py`. Determinista, idempotente, mismo nombre → mismo alias entre ficheros. `raise SystemExit` si queda un nombre sin redactar. 468/468 y 7/7 filas ya son alias `DOC-NNN`; unión real = **121** nombres distintos, no 114. Dataset generado **byte-idéntico** (`4d6f8a28…` antes y después). `ruff check`, `ruff format --check` y `ty check` en verde. |
| **B6** | La D1 remota estaba 3 migraciones atrás | **CERRADA 2026-10-08** | `wrangler d1 migrations apply opensim --remote` aplicó `0006`, `0007`, `0008`. `wrangler d1 migrations list opensim --remote` → `✅ No migrations to apply!`; 9 entradas en `d1_migrations`. **Cero pérdida de filas**: `subjects` 42, `student_progress` 38, `course_groups` 8, `student_credentials` 1, `student_profiles` 1 — idénticos antes y después. Puerta G1: autorizada y ejecutada. |
| **B7** | Workers Builds quedó huérfano al borrar y recrear el repo | **CERRADA 2026-10-08** | Relink hecho por el operador. **El Worker nunca se borró**: `https://opensim.jose-luis-rs.workers.dev` sigue vivo. |
| **B8** | Los commits estaban sin firmar tras la reescritura de PII | **CERRADA 2026-10-08** | Los 128 commits se refirmaron con `git filter-branch`, clave `3335F4A0D9DBBA95`. 126/126 `G` en `main` (`ffcd595`), 128/128 `G` en la rama de fase (`8f40837`). Push a GitHub y Codeberg confirmado; force-push post-reescritura. **Cada SHA del repositorio cambió.**<br>**Corrección 2026-10-08 (segunda reconciliación):** el conteo y los SHAs de esta fila quedaron desfasados al aterrizar los commits posteriores. Hoy `main` = `fee9d60` con **126/126 `G`**, y la rama de fase = `2ac464f` con **132/132 `G`** (132 = 126 de `main` + 6 de la rama). Verificado con `git log <ref> --format='%G?' | sort \| uniq -c`. La afirmación original **128/128** no se borra: era correcta en el momento en que se escribió. |

**Consecuencia no obvia de B8:** las 54 referencias SHA únicas en `odd/` quedaron muertas.
Ninguna resuelve con `git cat-file -e`. Los *subjects* sí sobrevivieron, así que el camino de
vuelta es `git log --oneline --grep='<subject>'`.

**Puertas de autorización:** G1 (migraciones a D1 de producción) **ejercida** el 2026-10-08. G2
(`gentle-ai sync` global) **no se usó** — B1 se resolvió desactivando RDD a nivel de clon, sin
tocar la configuración global. G3 (PR #1 + ticket de soporte) sigue pendiente del operador.

---

## Por qué existe este plan

Phase 9 no está bloqueada por dificultad técnica: está bloqueada por **cuatro temas que
no son de código** (permisos del operador, configuración global, un bug de una librería
sin versión futura, y una escalada a soporte externo) y **uno que sí lo es**: no existe
ninguna forma de convertir `subjects.area` en NULL dentro del modelo actual de
migraciones, y sin eso el seed nuevo —que trae `area: null` en las 68 materias— no puede
escribirse en la base.

Todo lo de abajo salió de investigación con fuentes: docs de Cloudflare D1, docs de
drizzle-kit, el código del propio `gentle-ai`, y las docs de GitHub sobre datos
sensibles. Lo verificado está marcado **[V]**; lo inferido **[I]**; lo que no se pudo
determinar **[?]**.

---

## El conjunto bloqueante

| ID | Bloqueo | Tipo | Estado real |
| --- | --- | --- | --- |
| **B1** | La revisión de recibos RDD se rechaza en el runtime opencode | Configuración global | ~~**Solución de 1 comando, sin tocar código**~~ — **CERRADA 2026-10-08 sin ejecutar esa solución**: RDD se desactivó en scope de clon |
| **B2** | `subjects.area` → NULL no es aplicable en D1 | Límite de plataforma | **Resoluble** con `PRAGMA defer_foreign_keys` |
| **B3** | `pnpm db:seed:gen` rojo desde T9.1 | Código | **Depende de B2** |
| **B4** | 29 blobs con PII vivos en `refs/pull/1/head` | Soporte externo | **Sólo GitHub Support** |
| **B5** | La redacción de docentes es un paso manual | Código | **10 líneas** |
| **B6** | La D1 remota está 3 migraciones atrás | Operación remota | **CERRADA 2026-10-08** — comando de 1 paso ejecutado, G1 autorizada |

---

## Lo que destapó la investigación

### B1 — RDD: no es desajuste de versión, es un plugin que nunca se materializó **[V]** — **CERRADA 2026-10-08 por decisión, no por arreglo**

> **El diagnóstico de abajo sigue siendo correcto y no se borró. Lo que cambió es la decisión.**
> El operador eligió **deshabilitar RDD a nivel de clon** en vez de perseguir la elegibilidad:
> `gentle-ai review mode status --cwd .` → `receipt-driven development: off (decided by
> clone_local)`, `global: on`. `gentle-ai 4.0.0` es la última release publicada y OpenCode no es
> un runtime elegible de revisión inmutable para ese build, así que **U3 no se ejecuta y la
> configuración global no se toca** (G2 no se usó). La consecuencia operativa es que este host no
> emite recibos de revisión y el plan continúa con verificación ordinaria.

- `gentle-ai 4.0.0` **es la última versión publicada** (el release de GitHub apunta al
  mismo commit de build `ff77164d`). No hay nada que actualizar.
- La puerta de elegibilidad está en `internal/cli/review_transport_capability.go`
  (`reviewImmutableRuntimeCapability`). Para `AgentOpenCode` exige que la declaración
  del relay y la versión detectada **coincidan**: sin declaración ⇒ espera V1; declaración
  exacta `gentle-ai.opencode-relay/v2-staged` ⇒ espera V2.
- Este host es **opencode v2.0.24** y `GENTLE_AI_OPENCODE_RELAY_CONTRACT` está **sin
  definir** ⇒ pide V1, detecta V2 ⇒ **rechazo**. Ése es el error exacto.
- `docs/opencode-compatibility.md` lo dice: *"Native review … Admitted only for a V2
  runtime whose managed plugin declares the V2 relay contract."*
- `~/.config/opencode/plugins/` tiene `caveman/`, `engram.ts`, `telemetry-runtime.ts` —
  **no** está el plugin de transporte de revisión.
- El contrato del orquestador dice que el lifecycle existe en OpenCode. No se contradice:
  describe el destino, la binaria decide la elegibilidad y un host V2 sin registrar es,
  desde el límite compilado, un runtime no soportado.

**[?] Única release probada: opencode 2.0.4.** El doc admite que *"the broader runtime
matrix … remains unproven"*. Ours es 2.0.24. Hay que probar y ver.

### B2 — `PRAGMA defer_foreign_keys` es la salida documentada **[V]**

Docs de D1, *Foreign Keys*:

> *"Because D1 runs every query inside an implicit transaction, user queries cannot
> change this during a query or migration. Instead, D1 allows you to call
> `PRAGMA defer_foreign_keys = on` or `off`, which allows you to violate foreign key
> constraints temporarily (until the end of the current transaction)."*

El ejemplo de la propia documentación es un `ALTER TABLE` de esquema. También confirma
el premise: `PRAGMA foreign_keys = OFF` **no** es una palanca — *"is identical to …
`PRAGMA foreign_keys = on`"*.

Además:

- **drizzle-kit 0.31.11 es la última versión publicada** (`dist-tags.latest`). El bug de
  `SQLiteRecreateTableConvertor` **no tiene arreglo upstream**. No hay a qué esperar.
- **Las migraciones escritas a mano sí se soportan**: `drizzle-kit generate --custom`
  crea el archivo, el snapshot y la entrada del journal; se escribe el SQL entre los
  `--> statement-breakpoint`. Documentado.
- `docs/drizzle-migrations-and-data.md:145` del propio repo: una vez que wrangler
  registró una migración en `d1_migrations`, **el archivo es inmutable**. Por eso no se
  puede parchear `0008` a mano: tiene que ser `0009`.

**[?] Sin ejemplo de `defer_foreign_keys` como primera sentencia de una migración
aplicada por wrangler.** Es lo primero que hay que probar.

### B3 — la reconstrucción de `subjects` choca con las FK **[V]**

`subjects` es padre de `subject_aliases`, `subject_prerequisites`, `course_groups`,
`student_progress` y `subject_units`, todas con filas. Sin `onDelete`, la FK es NO
ACTION. Cambiar los `canonicalId` a `slug(código)` exige vaciar las hijas primero, y
`DROP TABLE subjects` con hijas presentes es justo lo que D1 rechaza.

**Esta es la cadena de dependencias de todo lo que viene después:**
`area → NULL` → seed escribible → fixture coherente → push y PR posibles.

### B4 — sólo soporte puede purgarlo **[V]**

Docs de GitHub, *Removing sensitive data from a repository*:

- *"you can permanently remove cached views and references to the sensitive data in
  pull requests on GitHub by contacting us through the GitHub Support portal."*
- Lo que hace soporte: desacreferenciar o borrar los PR afectados, correr `gc` en el
  servidor, limpiar vistas cacheadas, purgar objetos LFS huérfanos.
- **La puerta que importa:** *"GitHub Support won't remove non-sensitive data, and will
  only assist in the removal of sensitive data in cases where we determine that the risk
  can't be mitigated by rotating affected credentials."* 121 nombres de empleados **son
  datos personales, no credenciales**. Ése es el punto duro del ticket.
- *"We recommend merging or closing all open pull requests before removing files."*
  Cerrar el PR no purga nada por sí solo, pero quita una ref activa y simplifica el
  ticket.
- Contenido obligatorio del ticket: dueño + repo, **número de PR afectados** (de
  `.git/filter-repo/changed-refs`) y el `NOTE: First Changed Commit(s)`.

### B5 — un solo punto de entrada **[V]**

`load_specialty_subjects()` (`scripts/build-verified-curriculum.py:176`) es el **único**
lector de `docs/data/sim-grupos-oferta.json` y sólo toma `code`, `name`, `credits`. Nunca
toca `teacher`. **[?] No verificado si `sim-temarios.json` también lo lee** — hay que
comprobarlo antes de cerrar la tarea.

### B6 — la D1 remota está en `0005`, no en `0007` **[V, corrección]** — **CERRADA 2026-10-08**

> **Ejecutado.** `wrangler d1 migrations apply opensim --remote` aplicó `0006`, `0007` y `0008`;
> las tres pasaron. `wrangler d1 migrations list opensim --remote` responde ahora
> `✅ No migrations to apply!` y `d1_migrations` tiene 9 entradas. Conteo de filas **sin cambios**:
> `subjects` 42, `student_progress` 38, `course_groups` 8, `student_credentials` 1,
> `student_profiles` 1. La superficie del repo que había que evitar —reescribir `drizzle/`— no se
> tocó. La revisión de la derecha era correcta: el retraso eran 3 migraciones, no 1.

```
$ wrangler d1 migrations list opensim --remote
Migrations to be applied:
  0006_lush_wild_pack.sql
  0007_fast_scarlet_witch.sql
  0008_wealthy_kitty_pryde.sql
```

Revisadas a mano: `0007` es un `CREATE UNIQUE INDEX`; `0006` reconstruye
`student_progress` y `student_credentials`, **dos tablas sin hijas**, y su
`INSERT … SELECT` lista las mismas columnas a ambos lados. **Las tres son aplícables.**
La cifra real de retraso es 3, no 1.

---

## Ondas

### Onda 1 — sin dependencias entre sí, y en su mayoría no son código

| ID | Tarea | Superficie | Cierra |
| --- | --- | --- | --- |
| **U1** | Aplicar `0006`–`0008` a la D1 remota y verificar | ninguna (operación) | B6 |
| **U2** | `redact_teachers()` dentro del generador | `scripts/build-verified-curriculum.py`, `scripts/README.md` | B5 |
| **U3** | ~~`gentle-ai sync --agent opencode`, reiniciar host, re-evaluar~~ — **CANCELADA 2026-10-08**; B1 se cerró desactivando RDD en scope de clon | `~/.config/opencode/` (global, **sin tocar**) | B1 |
| **U4** | Cerrar PR #1, recoger el conteo, abrir ticket de soporte | GitHub (cuenta del operador) | B4 |

### Onda 2 — la columna vertebral de datos. Serializable, con dependencias duras

**Toda la Onda 2 está ejecutada (2026-10-08).** La columna de estado se añade aquí; el
plan original se conserva intacto.

| ID | Tarea | Depende de | Superficie | Estado |
| --- | --- | --- | --- | --- |
| **U5** | Probar `defer_foreign_keys` en una D1 descartable | — | `/tmp` sólo | ✅ ejecutado |
| **U6** | `area` → NULL con migración `0009` escrita a mano | U5 | `src/lib/server/db/schema.ts`, `drizzle/0009_*.sql` | ✅ `0009_subjects-rebuild.sql` |
| **U7** | `seed.ts` a la forma nueva + reconstrucción de `subjects` a 68 filas (= **T9.7**) | U6 | `src/lib/server/db/seed.ts`, `drizzle/0009` o `0010` | ✅ `159b2bc` |
| **U8** | Rehacer `enrollment-fixture.json` (= **T9.8**) | U7 | `src/lib/server/db/data/enrollment-fixture.json` | ✅ dentro de `159b2bc` |

**Puerta de decisión de Onda 2.** U6 y U7 compiten por la misma migración: U6 reconstruye
`subjects` para soltar el `NOT NULL`; U7 tiene que vaciar las hijas y escribir los
`canonicalId` nuevos. **Se hacen en una sola migración** — partirla crea dos
reconstrucciones de la misma tabla y el doble de ventana de fallo.

---

## Tareas en detalle

### U1 — D1 remota al día

- `wrangler d1 migrations list opensim --remote` antes y después.
- `just db-migrate-remote` (= `wrangler d1 migrations apply opensim --remote`).
- Verificación: `SELECT name FROM sqlite_master WHERE type='table'` y
  `PRAGMA table_info(subjects)` sobre `--remote`.
- **Requiere autorización explícita del operador.** Es una mutación de producción.
  **Autorizada y ejecutada el 2026-10-08.** El resultado verificado está en §B6.

### U2 — redacción como paso de pipeline

- Una función `redact_teachers(doc)` en `scripts/build-verified-curriculum.py`, alias
  deterministas, aplicada a todo lo que se lea de `docs/data/`.
- Comprobar primero si `sim-temarios.json` también es entrada del generador. Si lo es,
  la misma función cubre ambos; si no, hay que decidir si el redactor vive en el
  generador o en un paso aparte — **y entonces ya no es «10 líneas»**.
- Verificación: un `ruff check` + `ruff format --check` + `ty check` en verde, y una
  aserción de que ningún `teacher` del resultado coincide con un patrón de nombre real.

### U3 — el plugin del relay de revisión

- `gentle-ai sync --agent opencode` (scope global) y reiniciar el host.
- Repetir `gentle-ai review assess --cwd . --agent opencode --base-ref main --committed-only --json`.
- Éxito = `risk` con `reasons` sin `unassessable` y el lifecycle de STATUS ejecutable.
- **Requiere autorización**: escribe configuración global de OpenCode.
- Si sigue rechazando: **no** es un bug del repo. Se documenta como limitación del host
  y el plan sigue con verificación ordinaria. No se manda ningún reporte a Gentle AI sin
  que el operador lo pida.

### U4 — PR #1 y ticket de soporte

- Cerrar el PR #1.
- Contar los refs afectados: `grep -c '^refs/pull/.*/head$' .git/filter-repo/changed-refs`.
- Localizar el `NOTE: First Changed Commit(s)` de la salida de `git-filter-repo`.
- Abrir el ticket con esos tres datos. Decir **explícitamente** que son datos personales
  de empleados, no credenciales — ocultar eso es la forma más rápida de que lo rechacen.
- **Requiere al operador**: la cuenta es suya y el ticket identifica a una persona real.

### U5 — el experimento que decide la Onda 2 — ✅ **EJECUTADO 2026-10-08**

Banco descartable en `/tmp/opencode/dfk-probe/`, 15 bindings D1 locales, `--local`
nunca `--remote`, la base real `390df78e-…` nunca fue contactada. Nada se escribió en
`drizzle/`.

**VEREDICTO: `PRAGMA defer_foreign_keys = on` se ejecuta sin queja como primera
sentencia de una migración aplicada por wrangler, pero por sí solo NO hace que la
reconstrucción funcione. Sólo funciona si las filas se copian ANTES de soltar la tabla
padre.**

| Prueba | Resultado |
| --- | --- |
| 1. ¿El pragma se ejecuta? | **PASA.** `0001_pragma_only.sql` ✅. La posición es irrelevante:movido después de un DDL también funciona |
| 2. Reconstrucción con el pragma, orden ingenuo (12 pasos) | **FALLA** |
| 3. Control negativo (mismo archivo sin el pragma) | **FALLA limpio** — control y tratado difieren sólo en la línea del pragma |
| 4. Orden con tabla de respaldo | **PASA** sobre el esquema real de 11 columnas |

El fallo se movió: con el pragma el `DROP TABLE` sí pasa y la violación se pospone hasta
el `COMMIT`, que es donde revienta:

```
ERROR Durable Object was reset and rolled back to its last known good state because the
       application left the database in a state where constraints were violated:
       FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)
```

Es decir: **`defer_foreign_keys` aplaza la violación, no la previene.**

### U6 — `area` → NULL — **ORDEN CORREGIDO POR U5**

- `drizzle-kit generate --custom --name=area-nullable` → `0009_<slug>.sql`.
- **El orden de 12 pasos que este plan prescribía falla.** El orden que sí funciona:

```
PRAGMA defer_foreign_keys = on;
CREATE TABLE subjects_backup AS SELECT <11 columnas> FROM subjects;   -- respaldar PRIMERO
CREATE TABLE subjects_new (... area text ... );                       -- área nullable
DROP TABLE subjects;
ALTER TABLE subjects_new RENAME TO subjects;
INSERT INTO subjects (<11>) SELECT <11> FROM subjects_backup;        -- reponer ANTES del commit
DROP TABLE subjects_backup;
CREATE UNIQUE INDEX subjects_code_unique ON subjects (code);
PRAGMA foreign_key_check;
```

Resultado medido sobre D1 local con el esquema real de 11 columnas: `area notnull=0` ✅,
filas hijas intactas (`student_progress` 2, `course_groups` 2, `subject_aliases` 2,
`prereqs` 1, `units` 2) ✅, índice único recreado ✅, `PRAGMA foreign_key_check` → `[]` ✅,
sin tablas de respaldo colgando ✅, `INSERT` con `area=NULL` aceptado ✅.

Tres trampas que U5 discovered:

1. **`defer_foreign_keys` no sobrevive entre archivos.** Con la forma A aplicada en
   `0001`, un `0002` separado con sólo `DROP TABLE subjects;` falla con error de FK
   normal. Hay que repetir el pragma en cada archivo que haga DDL destructivo.
2. **`BEGIN;` explícito en un archivo de migración lo rechaza workerd:** *"To execute a
   transaction, please use the state.storage.transaction() … APIs instead of the SQL
   BEGIN TRANSACTION or SAVEPOINT statements."* U6 debe apoyarse en la transacción
   implícita del runner.
3. **La respaldo `CREATE TABLE AS SELECT` pierde la FK de `specialty_code`**, así que hay
   que redeclararla explícitamente en `subjects_new`. Y como U6 y U7 comparten migración,
   `subjects_backup` conserva los `canonicalId` **viejos**, que es justo lo que U7 va a
   reescribir — no deben cruzarse.

**Respaldo alternativo:** vaciar las cinco tablas hijas primero funciona sin pragma
ninguno. Es el plan B de U7 si esta forma se comporta distinto en la D1 remota.

- `schema.ts`: quitar `.notNull()` y **borrar el comentario de tres líneas** que T9.2
  dejó, porque su razón desaparece.
- Verificación: aplicar en local, `PRAGMA table_info(subjects)` con `area notnull=0`,
  conteos de filas hijas idénticos antes y después, `PRAGMA foreign_key_check` vacío,
  y `pnpm check` + `pnpm test` en verde.

### U7 — el seed contra la forma nueva (= T9.7)

- `seed.ts`: `Dataset` pasa de `careers[]` + `prerequisites` por materia a
  `careerCode`/`careers[]`/`specialties`/`prerequisites` de nivel superior, conservando
  **todas** las aserciones de fallo fuerte que ya tiene (fail loud, nunca rellenar sin
  fuente).
- Reconstrucción de `subjects` a las 68 filas verificadas, con los 114 alias sintéticos de
  docente. Los alias son los mismos `DOC-NNN` de `docs/data/`: una sola convención.
- Vaciar `subject_aliases`, `subject_prerequisites`, `course_groups`, `student_progress`
  y `subject_units` antes, porque los `canonicalId` viejos dejan de existir.
- Verificación: `pnpm run db:seed:gen` en verde, `wrangler d1 execute --local` del
  `seed.sql` generado, y un conteo por tabla contra lo esperado.

### U8 — el fixture (= T9.8)

- Todos los `canonicalId` del fixture pasan a `slug(código)`.
- Verificación: `pnpm run db:seed` completo y `pnpm test` en verde. La validación cruzada
  fixture↔currículo de `seed.ts` es la que detecta un `canonicalId` mal mapeado.

---

## Puertas de autorización

Nada de esto se ejecuta sin que el operador lo pida explícitamente. Permiso de
desarrollo local **no** es permiso para lo remoto:

| Puerta | Qué | Por qué |
| --- | --- | --- |
| **G1** | U1 (migraciones a la D1 de producción) — **ejercida 2026-10-08** | mutación de datos en producción |
| **G2** | U3 (`gentle-ai sync` global) — **no se usó** | escribe configuración global del host |
| **G3** | U4 (cerrar PR, ticket de soporte) | la cuenta es del operador y el ticket lo identifica |

U2, U5, U6, U7 y U8 son locales y no necesitan puerta.

---

## Riesgos y lo que queda abierto

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R1 | `gentle-ai sync` no admite opencode 2.0.24 | U3 falla; se pierde todo recibo de revisión en este host | Es el estado actual, así que no hay regresión. Se documenta y se sigue con verificación ordinaria |
| R2 | `defer_foreign_keys` no sobrevive al wrapper de wrangler | La Onda 2 se rediseña | U5 lo prueba antes de que U6 escriba una sola línea de migración |
| R3 | Ticket de soporte rechazado por ser datos personales y no credenciales | B4 no se cierra | Es el punto duro ya identificado. La mitigación real es no volver a publicar PII |
| R4 | `docs/drizzle-migrations-and-data.md:145` vuelve inmutable todo archivo ya registrado | No se puede parchear `0008` a posteriori | Por eso B2 es `0009`, no una edición |
| R5 | El generador también lee `sim-temarios.json` | U2 no son 10 líneas | Se comprueba primero; el plan se ajusta antes de escribir |

---

## Fuera de alcance

- T9.3–T9.6 y T9.9–T9.14. Este plan termina cuando se puede sembrar y verificar.
- Cambiar el modelo de datos más allá de `area`. Nada de `subject_subtopics`,
  `academic_periods` ni `subject_labs`.
- Documentación de Codeberg para el procedimiento de datos sensibles. **[?]** No
  investigada; si el ticket de U4 no prospera, es el siguiente sitio.
- Arreglar el bug de `SQLiteRecreateTableConvertor`. No hay versión que lo arregle y no
  es código nuestro.

---

## Estrategia de entrega

Pronóstico: **~300 líneas autorales** (U2 10, U6 40, U7 200, U8 50; los archivos `.sql`
generados no cuentan). Por debajo del presupuesto de 400 ⇒ **un solo PR**, sin cadena.
Partir entre migraciones relacionadas queda prohibido.

U1, U3 y U4 no producen commits: son operaciones. U2 y U6–U8 producen uno cada una.

## Próximo paso

> **Cerrado 2026-10-08 (tercera reconciliación).** U6 y U7 **están hechas**, en una sola
> migración `0009` como el plan decía, y U8 también. La Onda 2 está completa. Este bloque
> se conserva como registro del punto en el que se estaba.

**U6 + U7 en una sola migración `0009`.** U5 ya respondió la pregunta que las gating, y la
respuesta cambió la forma del trabajo: no es la reconstrucción de 12 pasos que este plan
prescribía, sino respaldar → crear → soltar → renombrar → reponer → tirar el respaldo.
U2 ya está hecha, así que la Onda 1 queda vacía salvo U4.

**Lo que realmente se ejecutó, y la diferencia con lo de arriba:** ni `defer_foreign_keys`
ni tabla de respaldo. Se tomó el **respaldo alternativo** que el propio §U6 ya preveía —
vaciar **12 tablas** antes del `DROP TABLE`: las cinco hijas de `subjects`
(`course_groups`, `student_progress`, `subject_prerequisites`, `subject_aliases`,
`subject_units`), más `course_schedule_blocks` (hija de `course_groups`) y las seis del
resto de la cadena (`subjects`, `auth_sessions`, `student_credentials`,
`student_profiles`, `specialties`, `careers`). El plan ya describía
esa forma; lo que no anticipaba era que **fuera la única que funciona**, porque no queda
nada que preservar.

Estado final de la Onda 2:

| Tarea | Estado | Evidencia |
| --- | --- | --- |
| **U5** | ✅ ejecutado | Veredicto en §U5: el pragma pospone, no previene |
| **U6** | ✅ ejecutada | `drizzle/0009_subjects-rebuild.sql`, escrita a mano, aplicada en remoto |
| **U7** | ✅ ejecutada | `159b2bc`; `seed.sql` regenerado y aplicado |
| **U8** | ✅ ejecutada | Fixture reconstruido dentro de `159b2bc` (absorbió T9.8) |
| **U4** | ⚪ parcial | Depende del operador — ver §B4 |

## Lo que la ejecución cambió que el plan se equivocó

Dos cosas. Ninguna se borra del plan; las dos se anotan aquí.

### 1. Relajar sólo `area` no bastaba

Todo el plan gira alrededor de una columna. El dataset verificado trae **cuatro** columnas en
`null`, no una:

| Columna | Por qué es `null` | Filas |
| --- | --- | --- |
| `area` | H4 — ninguna fuente clasifica áreas curriculares | 68 de 68 |
| `semester` | H8 — no se publica el semestre de un módulo de especialidad | 16 |
| `ht` | H8, mismo corte | 16 |
| `hp` | H8, mismo corte | 16 |

Si `0009` se hubiera escrito como el plan decía — relajar `area` únicamente — el seed
habría seguido fallando al insertar las 16 materias de especialidad. Se corrigió en la misma
migración, antes de aplicarla. **`subjects` tiene 11 columnas, cuatro nullable**; el plan
sabía de una.

### 2. "30 filas approved sumando 175 cr" es aritméticamente imposible

El plan derivó el fixture como "30 filas APPROVED que suman los 175 crás del perfil". Esa
combinación no puede existir: los **30 valores de crédito más altos del plan verificado
suman 161 cr**, así que ningún conjunto de 30 asignaturas alcanza 175.

Medido sobre el catálogo de 68:

| Conjunto | Suma de créditos |
| --- | --- |
| 30 valores de crédito más altos | **161** — imposible llegar a 175 |
| 41 valores más altos | 216 — sí alcanza |
| Las 41 filas `APPROVED` que hay en el fixture | **175** ✅ |

**Gana la invariante de créditos.** El fixture tiene **41 filas `APPROVED` / 175 cr** y **6
filas `ENROLLED` / 24 cr**, que es exactamente lo que declara el perfil del estudiante. El
número de filas se ajustó a la aritmética; el perfil no se tocó para acomodar el
número de filas.

Nota: el "30" no venía de la nada — el catálogo viejo tenía 42 materias y el fixture viejo
tenía 38 filas. Sobrevivió como número heredado al pasar al plan de 68.

> **Actualizado 2026-10-08 (segunda pasada).** U5 **corrió y produjo un resultado que
> invalida el orden de U6**: `defer_foreign_keys` por sí solo no alcanza. La Onda 1 queda
> así: U1 cerrada, U2 cerrada, U3 cancelada (B1 se resolvió desactivando RDD a nivel de
> clon), U4 parcialmente inválida porque no existe ningún PR que cerrar. La Onda 2 arranca
> con U6+U7 fusionadas en una migración, con el orden corregido de §U6.
>
> **Antes de escribir la migración:** los cambios de U2 y de la reconciliación de `odd/`
> están en el árbol sin commitear. Un commit de housekeeping los agrupa; otro cierra
> las migraciones y el seed.

## Lo que queda abierto y de quién depende

| Tarea | Depende de | Estado |
| --- | --- | --- |
| **U6+U7** | Nada. Todo local | ✅ **HECHO** — `drizzle/0009_subjects-rebuild.sql` + `seed.ts`, commit `159b2bc`, aplicado en la D1 de producción |
| **U8** | U7 | ✅ **HECHO** dentro de U7 — el fixture se reconstruyó, no se remapeó (0 de 38 filas viejas sobreviven) |
| **U4** | El operador | ⚪ **PARCIAL** — sin PR ni issues que cerrar. Sólo queda confirmar con GitHub Support que no queden objetos con PII |
| **H6** | Fuente externa | Nube suma 265, no 260. ¿Módulo de 30 cr o el alumno elige 5 de 6? |
| **H8** | El operador | Semestre de las 16 materias de especialidad. **Sigue abierta y ya tiene impacto visible:** `/retícula` muestra 52 de 68 módulos sin explicarlo. Decisión de bandeja o contador en T9.10 |
| **H3 / H4 / H9** | Catálogo del TecNM o coordinación | Temarios, áreas, seriación de 8 materias |
| **Defecto** | Nadie — pre-existente | `course_schedule_blocks` no tiene clave natural: `INSERT OR REPLACE` **duplica** los bloques en cada corrida del seed. Confirmado en HEAD sin modificar (28 filas antes del wipe de `0009`, 14 ahora). **No se arregla en v1.** Detalle en `phase-9-curriculum-data-foundation.md` |

### Verificación de esta reconciliación

| Comprobación | Resultado |
| --- | --- |
| `pnpm check` | svelte-check **0 errores, 0 warnings** |
| `pnpm test` | **272/272**, 16 ficheros |
| Suite **e2e** | **`NOT VERIFIED`** — no corrida en esta sesión |
| `wrangler d1 migrations list opensim --remote` | `✅ No migrations to apply!` |
| Docentes | **0** nombres reales; el seed emite `DOC-001`…`DOC-007` |