# ODD — Organic Driven Development

A predefined, mandatory workflow for AI-assisted implementation. Run it on **every request**, in this exact order, on every runtime, without the user asking for a plan, a workflow, or task tracking. Never describe this workflow only when asked about it: run it.

---

## The 7-Step Protocol (MANDATORY)

### 1. Authorize

Establish whether the requested outcome explicitly authorizes a change.

- **Read-only work** — investigation, explanation, review, audit, comparison, solution-proposal, planning-only — must not write, edit, delegate a writer, invoke apply, or create implementation artifacts unless the user explicitly requests implementation or another mutation.
- **Ambiguous or conditional intent** → ask one focused clarification and stay read-only until answered.

### 2. Explore

Inspect existing code and requirements first, proportionately to the request, before proposing or writing anything.

### 3. Resolve Uncertainty

- Recommend optional research only for a **named** uncertainty.
- Ask **one** focused user question only for a real unresolved product decision, then stop and wait.
- Use at most **one** scoped read-only assumption challenge for a high-consequence unproven premise. Name the premise, the evidence, and the consequence. Do not start a debate loop. Deterministic failures need fixes, not model debate.

### 4. Classify

The work is **substantial** when exploration yields two or more meaningful implementation steps, or progress worth recovering after an interruption. Small, understood work stays small and creates no durable task artifacts.

### 5. Track Before the First Write

For substantial authorized implementation, automatically create:

- `odd/tasks/<feature-name>.md` (file system)
- Engram recovery copy under topic `odd/<feature-name>/tasks` (mirror)

…**before the first source write**, without asking permission for tasks or storage. Tell the user in one line which feature document was created and how many tasks it holds.

### 6. Implement Task by Task

Route each task through the smallest useful topology (direct inline or delegated direct), honoring the mandatory delegation triggers, with the default applicable test-first policy and proportional checks.

- Check an item off **only after** its outcome and checks were observed. Update the file and the mirror after each task.
- Every task closes with at least **one work-unit commit** on the feature branch.
- **Branch first** when on the default branch.
- Tests and docs ship **alongside** the behavior.
- Use **Conventional Commit** messages; record the commit identity in the feature document as evidence.
- Work-unit commits on the feature branch are part of authorized substantial ODD implementation. Push, PR creation, and merge remain the user's decisions under ordinary repository policy.

### 7. Close

Report:

- the verified outcome
- every failed, skipped, or pending check
- the next step

The native review candidate is a work-unit commit or a PR slice — never a TODO checkbox and never the accumulated feature branch. Native review runs only under the user-owned receipt-driven development switch.

---

## Routing — Direct Inline vs Delegated Direct

Every authorized change takes exactly **one** implementation route:

| Route | When to use |
| --- | --- |
| **Direct inline** | Decide or verify with one parallel batch (≤ 3 calls, ~10k tokens of evidence). Use bounded search/line ranges, not whole large files. Keep one mechanical, already-understood file change inline only when it needs no research and has no unresolved design decision. |
| **Delegated direct** | Larger evidence, more than ~5 sequential lookups, or long-session mapping → one read-only explorer. Delegate one bounded writer for 2+ non-trivial files. Reading that prepares a write and broad research also delegate. |

**File count, changed lines, size, and perceived risk alone never force a heavier route.**

### Per-Action Exception

Tests, builds, installs, and review actors may still use fresh workers **without changing** the selected route.

---

## Mandatory Delegation Triggers

These triggers are mandatory, not advisory. When one fires, stop and delegate through the runtime's subagent mechanism before continuing; executing past a fired trigger inline is a routing defect even if the work succeeds.

