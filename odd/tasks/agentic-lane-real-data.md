<!-- odd-tracker
kind: phase-plan
status: closed
last-verified: 2026-10-19
branch: feat/agentic-lane-real-data
delivery: work-unit commits en la rama de feature
test-runner: just qa-fast · just test-e2e · just e2e-dev
continues: odd/tasks/roadmap-2026-10-15.md (Tramo 2)
depends-on: odd/tasks/findings-closure.md (Tramo 1, ya cerrado)
-->

# Carril agéntico: el alumno con historial real

Creado 2026-10-19. Es el **Tramo 2** del roadmap: gastar parte del presupuesto de tokens en el
runner agéntico, que hasta hace poco no hacía nada. El Tramo 1 (el ledger) está cerrado en
`odd/tasks/findings-closure.md`; este documento continúa desde ahí.

## El problema que este plan resuelve

El carril agéntico corre contra el alumno `99999999`, que **no tiene ni una fila** en
`student_progress`. Con cero historial, el corredor no puede comprobar nada sobre datos: la
página del Kardex le muestra un estado vacío y las pruebas sólo pueden afirmar "o un registro o
un estado vacío explícito", que es una afirmación que no puede fallar.

El 2026-10-15, el log de `odd/tasks/enrollment-period-and-pk-guard.md` lo dejó escrito: el test
agéntico del término **pasaba contra el código viejo**. Verde falso, y la causa era el mismo
alumno vacío: el bug del orden lexicográfico del periodo sólo es alcanzable para un alumno que
tiene filas.

La decisión del mantenedor (2026-10-19, textual): *"Restaurar 12345678 y usarla en el carril
agéntico"*. `12345678` tiene 49 filas de progreso, 175 créditos aprobados y 3 créditos
complementarios: es el alumno con datos.

## Specs

### S1 — El corredor firma con el alumno que tiene historial

`e2e.config.ts` firma como `12345678`. Playwright **sigue** con `99999999`, y no por descuido:
el suite determinista debe ver el estado vacío, porque hay pruebas que lo afirman.

Criterio de aceptación: el corredor entra y el primer_assert del dashboard ve los KPI del
alumno con historial, no ceros.

### S2 — El seeder y el suite de Playwright leen la contraseña del mismo sitio

`src/lib/server/db/seed-password.ts` leía `OPENSIM_TEST_PASSWORD` del entorno y, si no
estaba, caía al valor por defecto — mientras `tests/e2e/setup/auth.setup.ts` lee el `.env`.
Un shell sin la variable exportada escribía una contraseña y el suite probaba otra: el login
rebotaba en `/login` y parecía que la autenticación estaba rota.

Criterio de aceptación: `pnpm run db:set-password 12345678` y `just db-set-password` escriben
la contraseña del `.env`, y el login con esa contraseña entra.

### S3 — La portada no afirma un número que puede quedar viejo

El panel decía *"Explora las 42 asignaturas del plan ISIC-2010-224"*. El catálogo tiene 68
materias, de las cuales 52 son del plan y 16 son los módulos de la especialidad: **42 no era
ninguno de los dos**, y ningún número escrito a mano puede volver a ser cierto cuando el
catálogo cambie.

Criterio de aceptación: la llamada a la acción no afirma un total de materias.

### S4 — Las pruebas que asumían el estado vacío se actualizan

El Kardex ya no puede afirmar "un registro o un estado vacío": ahora hay registro. Los
créditos complementarios ya no son 0 de 5: son 3 de 5.

Criterio de aceptación: ninguna prueba del corredor afirma algo que sólo era verdad para el
alumno vacío.

### S5 — Cuatro rutas con aserción de datos (R3 + R4)

> El runner vale por lo que un locator no puede comprobar: si tres números de una pantalla
> suman lo que dicen que suman, si un campo vacío se lee como hueco y no como dato, si una
> página dice la cobertura que realmente tiene.

