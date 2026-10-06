# OpenSIM Spec Audit — Pre-Implementation Review

> [!WARNING]
> **PRE-IMPLEMENTATION RECORD — SUPERSEDED BY SPEC v2.2.** This audit ran 2026-10-01 against the *pre-v2* spec (SvelteKit 2, no implementation). Every finding below was either resolved during v2.0–v2.2 or re-decided; the spec is now at v2.2 (`odd/tasks/opensim.md`). The findings (AG-1…AG-22, CF-1…CF-5) are preserved verbatim as the historical decision record — **do not read them as current state.** For current status see `odd/README.md` and `odd/tasks/opensim.md`.
>
> Since resolved: **CF-1** dual identity (`canonicalId` + `subjectAliases`), **CF-2** Cloudflare D1 + Drizzle, **CF-3** auth single-file native (`opensim.md:18`), **CF-4** budgets explicit in §12, **CF-5** screenshot count corrected to 55.

**Date:** 2026-10-01
**Source spec:** OpenSIM — SvelteKit 2 + Svelte 5 runes + native CSS tokens + DAG
**Status (original, superseded):** ~75% implementation-ready for Phase 1. **4 critical findings** + **3 imprecise sub-claims** + **22 architecture gaps** to resolve.

---

## Executive Summary

Spec is largely sound: clear FOSS principles, mathematically formalized DAG, well-structured design tokens, TypeScript types close to real data, and **6 of 7 visual diagnoses confirmed** in actual screenshots.

**Critical findings requiring decisions before Phase 1:**

1. **CF-1 SubjectNode dual identity** — `ACF-0901` (legacy, retícula) vs `ACF-2301` (modern, Listado de Grupos) both refer to `Cálculo Diferencial`. Spec uses legacy without documenting the problem.
2. **CF-2 Backend / data source** — types defined but no source strategy.
3. **CF-3 Auth library** — Magic Link mentioned, no library chosen.
4. **CF-4 Performance budgets** — "ultraligera" but no measurable targets.

**Spec inaccuracies:**

- **CF-5 Evidence inflated**: spec claims 58 screenshots analyzed; only **55** exist in the cited range (spec overcounts by 3).
- **Sub-claims imprecise**: drawer does NOT darken the screen (overlay claro + watermark, no oscurecimiento real); header has ~6 acciones not 8+; verde del Kardex pasa WCAG AA (~5:1 sobre blanco) — el sub-claim "sin contraste WCAG AA" es subjetivamente brillante pero no falla accesible.

---

## Evidence Inventory

| Item | Status |
|---|---|
| Screenshots analyzed (spec claim) | 58 |
| Screenshots actually in cited range | **55** ⚠️ |
| PDF `carga-AGO-DIC_2026.pdf` | EXISTS at `<HOME>/Descargas/` (68 KB) |
| Total historical PNGs in `~/Imágenes/Capturas de pantalla/` | 528 |

---

## Spec-Claim Cross-Check

| Module | Claim | Status |
|---|---|---|
| Auth | Corte diagonal + 3 logos (SIM, TecNM, ITM) | ✅ CONFIRMED |
| Nav | Drawer gigante con marcas de agua | ⚠️ CONFIRMED — pero **NO oscurece** la pantalla; overlay claro + watermark |
| Nav | Header con 8+ acciones sin jerarquía | ⚠️ CONFIRMED PARCIAL — **~6 acciones** reales; saturación por proximidad de 3 badges circulares |
| Perfil | Card Fatigue (>8 tarjetas) | ⚠️ CONFIRMED — **>10 cards** identificadas |
| Perfil | Skeuomorfismo de cuaderno de espiral | ✅ CONFIRMED |
| Horario | Cajas idénticas azul pastel | ⚠️ CONFIRMED en Listado de Grupos (no vista semanal pura) |
| Horario | Escala rígida | ✅ CONFIRMED (bloques 07:00–11:00 / 11:00–15:00) |
| Kardex | Verde brillante sin contraste WCAG AA | ⚠️ CONFIRMED PARCIAL — verde pasa AA (~5:1), subjetivamente brillante pero no falla |
| Kardex | Tablas fragmentadas por semestre | ✅ CONFIRMED |
| Retícula | Matriz con 7 colores de acento | ⚠️ CONFIRMED — **~5–6 colores** distinguibles |
| Retícula | Ausencia de aristas/conectores | ✅ CONFIRMED |
| Reinscripción | Tabla masiva de 203 elementos | ✅ CONFIRMED ("Mostrando 1 a 50 de 203 elementos") |
| Reinscripción | 8 botones individuales de "Enterado" | ✅ CONFIRMED |

