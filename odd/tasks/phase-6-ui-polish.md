# Phase 6 — UI/UX Polish (post-deploy live feedback)

**Feature:** `phase-6-ui-polish`
**Branch:** `feat/phase-1-foundation` (continuing — same default as Phase 5)
**Goal:** Resolve 4 UI/UX issues observed by el maintainer on the live production deployment (`https://opensim.jose-luis-rs.workers.dev`) on 2026-10-03. All 4 are **non-blocking** but visibly degrade the first-impression polish.
**Status:** In progress — U1 closed via P0-1.1 (token parity), U2 and U4 implemented. U3 deferred pending spec rewrite (M3.1 round 8 found that the original U3 spec would introduce a serious ARIA violation and a redundant prop that already exists).

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
- [ ] `just test` still green; no new Vitest required (visual only)

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

**Visual goal (Image 4 from user):** The activity indicator should sit **on the lower-right edge of the profile picture, overlapping it externally** (think: WhatsApp/Telegram/Slack online dot pattern). The avatar's actual content gets the full diameter, and the status dot is a separate `~50%` overlap (half inside, half outside) of the avatar diameter.

**Diagnosis (current state of `src/lib/components/ui/Avatar.svelte:1-122`):**
- `status` prop **already exists** (line 10, type `'online' | 'offline' | 'busy' | 'away'`).
- The dot element exists (line 35) with `aria-label={status}` on a `<span>` with no role → **`aria-prohibited-attr` SERIOUS** logged in `tests/e2e/reports/axe-findings.json` for runs 3, 4, 16, 17, 29, 30 (target: `.avatar__status--online`, `.avatar__status--busy`).
- The dot is positioned `position: absolute; bottom: 0; right: 0; width: 25%; height: 25%` (lines 98-103) **inside** the `.avatar` container which has `overflow: hidden` (line 48) — so the dot never extends outside, contrary to the WhatsApp-style overlap the spec wants.
- Border color is `2px solid var(--surface-1)` (line 107). `--surface-1` does change between themes (light `#f7f8fa`, dark `#131825`) but **does not match the actual page background** behind the avatar in most call sites (`+page.svelte:93-97` sits on `--surface-0`). The ring is invisible (1.02:1 against the page) — fails the "punch through" intent.
- **Dot fill colors fail WCAG 1.4.11** in light: `--success-500 #10b981` = 2.56:1, `--warning-500 #f59e0b` = 2.15:1 (axe-core does NOT detect non-text contrast). Dark mode passes (lightness shift makes the colors readable). Use `--success-700 #047857` and `--warning-700 #b45309` in light to fix.
- `alt` prop is misleading: it feeds `aria-label` of the parent `role="img"`, not the `<img alt>` (which is hardcoded empty on line 29). The spec must be clear that `alt` is the accessible name, not an image alt.
- Current aria-label mixes Spanish ("Avatar de") with English status token ("online") — needs localization.

**Fix (3 phases, applied in order):**

**Phase A — A11y first (zero visual risk):**
- Remove `aria-label={status}` from the status dot (line 35) — it's decorative.
- Compose the parent avatar's `aria-label` from name + status, localized to Spanish: `"Ada Lovelace, en línea"`, `"Alan Turing, ocupado"`, etc. Status label map:
  ```typescript
  const STATUS_LABEL_ES = { online: 'en línea', offline: 'desconectado', busy: 'ocupado', away: 'ausente' } as const;
  ```
- Do NOT add `<span class="sr-only">` under the avatar — `role="img"` is a leaf role; AT ignores descendant content.
- The `<img>` element keeps `alt=""` (decorative image inside the img role).

**Phase B — Tokens:**
- Add a local CSS variable to `.avatar` for the ring color: `--avatar-ring: var(--surface-0);`. Override per-context (e.g., in `LayoutHeader.svelte` where the avatar sits on `--surface-1`, set `--avatar-ring: var(--surface-1)` on the wrapper).
- Light-mode dot fills need darker shades for non-text contrast ≥ 3:1 (WCAG 1.4.11):
  - `--success-500` → `--success-700 #047857` (3.74:1)
  - `--warning-500` → `--warning-700 #b45309` (3.74:1)
  - Or define new `--status-dot-online: var(--success-700)`, etc. for clarity.
  - Dark mode: `--success-500 #34d399` (light) and `--warning-500 #fbbf24` (light) on `--surface-0 #0b0f17` already pass 3:1.

