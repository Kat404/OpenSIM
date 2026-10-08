# Phase 9 — Cimientos de datos curriculares ISIC (v1)

<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@2ac464f (main@fee9d60)
sha-warning: los SHA 6ca7c12, 8f40837, ffcd595 y b3fef41 citados en el cuerpo de este archivo predicen la reescritura de firmas GPG del 2026-10-08 y están MUERTOS; los SHA de la sección "Commits que importan" verificados con `git cat-file -e` sí están vivos
-->

**Estado:** T9.1, T9.2 y T9.7 cerradas (T9.7 absorbió T9.8) · started 2026-10-07 ·
**reconciliado 2026-10-08**
**Alcance v1:** una sola carrera — **ISIC-2010-224 Ingeniería en Sistemas Computacionales**
**Fuera de v1:** las otras 12 carreras, sus materias y sus unidades (v2)

> **T9.1 → `6ca7c12`** `feat(data): verified ISIC-2010-224 curriculum dataset`
> **T9.2 → `8f40837`** `feat(db): subject seriation tri-state and component columns`
> **T9.7 → `159b2bc`** `feat(db): seed the verified curriculum and relax the unknown-column constraint`
> **T9.8 → absorbida por T9.7** (mismo commit `159b2bc`)
> **T9.3–T9.6 y T9.9–T9.14 abiertas.**

> **Shas re-derivados 2026-10-08.** Este documento se escribió cuando el force-push estaba en
> `b3fef41`. Ese SHA **está muerto**: la reescritura de firmas GPG cambió cada SHA del
> repositorio. La re-derivación del 2026-10-08 (esta pasada) corrige el HEAD: `main` está en
> **`fee9d60`** — no en `ffcd595`, que también está muerto — y la rama de fase en **`2ac464f`**.
> Firmas verificadas el 2026-10-08: **126/126 `G` en `main`, 132/132 `G` en la rama de fase**
> (132 = 126 + 6, no 128). Re-derivación: `git log --oneline --grep='<subject>'`.

### Commits que importan (vivos, `git cat-file -e` verificado 2026-10-08)

| Commit | Subject | Rol en Phase 9 |
| --- | --- | --- |
| `18de1a5` | `feat(data): verified ISIC-2010-224 curriculum dataset` | T9.1 |
| `b6a1d8a` | `feat(db): subject seriation tri-state and component columns` | T9.2 |
| `cbe4315` | `docs(odd): reconcile bookkeeping with the repository after the signing rewrite` | bookkeeping |
| `6f50f93` | `fix(privacy): make docs/data teacher redaction a pipeline guarantee` | B5 |
| `159b2bc` | `feat(db): seed the verified curriculum and relax the unknown-column constraint` | **T9.7 + T9.8** |
| `2ac464f` | `fix(privacy): drop personal names from the titulacion and residencia placeholders` | HEAD de la rama |

> `6ca7c12`, `8f40837` y `ffcd595` son los SHAs que este documento usaba antes de que la
> reescritura de firmas los matara. No se borran: quedan como registro del error. Los vivos
> equivalentes son `18de1a5` (T9.1) y `b6a1d8a` (T9.2).

---

## Objetivo

Reemplazar el catálogo curricular **fabricado** que hoy carga el seed por el catálogo
**verificado** del Instituto Tecnológico de Morelia, y extender el esquema para que existan
las unidades, temas, seriación y laboratorios que la aplicación siempre mostró vacíos.

### Por qué

El dataset anterior se escribió sin fuente. Contra la retícula oficial y el SIM:

| Métrica | Catálogo anterior | Verificado |
| --- | --- | --- |
| Materias | 42 (228 cr, declaraba 260) | **68** = 46 genéricas + 4 complementarias + 2 práctica + 16 especialidad |
| Códigos correctos | ~6 de 42 | **68 de 68** |
| `subject_units` | **0 filas** | **32 unidades / 223 subtemas** (7 materias) |
| Grupos de oferta | 8 ficticios | **468 reales** en 9 periodos |
| Laboratorios | campo `hasLab` sin definición | **6 materias** con grupo de laboratorio propio |
| Seriación | 57 aristas inventadas | **14 aristas verificadas** + **44 materias clasificadas** (21 `SERIALIZED` + 23 `INDEPENDENT`); las 24 restantes son `UNKNOWN` |

> **Corrección 2026-10-08:** esta fila decía "23 materias clasificadas". Era un error
> aritmético: 21 + 23 = 44, no 23. El 23 es el conteo de `INDEPENDENT` solo. Verificado contra
> `src/lib/server/db/data/curriculum-isic-2010-224.json`: `{"SERIALIZED":21,"INDEPENDENT":23,"UNKNOWN":24}`.

Existía una "Inteligencia Artificial `SCC-1024`" que no está en el plan, y faltaba **Química**,
obligatoria de 4 créditos del semestre 2.

---

## Reconciliación de créditos (T9.1) — **exacta**

```
estructura genérica       = 210    declarado en el PDF = 210    Δ = 0
práctica (servicio+resid) =  20    declarado 10 + 10
complementario            =   0    (0 cr reticulares)

ruta del estudiante con Desarrollo de Software = 210+20+25+5 = 260   Δ = 0
ruta del estudiante con Ciberseguridad         = 210+20+25+5 = 260   Δ = 0
ruta del estudiante con Nube                   = 210+20+30+5 = 265   Δ = +5
```

