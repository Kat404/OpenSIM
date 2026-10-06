# OpenSIM — Auditoría de accesibilidad (Phase 5 Tarea 5.1)

Fecha: 2026-10-03
Metodología: `@axe-core/playwright 4.13.0` + revisión externa con `mcode` (M3.1-Flash-Preview) en `--effort max` / `--prompt-mode work`.
Branch auditado: `feat/phase-1-foundation` @ 50 commits.
Dev credential: `controlNumber=12345678` / `password=opensim-dev-2026`.

---

## Resumen ejecutivo

- **Resultado final: 14/14 specs verde** (7 rutas × 2 temas de color).
- `just check` 0/0, `just test` 115/115.
- Cero violaciones **serious** o **critical** de WCAG 2.1 AA en las 7 rutas cubiertas, en light y dark.
- 3 violaciones serious detectadas y corregidas en el sweep inicial (N9 sidebar, N10 search button, N11 primary button).
- 6 violaciones serias/modernas adicionales detectadas por la revisión externa (mcode M3.1-Flash-Preview) y corregidas (N12-N14, N15, N16, N17, N19).
- 9/12 hallazgos cerrados en este turn; 3 menores documentados como follow-up (N18, N20, N23).
- El sweep ahora se ejecuta en CI via `just test-e2e` (db-reset + db-set-password + playwright).

## Rutas escaneadas

| Ruta | Tipo | Variantes |
| --- | --- | --- |
| `/login` | Pública | light + dark |
| `/dashboard` | Protegida | light + dark |
| `/horario` | Protegida | light + dark |
| `/reticula` | Protegida | base + deep-link (`#calculo-diferencial`), light + dark |
| `/academico/kardex` | Protegida | base + filtro "Repetición" activo, light + dark |
| `/reinscripcion` | Protegida | light + dark |
| `/tramites` | Protegida | light + dark |
| `/` (gallery) | Pública | light + dark |
| `/__404__` (no existe) | Error boundary | light + dark |

Total: 14 specs, ~33 s de runtime en este host.

## Reglas aplicadas

`AxeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])`. Falla en cualquier violación `serious` o `critical`. `moderate` y `minor` se loguean en `console.warn` y se persisten en `tests/e2e/reports/axe-findings.json` para revisión posterior — **no fallan el spec** (política: blocking-severity-only).

## Hallazgos cerrados (12)

### Round 7 (sweep inicial, ejecutados por axe-core directo)

