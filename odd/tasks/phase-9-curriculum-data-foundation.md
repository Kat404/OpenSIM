# Phase 9 — Cimientos de datos curriculares ISIC (v1)

<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-10
reconciled-against: feat/phase-9-verified-curriculum@c49caea (main@fee9d60)
sha-warning: los SHA 6ca7c12, 8f40837, ffcd595 y b3fef41 citados en el cuerpo de este archivo predicen la reescritura de firmas GPG del 2026-10-08 y están MUERTOS; los SHA de la sección "Commits que importan" verificados con `git cat-file -e` sí están vivos
-->

**Estado:** T9.1–T9.7 cerradas salvo T9.5 (cerrada dentro de T9.7) · started 2026-10-07 ·
**reconciliado 2026-10-08** · **reconciliado 2026-10-10: T9.3, T9.4 y T9.6 cerradas;
T9.9 cerrada el 2026-10-08 (`17e013b`). Abiertas: T9.10–T9.14.**
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

### Commits que importan (vivos, `git cat-file -e` verificado 2026-10-10)

| Commit | Subject | Rol en Phase 9 |
| --- | --- | --- |
| `18de1a5` | `feat(data): verified ISIC-2010-224 curriculum dataset` | T9.1 |
| `b6a1d8a` | `feat(db): subject seriation tri-state and component columns` | T9.2 |
| `cbe4315` | `docs(odd): reconcile bookkeeping with the repository after the signing rewrite` | bookkeeping |
| `6f50f93` | `fix(privacy): make docs/data teacher redaction a pipeline guarantee` | B5 |
| `159b2bc` | `feat(db): seed the verified curriculum and relax the unknown-column constraint` | **T9.7 + T9.8 + T9.5** |
| `2ac464f` | `fix(privacy): drop personal names from the titulacion and residencia placeholders` | último commit publicado |
| `13f4d7a` | `fix(db): stop RetSubject from claiming a semester it may not have` | `RetSubject.semester` |
| `4460f27` | `feat(db): load the verified syllabus, offering catalogue and lab sessions` | **T9.3 + T9.4 + T9.6** |
| `17e013b` | `feat(utils): make the seriation tri-state consumable` | **T9.9** |
| `db258a8` | `fix(db): make the seed idempotent and stop it lying about being so` | idempotencia del seed |
| `a799d47` | `fix(db): give course_schedule_blocks a reason to exist before querying it` | 500 de `/reinscripcion`, `0014`, detector de conflictos |
| `a3621f7` | `fix(ui): point the sidebar at the two routes that already exist` | rutas del sidebar |
| `c22d05c` | `feat(utils): match search text without case or accents` | `foldText` / `matchesText` |
| `639a663` | `docs(readme): correct the login control number and the stale schema facts` | documentación |
| `c49caea` | `chore(tool): harden the e2e runner and unblock the Playwright suite` | tooling |

> `6ca7c12`, `8f40837` y `ffcd595` son los SHAs que este documento usaba antes de que la
> reescritura de firmas los matara. No se borran: quedan como registro del error. Los vivos
> equivalentes son `18de1a5` (T9.1) y `b6a1d8a` (T9.2).
>
> **Los commits desde `2ac464f` no están publicados.** `origin` y `codeberg` siguen en
> `2ac464f`; todos los commits de Phase 9 posteriores son locales (11 sin publicar en la última
> medición). `main` no se ha movido desde `fee9d60` y sigue con 126 commits.

---

## Reconciliación 2026-10-10 — T9.3, T9.4, T9.6 y T9.9 cerradas

Cuatro tareas cerradas desde la última reconciliación, todas en un commit: `4460f27` para
las tres de esquema y `17e013b` para T9.9. **Ninguna está en producción.**

| Tarea | Qué exigía | Qué se entregó | Migración |
| --- | --- | --- | --- |
| **T9.3** | `subject_units`: `eval_from`, `eval_to`, `instruments`, `criteria` + 32 unidades / 223 subtemas | Las 4 columnas, nullable a propósito, y las **32** unidades. Los 223 ventanos de evaluación por subtema se quedan dentro de `subtopics_json` verbatim, no aplanados a la unidad | `drizzle/0010_productive_edwin_jarvis.sql` |
| **T9.4** | `course_groups`: `period`, `credits`, `is_lab_session` + 468 filas | Las 3 columnas y las **468** filas reales de oferta del SIM | `drizzle/0011_misty_namorita.sql` + `0013_yellow_wallow.sql` |
| **T9.6** | Tabla `complementary_credit_activities` | La tabla existe, **sin columna de créditos y sin flag de Servicio Social** — ver abajo | `drizzle/0012_condemned_vermin.sql` |
| **T9.9** | `dag.ts` con las 14 aristas + tri-estado de seriación | `describeSeriation` devuelve una unión discriminada por el propio estado, y `decomposeChains` reconstruye las 7 cadenas del operador desde las 14 aristas | — (sin migración) |