Las tres specialties tienen 5 materias × 5 cr salvo **Nube, que tiene 6** (H6).

---

## Fuentes y su estado probatorio

| # | Fuente | Qué aporta | Confianza |
| --- | --- | --- | --- |
| F1 | `dsc.itmorelia.edu.mx/web/documentos/reticula_isc.pdf` | HT/HP/créditos, semestre por columna, notas al pie, 5 celdas `ESPECIALIDAD 5 cred` | **Alta** — sha256 registrado |
| F2 | SIM `/estudiante/datos/reticula` | Semestre autoritativo, transversales `ITM-*` | **Alta** |
| F3 | SIM `/reinscripcion/grupos` | 468 grupos, docente, aula, y el **icono de matraz** = laboratorio; **catálogo completo de las 3 especialidades** | **Alta** |
| F4 | SIM `/estudiante/datos/calificaciones-curso` | Unidades, subtemas, instrumentos, criterios, fechas | **Alta**, sólo 7 materias |
| F5 | Retícula renderizada (flechas de seriación) | Las cadenas de prerrequisito | **Alta**, contrastada con el grill |
| F6 | Grill del operador | Qué es seriado, qué independiente, reglas de negocio | **Alta** |
| F7 | `morelia.tecnm.mx/assets/escolares/TABLA DE CARRERAS.pdf` | Claves oficiales de carrera | **Alta** para claves, nula para oferta actual |

Copias literales con SHA-256 y método en `docs/data/`. Generador del dataset:
`scripts/build-verified-curriculum.py`.

**Excepción de literidad:** los campos `teacher` de `sim-grupos-oferta.json` y
`sim-temarios.json` están **redaccionados** a alias `DOC-001…DOC-121` (ordenados
alfabéticamente sobre el nombre real). Motivo: el repositorio es público y contiene
PII de terceros ajenos al operador —121 empleados del TecNM Morelia— sin ningún
consumidor en el código. Decisión del operador, 2026-10-07. Los alias son
deterministas y el generador no lee ese campo, así que el dataset sigue siendo
reproducible desde un clon limpio.

### Precedentes técnicos que no hay que repetir

1. `pdftotext -layout` **no sirve** para F1: da 37 emparejamientos erróneos código↔columna.
   Usar `pdftotext -bbox-layout` + coordenada X/Y.
2. La **seriación de F1 está dibujada como vectores**, no como texto. Por eso la primera
   extracción dio 0 aristas. Ese error era rastreable: había que leer los dibujos del PDF.
3. La notación `/AxLy` (A=semestre, L=índice) **es falsa**: 34 de 44 coinciden, 10 no. La
   columna y el SIM mandan.
4. El temario **no** sirve para detectar laboratorios: 6 de 7 materias declaran
   "PRÁCTICAS DE LABORATORIO" y sólo 1 la tiene. El marcador fiable es el matraz de F3.

### Precedente técnico: relajar NOT NULL en SQLite sobre D1 (T9.2)

`area: NULL` (D1) **no se puede aplicar como migración**. SQLite no tiene
`ALTER TABLE ... DROP NOT NULL`; el único camino es la reconstrucción de 12 pasos,
y en D1 falla por dos motivos independientes:

1. **Bug de drizzle-kit 0.31.11.** `SQLiteRecreateTableConvertor` arma el `INSERT`
   de copia con **todas** las columnas de la tabla *nueva*. Si la migración añade
   una columna y además dispara la reconstrucción, emite SQL que referencia columnas
   inexistentes → `Parse error: no such column`.
2. **D1 bloquea reconstruir tablas padre.** D1 fuerza `foreign_keys=ON` y trata el
   `PRAGMA foreign_keys=OFF` de la propia migración como no-op dentro de su
   transacción, así que `DROP TABLE subjects` falla con `SQLITE_CONSTRAINT_FOREIGNKEY`
   (`subject_aliases`, `subject_prerequisites`, `course_groups`, `student_progress`
   tienen filas). Las migraciones 0002/0003/0006 pasaron sólo porque esas tablas no
   tenían hijas.

Sólo las migraciones **puramente aditivas** son seguras. Por eso T9.2 quedó con dos
`ALTER TABLE ... ADD COLUMN` (`seriation_state`, `component`) y `area` se difiere al
rebuild de T9.7, que es la tarea que reconstruye `subjects` de todos modos.

> **Este diagnóstico era correcto y la ejecución lo confirmó.** Pero estaba incompleto, y la
> omisión costó una iteración: **relajar sólo `area` no bastaba.** El dataset verificado trae
> `semester`, `ht` y `hp` en `null` para las 16 materias de especialidad, así que las cuatro
> columnas tienen que ser nullable en la misma migración o el seed vuelve a reventar. Ver
> §"Lo que shipped: T9.7" y `odd/tasks/phase-9-unblock.md` §"Lo que la ejecución cambió".

Dos trampas de verificación:

- `tests/unit/_helpers/harness.ts` reproduce **todos** los `drizzle/*.sql` en
  `node:sqlite`: una migración mal formada pone en rojo 117 de 272 tests.
- Un `sqlite3` local trae `foreign_keys` OFF y **oculta** el rechazo de D1. Hay que
  prefijar `PRAGMA foreign_keys=ON` para reproducirlo fielmente.

### Conflictos resueltos

