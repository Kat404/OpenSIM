# Phase 6 — UI/UX Polish (post-deploy live feedback)

**Feature:** `phase-6-ui-polish`
**Branch:** `feat/phase-1-foundation` (continuing — same default as Phase 5)
**Goal:** Resolve 4 UI/UX issues observed by el maintainer on the live production deployment (`https://opensim.jose-luis-rs.workers.dev`) on 2026-10-03. All 4 are **non-blocking** but visibly degrade the first-impression polish.
**Status:** Draft — awaiting sign-off.

---

## Context

- OpenSIM v1.2 is live on `main`, deployed via Cloudflare Pages → Workers + ASSETS adapter.
- Production URL: `https://opensim.jose-luis-rs.workers.dev` (Workers.dev subdomain; custom domain pending).
- 0 critical a11y violations post-Phase 5.1 (axe-core 14/14 routes green), 0 XSS, 0 CSRF, 0 PII leaks.
- 4 polish items surfaced during the user's first walkthrough. None are bugs per se; all are refinements.

---

## Findings (4, ordered by visual impact)

### U1 — Badge "Marca" desentona en dark mode (white background)

**Visual evidence (Image 1 from user):** The "Marca" badge in the activity legend shows a pure-white background even in dark mode, while the other badges ("Neutral" = dark slate, "Aprobado" = green tint) respect the theme.

**Why it looks wrong:** The badge is rendered with a static white/light surface token that doesn't map to a dark variant. It looks pasted-in, not part of the system.

**Reference:** Notion's brand badges use a soft brand-tinted background (`brand/5-10% alpha`) with the brand color as the text foreground, in both themes. The hue is the brand, the luminosity comes from the surface.

**Fix:**
- `src/lib/components/kardex/KardexTable.svelte` (evalCell) or wherever the "Marca" legend lives — likely `StatusLegend.svelte` or inline in the kardex page
- Replace the hardcoded light/white surface with `--brand-100` (light) / dark surface tint equivalent; keep text as `--brand-700` (light) / `--brand-300` (dark)
- Add a `MapPin` icon from `lucide-svelte` before the label (per user request) so the badge carries semantic weight, not just text

**Acceptance criteria:**
- [ ] Badge background matches the active theme (no pure white in dark)
- [ ] Map pin icon visible to the left of the label, using `currentColor` so it inherits the brand hue
- [ ] AA contrast ≥ 4.5:1 in both light and dark
- [ ] `pnpm test` still green; no new Vitest required (visual only)

**Effort:** ~5 lines, 1 file, no new deps.

---

### U2 — Progress bar "Sincronizando" animation is too fast / abrupt

**Visual evidence (Image 2 from user):** The progress bar under "Sincronizando" jumps quickly to ~90% and the final segment feels abrupt rather than smooth. Looks like a CSS transition with too-short duration or a JS update interval that's too coarse.

**Why it feels wrong:** Real progress indicators should ease into completion. A 50% bar that snaps to 90% in 100ms looks glitchy, especially in dark mode where motion is more visible.

