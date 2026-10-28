<!-- odd-tracker
kind: phase-plan
status: active
last-verified: 2026-10-28
branch: feat/vite-plus-migration
delivery: work-unit commits en la rama de feature
test-runner: vp check · vp test · vp build · just test-e2e
continues: odd/tasks/ui-ux-dashboard-perfil.md (cerrada)
decide: el mantenedor (2026-10-28) — sin CI en GitHub ni protección de rama; la puerta
  sigue siendo local (lint + typecheck + tests + e2e). Esta unidad NO toca esa decisión.
-->

# Migración a Vite+ (`vp`) como toolchain unificada

Creado el 2026-10-28. El mantenedor decidió unificar el toolchain: `vp` (Vite+) sustituye a
**vite, vitest y biome** por una sola cadena (Vite/Rolldown, Vitest, Oxlint, Oxfmt, Task), de
modo que `vp check` = formato + lint + tipos y `vp test` = los tests, sobre un solo binario.

Referencia del mantenedor: `/tmp/opencode/sveltekit-en-viteplus` (un `vp create vite` para
SvelteKit) y el `AGENTS.md` que la herramienta escribe. La referencia de la herramienta:
`node_modules/vite-plus/docs` (guía `migrate.md`, `migrate-rules.md`, `vitest-v5.md`).

## Specs

### S1 — Una sola cadena de herramientas, y las recetas de `just` siguen siendo la puerta

Los scripts de `package.json` y las recetas del `justfile` deben seguir siendo la interfaz
documentada del repo (`AGENTS.md`: "todo se ejecuta por `just`"). Concretamente: `just qa-fast`,
`just test`, `just build`, `just check`, `just db-*`, `just test-e2e` siguen existiendo, con
los mismos nombres, y ahora hablan con `vp` en vez de con binarios sueltos.

Criterio: `just --list` no pierde ninguna receta; `just qa-fast` corre formato + lint + tipos +
tests; `just test` corre la suite unitaria; `just build` produce el Worker.

### S2 — El linter único es Oxlint, y el formateo conserva la convención del repo

`biome` desaparece (dependencia y `biome.json`). Su configuración se porta a los bloques
`lint` y `fmt` de `vite.config.ts`: sangría con tabuladores, ancho 100, comillas dobles,
punto y coma, comas finales. La **disciplina de orden de imports** que imponía
`assist.source.organizeImports` se conserva: si Oxlint no la impone por defecto, hay que
activarla.

Criterio: `vp check` limpio (0 errores) sobre el repo entero; el formateo no produce un diff
gratuito en todo el árbol; y el orden de imports sigue siendo el del repo.

### S3 — Los tests siguen siendo los mismos

Los 387 tests unitarios y sus 26 archivos siguen siendo los mismos: la migración reescribe
los imports `vitest` → `vite-plus/test`, no reescribe los tests. La configuración de Vitest
(`expect.requireAssertions`, el proyecto `server`, el entorno node y las exclusiones) se
conserva.

Criterio: `vp test` → 387/387 en 26 archivos, con `expect.requireAssertions` activo.

### S4 — El build sigue produciendo un Worker con el `scheduled` funcionando

