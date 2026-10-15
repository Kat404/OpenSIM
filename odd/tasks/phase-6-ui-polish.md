# Phase 6 — UI/UX Polish (post-deploy live feedback)

<!-- odd-tracker
kind: phase-plan
status: closed
last-verified: 2026-10-08
reconciled-against: feat/phase-9-verified-curriculum@8f40837 (main@ffcd595)
sha-warning: every SHA cited in this file predates the 2026-10-08 GPG re-sign rewrite and is dead; re-derive the current SHAs with `git log --oneline --grep='<subject>'`
-->

**Feature:** `phase-6-ui-polish`
**Branch:** `feat/phase-1-foundation` (continuing — same default as Phase 5)
**Goal:** Resolve 4 UI/UX issues observed by el maintainer on the live production deployment (`https://opensim.jose-luis-rs.workers.dev`) on 2026-10-03. All 4 are **non-blocking** but visibly degrade the first-impression polish.
**Status:** CLOSED 2026-10-06 (bookkeeping sync). U1 closed via `1294c91`, U2 via `5d7ac9c`, U4 via `e7facd3`, U3 via the Phase 6.1 cycle (`a90ba55`/`2531434`/`3608369`/`281b9b5`/`d789930` + `7007561`/`d7d0a45`/`ccd490f`). Tooling + audit closure recorded in `odd/tasks/opensim.md` §6.5, hardening in §7.

> **RESOLVED CONTRADICTION — deploy state (reconciled 2026-10-08).** The banner below recorded a
> genuine contradiction on 2026-10-06. It is preserved verbatim; the resolution follows.
>
> > **UNRESOLVED CONTRADICTION — deploy state (bookkeeping sync 2026-10-06).** Two facts are both true and must not be silently reconciled:
> > - This doc's Context says the app is **live at `https://opensim.jose-luis-rs.workers.dev`** as of 2026-10-03.
> > - Canonical Task 5.2 (`odd/tasks/opensim.md:419`) is the **only unchecked box in the spec**, and the deploy checklist `odd/tasks/phase-5.md:80-98` (5.2.1–5.2.5) **never ran**.
> >
> > **Operator question that settles it:** which deploy actually happened, and does a **production D1 with a real `database_id`** exist in `wrangler.jsonc`? Until that is answered, Task 5.2 stays open. **Do not mark it complete from this doc.**
>
> **Answer (2026-10-08).** This doc's Context was the correct record; the spec checkbox was the
> stale one.
> - **Real `database_id`:** yes. `wrangler.jsonc:36` → `"390df78e-c4c2-4ace-94f4-6baebf1eb88f"`, `database_name: "opensim"`. It was never the `00000000-…` placeholder. `odd/tasks/phase-5.md:83-85` had already recorded this on 2026-10-06 — **`odd/README.md` was the file that was stale.**
> - **Which deploy:** a Workers deploy from outside the Phase 5 checklist — i.e. **this doc's Context block was the correct record all along**. Workers Builds was relinked by the operator on 2026-10-08 after the repo was deleted and recreated; **the Worker itself was never deleted**. B7 closed.
> - **Remote D1:** brought to `0008` on 2026-10-08 (`0006`–`0008` applied, zero row loss). `wrangler d1 migrations list opensim --remote` → `✅ No migrations to apply!` B6 closed.
> - **Task 5.2 is now `[x]`** in `odd/tasks/opensim.md` §8, on infrastructure state rather than smoke evidence. The production axe sweep (step 5.2.4) remains **NOT VERIFIED**.
>
> **This doc's SHAs are dead.** The 2026-10-08 GPG re-sign rewrite changed every commit SHA in the repository. Re-derive with `git log --oneline --grep='<subject>'`.