| # | Conflicto | Resolución |
| --- | --- | --- |
| C1 | Semestre de 5 materias: PDF vs SIM | **Gana el SIM** (F2). Confirmado contra F5 renderizada |
| C2 | Notación `/AxLy` | **No usar.** La columna manda |
| C3 | `AEF-104` (PDF) vs `AEF-1041` (SIM) | Gana el SIM: `AEF-1041` |
| C4 | Total impreso por semestre (245) vs declarado (260) | Los totales por semestre del PDF **no cuadran con sus propias celdas**. Usar la suma de celdas, que sí da 210 exactos (H7) |
| C5 | Temario como detector de laboratorio | **No sirve** |

---

## Decisiones del operador (D1–D5, resueltas)

| # | Decisión | Estado |
| --- | --- | --- |
| D1 | `area` a **NULL** en v1 | **Resuelto.** Se conserva la columna para clasificar en una v1 posterior y derivar de ahí las ramas de la seriación |
| D2 | Modelo de seriación | **Resuelto** — ver abajo |
| D3 | Purgar PII del repositorio | **Resuelto** — ver "Higiene de datos" |
| D4 | Especialidades | **Resuelto** — ver abajo |
| D5 | H1/H2/H3 contra el Catálogo del TecNM | **v2** |

---

## Modelo de seriación (D2)

Una columna + la tabla de aristas que ya existía:

```
subjects.seriation_state TEXT → 'SERIALIZED' | 'INDEPENDENT' | 'UNKNOWN'
subject_prerequisites         → 14 aristas verificadas
```

| Estado | Materias |
| --- | --- |
| `SERIALIZED` (21) | Cálculo · Programación · Bases de datos · Ing. de Software · Redes · Autómatas · Interfaz→Programables |
| `INDEPENDENT` (23) | 17 del plan + 4 transversales complementarias + 2 transversales |
| `UNKNOWN` (24) | 8 del plan sin flecha legible + las 16 de especialidad |

### Las 7 cadenas verificadas

```
ACF-0901 → ACF-0902 → ACF-0904
AED-1285 → AED-1286 → AED-1026 → SCD-1027
AEF-1031 → SCA-1025 → SCB-1001
SCC-1007 → SCD-1011 → SCG-1009
AEC-1034 → SCD-1021 → SCD-1004 → SCA-1002
SCD-1015 → SCD-1016
SCC-1014 → SCC-1023
```

Ajustes que corrigieron la primera lectura del grill:

- **Cálculo Vectorial sí es seriada.** Ecuaciones Diferenciales es la **independiente**.
- **Álgebra Lineal** → independiente.
- **Programación Lógica y Funcional** → independiente.

### Las 8 materias con seriación `UNKNOWN`

`SCC-1017` Métodos Numéricos · `SCD-1018` Principios Eléctricos · `AEC-1061` Sistemas
Operativos · `SCD-1003` Arquitectura de Computadoras · `SCA-1026` Taller de Sistemas
Operativos · `ACA-0909` Taller de Investigación I · `ACA-0910` Taller de Investigación II ·
`SCC-1012` Inteligencia Artificial.

La UI debe mostrar el tri-estado. `UNKNOWN` no es "no seriada": es "no sabemos".

---

## Especialidades (D4)

| Prefijo | Especialidad | Clave | Materias | Créditos |
| --- | --- | --- | --- | --- |
| `TDD-*` | **Desarrollo de Software** | `ISIE-TDD-2026-01` | `TDD-2301…2305` | 25 |
| `SID-*` | **Ciberseguridad** | `ISIE-SID-2026-01` | `SID-2301…2305` | 25 |
| `TND-*` | **Nube** | `ISIE-TND-2026-01` | `TND-2301…2306` | 30 ⚠️ |

Hueco H1 **cerrado**:;subjectos, códigos y créditos salen de F3. Semestre de las materias de
especialidad: **desconocido** (H8).

## Créditos complementarios (F6)

| Regla | Valor |
| --- | --- |
| Créditos complementarios requeridos | **5** |
| Liberan el Servicio Social | **Sí**, obligatorio |
| Quién los otorga | `ITM-100` Tutoría, `ITM-104` Act. Físicas, `ITM-105` Apreciación de Artes, `ITM-101` Actividades Complementarias |
| Créditos reticulares que aportan | **0** — sirven sólo para dar el complementario |
| `/actividades-complementarias` (subida de PDF) | **v2**. En v1 sólo la UI/UX del contador |

## ELEGIBILIDAD DE ESPECIALIDAD (F6, regla dura de v1)

```
semestre mínimo            : 6
créditos reticulares mín. : 146
```

Los créditos reticulares sirven para el **% de avance** y para esta elegibilidad. No se conoce
el equivalente de otras carreras.

---

## Laboratorios — el modelo correcto

```
course_groups.has_lab        → "este grupo tiene laboratorio"   (el matraz de F3)
course_groups.is_lab_session → "este grupo ES la sesión de laboratorio"  (0 créditos)
subjects.hasLab (derivada)   → existe algún grupo con has_lab
```

Las 6 materias con laboratorio dedicado y su grupo parejo de 0 créditos:

| Teoría | Cr | Grupo lab | Periodo |
| --- | --- | --- | --- |
| `AEC-1058` Química | 4 | `B2L4` | 2 |
| `SCF-1006` Física General | 5 | `B3LA` | 3 |
| `SCD-1018` Principios Eléctricos y Aplicaciones Digitales | 5 | `B4LA` | 4 |
| `SCD-1003` Arquitectura de Computadoras | 5 | `B5LB` | 5 |
| `SCC-1014` Lenguajes de Interfaz | 4 | `B6LE` | 6 |
| `SCC-1023` Sistemas Programables | 4 | `B5LA` | 7 |

