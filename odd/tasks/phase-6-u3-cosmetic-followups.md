# Phase 6 — U3 Cosmetic & Hardening Follow-ups (post-mcode-R12)

**Feature:** `phase-6-u3-cosmetic-followups`
**Branch:** `main` (continuing — same default as Phase 6 U3)
**Goal:** Resolve the cosmetic items mcode flagged across R11 + R12, plus the `initials()` dead-code bug R12 surfaced by re-running the function. All items are **non-blocking** for U3 closeout but cheap enough to land in one focused cycle.
**Status:** Plan written, R11 cross-audited, R12 cross-audited and refined. Pending user approval to implement.

---

## Context

- OpenSIM v1.2 is live on `main`, deployed at `https://opensim.jose-luis-rs.workers.dev`.
- Phase 6 U3 (Avatar status dot, WhatsApp-style overlap) shipped on `main` in 5 GPG-signed work-unit commits:
  - `a90ba55` Phase A (a11y)
  - `2531434` Phase B (non-text contrast + LayoutHeader override)
  - `3608369` Phase C (frame wrapper)
  - `281b9b5` doc closeout
  - `d789930` cascade CSS bugfix (R11 finding, mcode-caught)
- mcode R12 (cross-audit of this plan) verified C1/C2/C3/C5 as solid and caught:
  - C4 was misanalyzed: `initials('')` returns `''` not `'?'` because the `parts.length === 0` branch is unreachable. R11 missed this. **R12 surfaced a real cosmetic bug.**
- pnpm test 138/138, pnpm check 0/0, pnpm build clean. *(historical record of U3 cycle execution; canonical commands are now `just`)*
- Working tree dirty: `M tests/e2e/reports/axe-findings.json`, `M tests/e2e/reports/results.json`, `?? .agents/`, `?? skills-lock.json` (untouched).

---

## Findings (4 cosmetic + 1 dead-code + 1 production bug, ordered by ROI)

### C1 — `box-sizing: border-box` global eats the dot in xs/sm

**Source:** mcode R11 §Issues menores #2. Refined by R12.

**What:** Background `box-sizing: border-box` (tokens.css:299-303) is applied globally. `.avatar__status` (Avatar.svelte:135-136) uses `border: 2px solid var(--avatar-ring)`, so the 2 px border is counted *inside* the 25 % width. At xs (24 px): 25 % = 6 px dot → 2 px of fill visible. At sm (32 px): 25 % = 8 px dot → 4 px of fill visible. The md/lg/xl sizes are fine (≥ 10 px fill).

**Fix:** Replace `border: 2px solid var(--avatar-ring);` with `box-shadow: 0 0 0 2px var(--avatar-ring);`.

**R12 risks surfaced:**
- `box-shadow` is **outside** the box: the 25 % fill stays clean; the 2 px ring paints outward. At xs the visible dot grows from 6 px (4 px eaten by border) to 10 px (clean fill + 2 px halo). The "ring grows the dot" side-effect is desirable here.
- `prefers-reduced-motion`: `box-shadow` has no transition. tokens.css:289-295 zeros `--motion-duration-*` but does not disable transitions globally — no risk today, only if someone animates the shadow later. Worth a one-line inline comment.
- Theme switching: `var(--avatar-ring)` re-resolves at computed-value time. Both consumers (`Avatar.svelte:67`, `LayoutHeader.svelte:249`) keep working.
- WCAG 1.4.11 (AC10) actually **improves**: the fill is now the full 25 % at every size, so the contrast ratio only goes up.
- **Side effect on LayoutHeader:** with `border` the halo was inside the dot's box; with `box-shadow` it paints outward and may overlap the initials/avatar content. LayoutHeader doesn't pass `status` today (dormant), so this is invisible in current code paths. Future LayoutHeader status avatars will need a visual check.