### Lo que T9.4 añadió que el plan no pedía

Cargar el catálogo de oferta destapó un defecto que el plan no contemplaba:
**`course_groups` era a la vez el conjunto de inscritos del estudiante y, implícitamente, el
catálogo de oferta**, sin nada que los distinguiera. Tres lectores identificaban los grupos
del estudiante con un join sólo por materia y devolvían **49 filas donde debían devolver 7**.

La corrección es `course_groups.student_control_number` nullable (`0013`): `NULL` es una fila
de catálogo, con valor es una inscripción. Los tres lectores se acotan a él; el único que
quiere el catálogo completo —el `load` de `/reinscripcion`— se deja deliberadamente sin acotar
y distingue por `alreadyEnrolled`.

> **Nota sobre `0013`.** drizzle-kit 0.45 emite `ADD COLUMN … REFERENCES` **sin**
> `ON DELETE CASCADE`, en silencio. `0013` lleva la corrección a mano, y
> `PRAGMA foreign_key_list` confirma que la acción es ahora `CASCADE`.

### Lo que T9.6 decidió no hacer

`complementary_credit_activities` **no tiene columna de créditos** ni bandera
`social_service_unlocked`. La razón está escrita en el esquema: la fuente **no declara un
peso por actividad**, así que una columna de créditos sólo podría contener números
inventados, y el desbloqueo del Servicio Social es un conteo puro sobre estas filas.

### Las dieciséis sin semestre: el plan decía una columna, son cuatro

Esto ya estaba registrado el 2026-10-08 y se conserva intacto; lo que cambia el 2026-10-10 es
que **las tres columnas de H8 dejaron de ser un futuro problema**: `semester`, `ht` y `hp`
ya son nullable en el esquema, ya las escribe el seed con `NULL` para las 16 materias de
especialidad, y ya las lee `/retícula`. El coste de H8 ya está pagado en el lado de los
datos; lo que queda es la decisión de UI de §"Decisión abierta: las 16 materias sin semestre".

| Lo que el plan dijo | Lo que pasó | Dónde se ve |
| --- | --- | --- |
| "`subjects.area` → NULL" (una columna) | **Cuatro** columnas nullable: `area`, `semester`, `ht`, `hp` | `src/lib/server/db/schema.ts:59-66` |
| Relajar `area` era suficiente | No bastaba: el seed habría seguido fallando al insertar las 16 de especialidad | §"Las cuatro columnas nullable de `subjects`" |
| El coste se hubiera resuelto con una `ALTER` | Exigió reconstruir `subjects` en `0009` por el bug de `SQLiteRecreateTableConvertor` | §Precedente técnico |

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
| `specialties` | **3 filas** reales | ✅ **SHIPPED** — 3 filas, sembradas por `seed.ts` |
| `subject_prerequisites` | **14 filas** verificadas | ✅ **SHIPPED** — 14 aristas, `seed.ts` |
| `course_groups` | **468 filas** + `period`, `credits`, `is_lab_session` | ✅ **SHIPPED (T9.4, `4460f27`, migraciones `0011` y `0013`)** — 468 filas de catálogo reales **más 7 de inscripción del estudiante de demostración**, 475 en total. `period` con 9 números de término del SIM (`"1"`…`"9"`), `NULL` en 234 de las 468 |
| `subject_units` | **32 filas** + `eval_from`, `eval_to`, `instruments`, `criteria` | ✅ **SHIPPED (T9.3, `4460f27`, migración `0010`)** — las 4 columnas y las 32 unidades |

> **La foto de producción sigue siendo la del 2026-10-08.** Todas las filas de esta tabla
> son lo que **el `seed.sql` genera**, medido contando sentencias `INSERT` en
> `src/lib/server/db/seed.sql`. La D1 de producción está en `0009`; las migraciones
> `0010`–`0014` están escritas y confirmadas pero **no aplicadas**. Ver §Producción.