---

## TypeScript Type Validation

### `StudentProfile` — all spec values match real data ✓

| Field | Spec value | Real value | Match |
|---|---|---|---|
| controlNumber | <NUMERO DE CONTROL PURGADO> | <NUMERO DE CONTROL PURGADO> | ✅ |
| fullName | <NOMBRE PURGADO> | <NOMBRE PURGADO> | ✅ |
| career | ISC | 2013 ESP. MATEMÁTICO APLICADO Y CÓMPUTO | ⚠️ revisar |
| planCode | ISIC-2010-224 | ISIC-2010-224 | ✅ |
| currentSemester | 7 | 7 | ✅ |
| certifiedAverage | <PROMEDIO CERTIFICADO PURGADO> | <PROMEDIO CERTIFICADO PURGADO> | ✅ |
| arithmeticAverage | <PROMEDIO ARITMETICO PURGADO> | <PROMEDIO ARITMETICO PURGADO> | ✅ |
| approvedCredits | 130 | (ver semántica below) | ⚠️ |
| advancePercentage | 50 | 50 | ✅ |

**Campos adicionales visibles no en spec:**

- `passedAverage`: <PROMEDIO PASADO PURGADO>
- `completedCredits`: 177 (vs `approvedCredits: 130` en spec)
- `curp`: <CURP PURGADO>
- `birthState`: <ENTIDAD DE NACIMIENTO PURGADA>
- `enrollmentPeriod`: AGOSTO-DICIEMBRE/2023 EXAMEN DE INGRESO
- `socialService`: IMSS

⚠️ **Discrepancia semántica**: spec dice `approvedCredits: 130`. Real muestra "**Restantes**: 130" + "Avance: 50%". El 130 parece ser **RESTANTES**, no aprobados. Real "Créditos cursados" = 177. Probablemente el spec interpretó mal el campo. **Recomendación:** renombrar a `remainingCredits: 130` y agregar `inProgressCredits: 47` (177 cursados − 130 aprobados — verificar).

### `SubjectNode` — dual identity ❌

| Source | code | name | credits |
|---|---|---|---|
| Retícula (20-13-38) | `ACF-0901` | CALCULO DIFERENCIAL | 5 |
| Listado de Grupos (20-17-53) | `ACF-2301` | CALCULO DIFERENCIAL | 5 |

**Misma materia, dos códigos.** Ver **CF-1**.

---

## Architecture Gaps

### Phase 1 blockers

| ID | Gap | Decision needed |
|---|---|---|
| AG-1 | Backend / data source unspecified | Mock JSON? Postgres+Drizzle? BaaS (Supabase/Pocketbase)? |
| AG-2 | Auth library unspecified | Lucia/oslo? Auth.js? Custom? |
| AG-3 | Component inventory shallow (6 listed) | Expand to ≥18 atomic components (Tooltip, Toast, Tabs, Dropdown, DatePicker, Avatar, ProgressBar, Skeleton, Kbd, ...) |
| AG-4 | HSL color hash unspecified | Hash function (FNV-1a?) + saturation/lightness range |
| AG-5 | Performance budgets unspecified | LCP / INP / CLS / JS bundle targets |

### Phase 2 blockers

- **AG-6** Route tree structure (`src/routes/(app)/*` — sin diseñar)
- **AG-7** Form validation library (Valibot recommended over Zod for size)

### Phase 3 blockers

- **AG-8** DAG layout algorithm (recommend: grid-by-semester + Bézier connectors)
- **AG-9** Retícula data source (ISIC-2010-224 — ¿JSON estático? ¿DB?)