**Inline comment** (R12 refinement #4) over the box-shadow line, in code:

```css
/* box-shadow, not border: with global box-sizing: border-box
   (tokens.css:299-303) a 2px border eats the 25% fill at xs/sm.
   Spread paints outward. Do not "fix" back to border. */
```

**Static-regex test addition** (R12 refinement #3) in `Avatar.test.ts`:

```ts
describe('Avatar.svelte ring contract', () => {
  test('avatar__status block paints outward via box-shadow', () => {
    const statusBlock = SOURCE.match(/\.avatar__status\s*\{[^}]*\}/)?.[0] ?? '';
    expect(statusBlock).toMatch(/box-shadow:\s*0 0 0 2px var\(--avatar-ring\)/);
    expect(statusBlock).not.toMatch(/border:\s*[^n]/); // 'none' is fine; a 2px solid border would re-introduce the bug
  });
});
```

Reuses the existing `SOURCE` constant at `Avatar.test.ts:98-130` (per worker's report). +0 dependencies, +5 LOC.

**Effort:** 1 file, 1 line CSS + 1 comment + ~6 LOC test. No new helpers.

**Recommendation:** **A — fix now.** 1-line CSS fix at zero functional risk, with a defensive test that prevents regression.

---

### C2 — Dead/inert CSS in the inner `.avatar` block

**Source:** mcode R11 §Issues menores #1. Verified safe by R12 (grep of all 3 call sites).

**What:** Avatar.svelte:71 (`position: relative;`) and Avatar.svelte:81 (`flex-shrink: 0;`) became inert after Phase C wrapped the avatar in `.avatar-frame`. The frame already owns `position: relative` (line 64) and `flex-shrink: 0` (line 66).

R12 verified by grep that no call site uses `<Avatar ...>{children}</Avatar>` with an absolutely-positioned child inside, so dropping `position: relative` from `.avatar` is safe.

**Fix:** Delete both lines. Net −2 LOC.

**Caveat (R12):** dropping `flex-shrink: 0` couples `.avatar`'s correctness to `.avatar-frame:66` carrying it. This is exactly the argument the plan uses to remove it, and we accept the coupling as intentional (the frame *defines* the avatar's box).

**Recommendation:** **A — fix now.** Trivial, zero risk.

---

### C3 — `composeAltText('', 'online')` returns `'Avatar'` and silently drops status

**Source:** mcode R11 §Cobertura faltante #1. Verified correct by R12 branch-by-branch.

**What:** Avatar.svelte:11-20 short-circuits at `if (!name) return 'Avatar';` before evaluating `status`. If a caller passes `status="online"` with no `name`, the accessible label is `'Avatar'`, no mention of online presence. Silent semantic loss on a public exported function (exported via `<script module>`).

**Fix:** Keep the `'Avatar'` fallback for the no-name-no-status case, but evaluate `status` even when name is empty. New branch order:

```ts
export function composeAltText(
    name: string,
    status: AvatarStatus | undefined,
    alt?: string
): string {
    if (alt) return alt;
    if (!name) {
        if (status) return `Avatar, ${STATUS_LABEL_ES[status]}`;
        return 'Avatar';
    }
    if (status) return `${name}, ${STATUS_LABEL_ES[status]}`;
    return `Avatar de ${name}`;
}
```

R12 verified: this does NOT break any existing test (`Avatar.test.ts:60-95`) because:
- `composeAltText('', undefined)` → `'Avatar'` (test line 84) — still green
- `composeAltText('', 'busy', 'Custom')` → `'Custom'` (test line 93) — still green, `if (alt)` is first
- `composeAltText('Ada', 'online')` → `'Ada, en línea'` (test line 63) — still green

**New test cases** (R12 corrected count: 3, not 4 — the "Ada online" regression was a duplicate of test line 63):

- `composeAltText('', 'online')` → `'Avatar, en línea'`
- `composeAltText('', 'busy')` → `'Avatar, ocupado'`
- `composeAltText('', 'away')` → `'Avatar, ausente'`

**Effort:** Avatar.svelte (rewrite of one function), +3 tests, ~5 LOC.

**Recommendation:** **A — fix now.** Public API, silent semantic loss, cheap fix.

---

### C4 — `initials()` has unreachable dead branch + lacks tests (PRODUCTION BUG, not just coverage)

**Source:** mcode R12 surfaced a real bug R11 overlooked. R11 only flagged "no test coverage".

**What (R12 empirical):** Avatar.svelte:38-43:

```ts
function initials(n: string): string {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 0) return '?';          // ← UNREACHABLE
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
```

R12 ran the function in Node:
- `initials('')` → `''.trim().split(/\s+/)` returns `['']` (length 1, not 0) → falls into the single-word branch → `''.slice(0, 2).toUpperCase()` → `''`. The function returns `''`, not `'?'`.
- `initials('   ')` → same path, also returns `''`.
- Result: an `<Avatar />` without `name` renders an empty circle, **not** the `?` fallback the function claims to provide.

The `if (parts.length === 0) return '?';` branch is unreachable. Either the function never needed it (and the line is dead code) or it always needed it (and the line is buggy). Both readings point to a missing guard.

**Fix (R12 refinement #1):** Add the actual guard at the top of the function, drop the unreachable branch.

```ts
export function initials(n: string): string {
    if (!n.trim()) return '?';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
```

Move to `<script module>` and export (R12 verified: same mechanism as `composeAltText`, already importable, no extra imports, no state, no SSR risk).

**New test cases** (R12 corrected count):

| Input | Expected |
|---|---|
| `initials('')` | `'?'` |
| `initials('   ')` | `'?'` |
| `initials('Grace')` | `'GR'` |
| `initials('Grace Hopper')` | `'GH'` |
| `initials('Ada Lovelace')` | `'AL'` |
| `initials('  ada  lovelace  ')` | `'AL'` |

Six tests, all distinct. Note the `initials('')` and `initials('   ')` tests are now **proving the production fix works** — they would fail against the old function.

**Effort:** Avatar.svelte (function rewrite + move to module), +6 tests. ~10 LOC.

**Recommendation:** **A — fix now.** This is a real bug (renders empty circles instead of `?`), caught by mcode R12. The test additions prove the fix and document the contract.

---

### C5 — Update AC9 spec for the box-shadow change (C1 follow-on)

**Source:** mcode R11 §Riesgo #2 + spec AC9. Corrected by R12.

**What:** With C1's border → box-shadow change, the spec's AC9 ("`getComputedStyle(dot).borderTopColor === resolved(--avatar-ring)`") is no longer the right assertion target. The dot has no border; it has a `box-shadow`.

**R12 correction (refinement #5):** `boxShadowColor` is NOT a reliable longhand on `getComputedStyle`. The verifiable value is the shorthand `boxShadow` string, e.g. `"rgb(11,15,23) 0px 0px 0px 2px"`. The correct assertion is:

```ts
expect(getComputedStyle(dot).boxShadow).toContain(resolved('--avatar-ring'));
// where resolved('--avatar-ring') = getComputedStyle(avatarFrame).getPropertyValue('--avatar-ring').trim()
// and the test does an rgb/string-triangle: spec out-of-scope for these commits
```

**AC10 stays unchanged**: with the full fill, contrast only improves.

**Fix:** Update `odd/tasks/phase-6-ui-polish.md` AC9 line in two places:
1. The AC9 row description: "(`boxShadow` shorthand containing resolved `--avatar-ring`; was `borderTopColor`, updated per U3 follow-up C5)"
2. The AC10 row description: unchanged (fill is now the full 25%, contrast only improves)

**R12 recommendation:** put the note **also** in the code (already done in C1's inline comment). The spec note survives for the future Playwright implementer; the code comment survives for the next reader who might be tempted to "fix" back to border.

**Effort:** 1 line in spec, 1 line in code (C1). Zero LOC net.

**Recommendation:** **A — fix now.** Cheap insurance.

---

## Sequencing (if user approves implementation)

Ship as **4 work-unit commits** on `main` (R12 refinement #6 split commit 2):

1. **`fix(ui): avatar — replace border ring with box-shadow + drop dead inner CSS (U3 follow-up C1+C2)`**
   - Avatar.svelte:71 — drop `position: relative;`
   - Avatar.svelte:81 — drop `flex-shrink: 0;`
   - Avatar.svelte:135-136 — `border` → `box-shadow` + inline comment
   - Avatar.test.ts — add `describe('Avatar.svelte ring contract')` block with 1 test
   - odd/tasks/phase-6-ui-polish.md AC9 — 1-line note (sneaked into the same commit because the comment and the spec note belong together)
   - 2 files (+1 doc line), ~+10/-3 LOC, GPG-signed.

2. **`fix(ui): composeAltText keeps status when name is empty (U3 follow-up C3)`**
   - Avatar.svelte:11-20 — rewrite the function with `!name` + `status` branch evaluated
   - Avatar.test.ts — +3 test cases
   - 1 file, ~+5/-2 LOC, GPG-signed.

3. **`fix(ui): initials() guard so empty name renders "?" not blank circle (U3 follow-up C4)`**
   - Avatar.svelte:38-43 — add `if (!n.trim()) return '?';` guard, drop unreachable branch
   - Avatar.svelte — move `initials` from `<script lang="ts">` to `<script lang="ts" module>` and export
   - Avatar.test.ts — +6 test cases (the 2 `''`/`'   '` cases prove the fix)
   - 1 file, ~+8/-3 LOC, GPG-signed.

4. **NO commit 4.** C5 is folded into commit 1 (already covered).

Total: **3 work-unit commits**, 2 files (Avatar.svelte + Avatar.test.ts) + 1 spec line in commit 1. ~+23/-8 LOC. 0 new dependencies. 0 new tokens. **0 new test infrastructure.**

Estimated: ~15 min of dev + ~5 min of verification (3× pnpm check + 3× pnpm test + 1× pnpm build + 3 commits).

---

## Verification (run before each commit, in order — R12 refinement #7)

After commit 1 (C1+C2+C5):
- `just check` → 0 errors
- `just test` → 139/139 (was 138 + 1 new ring contract test)
- `just build` → clean (R12 added this — CSS scoped change must compile through the Svelte preprocessor)

After commit 2 (C3):
- `just check` → 0 errors
- `just test` → 142/142 (was 139 + 3 new composeAltText cases)

After commit 3 (C4):
- `just check` → 0 errors
- `just test` → 148/148 (was 142 + 6 new initials cases, including 2 that prove the production fix)
- `just build` → clean

After all:
- `git log --oneline -8` → 3 new commits on top of `d789930`, all GPG-signed
- `just test` final → 148/148
- No push to remote (human-owned).

---

## Risks (R12-augmented)

- **C1 visual diff:** at xs the visible dot grows from 2 px to 10 px; at sm from 4 px to 12 px. LayoutHeader uses `sm` and doesn't pass `status` (dormant), so the change is invisible in current code paths. Future LayoutStatus avatar = online would be slightly chunkier than the original spec's intent — visually verify after deploy.
- **C1 + LayoutHeader dormant override:** with `border`, the halo was inside the dot's box; with `box-shadow`, it paints outward and may overlap the avatar content (initials or img). Dormant today, will need a visual check when the override actually exercises.
- **C3 public API change:** `composeAltText('', 'online')` now returns `'Avatar, en línea'` instead of `'Avatar'`. No current caller exercises the change (grep showed all 3 call sites either omit `status` or pair it with `name`). Safe.
- **C4 public bug fix:** `initials('')` and `initials('   ')` now return `'?'` instead of `''`. Visible change — empty-name avatars render a `?` instead of an empty circle. This is the documented intent of the function; the bug was the unreachable branch. No current caller renders an empty-name avatar (LayoutHeader passes `user.fullName`, +page.svelte passes the example names). Safe to fix.
- **C5 docs drift:** spec note is annotation. Negligible.
- **C5 + AC8 spec drift (R12):** the box-shadow ring changes what the eye sees at the dot's center. AC8 (`document.elementFromPoint`) still works (box-shadows are not hit-testable), but AC6/AC7 (bounding box) measure the box without the halo. The "50% overlap" geometric expectation now describes what the eye sees as `25% + 2px`. Phase 6.1 (Playwright loop) needs to recalibrate, not just rename.

---

## Out of scope (parked, not these follow-ups)

- **Playwright AC6–AC11 tests** for U3. These belong in "Phase 6.1 — Avatar geometry test loop" with its own planning. ~80 test cases (5 sizes × 2 shapes × 4 statuses × 2 themes) is a different deliverable shape.
- **tests/e2e/axe inclusion in vitest include pattern** — separate infrastructure gap. See `opensim/test-infra-e2e-include-gap` topic in engram.
- **Adding a `test:e2e` npm script** — same.
- **Cleaning the working tree dirty files** — user decision (commit or discard).

---

## Decision points for the user

1. Approve all 4 fixes (C1, C2, C3, C4) + spec note (C5 folded into C1) as **3 work-unit commits**? Or pick a subset?
2. mcode R12 cross-audit recommended 6 refinements (1 production bug fix in C4, 1 test contract addition in C1, 1 commit split, 3 corrections to the plan). All applied above. Approve as-is?
3. Push to remote (decision deferred per ODD)? — yes/no after commits land.

---

## Cross-reference

- mcode R11 audit log: `/tmp/opencode/mcode-u3-audit.log` (commit range `3099f24..281b9b5`)
- mcode R12 cross-audit log: `/tmp/opencode/mcode-u3-plan-audit.log` (this plan + Avatar.svelte + Avatar.test.ts + tokens.css:289-303 + spec)
- Memory observations: `opensim/phase-6-u3-audit-mcode-r11` (cascade bug), `opensim/test-infra-e2e-include-gap` (related, out of scope here)
- Spec: `odd/tasks/phase-6-ui-polish.md` lines 80-191 (U3 phases A/B/C), 173-189 (AC1–AC11)
- Last reviewed boundary: `d789930` (U3 cascade-bug fix, 2026-10-04)
- This plan version: refined per R12 on 2026-10-04