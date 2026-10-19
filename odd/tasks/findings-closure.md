<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-19
branch: chore/findings-closure
delivery: work-unit commits en la rama de feature
test-runner: just qa-fast · just test-e2e · just test-e2e-avatar · just e2e-dev
reconciles: odd/tasks/findings-remediation.md (14 casillas abiertas)
-->

# Cierre de los 14 hallazgos vivos del ledger

Creado 2026-10-19 al retomar la sesión. El ledger de hallazgos tenía 28 casillas; la
reconciliación del 2026-10-15 dejó 17 cerradas y 14 vivas. Este plan las cierra una por
una, con evidencia contra el código — no con memoria.

**Antes de escribir nada, las 14 se verificaron una por una contra el código.** Cinco
resultaron **stale**: el ledger afirmaba defectos que ya no existen. Eso es exactamente el
peligro que el roadmap del 2026-10-15 advirtió: un findings ledger que no está reconciliado
con el código es peor que no tener archivo.

| Hallazgo | Lo que el ledger afirma | Lo que el código dice (2026-10-19) | Veredicto |
| --- | --- | --- | --- |
| T9.4 | no hay borrado por `student_control_number` | `invalidateAllSessions` existe en `auth.ts:445`; **sólo lo llama un test** | **medio** — falta cablearlo |
| T10.0 | falta la decisión de PK (A/B/C) | resuelta por `enrollment-period-and-pk-guard.md` (S1) | **stale** |
| T10.1 | BLOCKER: colisión de PK → 500 | arreglado en `015eb1e`, `19a5cc1`, `eaf9712` | **stale** |
| T12.1 | los forms recogen input y el action lo descarta | vivo | **vivo** |
| T12.2 | `/` es una galería de componentes | vivo: 226 líneas, título "OpenSIM — Inventario de componentes UI" | **vivo** |
| T12.3 | `/login/recuperar` finge ser un formulario | **falso**: la página ya dice que OpenSIM no gestiona el reset | **stale** |
| T13.1 | `annotateConflicts` test-only | vivo | **vivo** |
| T13.2 | `clearSessionCookieOptions` no se adopta | vivo: los 2 sitios limpian a mano | **vivo** |
| T13.3 | `pruneExpiredSessions` duplica el SQL del cron | más grave de lo que dice: `pruneExpiredSessions` **no lo llama nadie**, `pruneExpiredAttempts` sólo un test | **vivo** |
| T13.4 | `subject_units` nunca se selecciona | **falso**: lo lee `/temario/+page.server.ts`; `seed.sql` tiene 32 filas | **stale** |
| T13.5 | `subject_aliases` se escribe y nunca se lee | vivo: 4 filas legacy, ni un SELECT | **vivo** |
| T13.6 | `Drawer.svelte` sin consumidores | vivo | **vivo** |
| T13.7 | `MAX_GRADE` / `MIN_GRADE` test-only | vivo | **vivo** |
| T13.8 | letras de día desconocidas se descartan en silencio | vivo: `horario/+page.server.ts:110` | **vivo** |

## Specs

### S1 — Revocar todas las sesiones del alumno

> Decisión del operador, 2026-10-19, textual: *"Tarjeta 'Seguridad' en el dashboard"*.

`invalidateAllSessions` ya existe y está probado; lo que falta es un camino real que la
llame. Se añade `POST /login/logout-all`, que revoca **todas** las filas de
`auth_sessions` del alumno en sesión, y una tarjeta "Seguridad" en el dashboard con el
botón que la dispara.

Criterio de aceptación: un POST autenticado borra todas las filas del alumno y deja la
cookie limpia; un POST anónimo no borra ninguna fila y redirige a `/login`.

### S2 — Los trámites no se llenan si no se guardan

> Decisión del operador, 2026-10-19, textual: *"Deshabilitar los formularios y decirlo en
> pantalla"*.

Los tres formularios (residencia, servicio social, titulación) recogen diez campos y el
action los descarta. Pasan a estar deshabilitados, y el aviso aparece **antes** de que el
alumno escriba nada, no después de enviar.

Criterio de aceptación: los inputs de los tres formularios quedan deshabilitados y la
página dice, sin rodeos, que el trámite todavía no está disponible y que los datos no se
guardan. El action del servidor deja de prometer `202 Accepted` y responde `501`.

### S3 — La portada pública dice la verdad

> Decisión del operador, 2026-10-19, textual: *"Mover la galería a /design-system y hacer
> de / una landing honesta"*.