Las 6 tienen el **100 %** de sus grupos con matraz. No existe el caso parcial.

---

## Higiene de datos (D3)

**Fallo grave cometido y corregido.** Se escribió el nombre completo, la matrícula, la CURP,
los promedios, la entidad de nacimiento y el número de seguridad del operador en
`odd/audit.md` sin avisar.

| Acción | Estado |
| --- | --- |
| Purgado del árbol de trabajo | ✅ `odd/audit.md` + 6 archivos de `odd/tasks/` |
| Reescritura de los 126 commits con `git-filter-repo --replace-text` | ✅ 0 blobs con PII |
| Force-push a GitHub y Codeberg | ✅ ambos en `b3fef41` — **SHA muerto**; al 2026-10-08 `main`=`ffcd595`, rama de fase=`8f40837` |
| `refs/pull/1/head` en GitHub | ❌ **29 blobs con PII siguen vivos.** GitHub no permite borrar refs de PR. **B4, abierta.** |
| `src/` (Codegraph) | ✅ sólo PII sintética: `OPNS000101HDFRRA09`, control `99999999`, `HERA000615MMNRZNA3` |
| Alias de docentes en `docs/data/` | ✅ verificado 2026-10-08: **468/468** filas en `sim-grupos-oferta.json` y **7/7** en `sim-temarios.json` son alias `DOC-NNN`. Cero nombres reales en nada enviado. |

**Verificación de los alias (2026-10-08, reproducible):**

```sh
for f in docs/data/sim-grupos-oferta.json docs/data/sim-temarios.json; do
  printf '%s: ' "$f"; rg -o 'DOC-[0-9]{3}' "$f" | wc -l
done
```

**Pendiente del operador:** cerrar el PR #1 y reportar a soporte de GitHub y Codeberg para
el borrado de los objetos inalcanzables y de las vistas cacheadas. Una reescritura de
historial no garantiza borrado físico en un forge público.

La credencial de desarrollo de OpenSIM es `99999999`, no la matrícula real. No hubo fuga de
credencial viva.

---

## Cambios de esquema

### Lo que YA SHIPPEÓ (T9.7, `159b2bc` + `drizzle/0009_subjects-rebuild.sql`)

**Corrección 2026-10-08.** Esta sección decía "Cambios de esquema **pendientes**" y listaba
todo como futuro. `subjects`, `specialties` y `subject_prerequisites` ya están hechas y
aplicadas — a la D1 de producción incluida. La tabla original no se borra: se conserva abajo
como el plan que se escribió, con su estado real anotado.

| Tabla | Lo que decía el plan | Estado real |
| --- | --- | --- |
| `subjects` | `canonical_id` = `slug(código)`; **68 filas**; `area` → NULL; + `seriation_state`; + `component` | ✅ **SHIPPED**, pero el plan estaba incompleto: **cuatro** columnas quedaron nullable, no una. Ver abajo. |
| `specialties` | **3 filas** reales | ✅ **SHIPPED** — 3 filas, sembradas por `seed.ts:184` |
| `subject_prerequisites` | **14 filas** verificadas | ✅ **SHIPPED** — 14 aristas, `seed.ts:213` |
| `course_groups` | **468 filas** + `period`, `credits`, `is_lab_session` | ☐ **ABIERTA (T9.4)** — en producción hay **7** filas del fixture, no 468. Las columnas `period`/`credits`/`is_lab_session` no existen. |
| `subject_units` | **32 filas** + `eval_from`, `eval_to`, `instruments`, `criteria` | ☐ **ABIERTA (T9.3)** — en producción hay **0** filas. Las 4 columnas no existen. |

#### Las cuatro columnas nullable de `subjects` — el plan decía una

El plan afirmaba "`area` → NULL". Lo que shipped es **cuatro** columnas nullable
(`src/lib/server/db/schema.ts:62-66`), y la razón no es sólo H4:

```ts
// src/lib/server/db/schema.ts:59-66
// NULL where no source establishes the value: `area` is unclassified
// across the whole verified plan (H4), and `semester`/`ht`/`hp` are
// unknown for the 16 specialty modules (H8).
semester: integer("semester"),
ht: integer("ht"),
hp: integer("hp"),
credits: integer("credits").notNull(),
area: text("area"),
```

| Columna | Nullable | Por qué | Filas NULL medidas |
| --- | --- | --- | --- |
| `area` | sí | H4 — ninguna fuente clasifica áreas curriculares | **68 de 68** |
| `semester` | sí | H8 — no se publica en qué semestre se cursa un módulo de especialidad | **16** (las 16 de especialidad) |
| `ht` | sí | H8, mismo corte que `semester` | **16** |
| `hp` | sí | H8, mismo corte que `semester` | **16** |
| `credits` | **no** | siempre conocido | 0 |
| `seriation_state` | **no**, `DEFAULT 'UNKNOWN'` | tri-estado; `UNKNOWN` es "no establecido desde una fuente", no "no serializado" | 0 |
| `component` | **no**, `DEFAULT 'GENERIC'` | siempre conocido | 0 |

Medido en la D1 de producción `390df78e-c4c2-4ace-94f4-6baebf1eb88f` el 2026-10-08:
`area IS NULL` = 68, `semester IS NULL` = 16, `ht IS NULL` = 16, `hp IS NULL` = 16,
`seriation_state IS NULL` = 0. `PRAGMA foreign_key_check` vacío.

