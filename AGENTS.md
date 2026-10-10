# AGENTS.md - Bitácora de Ejecución

## Contexto

Repositorio todo-en-uno **OpenSIM**: opción FOSS al SIM original del Instituto
Tecnológico de Morelia. Un solo mantenedor; los agentes no deben adivinar el tooling.

**Stack:** SvelteKit 3 + Svelte 5 · Cloudflare Workers · D1 (SQLite) vía Drizzle ·
pnpm · Biome (formato + lint) · vitest · Playwright + axe-core · runner e2e agéntico
(MiniMax-M3 al navegador real, configurado en `e2e.config.ts`) · Codegraph.

## Patrones y Guía de Ejecución

### Búsqueda e Indexado de Código

- Siempre que requieras y quieras buscar cualquier fragmento de código haz de _Codegraph_ tú método principal y favorito. Codegraph permite indexar y buscar de manera semántica y natural porciones de código grande.
- Para búsqueda menos extensa y con un alcance más específico haz uso de _ripgrep_ (mediante 'rg') como una mejora exponencial de rendimiento de _grep_.
- Como último recurso haz uso de _grep_.

### Datos & Privacidad

- Siempre que vayas a tratar con datos personales pregunta al usuario mantenedor qué se deberían hacer con dichos datos, debido a que sería un riesgo grave a la privacidad subirlos en remoto.
- Cumple el requisito anterior aún si los datos no parecen ser completamente personales o que involucren a primeras o terceras personas.

### Comandos: usa los que existen

Todo se ejecuta por `just`; `just --list` es la lista real. Una receta que no
aparece ahí no existe y no la debes inventar en un reporte.

| Receta | Qué hace |
| --- | --- |
| `just qa-fast` | `check` + `biome-check` + `test`. El gate de pre-commit; **no** incluye e2e. |
| `just qa` | Lo anterior más `build`. El gate de pre-push. |
| `just test` | Sólo vitest. |
| `just test-e2e` | Playwright + axe-core contra la D1 local existente. **No destructiva**: migra y aprovisiona la credencial, no borra nada. |
| `just test-e2e-fresh` | Lo mismo desde una base limpia. **Destructiva**: borra `.wrangler/state/v3/d1`, re-migra y re-siembra. Sólo cuando la base local está realmente mal. |
| `just test-e2e-ui` | Playwright en modo interactivo (`--ui`). |
| `just test-e2e-avatar` | Suite Playwright de solapamiento de avatar (AC6-AC11, 80 corridas). El spec no usa auth, pero los proyectos que lo corren dependen del proyecto `setup`, así que autentica como el estudiante de prueba. |
| `just e2e-dev` | Runner e2e agéntico, headless. El runner levanta y baja `pnpm dev` él mismo. |
| `just e2e-web` | Igual con `--headed`, para depurar viendo el navegador. |
| `just db-migrate` · `just db-set-password` | Migrar / aprovisionar la credencial en la D1 local. Los dos son idempotentes: re-ejecutarlos es seguro. |
| `just db-seed` | Sembrar el catálogo y el estudiante del fixture (`12345678`). Determinista para ese estudiante y no destructivo para las credenciales, pero **reescribe** sus filas: no es un no-op si las editaste a mano. |

Cuál usar: `test-e2e` es el default porque no tira el trabajo del mantenedor;
`test-e2e-fresh` sólo cuando se sospeche de la base local. `qa` no corre e2e, así que un
`just qa` en verde no dice nada sobre el navegador: los e2e se corren aparte.
`e2e-dev` / `e2e-web` gastan tokens contra un gateway real y son lentos; no los
conviertas en el chequeo de cada cambio. Ojo: esas recetas aprovisionan la credencial
desde `OPENSIM_TEST_PASSWORD`, pero el runner agéntico inicia sesión con
`E2E_USER_ALUMNO_PASSWORD` de `.env`. Son dos ajustes independientes — nada obliga a
que coincidan, y si no coinciden el run falla en el login.

### Prohibido lo remoto

`just db-migrate-remote`, `just db-seed-remote`, `just db-set-password-remote` y
`just deploy-worker` tocan la D1 de producción o despliegan el Worker. Requieren
autorización explícita del mantenedor **cada vez**, sin excepción. Una autorización
de una corrida anterior no autoriza la siguiente, y "el plan lo pedía" tampoco.

Además, dos recetas más son remotas aunque no destruyan nada: `just logs`
(`wrangler tail`, los logs de producción del Worker desplegado) y `just push-mirror`
(`git push origin main`, que publica en GitHub **y** en Codeberg). Piden autorización
en los mismos términos. El resto de las recetas es local — pero la lista real es
`just --list`, no esta frase.

El D1 que hay en producción es de pruebas/demo, para que alguien pueda ver OpenSIM
funcionando sin instalarlo; no está diseñado para crecer. Esa es también la razón
de la prohibición: un `db-seed-remote` equivocado no se nota hasta que el demo
público ya no arranca.

### Actualización & Seguimiento

- Siempre que hagas cualquier cambio de código (no `docs/`) pasa por los comandos de arriba: `just qa-fast` como mínimo, más los e2e que toquen lo que cambiaste.
- Siempre que cambies partes del código, avances con tareas, planeaciones y demás actualiza `odd/` si es que hay un plan ODD para lo que ya ejecutaste.
- Guarda y/o actualiza en memoria Engram lo anterior. Este paso es _obligatorio_ se tenga o una planeación ODD.
- **Umbral del subagente de auditoría.** Lánzalo, *después* de que `qa-fast` y los e2e estén verdes, cuando el diff: (a) toque migraciones en `drizzle/**`, (b) toque código de auth o de credenciales, (c) toque `wrangler.jsonc` o cualquier receta remota, o (d) abarque ≥2 archivos de código (bajo `src/`, `tests/`, `drizzle/` o configuración ejecutable), excluyendo comentarios y `docs/`, o ~400 líneas escritas. El resto no lo amerita. La auditoría debe producir: los hallazgos con archivo y línea, la razón por la que cada uno importa, y qué se rompió o no se rompió con evidencia — no un "se ve bien".

## Disclaimer

Ver `README.md` para el propósito del proyecto; el código es de dominio público bajo [The Unlicense](https://unlicense.org).
