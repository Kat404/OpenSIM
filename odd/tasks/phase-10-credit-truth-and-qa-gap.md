<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-15
branch: feat/phase-9-verified-curriculum
test-runner: vitest (just qa-fast) · Playwright (just test-e2e) · runner agéntico (just e2e-dev)
-->

# Phase 10 — La aritmética de créditos, la verdad del fixture y el gap del runner agéntico

Creado 2026-10-13, después de cerrar T9.11–T9.14. Cubre tres cosas que el mantenedor
pidó resolver juntas: corregir la relación entre créditos reticulares y complementarios,
fijar el proyecto como rediseño FOSS del SIM con v1 = Sistemas, y cerrar el gap de
cobertura del runner e2e agéntico.

---

## El error que origina este plan

T9.13 implementó la puerta doble tal como se dictó: `reticulares ≥ 182` **y**
`complementarios ≥ 5`. La regla es del operador y no se toca. **El conteo sí estaba mal.**

La fuente que faltaba estaba en el repo desde el principio,
`docs/data/reticula-isc-2010-224.md`:

| Componente | Créditos |
| --- | --- |
| Estructura Genérica | 210 |
| Especialidad | 25 |
| Residencia Profesional | 10 |
| Servicio Social | 10 |
| Actividades Complementarias | 5 |
| **Total** | **260** |

De ahí salen tres hechos que T9.13 ignoró:

1. **El total reticular es 235, no 260.** Los 25 créditos no reticulares son los 5
   complementarios, los 10 de Residencia y los 10 de Servicio Social.