### Phase 4 blockers

- **AG-10** PDF generation library (recommend: `pdf-lib` — client-side, vectorial, MIT)

### Phase 5 blockers

- **AG-11** Testing stack (recommend: Vitest + Playwright + @testing-library/svelte)
- **AG-12** Deployment target (recommend: Cloudflare Pages — FOSS-aligned, edge SSR)
- **AG-13** WCAG validation tool (recommend: axe-core en CI + Lighthouse a11y audit)
- **AG-14** Browser target (recommend: Baseline 2024+, skip IE)

### Cross-cutting concerns

- **AG-15** Multi-user roles (spec solo menciona student — ¿docentes? ¿admin?)
- **AG-16** i18n (Spanish-only explícito o futuro Paraglide JS?)
- **AG-17** Offline/PWA (relevante si campus wifi inestable)
- **AG-18** Analytics (Plausible / Umami self-hosted?)
- **AG-19** Naming convention (componentes EN: Button, content ES: Calificaciones)
- **AG-20** Error handling (`+error.svelte`, form action errors)
- **AG-21** Empty states (Tarea 4.3 menciona, debería ser regla general)
- **AG-22** Loading states (skeleton/spinner — no mencionado)

---

## What's Working Well

✅ Principios claros (no Tailwind, no Lenis, no Motion.dev, FOSS-first, ultraligera)
✅ Formalización matemática del DAG con fórmulas de Ancestors/Descendants
✅ Design tokens bien estructurados (light/dark, semánticos)
✅ TypeScript tipos cercanos a datos reales
✅ WCAG 2.1 AA como objetivo explícito
✅ Phase breakdown sigue dependencias lógicas
✅ Stack unificado (SvelteKit full-stack, sin lógica de servicios externos innecesarios)

---

## Recommended Spec Amendments

**Add Sections 9–15:**

- **§9 Decisiones técnicas pendientes** — index de decisiones por fase
- **§10 Inventario completo de componentes UI** — ≥18 atómicos
- **§11 Estrategia de datos y persistencia** — backend + model de identidad de asignaturas
- **§12 Métricas de rendimiento objetivo** — LCP/INP/CLS/JS budgets
- **§13 Convención de nombrado** — EN para componentes, ES para contenido
- **§14 Manejo de errores** — boundaries + form action errors
- **§15 Estrategia de deployment + browser target**

**Update Section 2 (Diagnóstico):**

- Nav drawer: "drawer ancho ~25% con watermark visible, overlay claro — no darkening"
- Nav header: "~6 acciones; saturación real por proximidad de 3 badges circulares contiguos"
- Kardex verde: "verde pasa WCAG AA (~5:1), subjetivamente brillante pero no falla accesible"
- Card count: ">10 cards" (no >8)

**Update Section 5 (Tipos):**

- `StudentProfile`: agregar `remainingCredits`, `inProgressCredits`, `passedAverage`, `curp`, `birthState`, `enrollmentPeriod`, `socialService`
- `SubjectNode`: agregar `legacyCode?: string` para resolver dual identity

**Update Section 7 (Plan):**

- Tarea 1.3: expandir a ≥18 componentes atómicos
- Tarea 1.4: condicionada a CF-2 (backend) + CF-3 (auth)
- Tarea 3.1: condicionada a AG-4 (color hash)
- Tarea 3.3: condicionada a AG-8 (DAG layout) + AG-9 (data source)
- Tarea 5.1: condicionada a AG-10 (PDF lib)
- Tarea 5.2: condicionada a AG-13 (WCAG tool)

---

## Evidence Source — see source of truth

- `<HOME>/Imágenes/Capturas de pantalla/` (528 PNGs, 2026-05 to 2026-10)
- `<HOME>/Descargas/carga-AGO-DIC_2026.pdf` (68 KB)
- Visual cross-check via 4 sample screenshots (login 20-02-06, drawer 20-03-19, perfil 20-04-16/21/28/34, kardex 20-08-01/05, retícula 20-13-38/44, listado 20-17-53, reinscripción 20-09-51)