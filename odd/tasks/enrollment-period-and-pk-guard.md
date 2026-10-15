<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-15
branch: feat/phase-9-verified-curriculum
delivery: work-unit commits en la rama de feature
test-runner: vitest (just qa-fast) · runner agéntico (just e2e-dev) · Playwright (just test-e2e)
reconciles: odd/tasks/findings-remediation.md T10.1
-->

# Inscripción: el periodo correcto y el guard que ve todas las filas

Creado 2026-10-15, después de reconciliar el ledger de hallazgos. Cierra **T10.1**, el único
BLOCKER del repositorio: el único 500 que un alumno puede provocar.

## El defecto, y por qué no era sólo "ampliar el guard"

`student_progress` tiene PRIMARY KEY `(student_control_number, subject_canonical_id, period)`.
**Cualquier** fila de esas tres columnas ocupa el par. El guard de inscripción sólo leía las
filas `ENROLLED`, así que no veía las `APPROVED` ni las `LOCKED`.

Y el periodo tampoco era el que era. La cadena en `load` (`:173`) y en el action (`:390`) es:

```ts
requested ?? (await getLatestProgressPeriod(db, u.controlNumber)) ?? currentAcademicPeriod();
```

`getLatestProgressPeriod` ordena por `desc(studentProgress.period)` **sobre el texto** del
nombre del término. Como "ENERO-JUNIO" empieza por E y "AGOSTO-DICIEMBRE" por A, el año no
pesa: `ENERO-JUNIO/2027` le gana a `AGOSTO-DICIEMBRE/2026`. Medido sobre el fixture:

| period | status | filas |
| --- | --- | --- |
| `AGOSTO-DICIEMBRE/2026` | ENROLLED | 6 |
| `ENERO-JUNIO/2027` | LOCKED | 2 |

El alumno de demo resolvería a **un término futuro** que sólo tiene filas `LOCKED`.

Los dos arreglos anteriores se estorban: **T10.4** añadió `getLatestProgressPeriod` para que
un alumno sin `ENROLLED` no se atascara en el 400. Lo consiguió — y con él, un alumno así
llega por primera vez al INSERT, donde revienta. El caso que T10.4 desbloquear era
exactamente el que T10.1 hace reventar.

## Specs

### S1 — El periodo de una inscripción nueva es el término del calendario

> Decisión del operador, 2026-10-15, textual: *"Siempre el término del calendario"*.

Una inscripción pertenece al término en el que el alumno se inscribe, no al término de su
última fila. `currentAcademicPeriod()` ya existe y ya calcula bien: mes ≥ 7 →
`AGOSTO-DICIEMBRE/<año>`, si no → `ENERO-JUNIO/<año+1 si es julio>`.

Criterio de aceptación: con un alumno cuya fila más reciente es `ENERO-JUNIO/2027` LOCKED, la
inscripción cae en `AGOSTO-DICIEMBRE/2026`.

### S2 — `?period=` sobrevive, pero como override explícito

No se borra: los tests y el replay lo necesitan. Lo que se elimina es su carácter de default
silencioso: hoy una petición sin `?period=` hereda el periodo del alumno sin que nadie lo
pida. Pasa a ser el único modo de fijar un término que no sea el del calendario.

Criterio de aceptación: los tests actuales que dependían del periodo heredado pasan a
nombrarlo explícitamente.

### S3 — El guard ve todas las filas que ocupan la PRIMARY KEY

> No es expansión de alcance: es la definición de "esta fila ya existe".

La consulta de "ya está inscrita" deja de filtrar por `status = 'ENROLLED'` y pasa a mirar
`(student, subject, period)` sin filtro de estado. `APPROVED`, `ENROLLED` y `LOCKED` ocupan
el mismo par y los tres deben rechazar con un mensaje, no con un 500.

Criterio de aceptación: tres tests RED, uno por estado, cada uno esperando un `fail()` limpio.

### S4 — El guard de carga y el del action dicen lo mismo

`load` y `enroll` resuelven el periodo por la misma cadena. Arreglar uno y no el otro deja la
página ofreciendo un término que la acción no usa. Los dos cambian en el mismo work-unit.

### S5 — La verificación es agéntica, no sólo determinista

> Petición del operador, 2026-10-15: *"de manera correcta y agéntica (e2e)"*.

El runner agéntico verifica lo que un locator no puede: **qué término está ofreciendo la
página**. Esa es exactamente la afirmación de datos que estuvo mal en silencio.

Y conviene decirlo con precisión, porque es donde el carril tiene límites: **la restricción
de la PK se prueba en vitest, no en el navegador.** El alumno de la sesión e2e es `99999999`,
que tiene cero filas de `student_progress`; no existe forma honesta de provocar el conflicto
desde la UI sin sembrarle un historial inventado que el resto del repo no tiene. Sembrarlo
sólo para poder ver un 500 sería fabricar el defecto para poder medirlo.

Lo que el carril sí prueba, y vale: el camino feliz completa, y el término en pantalla es el
del calendario.

### S6 — `getLatestProgressPeriod` se borra

Tras el cambio queda sin un solo llamador, y su `desc(period)` lexicográfico es
precisamente la trampa que acaba de costar un 500. Dejarlo sería dejar la bomba puesta con
otro nombre.