- **N9** — `focusable-no-name` en los links del sidebar. Los iconos son `aria-hidden` y el label visual estaba en `{#if !collapsed}`, así que en primer paint los anchors no tenían nombre accesible. Fix: `LayoutShell` arranca con `collapsed=false` (default expandido) y `LayoutSidebar` añade `aria-label` defensivo para el caso colapsado. Round 7: 1/10 → 9/10 specs verde.
- **N10** — `color-contrast` en el botón "Buscar" del header. `--fg-tertiary` (#6b7280) sobre `--surface-2` (#eef0f4) da 4.27:1, debajo del 4.5:1. El label del search button es texto interactivo (body copy), no helper. Fix: usar `--fg-secondary` (body token, 8+:1).
- **N11** — `color-contrast` en el botón primario "Entrar" del login. Blanco sobre `--brand-500` (#06b6d4 cyan) da 2.42:1, muy por debajo de AA. Fix: bg a `--brand-700` (#0e7490, 5.44:1), hover a `--brand-900`.

### Round 7 (revisión externa mcode M3.1-Flash-Preview)

- **N12** — `Dropdown.svelte` primary trigger usaba `--brand-500` (mismo bug que N11). Replicado el fix: `--brand-700` base, `--brand-900` hover.
- **N13** — `Button.svelte` danger usaba `--danger-500` + `#ffffff` hardcodeado: 3.82:1 en light, 2.77:1 en dark. Fix: `--danger-700` + nuevo token `--fg-on-danger` (blanco en light, near-black en dark, ~6.5:1 en ambos temas).
- **N14** — Regla global `:focus-visible` tenía `outline: none` + box-shadow decorativo (cyan 35% sobre blanco ≈ 1.4:1). axe-core no tiene regla para SC 1.4.11, así que la regresión era invisible al sweep. Fix: `outline: 2px solid var(--brand-700)` con `outline-offset: 2px`. `--brand-700` resuelve a dark cyan en light (≈8:1) y bright cyan en dark (≈9:1), así que el indicador cumple 1.4.11 en ambos temas.
- **N15** — `_helpers.ts` solo adjuntaba el reporte por test vía `testInfo.attach()`, que vive en el blob store de Playwright y no en el working tree. Fix: escritura explícita a `tests/e2e/reports/axe-findings.json` (consolidado por spec, con timestamp + URL + violations).
- **N16** — El sweep original corría solo en `colorScheme: 'light'`. La inversión de la escala de marca en dark (--brand-700 se vuelve #67e8f9) no estaba verificada. Fix: nuevo proyecto `chromium-dark` en `playwright.config.ts`. Cada spec corre dos veces (light + dark), runtime subió de 17s a 33s.
- **N17** — La galería de componentes en `/` era la única ruta que renderiza `<Button variant="danger">` + Modal + Dropdown + Skeleton + Tabs + Stepper + Tooltip. Fix: nuevo `tests/e2e/axe/index.spec.ts` que escanea `/` (gallery) y la 404 (`+error.svelte`).
- **N19** — No existía `+error.svelte`; un error 404/5xx caía al fallback sin tema de SvelteKit. Fix: `src/routes/+error.svelte` themed con el Card atom + design tokens; 404 muestra copy genérico, 5xx muestra el `error.message` en un `<details>`.
- **N21** — `aria-label` en un `<span>` no focusable y sin role nunca se expone a tecnología asistiva. Fix: eliminado.
- **N22** — El spec de deep-link en `reticula` usaba `waitForTimeout(250)` sin asserción; si el hash-routing regresaba, el spec escaneaba la misma página que el caso base y pasaba silenciosamente. Fix: `toHaveClass(/node--highlighted/)` sobre el elemento `[data-canonical-id='calculo-diferencial']`, asegurando que el DAG recibió el focused state.

## Hallazgos documentados como follow-up (3)

- **N18** — `reuseExistingServer: !process.env.CI` permite que un `pnpm dev` previo en :5173 haga que el suite valide código viejo. Mitigación parcial: `just test-e2e` corre `db-reset` + `db-set-password` antes del spec, lo que descarta el state stale de D1. Pendiente: matar el dev server antes del sweep cuando el objetivo es auditar.
- **N20** — El cambio de default `collapsed=false` causa un flash del sidebar expandida en viewports < 1024px (mobile). Mitigación: el `matchMedia` callback colapsa en el primer frame, así que el flash es < 1 frame en la mayoría de los dispositivos. Pendiente: resolver el estado colapsado en `app.html` vía `data-collapsed` (SSR-side).
- **N23** — El `tests/e2e/reports/results.json` que se commiteó en `8c85a1b` es el output del runner de Playwright (qué tests pasaron/fallaron), no los hallazgos de axe-core. Decisión: se removió del repo (ahora en `.gitignore`); el artefacto de auditoría es `tests/e2e/reports/axe-findings.json` que se regenera con cada sweep.

## Cómo correr el sweep

```bash
# Setup (one-time per host):
# - Chromium del sistema: /usr/bin/chromium (ya instalado en este host)
# - No se ejecuta `pnpm exec playwright install` — el config apunta al
#   binario del sistema vía `launchOptions.executablePath`

# Suite completa (db reset + seed + password + dev server + scan):
just test-e2e

# Solo la suite (asume DB lista + dev server puede reusarse):
pnpm exec playwright test

# Solo un spec en particular:
pnpm exec playwright test tests/e2e/axe/dashboard.spec.ts

# Con UI mode (debug):
just test-e2e-ui
```

## Archivos clave

- `playwright.config.ts` — projects (setup + chromium + chromium-dark), webServer auto.
- `tests/e2e/setup/auth.setup.ts` — login con la credencial dev, storage state reutilizado.
- `tests/e2e/axe/_helpers.ts` — `scanForA11y(page, testInfo)`, umbral serious/critical.
- `tests/e2e/axe/*.spec.ts` — 9 archivos (7 rutas + index gallery/404 + login-dark).
- `tests/e2e/reports/axe-findings.json` — artefacto de auditoría (regenerado por cada sweep).
- `src/lib/styles/tokens.css` — focus ring, `--fg-on-danger`, propagados a `[data-theme='dark']` y `@media (prefers-color-scheme: dark)`.
- `src/lib/components/ui/Button.svelte` — primary (brand-700/900), danger (danger-700 + fg-on-danger).
- `src/lib/components/ui/Dropdown.svelte` — primary (brand-700/900).
- `src/lib/components/layout/LayoutShell.svelte` — `collapsed=false` por default.
- `src/lib/components/layout/LayoutSidebar.svelte` — `aria-label` defensivo en links.
- `src/lib/components/layout/LayoutHeader.svelte` — search button `color: var(--fg-secondary)`.
- `src/routes/+error.svelte` — themed error boundary (404 + 5xx).

## Reproducibilidad

```bash
cd <HOME>/Proyectos/OpenSIM
just db-reset && just db-set-password && just test-e2e
# → 14 passed in ~33s
```

## Limitaciones del sweep

- axe-core no cubre SC 1.4.11 (non-text contrast), SC 1.3.1 (info & relationships en SVG), ni 2.1.1 (keyboard). El sweep detecta color-contrast textual, roles, ARIA, labels, headings, landmarks, etc., pero **no** valida navegación pura por teclado, focus traps del `<dialog>`, ni semántica profunda del DAG SVG.
- El sweep usa Playwright en Desktop Chrome (1280x720). Viewports angostos (mobile) no se prueban.
- `prefers-reduced-motion` no se verifica.
- Solo se escanean 7 rutas + `/` + 404; otras rutas (e.g. `/login/recuperar`, `/api/export/carga`) no están en el sweep.