### Lo que SIGUE pendiente

| Tabla | Acción | Tarea |
| --- | --- | --- |
| `subject_units` | **32 unidades / 223 subtemas** (7 materias) + columnas `eval_from`, `eval_to`, `instruments`, `criteria` | T9.3 |
| `course_groups` | **468 filas** en 9 periodos + `period`, `credits`, `is_lab_session` | T9.4 |
| `complementary_credit_activities` | Tabla nueva: conteo por estudiante y su desbloqueo del Servicio Social | T9.6 |

### Tablas nuevas

| Tabla | Para qué | Estado |
| --- | --- | --- |
| `complementary_credit_activities` | Conteo por estudiante y su desbloqueo del Servicio Social | ☐ no creada (T9.6) |

### Lo que NO se agrega en v1

| No se agrega | Razón |
| --- | --- |
| `subject_subtopics` | Los subtemas viven en `subject_units.subtopics_json` |
| `academic_periods` | Basta `course_groups.period TEXT` |
| `subject_labs` | Derivable de `course_groups.is_lab_session` |
| Docentes reales en la app | **Ninguno.** `docs/data/` va redactado a alias `DOC-NNN`; el seed usa los mismos alias sintéticos |

---

## Huecos documentados

| # | Hueco | Impacto | Cierre |
| --- | --- | --- | --- |
| **H6** | **Nube suma 265, no 260** (6 materias × 5 cr) | La ruta del estudiante con Nube no cuadra | ¿El módulo vale 30? ¿el alumno elige 5 de 6? |
| **H7** | Los **totales por semestre impresos en F1 no cuadran con sus propias celdas** (S5 24 vs 25, S6 29 vs 28, S7 30 vs 29, S8 26 vs 27, S9 24 vs 14) | F1 tiene arithmetic interno roto | Se usa la suma de celdas, que da 210 exactos. La fila de totales es inservible |
| **H8** | **Semestre de las 16 materias de especialidad** desconocido | No se pueden colocar en la retícula | SIM `/estudiante/datos/especialidad` de un alumno ya asignado, o Catálogo |
| **H3** | **Temarios de ~39 materias**: F4 sólo expone el periodo activo | El detalle de temario sólo existe para 7 | Catálogo de Asignaturas · docentes |
| **H4** | **Áreas curriculares**: sin fuente | `/reticula` sin color por área | Clasificación del plan impreso |
| **H9** | **Seriación de 8 materias** `UNKNOWN` | La UI las muestra "por confirmar" | F5 a mayor resolución, o Catálogo |
| **H10** | `refs/pull/1/head` con PII en GitHub | Filtrado de datos incompleto en GitHub | Cerrar el PR + soporte |

---

## Tareas

| ID | Tarea | Estado |
| --- | --- | --- |
| **T9.1** | Dataset canónico verificado — `scripts/build-verified-curriculum.py` → 68 materias, Δ 0 en los 3 routes | ✅ **cerrada** |
| **T9.2** | Migración `subjects`: `seriation_state`, `component` (2 `ADD COLUMN`) | ✅ **cerrada** (`b6a1d8a`) — `area` → NULL se difirió a T9.7, y resultó que `semester`/`ht`/`hp` también |
| **T9.3** | Migración `subject_units`: 4 columnas + 32 filas | ☐ abierta |
| **T9.4** | Migración `course_groups`: `period`, `credits`, `is_lab_session` + 468 filas | ☐ abierta |
| **T9.5** | Migración `specialties` (3 filas) + `subject_prerequisites` (14 aristas) | ✅ **cerrada por T9.7** — las 3 especialidades y las 14 aristas se sembraron en `159b2bc`; no hizo falta migración aparte |
| **T9.6** | Tabla `complementary_credit_activities` | ☐ abierta |
| **T9.7** | `seed.ts` + `seed.sql`: leer el nuevo dataset, reconstruir `subjects` a 68 filas, sembrar especialidades y prerrequisitos | ✅ **cerrada** (`159b2bc`) — **absorbió T9.8** |
| **T9.8** | Rehacer `enrollment-fixture.json` con los `canonicalId` nuevos | ✅ **cerrada dentro de T9.7** — fue una reconstrucción, no un remapeo. Ver §"T9.8 fue una reconstrucción, no un remapeo" |
| **T9.9** | `dag.ts` con 14 aristas + `seriation_state` tri-estado | ☐ abierta |
| **T9.10** | `/retícula`: semestres corregidos, badge de laboratorio, ramas de seriación | ☐ abierta — **con una decisión de operador pendiente**. Ver abajo |
| **T9.11** | `/horario`: aulas reales | ☐ abierta |
| **T9.12** | **Detalle de temario** — primer consumidor real de `subject_units` | ☐ abierta |
| **T9.13** | `/tramites`: regla de los 5 complementarios → Servicio Social | ☐ abierta |
| **T9.14** | `/reinscripcion`: filtro por área desaparece (D1), aparece el de laboratorio | ☐ abierta — **el filtro por área ya está inerte y_null-safe**; ver §Radio de impacto |

## Radio de impacto de las cuatro columnas nullable

Medido sobre `src/` en `2ac464f`. Las cuatro columnas nullable **no** tienen el mismo
consumidor: dos tienen lector real y dos no tienen ninguno.