| Trigger | Definition |
| --- | --- |
| **Mapping** | Evidence exceeds the inline batch budget, needs more than ~5 sequential lookups, or involves long-session mapping → delegate one read-only explorer. Return a handoff of at most ~2k tokens with `path:line` evidence plus one parent spot check (max 1). Do not reread the entire mapped evidence. |
| **Writer** | Implementation touches 2+ non-trivial files → delegate one bounded writer. A mechanical second-file edit does not fire this trigger solely because an earlier file was touched; count non-trivial files in the current work. |
| **Preparation** | Reading that prepares a write, and broad research or context compression → delegate together with or ahead of the write instead of filling the parent context. |
| **Output budget** | Keep parent bash output bounded to counts, `--stat`, tail, or summaries. Delegate full suites and builds; return concise observed results, including failures. |
| **Long-session backstop** | At ~150k parent-context tokens, pause and delegate the next bounded unit. Advisory context guidance only — not enforced. |
| **Route declaration** | For substantial work, record the chosen route per task (inline or delegated) and the trigger evidence in the feature document, so skipped delegation is observable instead of silent. |

---

## Test-First Policy (Default)

Apply one default test-first policy to ODD behavior changes:

- When a relevant runnable deterministic test and clear expected outcome exist → observe **RED** before implementation, implement **GREEN**, then refactor while tests stay green.
- Tests or frameworks being present alone **do not** establish applicability.
- For passive documentation, unavailable runners, or no meaningful runnable RED → explain the exception and run proportionate functional or structural checks.
- Forward the applicable runner and evidence (or the exception) to workers. **Never invent** RED/GREEN evidence or a runner.

---

## Work-Unit Commits

Plan commits as reviewable work units. Every ODD task closes with at least one such commit on the feature branch. Use **Conventional Commit** messages. Tests and docs ship with the code, not in a later cleanup commit.

The native review candidate is a work-unit commit or a PR slice — never a TODO checkbox and never the accumulated feature branch.

---

## Delivery Strategy

At feature-document creation, forecast authored changed lines (additions + deletions, generated files excluded) from the task list. Keep a running count from work-unit commits. Choose **one** delivery strategy per feature:

| Strategy | Behavior |
| --- | --- |
| `ask-on-risk` (default) | When the budget is reached, ask once for the chain strategy: `stacked-to-main` or `feature-branch-chain`. |
| `auto-chain` | Ask only for a missing chain strategy and slice automatically. |
| `single-pr` | Ship as a single pull request. |
| `exception-ok` | Acknowledge the budget is exceeded and document why. |

**Heuristic:** ~400 authored changed lines per ODD task is a planning heuristic only — not a hard cap, counter-trigger, automatic stop, forced split, or RDD trigger. If the correct, clear solution naturally exceeds it, briefly explain why and continue.

When the forecast or running count exceeds ~400 authored changed lines, apply the chosen strategy **before the next commit**. Cache both the strategy and the slice boundaries in the feature document.

---

## Decision Authority

- The **parent** owns product decisions. Ask one focused user question only for a real unresolved product decision, then stop and wait.
- **Workers** return gaps to the parent rather than assuming choices.
- **Findings alone** never authorize scope expansion or automatic acceptance. Business scope changes still require user authorization.

---

## Resume Protocol

When interrupted, resume with:

1. `mem_context` — recover recent session history.
2. Project- and feature-scoped `mem_search` — find the relevant feature.
3. `mem_get_observation` — load the full saved document.
4. The actual task file — read the current state directly.

Reconcile current requirements, code, and proof **before** resuming the next unfinished task. Preserve pending mirrors and conflicting edits.

**Mirror caveat:** If Engram is unavailable, preserve local progress and explicitly mark the mirror pending. Do not claim success or block unrelated safe work. Resynchronize when available.

---

## Non-Negotiables

- Ask **one** focused question per real product decision. Do not stack questions.
- Do **not** invent tests, evidence, or runners. RED/GREEN must be observed.
- Do **not** expand scope without user authorization.
- Do **not** mark a task complete before its outcome and checks are observed.
- Do **not** route around the mandatory delegation triggers.
- Do **not** commit, push, open a PR, or merge on your own — those stay with the user, except the work-unit commits that authorized substantial ODD implementation makes on its feature branch.
- Do **not** toggle the user-owned review switch automatically.
- Do **not** infer low risk from a failed assessment; treat it as not closed.
- Never resume against unpublished code: a source checkout, a local build, or an unmerged pull request.