**El punto más frágil de la migración.** `scripts/inject-scheduled-handler.mjs` parchea
`_worker.js` **por sustitución de texto** (es el atajo `ponytail:` #4). El motor de build
cambia (Vite+ core / Rolldown), así que la forma del bundle puede cambiar y el parche puede
dejar de aplicar — sin error visible, pero el cron `0 */6 * * *` deja de podar `auth_sessions` y
`auth_attempts`.

Criterio: `vp build` produce `.svelte-kit/cloudflare/_worker.js` con el handler `scheduled`
exportado (el script lo verifica y falla si no); el build se ejecuta igual que antes
(`wrangler types && vp build && node scripts/inject-scheduled-handler.mjs`).

### S5 — La app no cambia de comportamiento

La migración es de toolchain, no de producto: ningún `.svelte` cambia de semántica, la D1 no
cambia, los datos no cambian, y la suite de e2e (Playwright) pasa igual: 213 verdes.

Criterio: `just test-e2e` → 213 verdes / 0 rojos; las recetas de D1 local (`just db-migrate`,
`just db-set-password`, `just db-seed`) siguen funcionando.

### S6 — La documentación dice la verdad

`README.md` (la tabla de scripts y el stack), `AGENTS.md` (los comandos) y `odd/` (el índice)
deben describir el toolchain nuevo, no el viejo. `biome` no debe aparecer como herramienta
del proyecto en ningún sitio.

Criterio: `rg -n "biome" README.md AGENTS.md odd/` → sin resultados (salvo el registro
histórico del ledger, que es un hecho pasado y puede quedarse).

## Los riesgos, antes de empezar

| #   | Riesgo                                                                                                | Mitigación                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R1  | El parche textual del `scheduled` deja de aplicar con el motor nuevo                                  | S4 lo verifica en el build; si el parche falla, el script **falla** (no degrada en silencio) |
| R2  | Oxlint y Biome no tienen el mismo conjunto de reglas: lo que Biome no marcaba, Oxlint sí, y viceversa | `vp check --fix` y luego revisión manual del diff; 0 errores es la puerta                    |
| R3  | La migración reescribe 26 archivos de test (`vitest` → `vite-plus/test`)                              | Es mecánico; los asserts no se tocan y la suite lo demuestra                                 |
| R4  | `vp migrate` toca `AGENTS.md` y crea `pnpm-workspace.yaml` + el catálogo de pnpm                      | Copia de seguridad de `AGENTS.md` antes de correrlo; el diff se revisa commit a commit       |
| R5  | El motor de build cambia (Vite+ core) y el output puede diferir en tamaño/hash                        | El e2e corre contra el dev server, no contra el bundle; `vp build` + el parche son la prueba |

## Tasks

| ID  | Specs  | Ruta                                           | Estado    | Commit |
| --- | ------ | ---------------------------------------------- | --------- | ------ |
| T1  | S1, S3 | `vp migrate` + el fallout de imports/config    | cerrado | `chore(toolchain)` |
| T2  | S2     | biome → `lint`/`fmt` de Oxlint                 | cerrado | `chore(toolchain)` |
| T3  | S1, S4 | el `justfile` y el parche del `scheduled`      | cerrado | `chore(toolchain)` |
| T4  | S5     | verificación completa (gates + e2e + D1 local) | cerrado | —                   |
| T5  | S6     | README, AGENTS.md, `odd/`                      | cerrado | `docs(readme)`      |

## Lo que la migración cambió, y lo que dejó igual

| Antes                                                                              | Después                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `vite` 8.3.4 + `vitest` 5.0.5 + `@biomejs/biome` 2.5.15 + `tsx`                   | `vite-plus` 1.4.0 (Vite+ core, Vitest y Oxlint incluidos) + `vpx` para los scripts |
| `vite dev` / `vite build` / `vitest --run` / `tsx script.ts`                        | `vp dev` / `vp build` / `vp test --run` / `vpx script.ts`                          |
| `biome.json` (formatter + linter + `organizeImports`)                              | los bloques `fmt` y `lint` de `vite.config.ts` (oxfmt + oxlint)                   |
| `pnpm exec biome ci` en el justfile                                                | `pnpm exec vp check` (formato + lint)                                             |
| 27 archivos con `import … from "vitest"`                                            | los mismos 27 con `from "vite-plus/test"` — los asserts no se tocaron             |

**Lo que NO se tocó:** ni una línea de `.svelte` (oxfmt no formatea Svelte, igual que Biome),
ni los datos de la semilla (`src/lib/server/db/data/**` queda excluido del formateador: sus
bytes alimentan el `seed.sql` generado, y el `seed.sql` regenerado salió **byte a byte
idéntico**), ni los snapshots de drizzle, ni la prosa en markdown.

**La casa del formato, calibreada en `vite.config.ts`:** tabuladores, tabulación de 2, 100
columnas, comillas dobles, punto y coma, comas finales, imports ordenados y `package.json` sin
ordenar claves — la configuración de `biome.json`, traducida a los nombres del esquema de
oxfmt (`useTabs`, `tabWidth`, `printWidth`, `singleQuote`, `semi`, `trailingComma`).

## Verificación observada

| Comprobación                                                                     | Resultado                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `just vp-check` (formato + lint)                                                 | **0 errores**, 12 avisos en 165 archivos                                                                       |
| `just test` (`vp test --run`)                                                     | **387/387** en 26 archivos                                                                                        |
| `just check` (svelte-check)                                                      | **0 errores, 0 avisos**                                                                                          |
| `just build`                                                                     | ✓ `vp build` + **el parche del `scheduled` sigue aplicando** ("patched .svelte-kit/cloudflare/_worker.js")         |
| `just test-e2e`                                                                  | **213 verdes, 0 rojos**, 160 saltados (por diseño)                                                               |
| Recetas de D1 local                                                              | `db-migrate` ✓ · `db-set-password` ✓ · `db-seed` regeneró un `seed.sql` **byte a byte idéntico**                  |


## Log

- **2026-10-28 — Creado.** El mantenedor: _"Migra hacia vp como toolchain unificada por lo que
  unificaríamos vite, vitest, biome y demás"_, con la referencia de `vp create vite` para
  SvelteKit y sus logs. En la misma decisión: **no** habrá CI en GitHub ni protección de rama;
  la puerta sigue siendo local (lint + tipos + tests + e2e). Esta unidad no abre esa puerta:
  sólo cambia con qué herramientas se corre.
- **2026-10-28 — Migrada.** `vp migrate --no-interactive` reescribió los scripts (`vite dev` →
  `vp dev`, `vitest --run` → `vp test --run`, `tsx` → `vpx`), los 27 imports de `vitest` a
  `vite-plus/test`, y dejó el catálogo de pnpm (`vite` → `@voidzero-dev/vite-plus-core@1.4.0`).
  A mano: el bloque `fmt` calibrado con la casa del formato del repo (el primer `vp fmt` sin
  calibrar reescribió 149 archivos a espacios — 13k líneas de ruido — y además reformateó los
  `.md`, que oxfmt no debe tocar), la traducción de `biome.json` a `fmt`/`lint`, la receta
  `biome-check` → `vp-check` en el justfile, la eliminación de `@biomejs/biome` y de
  `biome.json`, y un helper nuevo (`src/lib/utils/form.ts`) para los cuatro avisos que eran
  defectos reales y no estilo: un campo de formulario puede ser un `File`, y `String(file)` es
  `"[object File]"`.
- **2026-10-28 — El punto más frágil, comprobado.** El parche textual del `scheduled`
  (`scripts/inject-scheduled-handler.mjs`, el atajo `ponytail:` #4) **sigue aplicando** con el
  motor nuevo: el build deja "patched .svelte-kit/cloudflare/_worker.js — scheduled handler
  added to default export" y el worker construido trae el handler. Ese era el riesgo R1 y la
  razón de que el build sea una puerta de esta unidad y no un detalle.
- **2026-10-28 — Lo que la migración NO puede dar:** oxlint no lintea `.svelte` (Biome sí
  linteaba los 53 archivos del repo con su dominio `svelte: all`). La cobertura de tipos y
  a11y de esos archivos la siguen dando `svelte-check` (en la receta `check`) y el barrido
  axe-core, pero las reglas de estilo de los `.svelte` dejan de pasar por un linter: es una
  pérdida real de cobertura y el precio de la unificación.