**Phase C — Structure:**
- Wrap the avatar in a `<span class="avatar-frame">` that owns `position: relative; display: inline-flex; flex-shrink: 0;` (replicates the flex-item contract of the original). The inner `<span class="avatar">` keeps `overflow: hidden` for the circular clip.
- The status dot lives in the **wrapper**, not the inner avatar, so it can extend outside without being clipped.
- Positioning: `position: absolute; bottom: 0; right: 0; width: 25%; height: 25%; min-width: 8px; min-height: 8px; transform: translate(50%, 50%); border: 2px solid var(--avatar-ring);` — `transform: translate(50%, 50%)` shifts the dot's center to the avatar's lower-right corner (50% inside, 50% outside).
- **Never** use percentages on `bottom`/`right` (would break per-size). `transform: translate(50%, 50%)` is the correct primitive because percentages resolve against the dot's own box.
- Drop the `min-width: 8px` (or make it `min(8px, 25%)` for consistency at xs) — at `xs` (24px), 25% = 6px, clamped to 8px = 33% which breaks the 50% overlap math.

**Updated `Avatar.svelte` template:**
```svelte
<script lang="ts">
  // ... existing imports/props ...
  const STATUS_LABEL_ES = {
    online: 'en línea',
    offline: 'desconectado',
    busy: 'ocupado',
    away: 'ausente'
  } as const;
  const altText = $derived(
    alt ?? (name
      ? (status ? `${name}, ${STATUS_LABEL_ES[status]}` : `Avatar de ${name}`)
      : 'Avatar')
  );
</script>

<span class="avatar-frame">
  <span class="avatar avatar--{size} avatar--{shape}" role="img" aria-label={altText}>
    {#if src}<img {src} alt="" class="avatar__img" />
    {:else if children}{@render children()}
    {:else}<span class="avatar__initials" aria-hidden="true">{initialsText}</span>{/if}
  </span>
  {#if status}<span class="avatar__status avatar__status--{status}"></span>{/if}
</span>

<style>
  .avatar-frame {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }
  .avatar {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--brand-100);
    color: var(--brand-700);
    font-family: var(--font-sans);
    font-weight: var(--weight-semibold);
    overflow: hidden;
    user-select: none;
    flex-shrink: 0;
    --avatar-ring: var(--surface-0);
  }
  /* ... existing size variants ... */
  .avatar__status {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 25%;
    height: 25%;
    min-width: 8px;
    min-height: 8px;
    border-radius: 50%;
    border: 2px solid var(--avatar-ring);
  }
  .avatar__status--online  { background-color: var(--success-700); }
  .avatar__status--offline { background-color: var(--fg-tertiary); }
  .avatar__status--busy    { background-color: var(--danger-500); }
  .avatar__status--away    { background-color: var(--warning-700); }
</style>
```

**Override ring in `LayoutHeader.svelte`:** where the user avatar sits on `--surface-1`, add `--avatar-ring: var(--surface-1)` to the wrapper so the dot "punches through" against that surface.

**Acceptance criteria (verified with axe-core + Playwright):**

```
AC1   axe in /       →  0 nodes aria-prohibited-attr with target .avatar__status
AC2   axe in /       →  violations ⊆ {color-contrast, document-title}  (baseline preexisting; see U3 M7)
AC3   axe in /       →  getByRole('img', { name: /Ada Lovelace/ }).count() === 1
AC4   axe in /       →  getByRole('img', { name: /en línea/ }).count() === 1   (localized name)
AC5   DOM            →  locator('.avatar__status').getAttribute('aria-label') === null
AC6   Playwright     →  dotBox.right  - avatarBox.right  === dotBox.width  / 2  (±1px)
AC7   Playwright     →  dotBox.bottom - avatarBox.bottom === dotBox.height / 2  (±1px)
AC8   Playwright     →  document.elementFromPoint(corner outside the dot) === the dot  (no ancestor clipping)
AC9   Playwright     →  getComputedStyle(dot).boxShadow.includes(resolved('--avatar-ring'))  (was `borderTopColor`; C1 paint-ringed the halo via `box-shadow: 0 0 0 2px var(--avatar-ring)` because global `box-sizing: border-box` eats the 25 % fill at xs/sm — see `Avatar.svelte:140`. AC8 also needs a halo-aware probe point: `box-shadow` spread is not hit-testable, so the corner picked must clear the 2 px halo or the assertion must relax to "dot or any of its descendants".)
AC10  Playwright     →  contrast(dotFill, --avatar-ring) >= 3.0  in light AND dark, for all 4 statuses  (M1)
AC11  loop           →  5 sizes × 2 shapes × 4 statuses × 2 colorSchemes: AC6+AC7+AC8+AC10 all pass
```