2. **182 salió de 70% de 260** (commit `6a3afee`: *"Credit thresholds correspond to the
   ISIC-2010-224 plan total of 260 credits (50/70/80%)"*). Ese denominador cuenta los 5
   complementarios, que son precisamente los que la puerta nueva exige aparte. El
   porcentaje se calculó sobre un total que incluye lo que la puerta excluye.
3. **Los 5 complementarios no son "5 actividades".** El plan los numera como un bloque
   agregado. `complementary_credit_activities` no tiene columna de créditos, y las cuatro
   materias transversales guardan `credits = 0`, así que la regla no era representable y
   T9.13 salvó contando renglones.

---

## Specs

### S1 — Cada materia complementaria vale un crédito, y el peso vive en la actividad

> Dictamen del operador, 2026-10-13, textual: *"Tutoría, Actividad Física y Artes son
> materias opcionales para el avance curricular del estudiante, es decir, el estudiante
> técnicamente podría graduarse sin tener que agarrar y/o cursar dichas materias, son
> materias únicamente con el propósito de obtener un crédito complementario por materia."*

> Corrección del operador, 2026-10-15, textual: *"Que las materias den un solo créditos
> complementario está correcto. Las materias no son la única forma de obtenerlos debido a
> que puede obtener créditos mediante cursos, talleres, participaciones externas y demás.
> Recordemos que si NO cursa dichas materias COMPLEMENTARIAS aún podría reunir 5 créditos
> complementarios mediante actividades externas a las materias."*

> Decisión del operador, 2026-10-15, textual: *"El peso va en la ACTIVIDAD"*

El crédito complementario es una propiedad de la **actividad**, no de la materia. Eso
cambia la premisa de la versión anterior de este spec, que adjudicaba el peso a
`subjects.complementary_credits`:

| Materia | Peso complementario | Fuente |
| --- | --- | --- |
| `ITM-100` Tutoría | 1 | dictamen del operador |
| `ITM-101` Actividades Complementarias | 1 | Same — es una materia más |
| `ITM-104` Actividades Físicas | 1 | dictamen del operador |
| `ITM-105` Apreciación de Artes | 1 | dictamen del operador |

Las cuatro suman **4, no 5**, y eso es correcto: el quinto crédito no tiene materia que lo
produzca. Se consigue con una actividad externa —un curso, un taller, una participación
externa— y por eso `complementary_credit_activities.subject_canonical_id` tiene que poder
ser nulo. Una fila sin materia es una actividad externa, no un dato roto.

Alcance aceptado:

- `complementary_credit_activities.credits INTEGER NOT NULL DEFAULT 1`, que es de donde
  sale el crédito del alumno.
- `subject_canonical_id` pasa a nullable.
- `subjects.complementary_credits` se elimina: dos fuentes de verdad para el mismo hecho es
  peor que una. La migración 0015 livedía un día y su premisa ya está retirada.
- La activities suma es `SUM(complementary_credit_activities.credits)`.

Lo que **no** cambia: el número 182. Es la regla del operador, reafirmada el 2026-10-13.

### S2 — El total reticular es 235 y el total del plan es 260, y son cosas distintas

`260` sigue siendo el total del plan. `235` es lo que un alumno puede tener en créditos
reticulares. Ninguna puerta puede derivar su umbral de `260 / approvedCredits` porque el
numerador y el denominador deben ser del mismo conjunto.

Criterio de aceptación: el código expone ambos números con nombre y un test afirma que
`235 = 210 + 25` y que `260 = 235 + 5 + 10 + 10`.

### S3 — 182 es un número del operador, y queda escrito como constante, no como porcentaje

> El 182 se derivó como 70% de 260, y esa derivación es incorrecta porque 260 incluye los
> 5 complementarios. El umbral se conserva porque es la regla del operador, pero deja de
> justificarse aritméticamente en el código.

Criterio de aceptación: un comentario junto a la constante dice exactamente esto, y un
test afirma que `182` **no** es `0.7 * 260` — para que nadie lo "simplifique" de vuelta.

### S4 — El copy de `/tramites` habla de créditos, y el número viene de la suma

Hoy la página dice "tienes 3 de 5 créditos complementarios" contando renglones. Con S1 el
número es la suma de pesos. La página no cambia de texto: cambia de ser verdad.

Criterio de aceptación: un test de loader con una materia de peso 2 acreditada afirma que
el total sube 2, no 1.

### S5 — Toda la PII del fixture pasa a sintética, con sentido

> Decisión del mantenedor, 2026-10-13: *"sustituir toda la PII por datos claramente
> sintéticos pero con sentido, es decir no vamos a poner como nombre 'Estudiante123' sino
> algo como 'Panfilo Ruíz'."*

Se sustituyen nombre, CURP y cualquier otro campo que identifique a una persona. Se usan
nombres y CURP estructuralmente válidos pero inventados. **No** se sustituyen los nombres
de salón ni las horas: son nombres de instalación del instituto, no datos de una persona, y
son lo que hace el demo creíble.

**Supuesto declarado**: el mantenedor afirma que el nombre actual ya era ficticio. No hay
registro de eso en la memoria del proyecto, así que se trata como PII real y se sustituye.
El archivo queda con un encabezado que declare su origen y su condición de sintético.

### S6 — El proyecto se declara como rediseño FOSS del SIM, v1 = Sistemas

> Decisión del mantenedor, 2026-10-13: *"nunca vamos a obtener por completo todos los datos
> de todas las carreras disponibles de la institución, aunque me pudiera apoyar de hacer
> web scraping de demás compañeros [...] nunca acabaríamos. Tomemos como base las materias
> que ya sabemos así como serialización, los créditos y demás. Lo que inventaremos serán
> los salones, edificios y horarios. Para v1 quedamos igual únicamente con la carrera de
> Sistemas."*

El README y `AGENTS.md` pasan a declarar, sin ambigüedad, qué es dato verificado y qué es
dato de diseño:

| Verificado del SIM | Invención de diseño |
| --- | --- |
| Materias, códigos, créditos, serialización | Salones, edificios, horarios |
| Catálogo de oferta (468 grupos) | Nombre y curriculum del alumno |
| Temario (7 de 68, cobertura parcial) | Los 25 créditos de especialidad sin temario |

Y queda escrito que el scraping queda fuera de alcance, con el motivo.

### S7 — El runner agéntico deja de tener un solo test real

Hoy hay tres archivos `*.e2e.ts`: uno es `example.e2e.ts`. Contra un gateway real eso es
la capa más cara del QA y la que menos cubre.

Alcance aceptado: tests agénticos para las superficies que hoy no tienen ninguno —
`/temario`, `/horario`, `/tramites`, `/academico/kardex`, y el flujo de auth. El criterio
de cierre no es "el agente no falló": es que **vitest y Playwright siguen siendo el gate**
y el runner se suma como capa probabilística. Nada de esto cambia `just qa-fast`.

---

## Tasks

| # | Task | Specs | Ruta | Riesgo |
| --- | --- | --- | --- | --- |
| T1 | Migración `activities.credits` + `subject_canonical_id` nullable - `subjects.complementary_credits` fuera | S1 | inline | item 1 — toca `drizzle/**` |
| T2 | `evaluateCreditThresholds` sin cambio de números + invariante "los pesos suman 5" **retirada** | S1 S2 S3 | inline | item 3 — contrato compartido |
| T3 | Loader y copy de `/tramites` sumando `activities.credits` | S1 S4 | inline | ninguno |
| T4 | Fixture: PII sintética con sentido + encabezado de origen | S5 | inline | item 1 — PII en repo público |
| T5 | README + `AGENTS.md`: posicionamiento de rediseño FOSS, v1 Sistemas | S6 | inline | ninguno |
| T6 | Tests agénticos para las rutas sin cobertura | S7 | inline | ninguno |

Presupuesto: ~400 líneas escritas acumuladas. Si lo rebasa, se corta en el límite de T4.

### Estado

| Task | Estado | Commit |
| --- | --- | --- |
| T1 | **reabierta 2026-10-15** — la premisa de S1 cambió: el peso va en la actividad, no en la materia. 0016 añade `activities.credits`, hace nullable `subject_canonical_id` y tira `subjects.complementary_credits` | — |
| T2 | **reabierta 2026-10-15** — los números no cambian; lo que cae es el validador que exigía que los pesos sumaran 5, porque la suma ya no tiene por qué dar 5 | — |
| T3 | **reabierta 2026-10-15** — el loader suma `activities.credits`; el copy ya decía "créditos" y ahora dice la verdad | — |
| T4 | cerrada — nombre y CURP sintéticos, `_NOTICE` en el fixture, PII vieja ausente del código | `5e2e936` |
| T5 | cerrada — README y AGENTS.md declaran verificado vs invención, v1 Sistemas, scraping fuera de alcance | `730aa91` |
| T6 | **cerrada 2026-10-15** — el shim repara la respuesta; 10 de 10 verdes, cero MODEL_OUTPUT_INVALID | `054be20`, `5fd9324` |

---

## Fuera de alcance

- Cambiar 182, 208 o 130. Son números del operador.
- Web scraping de la institución o de compañeros. Descartado por el mantenedor, con motivo.
- Cubrir las demás carreras. v1 = Sistemas.
- Cambiar el gate de `just qa-fast` para que dependa del runner agéntico.

---

## Log

- **2026-10-13 — L1.** Petición del mantenedor, textual: *"Planeemos de manera ODD la
  resolución de lo siguiente: Fixear de manera correcta la relación entre los créditos
  reticulares y los créditos complementarios, teniendo como regla de diseño lo que ya
  hemos hablado antes. En cuanto a decisión del proyecto me gustaría ir con la C [...]
  Lo que inventaremos serán los salones, edificios y horarios. Para v1 quedamos igual
  únicamente con la carrera de Sistemas. Cierra el gap del runner agéntico, tengo tokens
  para gastar así que no temas en realizar varios test e2e agénticos [...] aunque eso no
  reemplaza vitest ni Playwright debido a que los agentes son probabilístico y no
  deterministas."*
- **2026-10-13 — Dictamen sobre el peso complementario**, textual: *"Tutoría, Actividad
  Física y Artes son materias opcionales para el avance curricular del estudiante [...]
  son materias únicamente con el propósito de obtener un crédito complementario por
  materia."* De ahí sale S1.
- **2026-10-13 — Decisión sobre la PII del fixture**, textual: *"El nombre de dicha
  persona es demo por lo cual no existe pero por si acaso lo puedes cambiar para sustituir
  toda la PII por datos claramente sintéticos pero con sentido."* De ahí sale S5.
- **2026-10-13 — Búsqueda en memoria sin resultado.** Se buscó el nombre del fixture, su
  CURP, "datos personales" y el control number antiguo: no hay registro de que el nombre sea
  ficticio. La premisa del mantenedor no pudo verificarse y se trata como PII real.
- **2026-10-13 — Falsa alarma descartada con evidencia.** La memoria #2173 afirma que
  "30 filas APPROVED sumando 175 créditos" es imposible, porque las 30 mayores del plan
  suman 161. Consultado contra la D1 local: `student_progress` tiene **41** filas APPROVED
  y sus créditos suman **exactamente 175**, que es lo que declara
  `student_profiles.approved_credits`. El fixture es aritméticamente consistente y la
  premisa de #2173 describe un estado anterior. No se "corrige" nada aquí; queda anotado
  para que nadie toque un número que ya está bien.
- **2026-10-13 — Conflicto de memoria resuelto.** #2359 ("la unidad es el renglón") queda
  marcado como sustituido por este plan: el dictamen del operador sobre el crédito por
  materia responde exactamente la pregunta que #2359 dejó abierta.
- **2026-10-13 — Defecto de redacción corregido.** Al escribir este documento se colaron
  cuatro cadenas corruptas (`动机`, `bridó`, `必须是`, `覆盖`) que reemplazaron texto en
  español. Corregidas. Es la segunda vez que ocurre en los planes de `odd/`; el síntoma
  es siempre el mismo: un token foráneo en medio de una frase en español.
- **2026-10-13 — T1–T3 cerradas** (`68e6979`). La migración 0015 agrega
  `subjects.complementary_credits`; los cuatro pesos quedaron en la D1 local y el seed los
  valida (falla ruidosamente si un subject reticular cargara peso, o si la suma no fuera 5).
  El generador Python es la fuente y se regeneró el JSON con él, sin edición a mano.
  `RETICULAR_CREDITS_TOTAL = 235` y `PLAN_CREDITS_TOTAL = 260` conviven; los tres umbrales
  son ahora constantes con nombre.
- **2026-10-13 — T4 cerrada** (`5e2e936`). Nombre y CURP del fixture sustituidos por
  valores sintéticos con la misma forma estructurada, `_NOTICE` al inicio del JSON, y el
  nombre default del harness de tests alineado. La PII anterior ya no aparece en ningún
  `.ts`/`.json`/`.sql` del repo; sólo queda citada en planes históricos de `odd/`, que son
  registro de lo ocurrido y no se reescriben.
- **2026-10-13 — Regresión encontrada y corregida durante T4.** Poner
  `COMPLEMENTARY_CREDITS_REQUIRED` en `schema.ts` y re-exportarla desde `dag.ts` arrastró el
  módulo de servidor al cliente: `/reticula` (que importa de `dag.ts` en el cliente) tiró
  `server_only_import` y falló el e2e. La constante volvió a `dag.ts` (client-safe) y el
  seed la importa de ahí, de modo que ambos leen una sola definición sin cruzar el límite
  server/client.
- **2026-10-13 — T6 BLOQUEADA por el proveedor, no por los tests.** Los seis tests
  agénticos de `tests/phase10-pages.e2e.ts` fallan con `MODEL_OUTPUT_INVALID`. Se
  investigation a fondo con tres sondeos reproducibles
  (`scripts/probe-minimax-tools.mjs`, `probe-models.mjs`, `probe-budget.mjs`):
  `agent.assert` y `agent.extract` necesitan structured output, y este gateway lo emite de
  forma intermitente. Contra una pregunta sintética de una línea, los mejores resultados
  fueron M2.5 temp 0 con 50-60%, M3 con 0-20% (una vez leyó "7 de 68" al revés), M2.1 y M2
  con 25%. Subir `max_tokens` no cambia nada (4 000 y 12 000 puntúan igual) y los fallos
  llegan como `finish_reason: stop` sin tool call: el modelo elige responder en prosa.
  Contra las pantallas reales de la app (329-330 nodos) la tasa es **0%**: 6 tests, 36
  llamadas al modelo, todas inválidas.
  **Los tests quedan commiteados tal cual.** No se debilitan ni se borran: las preguntas son
  correctas y sólo necesitan un modelo que obedezca tool-calling. `e2e.config.ts` acepta
  `E2E_MODEL` para cambiar de modelo sin tocar código. `retries: 2` se probó y se quitó:
  triplicó el costo (12 → 36 llamadas) sin mover la tasa, que ya estaba medida.
  vitest y Playwright siguen siendo el gate y `just qa-fast` no depende de este carril.
- **2026-10-13 — T6: los nombres de modelo estaban mal documentados.** Los ids que se
  configuraron venían de un comentario en `e2e.config.ts`, no de la documentación. La fuente
  de verdad es `GET /v1/models`, que declara ocho: M3, M2.7, M2.7-highspeed, M2.5,
  M2.5-highspeed, M2.1, M2.1-highspeed y M2. `MiniMax-M3.1-Flash-Preview` **no está**
  disponible en esta cuenta: responde 400 `invalid params`. Un nombre inventado responde
  400 `unknown model`, así que el barrido midió modelos reales y no una misma respuesta
  repetida. Barrido completo (`scripts/probe-models.mjs`): M2.7 es el menos malo, pero
  con 12 corridas queda en **33%**, no en el 100% que sugerían las primeras 5.
  `scripts/confirm-model.mjs` existe por eso: un 5/5 habría pasado por bueno.
  Hipótesis descartadas con medición: el razonamiento no es la causa (con
  `thinking.type="disabled"` — que la documentación dice que M3 respeta — desaparecen los
  bloques de pensamiento y el tool-calling sigue en 0%); el presupuesto de tokens no es la
  causa; y los reintentos no son la solución. Los fallos llegan como
  `finish_reason: "stop"` sin tool call: el modelo termina su turno en prosa en vez de
  llamar a la herramienta que se le forzaba.
- **2026-10-13 — Dependencias actualizadas.** `pnpm outdated` mostraba `e2e` 0.19 → 0.20
  (su changelog no toca la gramática del judge), más parches de `ai` y
  `@ai-sdk/openai-compatible`. Nota: `pnpm update` NO sube `e2e` porque en 0.x el caret no
  cubre el siguiente minor; hay que mover el rango a mano. Commit `43d1d1f`.
- **2026-10-13 — Defecto propio en S3, capturado por un test.** El test que S3 especificaba
  ("182 no es 70% de 260") es una afirmación falsa: 182 = 0.7 × 260 exactamente, igual que
  130 y 208. Los tres umbrales SÍ son porcentajes de 260. Lo que se retira es la
  *procedencia*, no el número: medir avance reticular como fracción de 260 dejaría que los
  5 complementarios sustituyeran progreso reticular. El test que S3 especificaba ahora fija las
  constantes a sus literales y a que NO coincidan con un porcentaje del total reticular
  (235 × 0.7 = 164.5, no 182), que es la recálculo "correcto" tentador.
- **2026-10-15 — S1 estaba construida sobre una premisa falsa, y la Premisa la puso el
  modelo.** El `ITM-101 = 2` no era "un número sin confirmar": era una invención para que
  el bloque sumara 5. El bloque NO lo producen esas cuatro materias. El operador, textual:
  *"Que las materias dan un solo créditos complementario está correcto. Las materias no son
  la única forma de obtenerlos debido a que puede obtener créditos mediante cursos, talleres,
  participaciones externas y demás. Recordemos que si NO cursa dichas materias COMPLEMENTARIAS
  aún podría reunir 5 créditos complementarios mediante actividades externas a las materias."*
  Decisión de modelo, textual: *"El peso va en la ACTIVIDAD"*.
  Consecuencias que no estaban previstas: (1) las cuatro pesan 1 y suman 4, y el quinto
  crédito no tiene materia que lo produzca; (2) `complementary_credit_activities.subject_canonical_id`
  tiene que poder ser nulo, porque un curso externo no es ninguna de las cuatro; (3) el
  validador del seed que exigía `SUM(complementary_credits) == 5` deja de ser cierto y se
  retira — ese invariante era el que hacía parecer correcto el modelo equivocado; (4)
  `subjects.complementary_credits` se va: la migración 0015 quedó con una premisa retirada
  y una sola línea de vida. T1, T2 y T3 se reabren.
- **2026-10-15 — La hipótesis de "el output depende de la conexión" queda MEDIDA y
  descartada.** `scripts/probe-models.mjs` ahora separa la clase de fallo y toma la latencia
  por llamada. Barrido de `MiniMax-M3`, 12 corridas por temperatura:
  `temp=0 2/12 (17%) red=0/12 lat 1202/3172 ms` y
  `temp=1 2/12 (17%) red=0/12 lat 1047/1356 ms`. Cero eventos de red, latencia mediana de
  ~1 s contra un presupuesto de 120 s, y todos los fallos son `sin tool_calls
  (finish=stop)`: HTTP 200, turno cerrado en prosa, respuesta completa. Eso no es una
  conexión caída. Lo que sí era conexión —el `STEP_TIMEOUT` con el default de 30 s— ya
  quedó resuelto en `f752bfd`. Commit `67ee220`.
- **2026-10-15 — El operador fija el modelo en `MiniMax-M3` aunque el barrido lo coloca
  segundo.** No se toca el carril del juez: `model` y `judge` siguen siendo el mismo id, que
  es lo que hay. Consecuencia honesta: M3 mide 17% contra el 33% de M2.7, así que T6 sigue
  bloqueada con M3 y con M2.7. No hay modelo de la cuenta que devuelva structured output
  válido; los ocho que declara `GET /v1/models` fallan en `response_format`.

- **2026-10-15 — T6 reintentado con `MiniMax-M3` y vuelve a cerrarse por proveedor.** El
  operador lo pidió expresamente. `just e2e-dev`: 10 tests, 4 verdes, 6 rojos, 12 llamadas
  al modelo, 60 s en total. Los 6 rojos son todos
  `MODEL_OUTPUT_INVALID: provider response did not match the closed response grammar`, y
  cada uno consumió exactamente 2 llamadas — 6 × 2 = 12 se come el run entero, así que los
  4 verdes no llamaron al modelo: son los deterministas. O sea: **6 de 6** de los tests que
  necesitan juicio de modelo fallaron, y los que no lo necesitan pasaron.
  Lo que sí funciona es el carril del actor: `app.open` llegó a `/temario` en 513 ms y la
  pantalla tenía 329 nodos. Lo que falla es `agent.extract`, el paso de structured output, y
  sólo ese. Cero `STEP_TIMEOUT` en todo el run: el presupuesto de 120 s ni se acercó. T6
  sigue bloqueada por el proveedor, con el alcance más estrecho de lo que se creía.

- **2026-10-15 — T6 deja de estar bloqueada: el diagnóstico anterior era FALSO.** El
  shim `e2e-structured-output-shim.ts` repara la respuesta en `wrapLanguageModel` y el
  carril pasa de 4/10 a **8/10**, sin un solo `MODEL_OUTPUT_INVALID`.
  Lo que la sonda midió y lo que la documentation decía no coinciden. No es que el endpoint
  "ignore `response_format`": lo ignora y da igual, porque el JSON que vuelve es válido y
  sus **valores son correctos**. Lo que no hace es repetir la clave que le pides —
  `withTemario` vuelve como `publicadas` o `publicados`, `conTemario` como `con_temario` o
  `materias_con_temario`, y `publicadas` vuelve como `publicados`: renombra incluso cuando
  se le da la clave exacta que más le gusta, así que renombrar el campo NO es el arreglo.
  También suelta dos o tres objetos candidatos con prosa alrededor, y a `agent.extract` le
  llega la respuesta interior sin el sobre `found`/`value`/`missing`.
  El shim sólo renombra claves, nunca valores: un acierto equivocado se ve como un assert
  rojo, nunca como un verde. Texto que no encaja con nada se deja igual y falla la
  validación — un modelo que no respondió no puede convertirse en un test que pasó.
  La guía oficial de e2e para `MODEL_OUTPUT_INVALID` dice "simplify the schema or question;
  pick a stronger model": el runner no trae reparador, así que esto no reinventa nada.
  Quedan dos rojos que **no son del proveedor**: (1) el modelo se negó a avalar una
  afirmación que la UI en stepper no puede mostrar, que es exactamente lo que debe hacer;
  (2) un locator puro sin modelo, que además es un test mal escrito: el alumno de la sesión
  e2e es `99999999`, que no tiene historial académico, y el comentario del test da por hecho
  que sí. Commit `054be20`.

- **2026-10-15 — `e2e` 0.20.0 → 0.21.1 y T6 cerrada.** La versión salió el mismo día
  (0.21.1 a las 12:45). `pnpm update` no llega porque en 0.x el caret no cruza el minor
  siguiente: hay que mover el rango a mano, la misma trampa que en el salto 0.19 → 0.20.
  pnpm dejó la excepción anotada en `pnpm-workspace.yaml` porque la release es más joven
  que la edad mínima de release del proyecto.
  **Config: no hubo que migrar nada.** La única clave reemplazada, `cache.dir`, este config
  nunca la puso. Leídas las 28 entradas del changelog de 0.21.x: 3 tocan juicios y NINGUNA
  toca structured output — la única de juicios (#1092) es sobre tamaño de la observación
  causando `STEP_BUDGET_EXHAUSTED`, que es otro fallo. Se consideró `maxDuration` y se
  descartó: el gasto ya lo acotan `maxSteps` y `maxModelCalls`, y un tope de reloj puede
  cortar una corrida sana con el gateway lento. `E2E_CACHE_DIR` sólo sirve entre worktrees.
  **Los dos tests que quedaban rojos eran culpa del test, no de la app.** `/tramites` es un
  stepper: sólo el procedimiento seleccionado enseña su bloqueo, así que "todos los
  bloqueados dicen por qué" es una pregunta que no tiene respuesta en una vista y el modelo
  contestó `ASSERTION_INCONCLUSIVE` con razón. Ahora pregunta por procedimiento, pulsando
  cada pestaña: tres comprobaciones donde había una vaga. Y el Kardex pedía tabla cuando la
  sesión `alumno` es `99999999` y todas las filas de `student_progress` son de `12345678`:
  la página enseña su estado vacío y acierta.
  Nota que quedó viva: el SDK avisa por stderr
  `The feature "responseFormat" is not supported. JSON response format schema is only
  supported with structuredOutputs`. Es la evidencia de que el esquema ni siquiera sale, y
  por eso el shim repara la respuesta en vez de esperar que se cumpla. No se silencia a
  propósito: callar un aviso del provider es esconder un problema.
  Commit `5fd9324`.