| Ruta | La aserción de datos |
| --- | --- |
| `/dashboard` | El % de avance es el cociente de los dos números que la tarjeta muestra, y los dos promedios están dentro de la escala 0–10 del TecNM |
| `/tramites` | Los tres números de la puerta (lo que hay, lo que falta, lo que se exige) suman lo que dicen: 175 + 7 = 182, y 3 de 5 complementarios |
| `/academico/kardex` | El registro no tiene huecos: cada fila trae calificación, créditos, término y tipo de evaluación, y ninguna calificación sale de la escala 0–10 |
| `/horario` | La rejilla muestra exactamente las materias en las que el alumno está inscrito, con día, hora y salón |

Criterio de aceptación: cada una de las cuatro rutas tiene juicio de modelo sobre **datos**, y
la corrida se lee verde sin reintentos.

### S6 — Nada de esto entra al gate determinista

`just qa-fast` corre la misma suite que antes de esta rama. El corredor no es el gate de
nada: un verde es evidencia, no prueba.

Criterio de aceptación: `package.json`, `vite.config.ts`, `biome.json`, `justfile` y
`playwright.config.ts` sin cambios, y los globs de vitest igual.

### S7 — El proveedor y el shim no se tocan

El shim (`e2e-structured-output-shim.ts`) y el modelo (`MiniMax-M3`) quedan como están: el
problema que este plan resuelve es de datos, no de transporte.

Criterio de aceptación: `e2e.config.ts` sólo cambia la credencial del alumno.

## Tasks

| # | Task | Specs | Ruta | Riesgo | Estado |
| --- | --- | --- | --- | --- | --- |
| T1 | El seeder lee el `.env`; `12345678` aprovisionada con la contraseña real | S2 | inline | ninguno | ✅ `ca5839f` |
| T2 | La llamada a la acción del panel deja de afirmar un total de materias | S3 | inline | ninguno | ✅ `614c414` |
| T3 | El corredor firma con `12345678` | S1 | inline | ninguno | ✅ `7f0f537` |
| T4 | Las pruebas existentes se actualizan al alumno con historial | S4 | inline | ninguno | ✅ `7f0f537` |
| T5 | Las cuatro aserciones de datos | S5 S6 | inline | ninguno | ✅ `6788e0a`, `7f0f537` |
| T6 | La corrida del corredor: verde, sin reintentos | S5 | inline | ninguno | ✅ 15 de 15 |

## Log

- **L1 — 2026-10-19, decisiones del mantenedor, textuales:** *"Atacar los 14 hallazgos
  abiertos"*; *"Restaurar 12345678 y usarla en el carril agéntico"*; *"Sí, restaurarla ahora"*.
- **L1 — 2026-10-19, encargo de esta sesión:** *"¿Qué sigue? No pares en hacerme question
  tool"*.
- **2026-10-19 — El número del plan que se va a escribir con datos reales**, medido sobre la
  base: 175 créditos aprobados de 260, 67.3 % de avance, 3 créditos complementarios de 5,
  41 materias aprobadas, 6 inscritas, 2 bloqueadas, 14 bloques de horario en 5 materias
  inscritas, y una brecha de 7 créditos reticulares hasta la puerta de Servicio Social.
- **2026-10-19 — Un hallazgo que salió al volcar las pantallas**: la llamada a la acción del
  panel afirmaba *"las 42 asignaturas del plan ISIC-2010-224"*. El catálogo tiene 68 materias
  (52 del plan, 16 de la especialidad) y 42 era un número de una versión anterior del
  currículo. Se quita el número en vez de cambiarlo por otro: entre 52 y 68 ambos son
  defendibles y ninguno puede volver a ser cierto cuando el catálogo cambie.
- **2026-10-19 — La trampa del seeder**, hallada al aprovisionar la credencial: `just
  db-set-password` escribía la contraseña por defecto porque `seed-password.ts` no leía el
  `.env`, mientras el setup de Playwright sí lo leía. Con la variable sin exportar en el
  shell, las dos rutas discrepaban y el login rebotaba en `/login`.