#### Contenido del `seed.sql` medido el 2026-10-10

| Tabla | Filas en `seed.sql` |
| --- | --- |
| `careers` | 1 |
| `specialties` | 3 |
| `subjects` | **68** |
| `subject_aliases` | 4 |
| `subject_prerequisites` | **14** |
| `subject_units` | **32** |
| `course_groups` | **475** = 468 de catálogo + 7 de inscripción |
| `course_schedule_blocks` | 14 |
| `complementary_credit_activities` | **3** |
| `enrollments` | **7** |
| `student_progress` | 49 |
| `student_profiles` | 1 |

Medido con `rg -o '^INSERT (OR [A-Z]+ )?INTO [a-z_]+ ' src/lib/server/db/seed.sql | awk '{print $NF}' | sort | uniq -c`.

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
| — | Nada de esquema | — |

Las tres acciones que esta tabla listaba (`subject_units`, `course_groups`,
`complementary_credit_activities`) están **cerradas**. Ver §Reconciliación 2026-10-10.

### Tablas nuevas

| Tabla | Para qué | Estado |
| --- | --- | --- |
| `complementary_credit_activities` | Conteo por estudiante y su desbloqueo del Servicio Social | ✅ **creada (T9.6, `4460f27`, migración `0012`)** — sin columna de créditos, sin flag de desbloqueo |
| `enrollments` | Qué grupo eligió el estudiante, no sólo qué asignatura | ✅ **creada (2026-10-10, `a799d47`, migración `0014`)** — PK compuesta `(student_control_number, group_id, period)`. **Nada la lee todavía.** Ver abajo |

> **La tabla `enrollments` no estaba en el plan.** La acción de inscripción de
> `/reinscripcion` registraba sólo la asignatura, nunca el grupo, así que tras reinscribirse
> el estudiante no tenía ninguna fila de grupo: `enrolledGroupIds` no resolvía a nada y
> `course_schedule_blocks` no tenía de qué colgarse. La tabla registra ese dato que faltaba.
>
> **Trampa de nombre, deliberada y documentada.** `enrollments.period` lleva el **nombre**
> del periodo institucional —`AGOSTO-DICIEMBRE/2026`—, que es lo que guarda
> `student_progress.period`. **NO** es `course_groups.period`, que es el **número** de
> término del SIM (`"1"`…`"9"`, nullable). Las dos columnas comparten nombre y no se pueden
> cruzar jamás por join.

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
| **H8** | **Semestre de las 16 materias de especialidad** desconocido | No se pueden colocar en la retícula; `/retícula` muestra 52 de 68 sin explicarlo | **Decisión de producto tomada aparte** — ver §"Decisión abierta: las 16 materias sin semestre". El dato de origen sigue faltando: SIM `/estudiante/datos/especialidad` de un alumno ya asignado, o el Catálogo |
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
| **T9.3** | Migración `subject_units`: 4 columnas + 32 filas | ✅ **cerrada 2026-10-10** (`4460f27`, `drizzle/0010_productive_edwin_jarvis.sql`) — las 4 columnas nullable y las 32 unidades; los 223 ventanos por subtema quedan verbatim dentro de `subtopics_json` |
| **T9.4** | Migración `course_groups`: `period`, `credits`, `is_lab_session` + 468 filas | ✅ **cerrada 2026-10-10** (`4460f27`, `0011_misty_namorita.sql` + `0013_yellow_wallow.sql`) — 468 filas reales más 7 de inscripción; la `0013` añade el discriminador `student_control_number` que el plan no pedía |
| **T9.5** | Migración `specialties` (3 filas) + `subject_prerequisites` (14 aristas) | ✅ **cerrada por T9.7** — las 3 especialidades y las 14 aristas se sembraron en `159b2bc`; no hizo falta migración aparte |
| **T9.6** | Tabla `complementary_credit_activities` | ✅ **cerrada 2026-10-10** (`4460f27`, `drizzle/0012_condemned_vermin.sql`) — creada **sin** columna de créditos ni flag de desbloqueo, porque la fuente no declara peso por actividad |
| **T9.7** | `seed.ts` + `seed.sql`: leer el nuevo dataset, reconstruir `subjects` a 68 filas, sembrar especialidades y prerrequisitos | ✅ **cerrada** (`159b2bc`) — **absorbió T9.5 y T9.8** |
| **T9.8** | Rehacer `enrollment-fixture.json` con los `canonicalId` nuevos | ✅ **cerrada dentro de T9.7** — fue una **reconstrucción, no un remapeo**. Ver §"T9.8 fue una reconstrucción, no un remapeo" |
| **T9.9** | `dag.ts` con 14 aristas + `seriation_state` tri-estado | ✅ **cerrada 2026-10-08** (`17e013b`) — `describeSeriation` + `decomposeChains`; el tri-estado dejó de ser columna escrita sin consumidor |
| **T9.10** | `/retícula`: semestres corregidos, badge de laboratorio, ramas de seriación | ☐ **abierta** — corregido el tipo de `RetSubject.semester` (`13f4d7a`), pero **la decisión de las 16 materias sin semestre sigue pendiente**. Ver §"Decisión abierta: las 16 materias sin semestre" |
| **T9.11** | `/horario`: aulas reales | ☐ abierta |
| **T9.12** | **`/detalle`** primer consumidor real de `subject_units` | ☐ abierta — **desbloqueada el 2026-10-10**: la tabla ya tiene las 32 unidades. Ya no depende de T9.3 |
| **T9.13** | `/tramites`: regla de los 5 complementarios → Servicio Social | ☐ abierta — **desbloqueada el 2026-10-10**: `complementary_credit_activities` ya existe con 3 filas |
| **T9.14** | `/reinscripcion`: filtro por área desaparece (D1), aparece el de laboratorio | ☐ abierta — el filtro por área ya está inerte y null-safe; el de laboratorio tiene datos desde el 2026-10-10 con `is_lab_session` |