## Tasks

| # | Task | Specs | Ruta | Riesgo |
| --- | --- | --- | --- | --- |
| E1 | Tres tests RED: APPROVED, LOCKED y periodo heredado | S1 S3 | inline | ninguno |
| E2 | La cadena de periodo: `requested ?? currentAcademicPeriod()` en load y action | S1 S2 S4 | inline | item 3 — contrato compartido |
| E3 | El guard sin filtro de estado, con el mensaje que corresponde | S3 S4 | inline | item 1 — toca enrolment |
| E4 | Borrar `getLatestProgressPeriod` y su import | S6 | inline | ninguno |
| E5 | Hacer explícito el periodo en los tests que lo heredaban | S2 | inline | ninguno |
| E6 | Test agéntico: el término de la página es el del calendario | S5 | inline | ninguno |
| E7 | `just qa-fast` + `just e2e-dev` + auditoría | todas | inline | item 1 |

Presupuesto: bajo 400 líneas escritas. Si lo rebasa, se corta en el límite de E5.

### Estado

| Task | Estado | Commit |
| --- | --- | --- |
| E1 | cerrada — tres RED observados: APPROVED y LOCKED con `UNIQUE constraint failed`, periodo heredado con el término equivocado | `015eb1e` |
| E2 | cerrada — `requestedTerm(url) ?? currentAcademicPeriod()` en load y action | `015eb1e` |
| E3 | cerrada — el guard filtra por periodo y no por estado | `015eb1e` |
| E4 | cerrada — `getLatestProgressPeriod` borrado; sin llamadores | `015eb1e` |
| E5 | cerrada — el test que heredaba el periodo ahora lo nombra | `015eb1e` |
| E6 | **hecha pero no muerde** — pasa contra el código viejo; ver la entrada del log | `015eb1e` |
| E7 | en curso | `015eb1e` |

## Fuera de alcance

- Las otras 8 vivas del ledger. No bloquean nada y se planean aparte.
- El `?period=` no se quita. S2 dice por qué sobrevive.
- Sembrar historial al alumno `99999999`. S5 explica por qué no.

## Log

- **L1 — Petición del operador, textual:** *"Planea ODD para solucionar todos los bloqueos de
  manera correcta y agéntica (e2e)."* Y la acotación que vino con las respuestas: *"Sólo T10.1
  y su familia, primero"* y *"Siempre el término del calendario"*.
- **2026-10-15 — El hallazgo confirmado por ejecución, no por lectura.** Una sonda temporal en
  `tests/unit/reinscripcion.test.ts` sembró un `APPROVED` de `cat-0001` en
  `AGOSTO-DICIEMBRE/2025` y llamó al action con ese mismo grupo. La respuesta fue
  `UNIQUE constraint failed: student_progress.student_control_number,
  student_progress.subject_canonical_id, student_progress.period`. La sonda se borró; el
  archivo no quedó con diff.
- **2026-10-15 — El dato que hace el arreglo más grande de lo que parecía.** El orden
  `desc(period)` es sobre texto, y "ENERO-JUNIO/2027" le gana a "AGOSTO-DICIEMBRE/2026". Sin
  eso, S1 habría sido "ampliar el filtro de estado" y habríamos arreglado el síntoma dejando
  al alumno de demo inscribiéndose en un término que no ha abierto.
- **2026-10-15 — E6 dio un resultado que no era el esperado.** La
  prueba agéntica **pasó contra el código viejo**. Verde falso, y la causa es la misma
  limitación que ya había mordido en el Kardex: el alumno de la sesión e2e es `99999999`,
  que tiene **cero** filas en `student_progress`. Entonces `getLatestProgressPeriod` devolvía
  `null` y la cadena caía igual a `currentAcademicPeriod()` — exactamente el valor contra el
  que el test compara. El bug del orden lexicográfico **sólo es alcanzable para un alumno que
  tiene filas**.
  Consecuencia honesta, escrita en el propio test: `tests/reinscripcion-term.e2e.ts` guarda
  contra que el término se pinte y resuelva, **no** muerde el bug que nació para cazar. La
  mordida está en `tests/unit/reinscripcion.test.ts`, que sí siembra un alumno con filas.
  Ampliar lo que el carril agéntico alcanza significa darle un historial realista a la
  credencial de e2e, y eso es una decisión con consecuencias — entre ellas que el test del
  Kardex dejaría de ver el estado vacío — no un cambio tranquilo dentro de este fix. No se
  tomó aquí.
- **2026-10-15 — E2–E5 hechos y commiteados** (`015eb1e`). Tres tests RED antes del arreglo:
  `APPROVED` y `LOCKED` reprodujeron `UNIQUE constraint failed` literal, y el de periodo
  reprodujo el término equivocado. Después: 27 verdes en el archivo, 369 en la suite.
  Un agujero más salió del mismo renglón y quedó cerrado: `?period=` vacío producía un
  término vacío, porque `??` sólo cae ante `null`/`undefined` y `searchParams.get("?period=")`
  devuelve `""`. Por eso el override pasa por `requestedTerm`, que distingue los tres casos.