| Columna | Se escribe en | **Se lee en** | ¿Null-unsafe? |
| --- | --- | --- | --- |
| `semester` | `seed.ts:195` | `reticula/+page.server.ts:68` (select), `:72` (`orderBy asc`), `ReticulaDag.svelte:86-100` (agrupación), `SubjectNode.svelte:65-68` (render) | **Sí, en el tipo.** Ver abajo. |
| `area` | `seed.ts:195` | `reinscripcion/+page.server.ts:121` (select), `simulador/types.ts:19`, `EnrollmentSimulator.svelte:63` (filtro de `Set`), `:99` (predicado), `:156` (metadatos de fila) | **No.** Filtrado a propósito en `:63` antes de `Set`/`localeCompare`. |
| `seriation_state` | `seed.ts:195` | **nadie.** Sólo `seed.ts:344-346` lo valida al escribir | **No.** Columna escrita, aún sin consumidor de UI. |
| `component` | `seed.ts:195` | **nadie.** Sólo `seed.ts:347-349` lo valida al escribir | **No.** Columna escrita, aún sin consumidor de UI. |

**El punto que hay que arreglar en T9.10 — `RetSubject.semester` es una mentira de tipos.**

```ts
// src/routes/(protected)/reticula/+page.server.ts:32
semester: number;   // <-- dice number
```

La interfaz exportada declara `number`, pero la columna underlying es nullable y el `select`
de la línea 68 devuelve `number | null`. El type-checker no lo detecta porque el `return` de
la línea 114 no está anotado: `RetSubject` sólo se usa en los dos `satisfies` de las ramas
tempranas, donde el array va vacío. El consumidor final sí es correcto —
`SubjectNode.SubjectViewModel.semester` es `number | null` (`SubjectNode.svelte:21`) y
`ReticulaDag` comprueba `=== null` **antes** que `s.semester < 1`
(`ReticulaDag.svelte:86-92`), porque `null < 1` por coerción es `true` y los subjects se
archivarían bajo un motivo falso.

Efecto en runtime hoy: **no hay crash**. El peor síntoma es de consola — 16 líneas de
`console.warn` por render, en inglés como todos los del componente, diciendo `has no semester
on record; not rendered`, y 16 módulos que no aparecen. El arreglo correcto es
`semester: number | null` en `RetSubject`.

`area` es el espejo: el filtro de `EnrollmentSimulator` es **inerte** con las 68 áreas en
`null`, y eso es correcto según D1, no un defecto.

## Orden

```
T9.2 → T9.3 → T9.4 → T9.5 → T9.6   (migraciones)
  └─► T9.7 (seed) → T9.8 (fixtures) → tests
  └─► T9.9 (dag) → T9.10 → T9.11 → T9.12 → T9.13 → T9.14
```

**Corrección 2026-10-08.** Ese orden ya no refleja la realidad. T9.7 se ejecutó y **se tragó
T9.8**, de modo que el orden real de los datos fue `T9.1 → T9.2 → T9.7(+T9.8)` y las
migraciones de T9.3–T9.6 quedaron para después, no antes. T9.5 no necesita migración propia: las
3 especialidades y las 14 aristas entran por el propio `seed.sql`. El orden vigente:

```
T9.7+T9.8 (hecho) → T9.3 → T9.4 → T9.6 → T9.9 → T9.10 → T9.11 → T9.12 → T9.13 → T9.14
```

## Lo que shipped: T9.7 (2026-10-08)

Commit **`159b2bc`** `feat(db): seed the verified curriculum and relax the unknown-column
constraint`. migration `drizzle/0009_subjects-rebuild.sql` + `src/lib/server/db/seed.ts` +
`src/lib/server/db/seed.sql` + `src/lib/server/db/data/enrollment-fixture.json` + `schema.ts`.

### La migración 0009 es a mano, y no necesita ni backup ni pragma

`0009` **no** la generó drizzle-kit. Está escrita a mano a propósito, y su forma es la que
describe `odd/tasks/phase-9-unblock.md` §U6 como "respaldo alternativo":

- **No necesita `defer_foreign_keys`.** U5 demostró que el pragma sólo aplaza la violación al
  `COMMIT`. Aquí no hay nada que preservar: las 42 filas que había en `subjects` eran el
  catálogo fabricado, sus `canonical_id` morían con ellas, y las 57 aristas inventadas se
  reemplazan por las 14 verificadas.
- **No necesita tabla de respaldo.** Por lo mismo.
- **Sí necesita vaciar las hijas primero.** Ése es el precio, y está escrito en el propio
  archivo: `careers` y `specialties` no se pueden vaciar mientras `student_profiles` las
  referencie, así que la fila del alumno demo y su credencial caen también. Recuperar el
  login requiere `pnpm run db:seed:apply` **y** volver a correr `pnpm run db:set-password`.

El orden real del archivo (verificado en `drizzle/0009_subjects-rebuild.sql`): **12 `DELETE`**
en orden de dependencia inversa → `CREATE TABLE subjects_new` → `DROP TABLE subjects` →
`ALTER TABLE … RENAME` → `CREATE UNIQUE INDEX subjects_code_unique` → `PRAGMA foreign_key_check`.

### El seed ahora lee la forma nueva y falla ruidosamente

`Dataset` (`seed.ts:75-87`) pasó a `careerCode`/`careerName`/`totalSemesters`/
`declaredTotalCredits`/`specialties[]`/`subjects[]`/`prerequisites[]` de nivel superior. Las
aserciones fail-loud se conservaron todas y se reforzaron (`seed.ts:304-355`): careerCode
presente, créditos declarados numéricos, cero códigos duplicados, cero `canonicalId`
duplicados, `seriationState` y `component` dentro de las uniones de `schema.ts:360` y
`schema.ts:363`, y `specialtyCode` siempre declarado.