## Radio de impacto de las cuatro columnas nullable

Medido sobre `src/` en `2ac464f`. Las cuatro columnas nullable **no** tienen el mismo
consumidor: dos tienen lector real y dos no tienen ninguno.

| Columna | Se escribe en | **Se lee en** | ¿Null-unsafe? |
| --- | --- | --- | --- |
| `semester` | `seed.ts` | `reticula/+page.server.ts` (select, `orderBy`), `ReticulaDag.svelte:86-100` (agrupación), `SubjectNode.svelte:65-68` (render) | **Ya corregido** — `13f4d7a`, `13f4d7a` cambió `semester: number` por `semester: number \| null`. El resto de la cadena ya era correcto. |
| `area` | `seed.ts` | `reinscripcion/+page.server.ts`, `simulador/types.ts`, `EnrollmentSimulator.svelte` (filtro de `Set`, predicado, metadatos de fila) | **No.** Filtrado a propósito antes de `Set`/`localeCompare`. |
| `seriation_state` | `seed.ts` | `src/lib/utils/dag.ts` (`describeSeriation`), `reticula/+page.server.ts` | **No.** Dejó de ser columna muerta el 2026-10-08 (`17e013b`, T9.9). |
| `component` | `seed.ts` | `src/lib/utils/dag.ts` (`describeSeriation`), `reticula/+page.server.ts` | **No.** Igual que arriba. |

**`RetSubject.semester` era una mentira de tipos — RESUELTA 2026-10-08 (`13f4d7a`).**

> **El diagnóstico de abajo era correcto y no se borra.** Lo que había:
>
> ```ts
> // src/routes/(protected)/reticula/+page.server.ts:32
> semester: number;   // <-- decía number
> ```
>
> La interfaz exportada declaraba `number`, pero la columna underlying es nullable y el
> `select` devuelve `number | null`. El type-checker no lo detectaba porque el `return` no
> está anotado: `RetSubject` sólo se usa en los dos `satisfies` de las ramas tempranas,
> donde el array va vacío. El consumidor final sí era correcto —
> `SubjectNode.SubjectViewModel.semester` es `number | null` y `ReticulaDag` comprueba
> `=== null` **antes** que `s.semester < 1` (`ReticulaDag.svelte:86-92`), porque `null < 1`
> por coerción es `true` y los subjects se archivarían bajo un motivo falso.
>
> Efecto en runtime: **no había crash**. El peor síntoma era de consola — 16 líneas de
> `console.warn` por render, en inglés como todos los del componente, diciendo `has no
> semester on record; not rendered`, y 16 módulos que no aparecen.
>
> **El arreglo era `semester: number | null` en `RetSubject`, y está aplicado.** Verificado
> en `src/routes/(protected)/reticula/+page.server.ts:40`.