`/` deja de ser el inventario de componentes y pasa a ser la portada honesta del
rediseño: qué es OpenSIM, que v1 es la carrera de Sistemas, que el catálogo viene del SIM
publicado, y un enlace para entrar. La galería completa se mueve a `/design-system`, que
sigue siendo el consumidor de los ocho atoms que sólo ella usaba.

Criterio de aceptación: `/` no contiene un inventario de componentes ni fixtures
hardcodeados; `/design-system` los contiene; ningún dato de alumno aparece en `/`.

### S4 — `/login/recuperar` ya es honesta; se le corrige el idioma

El hallazgo T12.3 queda cerrado por evidencia: la página dice que OpenSIM no gestiona el
restablecimiento de contraseñas y lista el procedimiento institucional. Lo que sí queda es
una palabra en inglés dentro de un texto en español: *"identificación official vigente"*.

Criterio de aceptación: la palabra es *"oficial"*.

### S5 — El código muerto se borra

`annotateConflicts` (`schedule-conflict.ts:107`), `Drawer.svelte` y su export, y
`MAX_GRADE` / `MIN_GRADE` no tienen ningún consumidor fuera de sus tests.

Criterio de aceptación: los tres desaparecen del código y de sus tests, y nada más cambia
de comportamiento.

### S6 — Una sola implementación de cada cosa

`clearSessionCookieOptions` ya existe y los dos sitios que borran la cookie la escriben a
mano. `pruneExpiredSessions` y `pruneExpiredAttempts` existen en `auth.ts` y el cron
—un cuerpo SQL inyectado por `scripts/inject-scheduled-handler.mjs`— repite ese SQL con
un comentario que obliga a mantener las dos copias en sincronía.

Criterio de aceptación: los dos sitios de borrado de cookie usan la opción compartida; los
dos helpers de prune desaparecen de `auth.ts` y de sus tests, y el script inyectado deja de
advertir sobre una copia que ya no existe. El cron sigue podando igual.

### S7 — `subject_units` ya tiene consumidor

T13.4 queda cerrado por evidencia: `/temario/+page.server.ts` la consulta y `seed.sql`
trae 32 filas. No hay nada que cambiar.

### S8 — `subject_aliases` se va

> Decisión del operador, 2026-10-19, textual: *"Borrar la tabla"*.

La tabla guarda cuatro códigos legacy del SIM que nadie lee, al contrario que
`subject_prerequisites`, que sí lee la retícula. Se borra la tabla, sus tipos y sus
`INSERT` del seed.

Criterio de aceptación: la migración existe y aplica, `seed.sql` se regenera sin las
filas de alias, y la retícula y el temario siguen funcionando.

### S9 — Un día desconocido se anuncia, no se traga

`horario/+page.server.ts:110` descarta en silencio cualquier letra de día fuera de
`L M X J V S D`, con un `continue` sin rastro.

Criterio de aceptación: el descarte queda registrado en el log, con el valor que lo
provocó.

### S10 — El ledger dice la verdad, casilla por casilla

Las 28 casillas quedan marcadas, o con la nota de por qué siguen viva, citando la
evidencia que lo cerró. Ninguna casilla se borra. Las 14 de esta sesión se cierran aquí;
las cinco stale se cierran con la evidencia de por qué ya no eran defectos.

Criterio de aceptación: ninguna casilla queda sin veredicto, y cada una cerrada cita un
archivo, una línea o un commit.

### S11 — RED antes que GREEN, en cada cierre

Todo hallazgo que cambie comportamiento deja un test que falla antes del arreglo y pasa
después. El que no cambia comportamiento (S4, S7) se cierra con un check estructural.

Criterio de aceptación: cada work unit con cambio de comportamiento tiene su test RED
observado, y `just qa-fast` queda verde.

### S12 — Nada de esto entra al gate determinista

El carril agéntico no se toca aquí, y ningún test probabilístico entra a `just qa-fast`.

Criterio de aceptación: `just qa-fast` corre exactamente la misma suite que antes de esta
rama.

## Tasks

