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
| T13.4 | `subject_units` nunca se selecciona | **falso**: lo lee `/temario/+page.server.ts`; `seed.sql` tiene 35 filas | **stale** |
| T13.5 | `subject_aliases` se escribe y nunca se lee | vivo: 3 filas legacy, ni un SELECT | **vivo** |
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
trae 35 filas. No hay nada que cambiar.

### S8 — `subject_aliases` se va

> Decisión del operador, 2026-10-19, textual: *"Borrar la tabla"*.

La tabla guarda tres códigos legacy del SIM que nadie lee, al contrario que
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

| # | Task | Specs | Ruta | Riesgo |
| --- | --- | --- | --- | --- |
| T1 | Revocar todas las sesiones: endpoint + tarjeta "Seguridad" en el dashboard | S1 S11 | inline | item 2 (auth) |
| T2 | Trámites honestos: forms deshabilitados + aviso previo | S2 S11 | inline | ninguno |
| T3 | Portada honesta en `/` y galería en `/design-system` | S3 S11 | inline | ninguno |
| T4 | Código muerto: `annotateConflicts`, `Drawer.svelte`, `MAX_GRADE`/`MIN_GRADE` | S5 S11 | inline | ninguno |
| T5 | Una sola implementación: cookie compartida y prune sin duplicar | S6 S11 | inline | item 3 |
| T6 | `subject_aliases` fuera: migración + seed + schema | S8 S11 | inline | item 1 (datos) |
| T7 | Cierres sin código: typo, log del día desconocido, ledger, roadmap | S4 S7 S9 S10 | inline | ninguno |

T1 y T6 caen en la lista de riesgo alto → commit propio, verificador independiente, y
`gentle-ai review assess` con `--escalate-item`.

## Log

- **L1 — 2026-10-19, petición del mantenedor, textual:** *"?En dónde nos quedamos la
  sesión pasada sobre el desarrollo de OpenSIM? Para esta sesión cualquier duda, pregunta
  o incógnita házmela saber mediante question tool."*
- **L1 — 2026-10-19, respuestas del mantenedor:** *"Atacar los 14 hallazgos abiertos"*;
  *"Restaurar 12345678 y usarla en el carril agéntico"*; *"Sí, restaurarla ahora"*.
- **L1 — 2026-10-19, decisiones de producto, textuales:** *"Mover la galería a
  /design-system y hacer de / una landing honesta"*; *"Deshabilitar los formularios y
  decirlo en pantalla"*; *"Tarjeta 'Seguridad' en el dashboard"*; *"Borrar la tabla"*.
- **2026-10-19 — La credencial de `12345678` restaurada en la D1 local** con
  `just db-set-password` (idempotente). Antes sólo existía `99999999`, el alumno del
  runner agéntico, que tiene cero filas en `student_progress`; por eso el test agéntico
  del término dio verde falso contra el código viejo. El carril agéntico del Tramo 2
  usará `12345678`, que tiene 49 filas reales. Fuera de este plan.
- **2026-10-19 — Cinco hallazgos resultaron stale al verificarlos.** T12.3, T13.4, T10.1 y
  T10.0 ya estaban resueltos; T9.4 y T13.3 estaban a medias. La causa es la misma que el
  roadmap del 2026-10-15: un ledger sin reconciliar miente con
  la misma seguridad con la que dice la verdad. La verificación de este plan se hizo
  leyendo el código, no el ledger.
- **2026-10-19 — `docs/odd-protocol-chat.md` queda modificado sin commitear** desde fuera
  de esta sesión (6 líneas borradas: el bloque "## References"). No se toca: no es de este
  plan, y los commits de esta rama usan rutas explícitas para no arrastrarlo.