**Lo que sigue sin resolver en esa columna no es el tipo, es la decisión.** Los 16 módulos
siguen sin aparecer, y eso es una decisión de producto, no un defecto de tipos. Ver
§"Decisión abierta: las 16 materias sin semestre".

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

**Corrección 2026-10-10.** T9.3, T9.4, T9.6 y T9.9 también están hechas. De las cinco que
quedan, sólo dos dependen de algo externo:

| Siguiente | Por qué |
| --- | --- |
| **T9.12** — primer consumidor real de `subject_units` | **Desbloqueada** por T9.3. La tabla tiene las 32 unidades desde el 2026-10-10 |
| **T9.13** — regla de los 5 complementarios | **Desbloqueada** por T9.6. La tabla existe con 3 filas |
| **T9.14** — filtro de laboratorio en `/reinscripcion` | Tiene datos desde T9.4 con `is_lab_session` |
| **T9.10** — retícula | **BLOQUEADA por una decisión de operador**, no por datos. Ver §"Decisión abierta: las 16 materias sin semestre" |
| **T9.11** — aulas reales | Sin fuente. Depende de H8/H9 |

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

## Decisión abierta: las 16 materias sin semestre (T9.10, hueco H8)

**Estado: ABIERTA. Bloquea T9.10 y es la única decisión de producto que Phase 9 necesita del
operador.** No es un bug y no se resuelve con más datos: H8 no tiene fuente, y las opciones
que siguen son todas defendibles según qué se quiera que el estudiante entienda.

### El hecho

Las 16 materias de especialidad **no tienen semestre registrado** (H8, sin fuente publicada).
`ReticulaDag.svelte` **descarta** los subjects sin semestre (`ReticulaDag.svelte:86-90`), así
que la retícula muestra **52 de 68** módulos sin ninguna explicación en pantalla: el
estudiante ve 16 asignaturas desaparecer y no hay nada que diga por qué.

`SubjectNode.svelte` ya tiene el caso nulo escrito —"Semestre sin registrar" y la etiqueta
`S—`, en `SubjectNode.svelte:65-68`— pero **nunca se muestra**, porque los subjects sin
semestre se descartan antes de llegar al nodo.

### El dato que cambia la pregunta

Las 16 no son un bloque indiferenciado. **Cada una pertenece a una de las tres
especialidades, y un estudiante sólo ve la suya.** El catálogo es 68 = 52 con semestre + 16
módulos de especialidad repartidos en tres ramas (`ISIE-TDD-2026-01`, `ISIE-SID-2026-01`,
`ISIE-TND-2026-01`), de 5, 5 y 6 módulos respectivamente. Nube es la que suma 265 cr — H6.

Eso convierte "¿qué hago con 16 módulos sin semestre?" en una pregunta con identidad: **el
número que le falta a un estudiante no es 16, es 5 o 6.**

### Las opciones

| | Opción | Qué ve el estudiante | Coste |
| --- | --- | --- | --- |
| **A** | **Bandeja fuera de la retícula**, sólo con los módulos de **su** especialidad | Una bandeja bajo la rejilla: "Módulos de tu especialidad, sin semestre registrado", con los 5 o 6 que le corresponden | UI nueva. Es la única que **explica** y además **filtra por especialidad** |
| **B** | **Contador en el encabezado** ("52 de 68 con semestre") | Un número. Ni los 16, ni los 5, ni los 6 | Cambio mínimo |
| **C** | **Los 16 agrupados** bajo la rejilla, por especialidad, sin filtrar | 52 en la rejilla más 16 agrupados en tres bloques | UI media, y **muestra ramas que no son la del estudiante** |
| **D** | **Dejarlo como está** | 52 módulos y un `console.warn` en inglés que no ve nadie | Cero coste, y es la opción que este documento **descarta** |

**Recomendación, no decisión: A.** Es la única que responde a la pregunta que el estudiante se
hace —"¿cuál es mi asignatura y por qué no la veo?"— sin inventar nada y sin mostrarle ramas
que no le tocan. **C es aceptable** si el operador decide que el plan completo debe ser
visible para todos; su precio es tener que distinguir "esto no es tuyo" sin una fuente que lo
diga. **B es el mínimo honesto** si no hay tiempo para A. **D no es aceptable**: 16 módulos
desaparecen sin explicación, que es exactamente el fallo que Phase 9 existe para eliminar.