### `seed.sql` regenerado, y lo que contiene

`src/lib/server/db/seed.sql`, medido por conteo de sentencias `INSERT`:

| Tabla | Filas en `seed.sql` | Filas en la D1 de producción |
| --- | --- | --- |
| `careers` | 1 | 1 |
| `specialties` | 3 | 3 |
| `subjects` | **68** | **68** |
| `subject_aliases` | 4 | 4 |
| `subject_prerequisites` | **14** | **14** |
| `student_profiles` | 1 | 1 |
| `student_progress` | **49** | **49** |
| `course_groups` | 7 | 7 |
| `course_schedule_blocks` | 14 | 14 |
| `subject_units` | **0** | **0** |

### La invariante de créditos se cumplió, y el fixture la hizo cumplir

Las 49 filas de `student_progress` del fixture:

| Estado | Filas | Créditos |
| --- | --- | --- |
| `APPROVED` | **41** | **175** |
| `ENROLLED` | **6** | **24** |
| `LOCKED` | 2 | — |

Coincide exactamente con el perfil del estudiante. Este número **no** era el que el plan
esperaba — ver `odd/tasks/phase-9-unblock.md` §"Lo que la ejecución cambió".

### Lo que NO se corrigió: los alias de docente

El texto de T9.7 decía "emitir los 114 alias sintéticos de docente". Lo que `seed.sql` emite
son **7** valores `DOC-NNN` distintos (`DOC-001`…`DOC-007`), uno por `course_groups`. La
confusión: 121 es el número de nombres **distintos en la unión de `docs/data/`** (B5), y 114
era una estimación previa. Ninguno de los dos es lo que el seed escribe, porque el seed
sembla 7 grupos, no 468.

### Defecto conocido, no corregido: `course_schedule_blocks` no tiene clave natural

`course_schedule_blocks` (`schema.ts:185-208`) tiene `id integer PRIMARY KEY autoincrement` y
**ninguna clave natural**: un bloque se identifica sólo por
`(group_id, day, start_time, end_time, classroom)`. `seed.ts` lo siembra con
`INSERT OR REPLACE`, y como no existe `UNIQUE` sobre esa tupla, **cada corrida del seed
duplica los bloques**. Se confirmó en HEAD sin modificar: `wrangler d1 migrations apply
0009` vació la tabla y el `seed.sql` la dejó en **14**, que coincide con el fixture — pero
antes de la migración de 0009 la tabla tenía **28 filas**, el doble exacto.

**Pre-existente**, no introducido por T9.7. **No se arregla en v1** (queda registrado como
defecto conocido, no como tarea). Arreglarlo exige una `UNIQUE` sobre la tupla más una
limpieza de duplicados, y `ON DELETE` en `group_id` que hoy es NO ACTION.

### Verificación de T9.7

| Comprobación | Resultado |
| --- | --- |
| `wrangler d1 migrations list opensim --remote` | `✅ No migrations to apply!` — `0009` registrada |
| Conteos en producción | 68 subjects, 14 aristas, 3 especialidades, 1 carrera, 49 progress, 7 grupos, 14 bloques, **0 subject_units** |
| `PRAGMA foreign_key_check` | vacío |
| `area IS NULL` / `semester IS NULL` / `ht IS NULL` / `hp IS NULL` | 68 / 16 / 16 / 16 |
| `seriation_state IS NULL` | 0 |
| `pnpm check` | svelte-check **0 errores, 0 warnings** |
| `pnpm test` | **272/272**, 16 ficheros |
| Docentes | **0** ocurrencias de nombres reales; los 7 del seed son `DOC-001`…`DOC-007` |
| **Suite e2e** | **`NOT VERIFIED`** — no se ha corrido en esta sesión |

## T9.8 fue una reconstrucción, no un remapeo

> **El plan decía** "Rehacer `enrollment-fixture.json` con los `canonicalId` nuevos", lo que
> sugiere remapear filas existentes. **No fue eso.** No hubo ningún `canonicalId` viejo que
> remapear: los dos catálogos usan esquemas de identificador **incompatibles**.

Medido comparando el fixture en `cbe4315` (antes de T9.7) contra el catálogo verificado:

| Medida | Valor medido |
| --- | --- |
| Filas en el fixture viejo | **38** |
| IDs del catálogo viejo | 42, todos de forma `nombre-en-palabras` (`calculo-diferencial`, `fundamentos-programacion`) |
| IDs del catálogo nuevo | 68, todos de forma `slug(código)` (`acf-0901`, `aed-1285`) |
| IDs viejos presentes en el catálogo nuevo | **0 de 42** |
| Filas del fixture viejo cuyo `canonicalId` existe en el catálogo nuevo | **0 de 38** |

Es decir: **las 38 filas viejas referenciaban asignaturas que no existen en el plan real**, y
las 42 del catálogo viejo desaparecen todas. No hay un subconjunto que sobrevivir; el
fixture se reconstruyó desde el perfil del estudiante, no desde los datos viejos.

