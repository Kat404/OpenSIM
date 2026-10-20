<!-- odd-tracker
kind: handoff
status: active
last-verified: 2026-10-19
reconciled-against: feat/agentic-lane-real-data@2e40013 (main@48e20d6)
-->

# Handoff — lo que queda para cerrar la entrega (2026-10-19)

Documento de traspaso, no plan nuevo. Es el estado real al cierre de la sesión del 2026-10-19,
escrito para que otra sesión empiece sin releer catorce archivos. Si algo aquí contradice a un
documento anterior de `odd/`, **manda este**, porque se escribió después y con la base de datos
remota verificada.

## En una línea

Las 14 casillas vivas del ledger están cerradas y verificadas, las dos ramas están publicadas
con sus PR abiertos, y las migraciones `0015`–`0017` **ya están aplicadas** en la D1 de
producción. Falta **desplegar el worker** (el código, no la base), y quedan **tres decisiones
del mantenedor** que no son técnicas.

## Cerrado — no rehacer

| Qué | Evidencia |
| --- | --- |
| Las 14 casillas vivas | `odd/tasks/findings-remediation.md`: 31 casillas marcadas, 0 abiertas |
| Verificación independiente | `gentle-ai-verify`: 11/12 specs cumplidas; 2 blockers corregidos en **una** tanda (`d8affb9`) |
| Carril agéntico con datos reales | `odd/tasks/agentic-lane-real-data.md`: 15/15 en tres corridas seguidas, sin reintentos |
| Ramas publicadas | `chore/findings-closure` = `d8affb9` (14 commits) · `feat/agentic-lane-real-data` = `2e40013` |
| Publicación en los dos remotos | GitHub **y** Codeberg. `just push-mirror` **no** espeja: `origin` tiene un solo push URL (GitHub) y `codeberg` es un remoto aparte |
| PR abiertos | GitHub **#8** (`chore/findings-closure` → `main`) · **#9** (`feat/agentic-lane-real-data` → `chore/findings-closure`) |
| Migraciones de producción | `0015`, `0016`, `0017` aplicadas en la D1 remota y verificadas después de aplicar |
| Gates | `just qa-fast` 380 verdes · `just test-e2e` 156 verdes / 0 rojos · `just qa` con build verde |

**Nada de esto está fusionado.** `main` sigue en `48e20d6`. El merge es del mantenedor.

---

## Pendiente 1 — Desplegar el worker (lo primero)

**Por qué es lo primero.** La base de producción ya está en `0017` y el Worker sigue sirviendo
el build anterior. La base y el código están desalineados: el `scheduled` que inyecta
`scripts/inject-scheduled-handler.mjs`, el endpoint `POST /login/logout-all` y los forms de
trámites que responden `501` **no existen todavía en producción**.

**Autorización.** `just deploy-worker` es remoto y necesita autorización explícita del mantenedor
en cada corrida (AGENTS.md, "Prohibido lo remoto"). La del 2026-10-19 cubrió las migraciones,
**no** el deploy. Pedirla otra vez.

**El comando, con la trampa del `account_id`:**

```bash
# wrangler.jsonc no tiene account_id, así que wrangler responde
# "The given account is not valid or is not authorized" (7403)
CLOUDFLARE_ACCOUNT_ID=81556e2f476ba0a74c12b6a8e5394d0b just deploy-worker
```

Eso ejecuta `pnpm build` (que incluye `wrangler types && vite build && node
scripts/inject-scheduled-handler.mjs`) y después `wrangler deploy`.

**Decisión pendiente, misma raíz:** ¿se añade `account_id` a `wrangler.jsonc` para que
`just db-migrate-remote`, `just db-seed-remote`, `just db-set-password-remote` y
`just deploy-worker` funcionen **tal como están escritos**? Hoy las cuatro recetas remotas
fallan sin la variable en el entorno. Es una línea de configuración y quita una trampa
recurrente; es del mantenedor porque toca credenciales en un archivo versionado.

**Humo sobre la URL desplegada** (`https://opensim.jose-luis-rs.workers.dev`):

```bash
BASE=https://opensim.jose-luis-rs.workers.dev
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/"           # 200
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/login"       # 200
# login real: necesita Origin y devuelve 302 con Set-Cookie
curl -sS -i -X POST "$BASE/login" \
  -H 'Origin: https://opensim.jose-luis-rs.workers.dev' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'controlNumber=12345678&password=<OPENSIM_TEST_PASSWORD>' | head -20
```

El `POST /login` con `Origin` es el que prueba que el Worker novo sirve: es el que ejecuta el
`safeInternalRedirect` arreglado y el `Set-Cookie` con las opciones revisadas. Después, con la
cookie del `302`, un `GET /dashboard` debe dar `200` y no `303` a `/login`.

---

## Pendiente 2 — La credencial del demo público

**El hecho.** En la D1 remota, `student_credentials` tiene **una sola fila**: `99999999`, el
placeholder del suite de Playwright, con **cero** filas en `student_progress`. Las 49 filas de
progreso pertenecen a `12345678`, que **no tiene credencial remota**. Es decir: el demo público
muestra un alumno sin historial, y el alumno con historial no se puede entrar.

**Las dos salidas, y el coste de cada una:**

| Opción | Qué hace | Coste |
| --- | --- | --- |
| A — aprovisionar `12345678` en remoto | `OPENSIM_D1_TARGET=remote pnpm run db:set-password 12345678 <password>` | El script **rechaza** la contraseña por defecto (`opensim-dev-2026`) cuando el target es remoto: `.env` debe definir `OPENSIM_TEST_PASSWORD`. Publica datos de un alumno de catálogo en un Worker público |
| B — dejar `99999999` | nada | El demo público muestra el estado vacío. Honesto, pero no muestra el producto |

