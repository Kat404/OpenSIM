# Phase 9 — Cimientos de datos curriculares ISIC (v1)

**Estado:** T9.1 cerrado · started 2026-10-07
**Alcance v1:** una sola carrera — **ISIC-2010-224 Ingeniería en Sistemas Computacional**
**Fuera de v1:** las otras 12 carreras, sus materias y sus unidades (v2)

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
| Seriación | 57 aristas inventadas | **14 aristas verificadas** + 23 materias clasificadas |

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
| Force-push a GitHub y Codeberg | ✅ ambos en `b3fef41` |
| `refs/pull/1/head` en GitHub | ❌ **29 blobs con PII siguen vivos.** GitHub no permite borrar refs de PR |
| `src/` (Codegraph) | ✅ sólo PII sintética: `OPNS000101HDFRRA09`, control `99999999`, `HERA000615MMNRZNA3` |

**Pendiente del operador:** cerrar el PR #1 y reportar a soporte de GitHub y Codeberg para
el borrado de los objetos inalcanzables y de las vistas cacheadas. Una reescritura de
historial no garantiza borrado físico en un forge público.

La credencial de desarrollo de OpenSIM es `99999999`, no la matrícula real. No hubo fuga de
credencial viva.

---

## Cambios de esquema pendientes

### Tablas que se reconstruyen

| Tabla | Acción |
| --- | --- |
| `subjects` | `canonical_id` = `slug(código)` determinista; **68 filas**; `area` → NULL; nueva columna `seriation_state`; nueva columna `component` |
| `subject_units` | **32 filas** + columnas `eval_from`, `eval_to`, `instruments`, `criteria` |
| `course_groups` | **468 filas** + `period`, `credits`, `is_lab_session` |
| `specialties` | **3 filas** reales |
| `subject_prerequisites` | **14 filas** verificadas |

### Tablas nuevas

| Tabla | Para qué |
| --- | --- |
| `complementary_credit_activities` | Conteo por estudiante y su desbloqueo del Servicio Social |

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
| **T9.2** | Migración `subjects`: `canonical_id` por slug, `seriation_state`, `component`, `area` NULL | ☐ |
| **T9.3** | Migración `subject_units`: 4 columnas + 32 filas | ☐ |
| **T9.4** | Migración `course_groups`: `period`, `credits`, `is_lab_session` + 468 filas | ☐ |
| **T9.5** | Migración `specialties` (3 filas) + `subject_prerequisites` (14 aristas) | ☐ |
| **T9.6** | Tabla `complementary_credit_activities` | ☐ |
| **T9.7** | `seed.ts` + `seed.sql`: leer el nuevo dataset, emitir los 114 alias sintéticos de docente | ☐ |
| **T9.8** | Rehacer `enrollment-fixture.json` con los `canonicalId` nuevos | ☐ |
| **T9.9** | `dag.ts` con 14 aristas + `seriation_state` tri-estado | ☐ |
| **T9.10** | `/reticula`: semestres corregidos, badge de laboratorio, ramas de seriación | ☐ |
| **T9.11** | `/horario`: aulas reales | ☐ |
| **T9.12** | **Detalle de temario** — primer consumidor real de `subject_units` | ☐ |
| **T9.13** | `/tramites`: regla de los 5 complementarios → Servicio Social | ☐ |
| **T9.14** | `/reinscripcion`: filtro por área desaparece (D1), aparece el de laboratorio | ☐ |

## Orden

```
T9.2 → T9.3 → T9.4 → T9.5 → T9.6   (migraciones)
  └─► T9.7 (seed) → T9.8 (fixtures) → tests
  └─► T9.9 (dag) → T9.10 → T9.11 → T9.12 → T9.13 → T9.14
```

## Estrategia de entrega

Presupuesto: **~400 líneas de cambio** → un solo PR, sin cadena. Si al medir T9.2–T9.8 se pasa
de 400, partir en (a) esquema + seed, (b) UI. Nunca partir entre migraciones relacionadas.

## Estado del árbol entre T9.1 y T9.7

`pnpm db:seed:gen` está **rojo a propósito** desde T9.1: el dataset nuevo cambia la
forma del documento (top-level `careerCode`/`specialties`/`prerequisites`, sin
`careers[]`) y todos los `canonicalId` pasan a `slug(código)` (`acf-0901`), lo que
invalida `enrollment-fixture.json`. Se arregla en T9.7 (adaptar `seed.ts`) y T9.8
(rehacer el fixture). No hacer shim de compatibilidad: se borraría en dos tareas.

La app y los tests unitarios no leen el dataset, así que el resto del árbol está
verde. **Nada se empuja ni se abre PR antes de T9.8.**

## Próximo paso

**T9.2.** Cerrar H10 (cerrar el PR #1 y reportar a soporte) en paralelo.