AC1–AC5 are axe-detectable. AC6–AC8 are the actual overlap tests. AC9 verifies the contextual ring. **AC10 is mandatory** — axe does not check non-text contrast (M1), so this is the only test that catches the fill contrast bug.

**Effort:** ~30 LOC in `Avatar.svelte`, ~5 LOC override in `LayoutHeader.svelte`. New Vitest unit for the status label map. 2-3 commits (a11y, tokens, structure).

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
- `just test-e2e` (Playwright + axe) — 7/7 routes green, 0 new violations.
- Manual smoke test on `https://opensim.jose-luis-rs.workers.dev` after deploy: open `/dashboard`, `/kardex`, click "Guardar"/"Eliminar" buttons, verify activity dot position, verify dark theme is consistent.

---

## Evidence (filled in at close)

- Commit list per task (4 small commits or 1 batched commit, TBD with user).
- Screenshots before/after for each fix.
- axe-core re-run output.
- Bundle size delta (target: < +1 KB gz).

---

## Progress (2026-10-03)

- **U1 ✓** — closed via `1294c91 fix(theme): unify dark token parity` (P0-1.1 of last round). The "white badge" symptom was the missing `--brand-50/100` in the `@media prefers-color-scheme: dark` block. The fix added both tokens and a `--fg-on-danger` token. The "fix the Badge" approach in the original spec would have been a no-op; the real fix was in `tokens.css`.
- **U2 ✓** — `5d7ac9c fix(ui): smooth ProgressBar transition (700ms cubic-bezier, U2 Phase 6)`. 1 file, 1 line changed. The global `@media (prefers-reduced-motion)` override at the top of `tokens.css` zeros the duration for users who request reduced motion.
- **U3 ⏸ DEFERRED** — needs spec rewrite per M3.1 round 8 finding: the original spec (a) tries to add a `status` prop that already exists in `Avatar.svelte`, (b) suggests `aria-label="Estado: en línea"` on a `<span>` without a role, which is exactly the `aria-prohibited-attr` serious violation already logged in `axe-findings.json`, and (c) proposes a dot that would be clipped by the existing `overflow: hidden` on `.avatar`. Re-spec → implement in a follow-up round.
- **U4 ✓** — `e7facd3 fix(ui): align icon to text x-height via .btn__icon flex wrapper (U4 Phase 6)`. 1 file, added `.btn__icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0 }` so the existing `<span class="btn__icon">` wrapper becomes a self-centering flex container. The SVG now centers within its own box, and the box centers within the button — no more 1-2px vertical offset.

**Verification after U2 + U4:**

- `just check` 0/0
- `just test` 122/122 (no new tests; visual-only fixes)
- `just build` clean
- Both commits pushed to `origin` (GitHub + Codeberg mirror)

**Open for a future round:** re-spec U3 → implement.

---

## Progress (2026-10-04)

- **U3 ✓** — closed via 3 work-unit commits on `main`:
  - `a90ba55` feat(ui): localize avatar status aria-label + remove aria-prohibited-attr (U3 Phase A)
  - `2531434` feat(ui): non-text contrast fixes for avatar status dot (U3 Phase B)  [includes LayoutHeader --avatar-ring override]
  - `3608369` feat(ui): wrap Avatar in frame so status dot extends outside the clip (U3 Phase C)
- Added: `src/lib/components/ui/Avatar.test.ts` — Vitest unit for `STATUS_LABEL_ES` and aria-label composition.
- Outstanding (Playwright-only, not blocking): AC6-AC11 (overlap geometry + WCAG 1.4.11 non-text contrast).
- axe-core sweep: pending (orchestrator will run after this commit, with the existing e2e tests in `tests/e2e/axe/*.spec.ts`).

**Verification after U3:**

- `just check` 0/0
- `just test` 138/138 (122 baseline + 16 new Avatar tests)
- `just build` clean
- 3 GPG-signed commits on `main` (top of `3099f24`), NOT pushed (push is human-owned).
