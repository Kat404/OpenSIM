<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-22
branch: feat/ui-ux-dashboard-perfil
delivery: work-unit commits en la rama de feature
test-runner: just qa-fast · just test-e2e
continues: odd/tasks/delivery-handoff-2026-10-19.md (Pendiente 2 y 3 siguen abiertos)
-->

# UI/UX: dashboard, perfil y transiciones

Creado 2026-10-22 a partir de un reporte del mantenedor con capturas de pantalla. Son cinco
áreas de mejora sobre la app ya desplegada y una falla de la receta `push-mirror`. Todo lo que
este documento pide es **lo que el mantenedor pidió textualmente**; las decisiones de diseño
que el documento cierra están marcadas como tales.

## Estado del repo al abrir este plan

- `main` local y `origin/main` y `codeberg/main` están en `b5a69cc` (PR #8 y #9 fusionados).
- El Worker se desplegó el 2026-10-22 a las 15:47 y 15:50; el build vivo ya trae PR #8 y #9.
- La credencial de producción (`99999999`) usa la contraseña de `OPENSIM_TEST_PASSWORD` del
  `.env`, **no** la del README. Ver `odd/tasks/delivery-handoff-2026-10-19.md` §Pendiente 2.
- RDD está apagado a nivel de clone (`gentle-ai review mode status` → `off`). No hay review
  nativo que ejecutar; la entrega sigue la política ordinary del repo.

## Specs

### S1 — La caja de Seguridad no se desborda con el menú lateral expandido

Texto del mantenedor (verbatim):

> Cuando el menú lateral NO está colapsado y estamos en /dashboard la sección de Seguridad se
> desborda.

Criterio de aceptación: en `/dashboard`, con el menú lateral expandido (viewport ≥ 1024px), el
botón **"Cerrar sesión en todos los dispositivos"** queda dentro de la caja de contenido de su
tarjeta. La tarjeta no tiene desbordamiento horizontal (`scrollWidth <= clientWidth`) y el
botón no rebasa el borde interior de la tarjeta.

Causa conocida (verificada en el código, no supuesta): `Button.svelte` fija
`white-space: nowrap` y `Card.svelte` pone `.card__footer` en `display: flex` sin
`flex-wrap` ni `min-width: 0`. Una etiqueta larga no puede encogerse, así que el botón
empuja el pie de la tarjeta hacia la derecha.

### S2 — La misma caja, con el menú lateral colapsado, queda contenida en su tarjeta

Texto del mantenedor (verbatim):

> Cuando el menú lateral está colapsado esa misma box de seguridad de "Cerrar sesión..." se ve
> muy a la derecha y no está centrado.

Criterio de aceptación: con el menú lateral colapsado, el mismo botón queda dentro de la caja
de contenido de la tarjeta (mismo criterio geométrico que S1) y su texto queda centrado
dentro del botón, no corrido hacia un borde.

Nota de lectura: S1 y S2 son **el mismo defecto con dos anchos de columna** (la columna
`1fr` del grid del dashboard crece cuando el menú se colapsa). Se cierran juntos.

### S3 — El simulador de reinscripción no obliga a recorrer todo el contenido

Texto del mantenedor (verbatim):

> El simulador de reinscripción está bien pero para vez todo el contenido se tiene que hacer
> mucho scroll, verifica cómo corregirlo

Criterio de aceptación: en `/reinscripcion`, la lista de oferta (página de ~48 grupos) no
empuja la altura del documento: la lista se recorre dentro de su propia columna, y el bloque
**"Carga actual"** (la rejilla de 07:00–22:00, `min-height: 900px` en `SchedulePreview`) queda
acotado en altura o plegado. A 1440×900 la altura total del documento no debe pasar de ~2× la
altura del viewport.

Prohibido: quitar contenido, ocultar la rejilla de horario, ni cambiar el filtrado o la
paginación. El simulador "está bien" — lo que se corrige es el scroll.

### S4 — Animación al cambiar de página desde el menú lateral

Texto del mantenedor (verbatim):

> Añade animaciones al pasar entre páginas mediante el menú lateral

Criterio de aceptación: una navegación disparada desde el menú lateral anima la transición
(entrada/salida del contenido). La animación respeta `prefers-reduced-motion: reduce` (con
movimiento reducido no hay animación). Si el navegador no soporta la API de transiciones de
vista, la navegación sigue funcionando igual, sin animación y sin error.

### S5 — El dashboard principal no desperdicia espacio

Texto del mantenedor (verbatim):

> También siento que en el dashboard principal se desprovecha mucho espacio, verifica cómo
> mejorarlo

Criterio de aceptación: el grid principal de `/dashboard` no deja un vacío vertical grande
bajo la columna corta. El estado vacío **"Aún no tienes inscripción activa"** (que hoy vive en
la columna derecha, debajo de las tarjetas de CTA) se ubica junto al widget de clases, que es
de lo que habla ("aquí verás tus clases del día en vivo"). El grid alinea sus columnas al
inicio.

**Decisión posterior del mantenedor (2026-10-22, tras la QA visual):** el widget pasa a
mostrar **la semana completa** con el día de hoy resaltado, en vez de sólo hoy — porque un
alumno con inscripción dejaba la columna izquierda 360px más corta que la derecha, y eso no
se arregla con CSS sino con contenido. El widget se renombra **"Tu semana"** y su copy pasa a
"…aquí verás tus clases de la semana". S5 se cumple con ese nombre, no con el de "Clases de
hoy" que este documento citaba antes de la decisión.

### S6 — La página de perfil con los datos generales del estudiante

Texto del mantenedor (verbatim):

> Aún nos falta por desarrollar el profile que es donde viene en formato de tarjeta todos los
> datos generales del estudiante

Criterio de aceptación: existe una ruta protegida **`/perfil`** que presenta los datos generales
del estudiante **en formato de tarjeta**: nombre, número de control, carrera, semestre, créditos
(aprobados / restantes / en curso), promedios, porcentaje de avance, estado, servicio de salud,
periodo de inscripción y los datos de identificación (CURP, estado de nacimiento). Es alcanzable
desde el menú lateral y desde la paleta Cmd+K.

Restricción de privacidad (heredada de `(protected)/+layout.server.ts`, que recorta PII del
payload compartido): los datos sensibles **no** entran al layout; la página carga su propia fila
de perfil en su `+page.server.ts`. El estudiante de demostración es sintético (Phase 10, S5):
no hay dato de persona real detrás.

### S7 — `just push-mirror` sincroniza los dos remotos

Texto del mantenedor (verbatim):

> Verifica que el commit de HEAD de GitHub esté también en Codeberg

Hecho: `main` local estaba 33 commits atrás de `origin/main`, y por eso `git push origin main`
fue rechazado con `non-fast-forward`. Fast-forward a `b5a69cc` y `git push codeberg main` →
`codeberg/main` = `b5a69cc` = `origin/main` (verificado con `git ls-remote`).

Causa de fondo: la receta `push-mirror` sólo hace `git push origin main`, y `origin` tiene un
único push URL (GitHub). El comentario de la receta y `AGENTS.md` prometen "GitHub y Codeberg".
La receta se corrige para hacer lo que dice.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S5 | inline (padre) | cerrado | `4a4cf7c` |
| T2 | S6 | delegada (worker) | cerrado | `0f28d5a` |
| T3 | S4 | delegada (worker) | cerrado | `4dac011` |
| T4 | S3 | delegada (worker) | cerrado | `5add821` |
| T5 | S7 | inline (padre) | cerrado | `de9257e` |
| T6 | S5 (segunda vuelta) | delegada (worker) + inline | cerrado | `c1a9e2a` |
| T7 | S3 (defecto de la rejilla) | inline (padre) | cerrado | `bddd250` |
| T8 | S1 (UX del sidebar) | inline (padre) | cerrado | `954a6aa` |
| T9 | S4 (guarda `willUnload`) | inline (padre) | cerrado | `d27fefa` |
| T10 | — (documentación) | inline (padre) | cerrado | `564bfa5` |

Ruta de las unidades: `de9257e` (herramienta) → `0f28d5a` (perfil) → `4dac011` (transiciones) →
`5add821` (reinscripción) → `4a4cf7c` (dashboard) → `29c2560` (odd) → `d27fefa` (transición) →
`c1a9e2a` (semana) → `bddd250` (materia en la rejilla) → `954a6aa` (sidebar) → `564bfa5`
(README) → la revisión de la auditoría → este documento.

Decisiones cerradas aquí (para que ningún worker las reabra):

- La ruta del perfil es **`/perfil`** y la etiqueta en el menú es **"Perfil"**.
- Las tarjetas del perfil usan los componentes de `src/lib/components/ui/` que ya existen
  (`Card`, `Badge`, `Avatar`); no se crea un design system nuevo.
- La animación de S4 es una transición de contenido (fundido/desplazamiento corto), no una
  animación de las tarjetas: el movimiento va en la transición, la información no se mueve.
- El texto de la UI va en español (es-MX); el código y los comentarios en inglés.

## Verificación observada

| Comprobación | Resultado |
| --- | --- |
| `pnpm exec playwright test tests/e2e/dashboard-layout.spec.ts` (RED, código base) | **3 rojos**: el botón cruzaba el borde de la tarjeta por 34px (expandido) y 28px (colapsado); el estado vacío no estaba en la columna de clases |
| el mismo spec (GREEN, con el arreglo) | **3 verdes** × 3 proyectos de navegador |
| `just qa-fast` | verde — `svelte-check` 0/0, biome 171 archivos con 6 avisos **preexistentes** en `tests/unit/e2e-structured-output-shim.test.ts`, vitest 387/387 |
| `just test-e2e` | **198 verdes, 0 rojos**, 160 saltados (la suite de solapamiento de avatar, que por diseño corre sólo en su proyecto) |

Tres correcciones de arnés que hicieron falta (no eran defectos del producto, sino pruebas que
hablaban antes de que la página hidratara):

1. El spec del dashboard hace clic en el toggle del menú: el clic puede caer antes de que
   Svelte enganche el handler, y la barra lateral mide tan alta como el documento (el botón
   queda bajo el pliegue). Se hace `scrollIntoViewIfNeeded()` y se reintenta hasta que la
   barra se colapsa.
2. La medición se hace **después** de que terminen las transiciones CSS (`document.getAnimations()`),
   o la caja medida es un fotograma de un layout en movimiento: eso medía el botón 16px por
   fuera del borde de contenido.
3. Los specs del perfil y de la reinscripción esperan `networkidle` antes de su primera
   interacción (la paleta y la casilla del selector son de cliente).

Un hallazgo lateral, **preexistente y no tocado**: el botón de colapsar la barra lateral vive
al fondo de una barra tan alta como el documento, así que en una página que scrollea hay que
bajar hasta el final para llegar a él. Se verificó en el árbol base (sin estos cambios) que el
botón sí funciona cuando se alcanza.

## Revisión independiente

`gentle-ai-verify` sobre `b5a69cc..29c2560` (diff de 22 archivos, +1300/−33), con copia
aislada en `/tmp` y `git status` limpio antes y después. **Sin bloqueantes.** Veredicto por
spec: S1 met, S2 met, S3 met, S4 met (por código; la animación en navegador quedó sin
verificar en esa pasada), S5 met, S6 met, S7 met (documentos).

Lo que la revisión encontró, y qué se hizo con cada cosa:

| # | Hallazgo | Decisión |
| --- | --- | --- |
| F1, F2 | `max-width: 100%` en todo `Button` y `flex-wrap`/`min-width: 0` en todo pie de `Card` tocan componentes compartidos | **Revisado y aceptado**: el HTML SSR de `Button` y `Card` sale **byte a byte idéntico** al de la base (mismo nombre accesible), el prop `wrap` sólo añade la clase `btn--wrap` y no filtra ningún atributo al DOM, y los 21 call sites se enumeraron uno por uno |
| F3 | Posible interbloqueo entre `onNavigate` y `startViewTransition` | **Descartado con prueba**: con el código desplegado contra un DOM simulado, la navegación queda bloqueada hasta que el callback resuelve, y el callback espera a `navigation.complete`. Sin interbloqueo |
| F4 | En una navegación que descarga el documento, `navigation.complete` nunca resuelve: el callback queda colgado y el snapshot viejo se queda en pantalla | **Corregido**: `PageTransition.svelte` salta la transición cuando `navigation.willUnload` |
| F5 | `view-transition-name` crea bloque contenedor para los descendientes `position: fixed` | **Aceptado**: el único `position: fixed` es el `Toast`, que sólo se usa en `/design-system`, fuera del layout protegido |
| F6 | El `<div>` nuevo dentro de `<main>` | **Descartado**: ningún selector del repo depende de los hijos directos de `main` |
| F7 | `tabIndex=0` en la rejilla de horario mete un nuevo punto de tabulación | **Aceptado**: es lo que pide WCAG 2.1.1 para una región con scroll propio |
| F8 | El comando de setup del `justfile` documentaba la forma SCP de Codeberg, no la `ssh://` que está configurada (y que el mantenedor pidió) | **Corregido**: la receta documenta la forma `ssh://` |
| F9 | La cifra "28 px" del desbordamiento colapsado | **La cifra del documento es correcta**: 28.19 px contra el borde de contenido; el cálculo de la revisión comparó las posiciones de los dos botones en vez de los bordes |
| F10 | S4 no tenía prueba de navegador | **Corregido**: `tests/e2e/page-transition.spec.ts` espía `document.startViewTransition` antes de que corra el script de la app y comprueba que una navegación desde el menú lateral **sí** pide transición, y que con `prefers-reduced-motion: reduce` **no** la pide (y la navegación ocurre igual) |

Las pruebas de regresión que propuso la revisión y que **no** se escribieron (no eran
bloqueantes y las specs de e2e ya cubren el comportamiento observable): render SSR
byte-a-byte de `Button`/`Card`, la prueba de orden con DOM simulado, la aserción de que la
oferta sigue teniendo 50 filas, y la prueba de la frontera de PII del layout.

### Segunda revisión — la rama completa (`b5a69cc..HEAD`)

`gentle-ai-verify` auditó la rama entera (33 archivos, +1997/−240) en una copia aislada, con
`vitest` 387/387, `svelte-check` 0/0 y `biome` sin errores. **Sin bloqueantes.** Veredicto:
S1, S2, S3, S4, S5, S6 y S7 cumplidos, con evidencia en línea y archivo (la geometría del
botón reprobada en Chromium a 260–340px, el `weekClasses` de un alumno sin los bloques del
otro, el payload del layout sin `curp` ni `birth_state`, el HTML SSR de `Button` y `Card`
byte a byte idéntico al de la base).

Siete asesorías, y qué se hizo con cada una:

| # | Hallazgo | Decisión |
| --- | --- | --- |
| F1 | Las promesas de la `ViewTransition` nunca se leen: dos navegaciones encimadas dejan un `unhandledrejection` en la consola | **corregido**: `finished`, `ready` y `updateCallbackDone` se capturan |
| F2 | `max-width: 100%` en **todo** botón acota la caja de un botón `nowrap` y deja su etiqueta desbordando de su propio borde | **corregido**: el tope se mueve a `.btn--wrap`; un botón sin `wrap` se comporta como en la base |
| F3 | Este documento decía que el toggle del sidebar y el «—» de la rejilla seguían sin tocarse, y la tabla de tareas no incluía las unidades nuevas | **corregido**: este documento |
| F4 | S5 citaba el widget como "Clases de hoy" y el branch lo renombró a "Tu semana" | **corregido**: S5 documenta la decisión del mantenedor |
| F5 | La transición animate **toda** navegación del layout protegido, no sólo las que salen del menú lateral | **aceptado**: es un superconjunto del criterio, y acotarlo al clic del menú exigiría seguir el origen del clic |
| F6 | El `innerJoin` con `subjects` podía hacer desaparecer un bloque cuyo sujeto no estuviera en el catálogo | **corregido**: `leftJoin`, así que ningún bloque se va |
| F7 | Dos comentarios citaban el `TodayClasses.svelte` borrado | **corregido** |

## QA visual y de scroll (2026-10-22)

Método: Playwright con el Chromium del sistema, 1440×900, sesión real (`12345678` y
`99999999`), tema claro y oscuro. Por ruta se midió la altura del documento, el
desbordamiento horizontal y las regiones con scroll propio, y se tomó una captura del
principio y otra del final de cada página.

| Ruta | Alto del documento | Pantallas | Desbordamiento horizontal | Scroll propio |
| --- | --- | --- | --- | --- |
| `/login` | 981px | 1.1 | 0 | — |
| `/dashboard` | 981px | 1.1 | 0 | — |
| `/horario` | 1228px | 1.4 | 0 | — |
| `/reticula` | 1148px | 1.3 | 0 | — |
| `/academico/kardex` | 2532px | 2.8 | 0 | — |
| `/reinscripcion` | 1395px | 1.6 | 0 | lista de oferta (495→3754px), rejilla de horario (403→996px) |
| `/tramites` | 1263px | 1.4 | 0 | — |
| `/temario` | 3106px | 3.5 | 0 | — |
| `/perfil` | 900px | 1.0 | 0 | — |

**Cero desbordamiento horizontal en las nueve rutas**, y ningún elemento se sale de su
contenedor: la fuga de S1/S2 está cerrada de verdad, no sólo en la aserción.

Lo que dijo la QA de la página:

| # | Hallazgo | Estado |
| --- | --- | --- |
| Q1 | El botón "Cerrar sesión en todos los dispositivos" queda dentro de su tarjeta con el menú expandido **y** colapsado, en claro y en oscuro | **cerrado** (S1/S2) |
| Q2 | El demo sin inscripción (el caso de la captura del mantenedor) deja un vacío grande bajo la columna corta | **cerrado**: el estado vacío pasó a la columna de clases; las columnas miden 474px y 388px y el documento cabe en una pantalla (900px exactos) |
| Q3 | Un alumno **con** inscripción sigue dejando ~360px de vacío bajo "Clases de hoy": la columna izquierda tiene un widget y la derecha tres tarjetas | **cerrado en la segunda vuelta**: el mantenedor decidió que el widget mostrara **la semana completa** (`c1a9e2a`), y el vacío bajó a 168px (columnas de 767px y 599px) |
| Q4 | Las tarjetas de `/perfil` en una misma fila acababan en un borde desigual (la de Créditos cuelga 110px) | **cerrado** (`84aeac4`): la fila comparte altura |
| Q5 | **Preexistente**: en la rejilla "Carga actual", cada bloque inscrito muestra "—" en vez del código y el nombre de la materia. El loader de `/reinscripcion` trae los bloques sin `subjectCode`/`subjectName` y el componente los busca en la página de oferta del periodo, que no los contiene (`blockToPreview`, `src/lib/components/simulador/EnrollmentSimulator.svelte:97`, igual en `b5a69cc`) | **cerrado** (`bddd250`): el bloque lleva su propia materia (join por el grupo) y una spec lo fija |
| Q6 | **Preexistente**: el botón que colapsa la barra vive al fondo de una barra tan alta como el documento, así que en toda página que scrollea hay que bajar al final para alcanzarlo. Se verificó en `b5a69cc` que el botón funciona cuando se llega a él | **cerrado** (`954a6aa`): la columna se pega al viewport |
| Q7 | `/temario` (3.5 pantallas) y `/academico/kardex` (2.8) son largos porque **listan** catálogos (68 materias, el historial completo) | **reportado**: es contenido, no layout. Plegar la lista de las 61 materias sin temario, o paginarla, es una decisión de producto |

## Log

- **2026-10-22 — Creado con el reporte del mantenedor.** Llega con el fallout de dos hechos
  del mismo día: los PR #8 y #9 se fusionaron (y `main` local quedó atrás, rompiendo
  `just push-mirror`), y el mantenedor reporta cinco áreas de mejora visual sobre el Worker
  ya desplegado, con capturas. Las cinco áreas van textuales arriba, verbatim, porque así las
  pidió.