Es una decisión del mantenedor: el demo es público y sin credenciales, y la opción A expone la
trayectoria académica completa de un alumno ficticio.

**Lo que no se debe hacer:** sembrar el fixture entero en remoto (`just db-seed-remote` reescribe
filas y el catálogo de producción). Para lo que se necesita aquí sólo basta una fila de
credencial.

---

## Pendiente 3 — Los cuatro atajos `ponytail:` (respuesta a la pregunta abierta)

El mantenedor preguntó *"dime cuáles son los 4 atajos ponytail"* y quedó sin responder. Son
**cuatro marcadores de deuda deliberada** repartidos en tres archivos, y son los hallazgos
16–19 del ledger (`T12.4`). No son defectos: cada uno nombra su techo y su momento de
revisarlo. Se dejaron abiertos **a propósito**, porque cerrarlos es aceptar un coste que el
comentario difiere explícitamente.

| # | Marcador | El atajo | El techo que nombra | Cómo se cierra |
| --- | --- | --- | --- | --- |
| 1 | `src/lib/server/auth.ts:57` | El contador de rate-limit es **global** al sistema: una sola tabla, sin sharding por IP | "A tráfico adecuado es la forma correcta; partir por región-edge cuando el límite sea un punto de contención" | Partir el contador por región-edge (o por hash de IP) |
| 2 | `src/lib/server/auth.ts:118` | La clave del cubo trunca el timestamp a **1 minuto**, así que un ataque sostenido sobre una clave produce ~15 filas en 15 minutos en vez de una por intento | "Tabla más pequeña, la misma cuenta" | Rediseñar el cubo (ventana más fina o contador en memoria) |
| 3 | `src/lib/server/db/schema.ts:410` | Las filas por cubo **no tienen tope**: una cuenta con historial largo acumula una fila por ventana de 15 min | "~4 filas/día por atacante, ~1.5k filas/año; dentro del presupuesto de D1 por una década; revisitar al añadir un janitor" | Añadir el janitor que ya es el `scheduled` del cron, o un tope |
| 4 | `scripts/inject-scheduled-handler.mjs:19` | El `scheduled` se **parchea por sustitución de texto** sobre `_worker.js` en vez de usar un plugin de Vite | "~80 líneas de sustitución textual ganan a una cadena de upgrades transitivos para un parche de un método" | La dependencia `@oselvar/sveltekit-add-worker-exports`, que las Hard Rules prohíben hoy |

**Lo que hace falta para cerrarlos:** un dueño y un horizonte, no una casilla. El atajo 4 está
bloqueado por una regla del propio repo (prohibir dependencias npm nuevas) — cerrarlo es una
decisión de política, no de código.

---

## Pendiente 4 — Fusionar los PR

**PR #8** (`chore/findings-closure` → `main`, 14 commits) y **PR #9**
(`feat/agentic-lane-real-data` → `chore/findings-closure`). El orden importa: #9 se apoya en #8.
El merge es del mantenedor; nada de esto se fusionó solo.

`git push` y la apertura de los PR **no** autorizan el merge. Cada uno de los dos PR se revisa
y se fusiona por separado.

---

## Bloqueos que no dependen de esta sesión

| Bloqueo | Qué es | Quién lo resuelve |
| --- | --- | --- |
| **B4** de `odd/tasks/phase-9-unblock.md` | 29 blobs con PII quedan en las referencias de un PR muerto; GitHub no los purga con `filter-repo` | GitHub Support, con la cuenta del mantenedor |
| **Credenciales de Cloudflare** | `wrangler` pide `CLOUDFLARE_ACCOUNT_ID` en cada invocación remota | La variable de entorno, o una línea en `wrangler.jsonc` (decisión del mantenedor) |

## Cómo retomar

1. `git checkout feat/agentic-lane-real-data` (o `chore/findings-closure`; la diferencia entre
   las dos es el carril agéntico) y `git pull`.
2. Pedir la autorización remota del deploy y correr el `just deploy-worker` de arriba.
3. Correr el humo sobre la URL desplegada.
4. Decidir la credencial del demo (opción A o B) y actuar.
5. Responder si los cuatro atajos llevan dueño y horizonte, o si se acepta que sigan abiertos.
6. Fusionar #8 y luego #9, en ese orden.
7. Registrar el deploy en `odd/tasks/agentic-lane-real-data.md` y
   `odd/tasks/roadmap-2026-10-15.md`, commitear y publicar.

**No tocar:** `docs/odd-protocol-chat.md` está modificado desde fuera de la sesión del
2026-10-19. No es parte de este trabajo y no debe entrar en ningún commit.

## Log

- **2026-10-19 — Documento creado al cierre de la sesión.** Se escribió para el traspaso
  explícito del mantenedor: *"Guarda en memoria y en `odd/` lo pendiente y necesario, voy a
  abrir otra sesión"*. Recoge lo que quedó a medias: el deploy del Worker (lo primero), la
  credencial del demo público, los cuatro atajos `ponytail:` (con su respuesta) y el merge de
  los dos PR. Se verificó contra la base remota antes de escribir: las migraciones `0015`,
  `0016` y `0017` están aplicadas, `subject_aliases` ya no existe, y no se perdió ninguna fila
  de datos.