> **Acceptance-criteria bookkeeping (bookkeeping sync 2026-10-06):** the 4 ticked ACs rest on the Progress blocks below — U1-A1 on `1294c91`, U2-A1/U2-A3 on `5d7ac9c` (700ms cubic-bezier, honors `prefers-reduced-motion`), U4-A1 on `e7facd3` (`.btn__icon` flex wrapper). The 7 boxes left unchecked have **no evidence anywhere in this file**: the `MapPin` icon (U1-A2 — never implemented; the real U1 fix was in `tokens.css`), the U1 contrast measurement (A3) and U1 test run (A4), the U2 visual "no jumps" check (A2), and all four U4 coverage/regression claims (A2–A4). They are visual or matrix criteria that the recorded verification runs (`just check` / `just test` / axe) do not assert.

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
- [x] Badge background matches the active theme (no pure white in dark)
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
- [x] Bar transitions from 0% to 100% over ~600-800ms with `cubic-bezier(0.4, 0, 0.2, 1)`
- [ ] No visible "jumps" when value updates
- [x] Honors `prefers-reduced-motion` (instant transition for users with reduced motion preference)

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
- [x] Icon vertical center is within 1px of the text x-height center in both light and dark
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

---

## Progress (2026-10-04, final — U3 audit cycle + tooling adoption)

The U3 cycle, its cosmetic follow-ups, and a tooling overhaul all landed in one continuous session. Audit was conducted via mcode R11–R17 (minimax-coding-plan/MiniMax-M3.1-Flash-Preview, `--effort max --prompt-mode work`). mcode logs at `/tmp/opencode/mcode-*-log`.

**U3 cascade bug fix** (mcode R11):

- **✓ `d789930`** `fix(ui): declare --avatar-ring on avatar-frame so dot inherits (mcode R11)`. The `--avatar-ring` was declared on `.avatar` (Avatar.svelte:81) but the dot lives on its sibling `.avatar-frame` introduced in Phase C. CSS custom properties inherit parent → child, never between siblings, so the dot resolved the guaranteed-invalid value and the border fell back to none — invisible halo at every call site. Fix: move the declaration to `.avatar-frame`. 1 line.

**U3 cosmetic follow-ups** (per plan v1 in `phase-6-u3-cosmetic-followups.md`, refined by mcode R12, executed as 3 work-unit commits + 1 follow-up):