| # | Task | Specs | Ruta | Riesgo | Estado |
| --- | --- | --- | --- | --- | --- |
| T0 | El test del panel no puede depender del día de la semana | S11 | inline | ninguno | ✅ `c161dfe` |
| T1 | Revocar todas las sesiones: endpoint + tarjeta "Seguridad" en el dashboard | S1 S11 | inline | item 2 (auth) | ✅ `6c2a3a2` |
| T2 | Trámites honestos: forms deshabilitados + aviso previo | S2 S11 | inline | ninguno | ✅ `834b81b` |
| T3 | Portada honesta en `/` y galería en `/design-system` | S3 S11 | inline | ninguno | ✅ `fa66ed8` |
| T4 | Código muerto: `annotateConflicts`, `Drawer.svelte`, `MAX_GRADE`/`MIN_GRADE` | S5 S11 | inline | ninguno | ✅ `99c5f9a` |
| T5 | Una sola implementación: cookie compartida y prune sin duplicar | S6 S11 | inline | item 3 | ✅ `c29ed38` |
| T6 | `subject_aliases` fuera: migración + seed + schema | S8 S11 | inline | item 1 (datos) | ✅ `3fc41db` |
| T7 | Cierres sin código: typo, log del día desconocido, ledger, roadmap | S4 S7 S9 S10 | inline | ninguno | ✅ `e5e8c96` + este commit |

T1 y T6 caen en la lista de riesgo alto → commit propio y verificador independiente. RDD está
**off** (clone-local), así que no hubo ceremonia de revisión nativa: el gate fue `just qa-fast`
más los e2e que tocan lo cambiado.

## Log

- **L1 — 2026-10-19, petición del mantenedor, textual:** *"?En dónde nos quedamos la
  sesión pasada sobre el desarrollo de OpenSIM? Para esta sesión cualquier duda, pregunta
  o incógnita házmela saber mediante question tool."*
- **L1 — 2026-10-19, respuestas del mantenedor:** *"Atacar los 14 hallazgos abiertos"*;
  *"Restaurar 12345678 y usarla en el carril agéntico"*; *"Sí, restaurarla ahora"*.
- **L1 — 2026-10-19, decisiones de producto, textuales:** *"Mover la galería a
  /design-system y hacer de / una landing honesta"*; *"Deshabilitar los formularios y
  decirlo en pantalla"*; *"Tarjeta 'Seguridad' en el dashboard"*; *"Borrar la tabla"*.
- **2026-10-19 — La credencial de `12345678` restaurada en la D1 local.** Antes sólo
  existía `99999999`, el alumno del runner agéntico, que tiene cero filas en
  `student_progress`; por eso el test agéntico del término dio verde falso contra el
  código viejo. El carril agéntico del Tramo 2 usará `12345678`, que tiene 49 filas
  reales. Fuera de este plan. (El comando exacto y el tropiezo están al final de este
  Log: la primera vez se corrió el que aprovisiona `99999999`.)
- **2026-10-19 — Cinco hallazgos resultaron stale al verificarlos.** T12.3, T13.4, T10.1 y
  T10.0 ya estaban resueltos; T9.4 y T13.3 estaban a medias. La causa es la misma que el
  roadmap del 2026-10-15: un ledger sin reconciliar miente con
  la misma seguridad con la que dice la verdad. La verificación de este plan se hizo
  leyendo el código, no el ledger.
- **2026-10-19 — `docs/odd-protocol-chat.md` queda modificado sin commitear** desde fuera
  de esta sesión (6 líneas borradas: el bloque "## References"). No se toca: no es de este
  plan, y los commits de esta rama usan rutas explícitas para no arrastrarlo.

- **2026-10-19 — T0: un test que dependía del calendario se rompió con el calendario.** `just
  qa-fast` falló en `protected-loaders.test.ts` con `expected [ 'SCC1027', 'SCC0901' ] to deeply
  equal [ 'SCC0901' ]`. No lo había causado ningún cambio de esta rama: se reprodujo con los
  cambios en stash y el fallo siguió ahí. El fixture sembraba un bloque en `L` (lunes) mientras
  el loader pregunta al reloj real qué día es, así que la suite caía **cada lunes**. Se congeló
  `Date` (sólo `Date`, no los timers) a un miércoles fijo dentro del describe del dashboard.
- **2026-10-19 — T1: `invalidateAllSessions` ya existía, y el schema ya prometía que estaba
  implementado.** Lo que faltaba era un camino. Se añadió `POST /login/logout-all` con su test
  (`tests/unit/logout-all.test.ts`, 5 casos) y una tarjeta "Seguridad" en el dashboard.
- **2026-10-19 — T2: el action de trámites devolvía `202 Accepted` sobre un descarte.** Un
  `202` dice "lo recibí"; OpenSIM no guarda nada. Ahora los forms se renderizan deshabilitados
  (el `<fieldset disabled>` que la casa ya usaba), la razón está en pantalla antes del primer
  campo, y el action responde `501`. Probado en el navegador: `tests/e2e/tramites.spec.ts`.