- **2026-10-19 — El corredor encontró un defecto que nadie había visto.** La columna Calificación
  del Kardex decía "En curso" en toda fila sin nota, y `gradeText` lo hacía también cuando
  `grade == null`: las tres materias complementarias **aprobadas** (ITM-100, ITM-104, ITM-105,
  que no llevan nota de 0 a 10) y las dos **bloqueadas** se contradecían con su propia columna
  Estado, que decía "Aprobada" o "Bloqueada" justo al lado. Ahora una nota que no existe es un
  hueco, como la columna Evaluación ya hacía, y el estado vive en la columna Estado. El
  corredor lo encontró; el gate determinista lo fija (`tests/e2e/kardex.spec.ts`).
- **2026-10-19 — La mordida, medida y no supuesta.** El test del término se corrió contra el
  código **pre-arreglo** (`015eb1e^`): falló con *"The 'Periodo:' line in the offer region
  reads 'ENERO-JUNIO/2027', not 'AGOSTO-DICIEMBLE/2026'"* — el bug lexicográfico, el que el
  test del 2026-10-15 **pasaba** porque el alumno estaba vacío. Con `12345678` el corredor
  llega al bug que fue escrito para cazar. Es la primera vez que el carril agéntico muerde un
  defecto real, y se verificó con el código viejo, no con una opinión.
- **2026-10-19 — La corrida completa:** 15 de 15 en 6 archivos, 20 llamadas al modelo, 81 mil
  tokens, 54 segundos. Sin reintentos, que era la condición de cierre del Tramo 2.

- **2026-10-19 — Segundo defecto del corredor: el día de cada clase.** El modelo respondió
  `ASSERTION_INCONCLUSIVE` y dijo por qué: el día vive en la **columna** de la rejilla, y una
  posición no está en el árbol de accesibilidad. Un lector de pantalla oía los siete encabezados
  de día y luego una lista plana de clases sin poder saber cuál era cuál. Es WCAG 1.3.1
  (Información y relaciones) y el barrido axe-core no lo detecta, porque las reglas de axe no
  miran la semántica de una rejilla propia. Ahora la columna es un grupo etiquetado, el bloque
  dice su día, y el encabezado dice "Día Lunes" en vez de "Día L".
- **2026-10-19 — La depuración de dependencias.** `lucide-svelte` estaba **deprecado** ("please
  use @lucide/svelte instead"): 20 archivos migrados y seis iconos renombrados, con el path
  SVG de cada uno comparado para comprobar que es **el mismo dibujo** y no otro glifo. El resto
  del toolchain subió a la última versión (SvelteKit 3.1.0, Svelte 5.57.2, Vite 8.3.4, Vitest
  5.0.5, Playwright 1.64.1, wrangler 4.151.1, el SDK de IA 7.0.143, y el tipo compartido de
  iconos pasó de `typeof Icon` a `LucideIcon`, que es el tipo de un icono). **TypeScript 7.0.2
  volvió atrás**: SvelteKit lee el tsconfig con `ts.readConfigFile(file, ts.sys.readFile)` y el
  port nativo no tiene `ts.sys`, así que `svelte-kit sync` —y con él el build— moría con
  "Cannot read properties of undefined". Un compilador mayor es una migración, no una
  actualización de dependencia.
- **2026-10-19 — El carril era intermitente, y ya no.** La reparación del shim sólo funciona
  cuando la respuesta tiene **exactamente** tantas claves como pide el esquema, así que un
  campo que el test no asserta es un campo que el modelo puede omitir y la corrida falla por un
  motivo que no tiene que ver con la página. Se quitaron los campos que nadie assertaba, la
  extracción del horario pasó a localizadores más un juicio, y el resultado son tres
  corridas seguidas de 15 de 15.
- **2026-10-19 — Traspaso al cierre de la sesión.** El carril quedó verde y publicado, pero el
  **Worker no se ha desplegado**: la D1 de producción ya está en `0017` y el código que la usa
  sigue sin publicar, así que la base y el código están desalineados. Lo pendiente —deploy,
  credencial del demo público, los cuatro atajos `ponytail:` y el merge de los PR #8 y #9— está
  en `odd/tasks/delivery-handoff-2026-10-19.md`.
- **2026-10-19 — La base verificada**: `main` local, `origin/main` y `codeberg/main` están en
  `48e20d6`, sin divergencia en ninguna dirección, y los trece SHA citados en los planes de
  esta rama existen.