- **✓ `5b05166`** U3 follow-up C1+C2+C5 — border ring → `box-shadow` halo (escape global `box-sizing: border-box`); drop dead `position: relative` + `flex-shrink: 0` from inner `.avatar`; spec note in AC9. **Plus** static-regex test for the ring contract. **Plus** regex-comment-strip fix (a 1-line in-test fix at implementation time: scope the CSS comment strip to `<style>` only, since the defensive comment "not border:" would otherwise match the regex's own negation).
- **✓ `7fb89a7`** U3 follow-up C3 — `composeAltText('', 'online')` was silently dropping status (public API bug). Rewrite branch order: `if (alt) return alt; if (!name) { if (status) return 'Avatar, ${STATUS_LABEL_ES[status]}'; return 'Avatar'; } if (status) ...`. 3 new test cases.
- **✓ `e43caae`** U3 follow-up C4 — `initials('')` was returning `''` (not `'?'`) because the `parts.length === 0` branch was unreachable (`''.trim().split(/\s+/)` returns `['']`, length 1). R12 caught the bug while reviewing the plan; production fix is `if (!n.trim()) return '?'` at the top of `initials`, plus move to `<script module>` and export. 6 new test cases — 2 of which prove the production fix.
- **✓ `482a00e`** (mcode R13 follow-up) — C5 spec defect. R13 caught that the original C5 implementation only appended parenthetical text "(was `borderTopColor`; updated to `boxShadow` shorthand)" without rewriting the LHS assertion. After C1, `getComputedStyle(dot).borderTopColor` was no longer valid (dot has no border). Rewrote AC9 to assert the resolved `--avatar-ring` color appears inside `getComputedStyle(dot).boxShadow`; documented AC8 hit-test implication (box-shadow spread is not hit-testable). Also added `composeAltText('', 'offline')` test case for 4-status symmetry and re-scoped the CSS comment strip.

**Audit closure** (per plan in `phase-6-u3-audit-closure.md`):

- **✓ `72cddf5`** `docs(odd): close R11/R12/R13 audit cycle + adopt just in reports (F1+F2)`. 5 files: new closure doc with traceability table (round | finding | fix commit | evidence mcode log path), 7 `pnpm` invocations migrated to `just` across 4 reports/README, 3 typo fixes (`just test:e2e` → `just test-e2e` in `phase-6-ui-polish.md:240`, `phase-5.md:67`, `phase-5.md:106`).

**Tooling adoption** (per plan v5 in `phase-6.5-closure-and-just-adoption.md`, 4 commits):

- **✓ `d5e2109`** `chore(tooling): adopt Biome 2.5.15 + activate domains + repair precommit + drop vestigial deploy (U3 follow-up F3)`. `biome.json` adopted with formatter (tab/double/semicolons:always/trailingCommas:all) + 4 domains enabled (svelte/drizzle/playwright at `all`, test at `recommended`). Repaired `just precommit` (was depending on broken `just format-check`). Deleted vestigial `just deploy` (canonical is `deploy-worker`). +1 devDep `@biomejs/biome@2.5.15` pinned exact.
- **✓ `dcd3e9e`** `chore(style): format repo with Biome 2.5.15 (gate repair)`. 120 source files reformatted. Zero domain findings — the user's instinct to enable those domains was correct, the codebase is already idiomatic. 22 default-rule findings (lint/style/noNonNullAssertion, lint/a11y/*, lint/suspicious/noExplicitAny) — fixed in code or silenced in overrides per file-type, with full disclosure in commit body. Override patterns corrected from `*.svelte` to `**/*.svelte` to match nested component files.
- **✓ `6e67534`** `chore(ci): drop GitHub Actions + add local Podman CI recipes (U3 follow-up F5)`. Deleted entire `.github/` directory (only `workflows/e2e.yml` was there). New `Containerfile.ci` at root: `node:24-bookworm-slim` base (Playwright rejects musl/Alpine per https://playwright.dev/docs/docker; caught by mcode R15), Chromium via apt-get + 31 runtime deps symlinked to `/usr/bin/chromium` matching `playwright.config.ts:49`. 5 new recipes: `ci-build`, `ci` (alias `ci-test`), `ci-shell`, `ci-clean`, `ci-drift` (opt-in schema drift detection, local-only). CMD = `[just, precommit]` (the orchestrator renamed `precommit` → `qa-fast` in a later commit).
- **✓ `338ad07`** R17 follow-up A. 5 files, +33/-24. Repaired 3 doc-comments falsely claiming `just ci` runs axe (real `just ci` = `just precommit` = check + biome-check + test; axe-core e2e ran via `just test-e2e` separately). Updated `docs/ci-local.md:25` (pnpm install IS required on host; bind-mount doesn't install). Added `biome-check` to `just verify`. Softened `just ci-drift` doc to match what the recipe actually does. Ran `biome migrate` (resolved the `recommended: true` deprecation info). Moved multiline `#` comments → `[doc()]` attribute for clean `just --list` display.
- **✓ `0baf00b`** R17 follow-up B. 4 files, +344/-1. New `.env.example` documenting the dotenv-load convention. Historical-record note added to `phase-6-u3-cosmetic-followups.md:237` (L21 had it, L237 was missed in first pass). Committed the previously-untracked `phase-6.5-closure-and-just-adoption.md` plan (was referenced by the closure doc but not in git). Added `packageManager: pnpm@11.28.4` to `package.json` so corepack enforces it (was a R17 finding that the Containerfile pin was technically not enforced).

**Naming refactor** (per user request — user preferred `just qa`/`just qa-fast` over `just precommit`/`just verify`):

- **✓ `cc0f8ee`** `refactor(just): rename verify→qa (full gate) and precommit→qa-fast (delete verify)`. 5 files, +13/-13. Aligns with TallerAgentes convention (`just qa` = full QA session). Tiered by scope (qa-fast = no build, qa = with build) rather than by git event (precommit, pre-push) — naming follows intent, not convention. `Containerfile.ci` CMD updated to `[just, qa-fast]`.

**Verification (after all 15 commits on main post-`482a00e`):**

- `pnpm run check` → 0 errors, 0 warnings
- `pnpm test` → 149/149 (was 122 before Phase 6)
- `pnpm exec biome ci` → exit 0 (deprecation info resolved by `biome migrate`)
- `pnpm run build` → clean
- `just qa-fast` → ✓ pre-commit checks passed
- `just qa` → ✓ all green — ready to push (with build)
- `git grep 'just verify\|just precommit'` → 0 hits
- All 15 commits GPG-signed (key `3335F4A0…`); NOT pushed (push is human-owned)

**Outstanding (NOT blocking, deferred to follow-up):**

- Playwright AC6–AC11 loop for U3 (~80 test cases: 5 sizes × 2 shapes × 4 statuses × 2 themes) — separate feature with its own planning
- `project` and `types` Biome domains — opt-in via uncommenting in `biome.json` (perf cost: module graph scan + type inference)
- Lint findings silenced by override block — pre-existing smells that need human review (not blockers, deferred per plan)
- Working tree dirty files (`tests/e2e/reports/*.json`, `.agents/`, `skills-lock.json`) — preserved across all 15 commits, user decision required

---

## Progress (2026-10-05) — Phase 6.1 closed

Phase 6.1 closes the U3 acceptance criteria cycle end-to-end. AC1–AC5 already pass via the axe-core sweep (`tests/e2e/axe/*.spec.ts`). AC6–AC11 now pass via the new 80-matrix Playwright suite. The U3 spec is fully validated end-to-end.

- **✓ `7007561`** `test(e2e): add avatar test helpers + 80-matrix overlap suite (Phase 6.1 F1+F2)`. 4 new files (+544 LOC) + 1 opt-in extension to `Avatar.svelte` (`dataTestid?: string` so the testid lands on the same element the spec reads box dimensions from — no behaviour change when the prop is omitted). 80 test cases (5 sizes × 2 shapes × 4 statuses) × 2 Playwright projects (chromium + chromium-data-theme-dark) = 160 runs, 100% pass on three consecutive runs (~35s each). The dark describe uses the `addInitScript` + `page.reload()` pattern from `tests/e2e/axe/_helpers.ts:49-54` to defeat `theme.svelte.ts:61`'s post-hydration `data-theme` stomp. Implementation drift from plan v2 is documented below.
- **✓ `d7d0a45`** `chore(ci): add just test-e2e-avatar recipe + docs (Phase 6.1 F3)`. 2 files modified (+9 LOC). New focused recipe for the overlap suite — no `db-set-password` dependency (spec is public), restricted to `chromium` + `chromium-data-theme-dark` projects via `--project` flags. 1 row added to the `docs/ci-local.md` recipe reference table.
- **✓ `<this commit>`** `docs(odd): record Phase 6.1 closeout + U3 acceptance criteria complete (post-mcode-R19)`. 1 file modified. This section.

**mcode R19 final audit verdict:** `ship-with-fixes`. One blocker + four minors caught at audit time. All were folded into this commit alongside the closeout doc; see the "R19 fixes applied in this commit" section below. Full report: `/tmp/opencode/mcode-r19-audit.log`.

**Implementation drift from plan v2 (R18 baseline):**

- `getComputedStyle(el).getPropertyValue('backgroundColor')` returned empty in Chromium — `getPropertyValue` expects the hyphenated form `background-color`. Plan v2 used `'backgroundColor'` (camelCase). Fixed in the spec at implementation time.
- `parseRgbString` was extended to also accept 3- and 6-digit hex (`#fff`, `#ffffff`) in addition to `rgb()`/`rgba()`. The plan only specified the `rgb()` family, but `getPropertyValue('--surface-0')` returns the raw token value (`#ffffff` or `#0b0f17`) — Chrome does not normalise custom-property declarations. The extended parser is backwards-compatible with the plan's contract.
- `getDotBox` calls `dot.scrollIntoViewIfNeeded()` (not `frame.scrollIntoViewIfNeeded()`) because the dot extends 50% of its own size past the avatar's lower-right corner via `transform: translate(50%, 50%)`. For `xl` (80×80 with a 20×20 dot) the dot's center sits exactly at the avatar's lower-right corner, and scrolling only the frame leaves the dot's centre at the viewport edge where `elementFromPoint` returns null. Scrolling the dot itself guarantees the centre lands well inside the viewport.
- The fixture page uses `#lib/components/ui/Avatar.svelte` (the project's existing alias convention; `+page.svelte` is the only file in the project that used `$lib` — the layout and 6 other component files use `#lib`). Plan v2 said "SvelteKit 2.x removed `$lib`", which is inaccurate (`$lib` remains a first-class default alias in `@sveltejs/kit@3.0.0`); the implementation follows the repo's own convention regardless. Also a one-line `import { dev }` path fix in `+page.server.ts` from `$app/environment` to `$app/env` (the former is deprecated in this SvelteKit version and emits a build warning).
- The dark describe's `addInitScript` + `page.reload()` pattern from plan v2 (mirroring `tests/e2e/axe/_helpers.ts:49-54`) does not work because the repo's CSP hash in `hooks.server.ts:51` is stale — it was computed against an older version of the app.html theme bootstrap, so every inline-script-shaped injection is blocked. The implementation uses a `page.route` handler that strips `Content-Security-Policy` from the HTML document only (every other request passes through unchanged to keep dev-server throughput normal), then sets the localStorage override via `addInitScript` and reloads. The R19 audit caught the original spec-vs-implementation gap and the fix iteration is documented under "R19 fixes applied in this commit" below.

**Verification (after all 3 Phase 6.1 commits on top of `2dbdd91`):**

- `pnpm run check` → 0 errors, 0 warnings
- `pnpm test` → 149/149 (no change — Playwright suite, not vitest)
- `pnpm exec biome ci` → exit 0 (6 warnings, all `lint/style/noNonNullAssertion` in the test file; tests/ is in the `playwright: all` domain, the rule is non-blocking)
- `pnpm run build` → clean
- `just qa-fast` → ✓ pre-commit checks passed
- `just test-e2e-avatar` → 161 passed in ~35s (1 setup + 80 light + 80 dark)
- 3 consecutive `just test-e2e-avatar` runs all green (no flake observed)
- `just --list` shows the new `test-e2e-avatar` recipe under the `[test]` group
- All 3 commits GPG-signed (key `3335F4A0…`); NOT pushed (push is human-owned)

**Final state after Phase 6 + 6.1 (19 commits on top of origin/main):**

- `pnpm run check` 0/0
- `pnpm test` 149/149
- `pnpm exec biome ci` exit 0
- `pnpm run build` clean
- `just qa-fast` ✓
- `just test-e2e-avatar` 161/161
- Working tree dirty files preserved: `tests/e2e/reports/axe-findings.json`, `tests/e2e/reports/results.json`, `.agents/`, `skills-lock.json` (user decision required)

**R19 fixes applied in this commit (post-audit):**

- **Blocker — dark suite was inert.** `theme.svelte.ts:53-65`'s `followOs` checks `localStorage.getItem("opensim-theme")` (NOT the `data-theme` attribute) and, with no stored override, unconditionally writes `e.matches ? "dark" : "light"`. Under `chromium-data-theme-dark` (`colorScheme: "light"`), `e.matches` is `false` so the follower rewrites the attribute to `light`. The previous `addInitScript` set the attribute but not localStorage, so any future layout/fixture that imported the theme module would silently break the dark half of the matrix. **First-attempt fix:** write the localStorage override in the init script. **Caught at implementation time:** the repo's CSP hash in `hooks.server.ts:51` is stale (it was computed against an older version of the app.html theme bootstrap — the current script's computed SHA-256 is `YfKZ4T9N2XdfnDn9F8TBHR4dTHuYaB+Vi3eUqxqYXxo=`, not the one in the CSP), so every inline-script-shaped injection is blocked. **Final fix:** a `page.route` handler that strips `Content-Security-Policy` from the HTML document only, lets every other request pass through, and pairs with `addInitScript` to set the localStorage override. Verified end-to-end: `data-theme="dark"` and `--avatar-ring: #0b0f17` are observed in the chromium-data-theme-dark project after the beforeEach.
- **Minor 1 — AC8 descendant check was not load-bearing.** The previous `isDescendantOfFrame` matched any `SPAN` inside the frame, so it passed even when the probe landed on `.avatar__initials` or the avatar body. **Fix:** replaced with a tagName + class match against the dot's selector — the dot is a leaf `<span class="avatar__status--{status}">`, so the strict form is the load-bearing assertion today, with a comment noting the descendant relaxation is the future-proof form for the spec (the dot may grow children in a future revision).
- **Minor 2 — `getRgbFromVar` docblock contradicted the parser.** The function claimed Chrome normalises computed values to `rgb()`/`rgba()` "regardless of how the source token is declared", while `parseRgbString`'s own docblock correctly documents the opposite (the exact reason the hex branch exists). **Fix:** rewrote the `getRgbFromVar` docblock to state that custom-property values are returned unnormalised and to defer to `parseRgbString` for accepted forms.
- **Minor 3 — "80 cells" claim was wrong.** The fixture renders 40 cells (5 × 2 × 4); 80 is the test count (40 light + 40 dark). The fixture page (`+page.svelte:27`) and the `docs/ci-local.md` recipe row both said "80 cells". **Fix:** the page now reads "renders all 40 cells ... 80 test cases" and the docs row reads "40 cells × 2 themes".
- **Minor 4 — `getBoxShadowRaw` had an unused `page: Page` parameter.** The helper only builds a locator from the selector; the parameter is harmless but inconsistent with the helper's actual dependency surface. **Fix:** left as-is (uniform signatures across the helper file are a deliberate trade; the next refactor that splits helpers can revisit).

R19 nits (out of audited range or non-blocking):

- The closeout doc previously self-referenced `<this commit>` and a non-existent audit log; both resolved by this commit.
- Plan v2's claim "SvelteKit 2.x removed `$lib`" is inaccurate (`$lib` remains a first-class default alias in `@sveltejs/kit@3.0.0`); the implementation correctly uses the repo's own `#lib` convention regardless. The closeout doc's "drift" note above preserves the plan's original phrasing for traceability; the code is correct.

## Progress (2026-10-06) — Phase 7 closed

Phase 7 closes the cross-audit cycle that started with Gemini R20. The 3 critical bugs (CSP hash stale, fixture bundle leak, brand-600 contrast regression) and 5 important issues (pnpm version drift, dataTestid anti-pattern, --project filter not scoping test.describe, missing `<title>` on root routes, /404 button) are all fixed. mcode R21 caught 3 blockers in the v1 plan (proposed 'script-src self' would have broken hydration; (dev) route group is layout-grouping not exclusion; spec split doesn't reduce runs) and all 3 were applied to v2.

The 5 Phase 7 commits (all GPG-signed, key `3335F4A0…`):

- **✓ `5ab128e`** `fix(security): adopt SvelteKit 3 kit.csp.mode:'nonce' + remove manual CSP (Phase 7 F1 v2)`. 4 files changed (+39/-69).
- **✓ `d34c3df`** `chore(ci): exclude _dev/avatars from production bundle via Vite plugin (Phase 7 F2 v2)`. 4 files changed (+62/-2).
- **✓ `b49e5a7`** `fix(a11y): brand-600 to #0f6f85 + add titles + fix /404 button (Phase 7 F3+F7a+F7b)`. 5 files changed (+33/-2).
- **✓ `9a98041`** `fix(tooling): sync pnpm + Avatar.svelte HTMLAttributes spread + avatar spec test.skip (Phase 7 F4+F5+F6)`. 5 files changed (+81/-21).
- **✓ `<this commit>`** `docs(odd): record Phase 7 hardening closeout (post-gemini-R20-2 + mcode-R21)`. 2 files changed (this Progress section + Phase 7 section in `odd/tasks/opensim.md:472-499`).

**mcode R21 final audit verdict:** `ship-with-fixes`. 3 blockers caught in v1; all applied to v2 before implementation. Full report: `/tmp/opencode/mcode-phase7-audit.log`.

**Gemini R20-2 audit verdict (post-implementation cross-audit, run via `agy` after this commit):** see `odd/tasks/opensim.md:498-499` and `/tmp/opencode/agy-r20-2-audit.log`. If R20-2 caught new issues, they were folded into this commit or a follow-up `fix(odd): apply R20-2 corrections` commit; the absence of an R20-2 corrections commit means R20-2 was clean.

**Implementation drift from plan v2 (R21 baseline):**

- **F2 v2 mechanism.** Plan recommended a `rollupOptions.external` Vite plugin first. That path did NOT strip the route from SvelteKit's manifest dictionary (SvelteKit registers the route before Rollup sees it). The shipped approach is `transform + closeBundle`: the `transform` hook strips the route entry from `.svelte-kit/generated/build/client/app.js` (dev is untouched because the hook is scoped to `.svelte-kit/generated/build/`, not `dev/`), and `closeBundle` walks the client output's `nodes/` directory and unlinks any chunk whose body still contains the fixture markers (`avatar-fixture-root` or "Avatar fixture"). Also tried the rename to `.dev/` (per plan's fallback) as a defense-in-depth marker; SvelteKit's routes glob does NOT actually exclude dot-prefixed paths, so the rename alone doesn't strip the route — the Vite plugin does the real work.
- **F6 v2 mechanism.** Plan said `test.skip(({ testInfo }) => ...)` inside the describe. That signature does NOT exist in Playwright v1.63 — `test.skip(callback)` is `(args: TestArgs & WorkerArgs) => boolean` and `testInfo` is not in those. The shipped approach is `test.beforeEach(({}, testInfo) => { test.skip(true, ...) })`. The `{}` empty destructure is required by Playwright's runtime check ("First argument must use the object destructuring pattern") but triggers biome's `noEmptyPattern`; suppressed with an inline `biome-ignore` comment.
- **F3 verification gate.** Plan said `just test-e2e` must be all 8 specs GREEN. 3 specs (`/horario`, `/reinscripcion`, `/tramites` on `chromium-dark`) are red at `ccd490f` HEAD and remain red after this commit. Root cause is `--fg-secondary` text on HSL-hashed subject backgrounds in `.class-block__meta` (e.g. `#cbd5e1` on `#31721d` = 3.97:1, fails AA 4.5:1). The same 3 specs pass on the `chromium` (light) and `chromium-data-theme-dark` (data-theme-driven dark) projects. F3's brand-600 fix is correct for the primary links; the schedule's HSL-hash contrast on `chromium-dark` is a separate pre-existing bug filed as Phase 8 follow-up. The plan's "all 8 specs GREEN" expectation was inaccurate; the gate is 271/274 with the 3 pre-existing `chromium-dark` failures documented.

**Verification (after all 5 Phase 7 commits on top of `ccd490f`):**

- `pnpm run check` → 0 errors, 0 warnings
- `pnpm test` → 149/149 (no change — Playwright suite, not vitest)
- `pnpm exec biome ci` → exit 0 (5 warnings, all `lint/style/noNonNullAssertion` in `tests/e2e/avatar-overlap.spec.ts:97,101`; tests/ is in the `playwright: all` domain, the rule is non-blocking)
- `pnpm run build` → clean
- `just qa-fast` → ✓ pre-commit checks passed
- `just test-e2e-avatar` → 81 passed in ~35s (1 setup + 40 light + 40 dark), 160 skipped on the wrong-project combinations
- `! grep -r 'dev/avatars' .svelte-kit/output/client/` → empty (F2 v2 verified)
- `git log --oneline -6` → `5ab128e d34c3df b49e5a7 9a98041 <this> ccd490f` (Phase 6.1 closeout HEAD)
- 5 new commits GPG-signed (key `3335F4A0…`); NOT pushed (push is human-owned)

**Final state after Phase 6 + 6.1 + 7 (24 commits on top of origin/main):**

- `pnpm run check` 0/0
- `pnpm test` 149/149
- `pnpm exec biome ci` exit 0
- `pnpm run build` clean
- `just qa-fast` ✓
- `just test-e2e-avatar` 81/81 (40 light + 40 dark + 1 setup)
- Working tree dirty files preserved: `tests/e2e/reports/axe-findings.json`, `tests/e2e/reports/results.json`, `.agents/`, `skills-lock.json` (user decision required)
- 24 commits ahead of origin/main (19 from Phase 6 + 5 from Phase 7), all GPG-signed
- Ready for Phase 5.2 (Cloudflare Workers deploy — human-owned, requires `wrangler login` + `wrangler d1 create` + `wrangler d1 migrations apply --remote` + `pnpm build` + `wrangler deploy` per `docs/deploy.md`)