> **Discrepancia con la cifra citada "20 de 38".** Ese número circuló en el resumen de esta
> pasada y **no se reproduce** con ninguna métrica que yo pueda medir. Lo que sí se
> reproduce: por `canonical_id`, **38 de 38**
> (0 de 38 existen en el plan nuevo); por nombre normalizado, **15 de 38** casan con una
> materia verificada y **23 de 38** no. Ninguna de las dos da 20. Se registra como
> **`NOT VERIFIED`**; la afirmación original no se borra.

### La regla de derivación que reemplazó al remapeo

Dado que no hay correspondencia que conservar, el fixture se derivó del **perfil**, no de las
filas previas:

1. **Partir del perfil del estudiante**, no del historial: specialty, semestre actual y
   créditos declarados.
2. **`APPROVED` = todo lo que el perfil declara como crédito aprobado** — 175 cr, lo que
   obliga a **41 filas**, no 30. Los 30 valores de crédito más altos del plan suman **161**,
   así que "30 filas Approved sumando 175 cr" es aritméticamente imposible.
3. **`ENROLLED` = 24 cr** — 6 filas, el semestre en curso.
4. **`LOCKED` = 2 filas** de muestra.
5. Todo `canonicalId` sale del catálogo verificado. **0 filas huérfanas** — verificado en las
   49 contra el catálogo de 68.

## Estrategia de entrega

Presupuesto: **~400 líneas de cambio** → un solo PR, sin cadena. Si al medir T9.2–T9.8 se pasa
de 400, partir en (a) esquema + seed, (b) UI. Nunca partir entre migraciones relacionadas.

## Estado del árbol entre T9.1 y T9.7 — **RESUELTO, se conserva como historia**

> **Este bloque describe un estado que ya no existe.** Se conserva literal porque la decisión
> que se tomó —"no hacer shim de compatibilidad"— fue la correcta y conviene que se lea.

`pnpm db:seed:gen` está **rojo a propósito** desde T9.1: el dataset nuevo cambia la
forma del documento (top-level `careerCode`/`specialties`/`prerequisites`, sin
`careers[]`) y todos los `canonicalId` pasan a `slug(código)` (`acf-0901`), lo que
invalida `enrollment-fixture.json`. Se arregla en T9.7 (adaptar `seed.ts`) y T9.8
(rehacer el fixture). No hacer shim de compatibilidad: se borraría en dos tareas.

La app y los tests unitarios no leen el dataset, así que el resto del árbol está
verde. **Nada se empuja ni se abre PR antes de T9.8.**

**Estado real 2026-10-08:** `pnpm test` **272/272** en 16 ficheros, `pnpm check` **0 errores,
0 warnings**, y el `seed.sql` regenerado está aplicado en la D1 de producción
`390df78e-c4c2-4ace-94f4-6baebf1eb88f`. La suite **e2e no se ha corrido** en esta sesión:
`NOT VERIFIED`.

## Decisión de operador pendiente — T9.10 y las 16 materias sin semestre

**El hueco visible de T9.10. Necesita una decisión del operador; esta pasada no lo resuelve.**

Las 16 materias de especialidad no tienen semestre (H8, sin fuente publicada). Como
`ReticulaDag.svelte` **descarta** los subjects sin semestre (`ReticulaDag.svelte:86-90`), la
retícula muestra **52 de 68** módulos sin ninguna explicación en pantalla: el estudiante ve
16 asignaturas desaparecer y no hay nada que diga por qué.

| Opción | Qué implica |
| --- | --- |
| **A. Bandeja fuera de la retícula** ("sin semestre registrado: 16 módulos") | Honesto y completo, pero es UI nueva |
| **B. Contador en el encabezado** de `/retícula` ("52 de 68 con semestre") | Cambio mínimo, un número |
| **C. Dejarlo como está** | El estudiante ve 52 módulos y un `console.warn` invisible |

**Prohibido inventar un semestre.** No hay fuente para el semestre de un módulo de
especialidad; asignar uno sería fabricar dato curricular, que es justo lo que Phase 9 existe
para eliminar. `SubjectNode.svelte` ya tiene el caso nulo escrito —"Semestre sin registrar" y
la etiqueta `S—`, en `SubjectNode.svelte:65-68`— pero **nunca se muestra**, porque los
subjects sin semestre se descartan antes de llegar al nodo.

## Próximo paso

**T9.3** — migración `subject_units`: 4 columnas (`eval_from`, `eval_to`, `instruments`,
`criteria`) + 32 unidades / 223 subtemas de 7 materias. Es la siguiente tarea abierta y
desbloquea a T9.12, el primer consumidor real de esa tabla.

En paralelo, y sin coste de código:

- **Elegir A o B para T9.10** (bandeja vs contador). C no es aceptable: el estudiante ve 16
  módulos desaparecer sin explicación.
- **H10** — sigue dependiendo del operador: confirmar con GitHub Support que no queden
  objetos con PII. Ya no hay PR que cerrar; ver `phase-9-unblock.md` §B4.

**Sobre el filtro de `/reinscripcion`:** el "Próximo paso" anterior advertía que
`EnrollmentSimulator` haría `null.localeCompare` y reventaría con `area` en `null`. **Ya está
resuelto** — `EnrollmentSimulator.svelte:57-67` filtra los `null` antes de que el `Set` y el
`localeCompare` los vean, y el comentario explica que `localeCompare` sobre `null` es un
`TypeError` en runtime, no sólo un error de tipos. Con las 68 áreas en `null` el filtro por
área queda **inerte** a propósito: el select sólo ofrece "todas las áreas". Eso es el
comportamiento correcto de D1, no un bug pendiente.