- **2026-10-22 — S7 cerrado.** `main` local estaba 33 commits atrás de `origin/main`; por eso
  `git push origin main` fue rechazado con `non-fast-forward`. Fast-forward a `b5a69cc` y
  `git push codeberg main` → los dos remotos en `b5a69cc`. La causa de fondo es que `origin`
  llevaba **un solo** push URL: un `git push` a secas nunca llegaba a Codeberg. Se le dieron
  los dos (`git@github.com:Kat404/OpenSIM.git` y `ssh://git@codeberg.org/Kat404/OpenSIM.git`),
  y la receta y `AGENTS.md` ahora dicen cuál es cuál y con qué comando se configura.
- **2026-10-22 — S1, S2 y S5 cerradas.** La causa del desbordamiento está medida, no supuesta:
  el pie de la tarjeta es una fila flex y una fila flex no encoge una etiqueta `nowrap`, así
  que el botón empujaba el pie fuera de la tarjeta. Se añadió `wrap` al `Button` (una
  opcional, no un cambio de contrato) y `flex-wrap`/`min-width: 0` al pie de la `Card`. El
  estado vacío de inscripción se movió junto a "Clases de hoy", que es de lo que habla.
- **2026-10-22 — S6 cerrada.** `/perfil` carga su propia fila de `student_profiles`: el layout
  compartido recorta PII a propósito, y la página no rompe esa regla. Cinco tarjetas, entrada
  en el menú y en la paleta, spec de Playwright y barrido de axe-core como cualquier otra ruta
  protegida.