> **Cambio frente a la versión anterior de esta sección.** Hasta el 2026-10-10 el plan ofrecía
> tres opciones y ninguna distinguía especialidad. La diferencia importa: **A** y **B**
> operands sobre las 16 son opciones distintas en número y en significado de las que
> oferece ahora, porque el número que ve un estudiante es el de **su** especialidad.

**Prohibido inventar un semestre.** No hay fuente para el semestre de un módulo de
especialidad; asignar uno sería fabricar dato curricular, que es justo lo que Phase 9 existe
para eliminar. Un "semestre estimado", un "semestre 7 por defecto" o un orden deducido de los
códigos son las tres formas barreduras de inventarlo, y las tres quedan prohibidas aunque la
rejilla se vea mejor.

### Qué desbloquea y qué no

| Al resolver | Se desbloquea | Sigue sin resolverse |
| --- | --- | --- |
| T9.10 | La rejilla de `/retícula` deja de truncar en silencio | H8 sigue abierta: sin la fuente, la bandeja seguirá diciendo "sin semestre registrado", que es la verdad |
| — | — | H6 (Nube suma 265), H3 (temarios de ~39 materias), H4 (áreas), H9 (seriación de 8) |

## Producción — qué está aplicado y qué no

| Migración | Contenido | ¿En producción? |
| --- | --- | --- |
| `0009_subjects-rebuild.sql` | reconstrucción de `subjects`, `area`/`semester`/`ht`/`hp` nullable | ✅ **sí** — producción está en `0009` con el seed aplicado |
| `0010_productive_edwin_jarvis.sql` | T9.3 — 4 columnas de `subject_units` | ❌ **no** |
| `0011_misty_namorita.sql` | T9.4 — `period`, `credits`, `is_lab_session` | ❌ **no** |
| `0012_condemned_vermin.sql` | T9.6 — `complementary_credit_activities` | ❌ **no** |
| `0013_yellow_wallow.sql` | discriminador `student_control_number` | ❌ **no** |
| `0014_famous_darkhawk.sql` | `enrollments` | ❌ **no** |

Las cinco están escritas y confirmadas. Aplicarlas requiere la **puerta G1** del plan de
desbloqueo —autorización explícita del operador para una mutación de producción— y **no se
ha usado**. Hasta que se apliquen, **producción sigue sirviendo el 500 de `/reinscripcion`**:
el arreglo está confirmado en `a799d47`, pero **nada de este trabajo está publicado en ningún
remoto**. `origin` y `codeberg` siguen en `2ac464f`; todos los commits de Phase 9 posteriores
a ese punto son locales.

## Próximo paso

**T9.12** — primer consumidor real de `subject_units`: el detalle de temario con las 32
unidades y los 223 ventanos de evaluación. Es la siguiente tarea abierta y ya no depende de
nada: la tabla se cargó el 2026-10-10 (`4460f27`).

En paralelo, y sin coste de código:

- **Responder la decisión de §"Decisión abierta: las 16 materias sin semestre"** (A, B o C).
  T9.10 no empieza sin eso.
- **H10 / B4** — sigue dependiendo del operador: confirmar con GitHub Support que no queden
  objetos con PII. Ya no hay PR que cerrar; ver `phase-9-unblock.md` §B4.
- **Autorizar o rechazar la aplicación de `0010`–`0014` en producción** (puerta G1). Sin eso
  el arreglo del 500 de `/reinscripcion` existe pero no llega a nadie.

**Sobre el filtro de `/reinscripcion`:** el "Próximo paso" anterior advertía que
`EnrollmentSimulator` haría `null.localeCompare` y reventaría con `area` en `null`. **Ya está
resuelto** — `EnrollmentSimulator.svelte:57-67` filtra los `null` antes de que el `Set` y el
`localeCompare` los vean, y el comentario explica que `localeCompare` sobre `null` es un
`TypeError` en runtime, no sólo un error de tipos. Con las 68 áreas en `null` el filtro por
área queda **inerte** a propósito: el select sólo ofrece "todas las áreas". Eso es el
comportamiento correcto de D1, no un bug pendiente.