- **2026-10-19 — T3: la galería se movió con `git mv`** para no perder su historia, y `/` pasó a
  ser la portada honesta. Los ocho átomos que sólo la galería consumía conservan su consumidor.
- **2026-10-19 — T5: el prune del cron no tenía ni una copia implementada.** `pruneExpiredSessions`
  no lo llamaba nadie y `pruneExpiredAttempts` sólo un test; el SQL que de verdad corre vive en
  una cadena dentro de `scripts/inject-scheduled-handler.mjs`. Se borraron los helpers y el
  comentario que pedía mantener dos copias en sincronía, y el SQL que sí se despacha ahora se
  ejecuta contra una base real en `tests/unit/scheduled-prune.test.ts` — leído del script, no
  copiado, porque una copia sería la segunda implementación que este hallazgo pedía borrar.
- **2026-10-19 — T6: `drizzle-kit generate` no servía.** Su snapshot era anterior a las
  migraciones 0015 y 0016 (escritas a mano), así que proponía rehacer el rebuild de
  `complementary_credit_activities` — el rebuild que 0016 explica por qué D1 no puede
  expressar. La migración 0017 se escribió a mano; el snapshot se regeneró (ahora sí describe el
  esquema actual) y el journal se completó con 0015, 0016 y 0017, que nunca habían entrado.
  El seed se regenera byte a byte idéntico, y el diff de `seed.sql` son exactamente las cuatro
  filas de alias y la consulta de conteo.
- **2026-10-19 — T7: el ledger quedó con 31 casillas marcadas y ninguna abierta.** Los hallazgos
  16–19 de la tabla de trazabilidad (`T12.4`, los cuatro marcadores `ponytail:`) siguen abiertos
  **a propósito**: son atajos documentados con su techo nombrado y cerrarlos es una decisión del
  mantenedor, no remediación.
- **2026-10-19 — El gate de la rama:** `just qa-fast` en verde, `just qa` con build en verde, y
  `just test-e2e` con 0 rojas. El carril agéntico no se tocó: `just e2e-dev` gasta tokens contra
  un gateway real y no es el gate de nada. (Las cifras finales, tras la tanda de corrección del
  verificador, están más abajo en este Log.)

- **2026-10-19 — Verificación independiente (`gentle-ai-verify`).** El verificador corrió sus
  propias sondas —no las de esta rama— contra el baseline `48e20d6` y la rama: 11 de 12 specs
  cumplidas con evidencia, la migración sin pérdida de filas, el prune roto a propósito para
  comprobar que su test muerde, y el `Set-Cookie` del logout **byte a byte igual** en ambos
  commits. Salieron **dos blockers**:
  - **B1 — un bug que esta rama introdujo**: `REVOCATION_NOTICES[reason]` era un índice a secas
    sobre un literal de objeto, así que `?reason=constructor` renderizaba
    `function Object() { [native code] }` en el banner del login. Ahora es un `Map`, que no
    consulta el prototipo. El test que lo caza (`tests/e2e/login-reason-notice.spec.ts`) falló
    antes del arreglo y pasó después.
  - **B2 — el ledger citaba el commit equivocado** en la casilla T12.3.
  Se corrigieron ambos en **una** tanda, junto con los advisories (conteos de filas, comentarios
  obsoletos, la variable sin usar, el doc de migraciones) y adoptando las cuatro sondas del
  verificador como tests de regresión. Recheck: `just qa-fast` 380 verdes, `just test-e2e` 150
  verdes, 0 rojos.
- **2026-10-19 — La credencial de `12345678` sí quedó restaurada, y esta vez de verdad.** La
  primera vez se corrió `just db-set-password`, que aprovisiona `99999999` por defecto —la
  credencial del suite de Playwright—, no `12345678`. El verificador lo detectó al leer la base:
  `student_credentials` tenía una sola fila. Se aprovisionó con
  `pnpm run db:set-password 12345678`, que deja las dos credenciales conviviendo: `99999999`
  para Playwright (que debe ver el estado vacío del alumno de pruebas) y `12345678` para el
  carril agéntico, que necesita datos reales.
- **2026-10-19 — Una sonda del verificador era flaky y la causa no era el código:** un click que
  cae antes de que SvelteKit hidrate la página no hace nada. En dev, con la ruta recién
  compilada, el click se perdía y el stepper no cambiaba. La sonda reintenta hasta que el paso
  cambia, y ahora corre 5 de 5.