- **2026-10-22 — S4 cerrada.** `onNavigate` + la API de transiciones de vista. La animación
  usa los tokens de movimiento, que el bloque `prefers-reduced-motion` ya pone en 0ms; un
  navegador sin la API navega igual.
- **2026-10-22 — S3 cerrada.** La lista de oferta y la rejilla "Carga actual" tienen su propio
  scroll; el panel de filtros queda fijo. No se quitó ni se re-paginó nada.
- **2026-10-22 — QA visual y de scroll.** Nueve rutas medidas con Playwright en 1440×900, claro
  y oscuro, con capturas del principio y del final de cada una. Cero desbordamiento horizontal
  en las nueve. Se cerraron Q2 (el vacío del demo) y Q4 (la altura de las tarjetas del perfil);
  Q3 quedó abierto con su diagnóstico, y Q5–Q7 se reportan como preexistentes o de producto.
- **2026-10-22 — Segunda vuelta, con lo que decidió el mantenedor.** Q3: el widget del panel
  pasa a mostrar **la semana completa** con el día de hoy resaltado (`c1a9e2a`); el dato sale
  del mismo enrolment y de la misma consulta de materias que usa `/horario`. Q5: la rejilla
  "Carga actual" nombra la materia de cada bloque (`bddd250`). Q6: la barra lateral se pega
  al viewport y su botón de colapso queda siempre alcanzable (`954a6aa`). T10: el README dice
  qué contraseña escribe el seeder de verdad (`564bfa5`).
- **2026-10-22 — La D1 de producción tenía la identidad anterior a la corrección de
  privacidad.** `student_profiles.12345678` seguía con "Ana Gabriela Hernández Ruiz" y el CURP
  `HERA000615MMNRZNA3`, los valores que el commit `5e2e936` sustituyó por unos sintéticos en el
  fixture — el seed es un upsert por `control_number`, así que la base remota nunca se enteró.
  Con la credencial de `12345678` aprovisionada (decisión del mantenedor), esa fila era
  alcanzable por login. Con su autorización explícita se sincronizó a la identidad sintética
  (`full_name` → "Sofía Ramírez Aguirre", `curp` → `RAGA000615MMZNRX3`), los mismos valores que
  la D1 local) y se comprobó que el nombre viejo no queda en ninguna columna de texto de la
  base remota.