**Fix:**
- `src/lib/components/ui/ProgressBar.svelte` (or wherever the sync bar lives — search for "Sincronizando" string)
- Slow the `transition: width` from the current value (likely `200ms ease-out` or similar) to `~600-800ms cubic-bezier(0.4, 0, 0.2, 1)` (Material standard easing)
- If a JS-driven value (via `$state`), debounce the updates or use an `ease-out` interpolation in a `$derived`
- Add a subtle pulsing glow at the leading edge (optional, see Notion's pattern)

**Acceptance criteria:**
- [ ] Bar transitions from 0% to 100% over ~600-800ms with `cubic-bezier(0.4, 0, 0.2, 1)`
- [ ] No visible "jumps" when value updates
- [ ] Honors `prefers-reduced-motion` (instant transition for users with reduced motion preference)

**Effort:** ~10 lines (CSS transition + reduced-motion media query), 1 file.

---

### U3 — Activity status indicator position (Avatar overlap pattern)

**Visual evidence (Image 3 from user):** The activity dot (green in Image 3) is currently **inside** the profile picture's constrained area, which limits the avatar's actual content to a smaller circle than the container.

**Visual goal (Image 4 from user):** The activity indicator should sit **on the lower-right edge of the profile picture, overlapping it externally** (think: WhatsApp/Telegram/Slack online dot pattern). The avatar's actual content gets the full diameter, and the status dot is a separate `~25-30%` of the avatar diameter circle positioned at `bottom: 0; right: 0` (or with a small negative offset so it straddles the edge).

**Why it matters:** The current pattern wastes visual real estate and makes the avatar feel cramped. The standard pattern (WhatsApp, Slack, iOS contacts) communicates presence without sacrificing identity readability.

**Fix:**
- `src/lib/components/ui/Avatar.svelte` (the atomic component, used in LayoutHeader for the user chip)
- Wrap the avatar's content div in a `position: relative` container
- Add a `<span class="avatar__status">` positioned `absolute; bottom: 0; right: 0; transform: translate(25%, 25%); width: 30%; height: 30%; border-radius: 50%; border: 2px solid var(--surface-1); background: var(--status-success);`
- Add a `status?: 'online' | 'away' | 'offline' | 'busy'` prop
- Update the existing `LayoutHeader.svelte` use site to pass a status

**Acceptance criteria:**
- [ ] Status dot visible at lower-right edge, overlapping the avatar boundary by ~25-30%
- [ ] Dot has a 2px border in the surface color so it visually "punches through" the avatar
- [ ] Works in both themes
- [ ] When no status prop is passed, dot is hidden (don't force it)
- [ ] Accessible: `aria-label="Estado: en línea"` on the dot

**Effort:** ~20 lines, 2 files (Avatar + LayoutHeader).

---

### U4 — Icon-text vertical alignment in buttons/boxes

**Visual evidence (Image 5 from user):** The icons in the "Guardar" and "Eliminar" buttons sit ~1-2px higher than the text baseline. This is a classic `align-items: center` flex issue when the icon's intrinsic vertical metrics differ from the text's.

**Why it happens:** When `display: flex; align-items: center` is used, the children are centered by their `vertical-align: baseline` of the first line of text. SVG icons (especially `lucide-svelte` at `stroke-width: 2`) often have a different visual center than the text's x-height, so the optical result is a slight upward offset of the icon.

**Fix:**
- `src/lib/components/ui/Button.svelte` (or whichever wrapper renders the Guardar/Eliminar buttons — likely the kardex page form actions)
- Add `vertical-align: middle` to the icon `<svg>` (some browsers respect this inside flex)
- OR add `transform: translateY(0.125em)` (≈2px on 16px font) to the SVG to align the icon's optical center with the text's x-height
- OR use `display: flex; align-items: baseline; gap: 0.5em` and add `transform: translateY(0.05em)` to the icon for a baseline-aligned look
- The most robust solution: wrap the icon in `<span class="btn__icon">` with `.btn__icon { display: inline-flex; align-items: center; }` so the SVG centers within its own box and the box centers within the button

**Acceptance criteria:**
- [ ] Icon vertical center is within 1px of the text x-height center in both light and dark
- [ ] Works across all button variants (primary, secondary, ghost, danger)
- [ ] Works in both horizontal (`[icon] [label]`) and icon-only (`[icon]`) button modes
- [ ] No regression in click target size (the alignment fix shouldn't change `padding`)

**Effort:** ~15 lines, 1-2 files (the Button atom + the specific caller if it has custom CSS).

---

## Out of scope (parked, not Phase 6)

- **Custom domain** for the Workers.dev URL — separate effort (Cloudflare DNS + `custom_domain` in wrangler.jsonc)
- **Spanish-only validation** of all UI copy (i18n is AG-16, deferred)
- **Branding/logo pass** — the `MapPin` icon is a one-off; a full "TecNM Morelia + OpenSIM" identity pass is a future phase
- **Mobile breakpoints** — LayoutSidebar already has the collapse logic; need to verify the rest of the 7 routes on < 1024px
- **Empty states per route** — some have them, some don't; full audit pending

---

## Non-goals

- No new dependencies. All fixes are CSS-only or Svelte component tweaks.
- No a11y regression. All 4 fixes must pass the existing `@axe-core/playwright` sweep (re-run after implementation).
- No bundle bloat. The fix is sub-1KB gz added.

---

## Verification (run before close)

- `just check` 0/0.
- `just test` 115+/115+ (no new tests required for visual-only fixes; existing snapshot tests still pass).
- `just test:e2e` (Playwright + axe) — 7/7 routes green, 0 new violations.
- Manual smoke test on `https://opensim.jose-luis-rs.workers.dev` after deploy: open `/dashboard`, `/kardex`, click "Guardar"/"Eliminar" buttons, verify activity dot position, verify dark theme is consistent.

---

## Evidence (filled in at close)

- Commit list per task (4 small commits or 1 batched commit, TBD with user).
- Screenshots before/after for each fix.
- axe-core re-run output.
- Bundle size delta (target: < +1 KB gz).
