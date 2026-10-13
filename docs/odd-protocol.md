---
name: gentle-ai
description: "Trigger: any implementation request — implement, fix, refactor, bug, plan. Runs the mandatory 7-step ODD workflow (authorize → verify) with task sizing, delegation triggers, test-first, risk lines, and native review."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# gentle-ai — Organic Driven Development

## Activation

Trigger on **every request**, in this exact order, on every runtime, without the user asking for a plan, a workflow, or task tracking. Never describe this workflow only when asked for it: run it.

Audience: agents on a full runtime — local filesystem, subagent/delegation mechanism, git, tests.

**Source of truth.** This skill is a readable digest of the ODD rules installed in the `gentle-orchestrator` agent contract (managed by `gentle-ai`). Where this file and the installed contract disagree, **the installed contract wins**. Last synced: 2026-10-12.

**Vocabulary.** The contract calls the non-small class **large**. Do not rename it — no synonym in this file means a different rule.

## Hard Rules

- Ask **one** focused question per real product decision. Never stack questions.
- **Never** invent tests, evidence, runners, or tool capabilities. RED/GREEN must be observed. If a tool is unavailable, say so plainly.
- **Never** claim success on operations the runtime refused, denied, or never executed, and never fabricate authority — do not speak as if you have permissions, memory, or tools you lack.
- **Never** expand scope without user authorization. Findings alone authorize nothing.
- **Never** mark a task complete before its outcome and checks are observed. A checkbox grants no approval.
- **Never** classify a task by counting files, commands, tests, fixes, or a requested todo list.
- **Never** delegate a writer on file count. A writer fires only for a named reason: **parallelism** or **context backstop**.
- **Never** close a code change without its **Risk line**.
- **Never** route around a mandatory delegation trigger. A high-risk change always gets an independent verifier.
- **Never** commit, push, open a PR, or merge on your own — those stay with the user, except the work-unit commits authorized large ODD implementation makes on its feature branch.
- **Never** toggle the user-owned review switch automatically, in either direction.
- **Never** infer low risk from a failed assessment; treat it as not closed.
- **Never** resume against unpublished code: a source checkout, a local build, or an unmerged pull request.
- **Never** accept an ambiguous answer to a closed single-select, and never use chat text as consent, auto-select an option, or synthesize a continuation.
- **Never** summarize, abbreviate, reorder, relabel, merge, or omit a blocking prompt's choices. If it cannot be presented without losing a decision, stop and report that.
- **Never** discover or reuse ambient credentials, agents, sockets, or authenticated sessions as permission to use them. Local development permission does **not** authorize remote execution or file transfer; require explicit per-operation authorization and stay local when it is ambiguous.
- **Language domain:** the persona controls direct conversation only. Generated technical artifacts default to **English** regardless of persona or conversation language. Public or contextual comments follow the target context language; otherwise a neutral/professional register. Forward this contract to every worker.
- Be concise. This protocol lives in your instructions; surface it only when relevant.

## Decision Gates

### Task size

A task is **small** only when all three hold:

1. **Understood** — outcome specified, what and where to change is known, no product or design decision open, provable within one bounded read batch (≤ 3 calls, ~10k tokens).
2. **Contained risk** — touches no high-risk item (table below).
3. **Resumable from the diff** — if the session stopped now, someone could finish from the original request plus `git diff` alone.

A task is **large** only when the resume test fails: several sessions, waiting on something external, separate deliverables, or requirements too long to survive compaction.

| Small                            | Large                                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| Route: direct inline             | Route: inline by default; delegated only when a named trigger fires |
| No durable artifacts             | Feature document + Engram mirror                                    |
| Commits only when asked          | ≥ 1 work-unit commit per task                                       |
| Own focused test + suite, inline | Own checks, then the risk tier                                      |

### High risk

A mistake is high risk when it would be hard to detect, hard to undo, or reaches beyond the change:

| #   | Class                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Data or irreversible effects** — migrations, changing or deleting stored data, persisted format changes (not saving new records).                                                                                  |
| 2   | **Security** — auth, permissions, credentials, secrets, guards, sandbox.                                                                                                                                             |
| 3   | **Contracts others consume** — changing or removing a public API, CLI flags, config formats, published exports, or mirrored prompts/contracts (not adding an optional field; unrequested breaks in shared code are). |
| 4   | **Concurrency** — locks, races, async ordering.                                                                                                                                                                      |
| 5   | **Delivery or environment** — installers, release, CI, deploy, dependencies.                                                                                                                                         |
| 6   | **No test would catch a regression** in what changes.                                                                                                                                                                |

Count "unclear" as high when a bounded look cannot rule out 1–5. A tier returned by native assessment wins and may only be **raised**, never lowered, via `--escalate-item <1-6> --escalate-reason "<one line>"`.

### Delegation triggers

Mandatory, not advisory. When one fires, stop and delegate before continuing; executing past a fired trigger inline is a routing defect even if the work succeeds.

| Trigger                   | Gate → action                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ask**                   | Open product or design decision → one focused user question, stop and wait.                                                                                                                                                                                                                                      |
| **Mapping**               | Evidence exceeds the inline batch budget, needs >~5 sequential lookups, or involves long-session mapping → one read-only explorer. Handoff ≤ ~2k tokens with `path:line` evidence; parent does one spot check (max 1) and never rereads the whole mapping.                                                       |
| **Writer**                | Named reason only: (a) **parallelism** — 2+ independent units, disjoint edit surfaces, each clearly heavier than starting a subagent, launched together; (b) **context** — the long-session backstop. Never for size, a large task alone, file count, or price ratio. Without a reason the parent writes inline. |
| **Preparation**           | When a writer is delegated, its prerequisite reading plus broad research and context compression delegate together with or ahead of it. An inline write reads inline.                                                                                                                                            |
| **Verification**          | High-risk change → independent verifier **after** the change's own checks. Otherwise the author runs its focused test and suite inline, small tasks included.                                                                                                                                                    |
| **Output budget**         | Keep parent shell output bounded to counts, `--stat`, `tail`, summaries. Delegate long suites and builds; return concise observed results including failures.                                                                                                                                                    |
| **Long-session backstop** | At ~150k parent-context tokens, pause and delegate the next bounded unit. Advisory, not enforced.                                                                                                                                                                                                                |
| **Route declaration**     | Large work records the chosen route per task and its trigger evidence in the feature document, so skipped delegation is observable rather than silent.                                                                                                                                                           |
| **Tracking**              | Large task → feature document + mirror + work-unit commits.                                                                                                                                                                                                                                                      |

**Parallel writers.** Another repository → a fresh worktree based on that repository's main, never a checkout someone else may be using. Same local repository → share the tree only with declared disjoint edit surfaces. The parent owns git; writers run no repository-wide formatters, generators, or installs. A shared file has one owner, or the parent edits it at the end. The parent checks each writer's diff against its declared surface before accepting it. One seam check (the full suite, once) at the end. Units needing the same file use isolated worktrees.

**Allowed edit surfaces.** A bounded writer refuses to write outside its exact surfaces and stops for interaction when they are missing. The **parent** derives the surface from the delegated task — files the change must touch plus directories where new files are authorized — as repository-relative paths or narrow globs, one per line, under an `## Allowed edit surfaces` heading. Never `.`, a bare repository root, or an absolute path. List pre-existing untracked targets explicitly. Nothing beyond the delegated task; a surface wider than the task is the same defect as no surface at all. If it cannot be derived: do not launch the writer, and do not ask the human to author paths — derive the candidate set and present that enumerated list as an approve/decline choice. A free-text "which paths?" question is never a valid escalation.

### Verification tiers

Run `gentle-ai review assess --cwd <repo> --agent opencode --json` over a delegated writer's diff; any assessment failure or unrecognized verb is treated as **high**.

| Tier                    | Requirement                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **passive**             | Structural readback only.                                                                        |
| **medium**              | Writer self-verification, plus a separate verifier when the writer ran on a small-model profile. |
| **high / unassessable** | Writer self-verification **plus** an independent verifier.                                       |

A small-model profile (low effort or a mini model) raises the tier by one for verification purposes. The parent spot check — re-running one reported command before delivery — applies in every tier.

**Correction bounds:** one correction batch fixing every reported blocker, then one recheck limited to those blockers. A second correction runs only when the recheck shows the same blocker still failing; a new finding never earns one. Blockers still open after that become one **Needs your decision** result, and the writer reports `partial`.

**Verify handoff:** give the verifier the whole feature document (every `S#`, never one task), the baseline commit, and the probe command forms. On first launch the verifier runs probes in a fresh scratch copy made with `mktemp -d` under the system temp dir — never inside the workspace — and leaves no new workspace file. Probes derive from the specs plus invariants: the data hash is unchanged after a rejected command, and prior commands' output matches the baseline. A blocker is a change-caused defect or unmet spec item reproducing with realistic input that did not reproduce at baseline; baseline-present defects and out-of-domain values are advisories; silently ignoring an explicit option with success, or changing existing output nobody asked to change, is always a blocker. The writer commits the probes as regression tests.

When the same model wrote several deliveries of one feature inline, run one independent verifier at the feature's end instead of one per delivery; verify per unit only when it is really high risk, and always when a smaller-model profile wrote the code.

### Test-first applicability

| Situation                                                  | Gate → action                                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runnable deterministic test + clear expected outcome exist | Observe **RED** before implementation, **GREEN** after, then refactor while green. One RED test per requested rule.                                         |
| An existing command or option the change touches           | Add **one** test proving its previous behavior still holds. Add no other cases. Touched means sharing changed code (options, parsers, helpers, validation). |
| Tests or frameworks merely present                         | Does **not** establish applicability.                                                                                                                       |
| Passive documentation, no runner, or no meaningful RED     | State the exception and run proportionate functional or structural checks.                                                                                  |

Forward the applicable runner, this discipline, and the evidence (or the exception) to workers. Never invent RED/GREEN evidence or a runner.

### Native review (RDD)

RDD is **user-owned**: `gentle-ai review mode enable|disable|status`. On by default and opt-out; an explicit global or clone-local off still wins; candidate consent is separate from the mode default. `status` is read-only — a `default` deciding source means nobody has chosen, so the effective mode is on. When the user asks to stop, run `disable`: do not argue, do not work around it, do not propose alternatives first. While disabled, keep implementing organically; never start, retry, or reactivate a review.

Per work-unit commit, when enabled:

```
gentle-ai review assess --cwd <repo> --agent opencode --base-ref <last reviewed boundary> --committed-only --json
```

| `review_due_reason`              | Gate → action                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `high_risk`                      | `review_due` true → run the returned `next_transition.command` verbatim with `--lenses`/`--lenses-reason` appended; follow the transitions it returns. Boundary advances once acknowledged. |
| `passive`                        | No review. Record the reason; the boundary advances.                                                                                                                                        |
| `under_budget`                   | Stays pending in this slice until a later commit reaches the budget.                                                                                                                        |
| `already_reviewed`               | This range is already covered by terminal authority.                                                                                                                                        |
| assessment failed or unavailable | Treat the commit as due; run the preflight STATUS with `--base-ref <last boundary> --committed-only`. Never lower the tier.                                                                 |

The first boundary is the branch point; every reviewed boundary becomes the next base. Record per task the assessed tier and outcome: granted, declined, passive, under budget, already reviewed, or unavailable.

Review is an extra outside view for high-risk work, never a per-candidate ritual. It selects **0–4 lenses** by consequence, not file names: `risk` (a mistake could expose, lose, or irreversibly change something), `resilience` (behavior under failure, retries, timeouts, partial writes, load, concurrency), `readability` (what others read or depend on — public APIs, command output, docs, structure), `reliability` (logic or observable behavior tests should pin). Requirement compliance is verification's job before review and is never a lens reason.

### Blocking prompts and provider defects

When a tool or subagent returns a user-facing blocking prompt, relay it **losslessly**: why input is required; every group and question in original order including headers; every option label and description; the selection mode; the exact allowed-answer domain. A question about the block itself — why input is required, what a choice means, what happens next — is a request for information, not a candidate answer: answer it from the envelope already held, then re-present the envelope and keep waiting.

**Provider defect handoff.** When the failure was produced by a Gentle AI invocation — its non-zero exit, its typed envelope, its refusal, or its own documented contract refusing — ask the user for explicit consent first, presenting one single-select with exactly three choices: report and continue / continue without reporting / stop here. A failure produced by the model provider, the client runtime, the environment, or the user's own repository state is **not** reportable: do not name a component, do not suggest where else to file it, do not ask. Say plainly what blocked the work, then continue or stop as the workflow dictates.

## Steps

1. **Authorize.** Establish whether the outcome explicitly authorizes a change. Read-only work — investigation, explanation, review, audit, comparison, solution-proposal, planning-only — must not write, edit, delegate a writer, invoke apply, or create implementation artifacts unless the user explicitly requests implementation or another mutation. Ambiguous or conditional intent → one clarification, read-only until answered. Implementing when only exploration was authorized is costly and hard to reverse.

2. **Explore.** Inspect existing code and requirements first, proportionately to the request, before proposing or writing anything.

3. **Resolve uncertainty.** Recommend optional research only for a **named** uncertainty. Ask **one** focused user question only for a real unresolved product decision, then stop and wait. Use at most **one** scoped read-only assumption challenge for a high-consequence unproven premise — name the premise, the evidence, and the consequence; no debate loops. Deterministic failures need fixes, not model debate.

4. **Classify.** Apply the Task size gate. Size drives route, tracking, commits, and verification tier.

5. **Track before the first write.** Large authorized implementation automatically creates — before the first source write, without asking permission for tasks or storage — `odd/tasks/<feature-name>.md` plus an Engram recovery copy under topic `odd/<feature-name>/tasks`. Tell the user in one line which feature document was created and how many tasks it holds.

   The feature document is the specification workers read, in this fixed order: a 2–3 line header (objective, branch, delivery strategy, test runner); `## Specs` with numbered `S1..Sn` quoting the user's exact strings, error messages, commands, and examples **verbatim**, never summarized or reworded, never adding unrequested requirements, with assumptions marked as assumptions; `## Tasks` with one line per task (stable ID, linked `S#`, route, status, commit identity or RED/GREEN evidence); `## Log` last, where `L1` is the user's original request verbatim and later corrections, evidence, and decisions are appended.

   The two writes are not atomic — read both back. If Engram is unavailable, preserve local progress, mark the mirror pending explicitly, and do not claim success or block unrelated safe work; resynchronize when available. On an irreconcilable edit, preserve both versions and ask about the real conflict only. A requirement change appends its verbatim Log entry, rewrites only the affected `S#`, and reopens only its linked task; valid completed and unrelated work is preserved.

6. **Implement task by task.** Route through the smallest useful topology per the gates above. Hand off **by reference, never by paraphrase**: name the document, the task, and the specs; workers read until `## Log` and report which `S#` they covered. Check an item off only after its outcome and checks were observed; update the file and the mirror after each task. Each test asserts every observable effect of the rule (output, exit code, persisted data), covers the cases the rule names, and goes through the public interface. When you add or change a command, option, or message, update the help text and docs in the same task. When the user reports a failure, reproduce it before deciding it already works. Every task closes with at least one work-unit commit on the feature branch; branch first when on the default branch. Use Conventional Commit messages and record the commit identity in the feature document as evidence. Tests and docs ship alongside the behavior. Push, PR creation, and merge remain the user's decisions under ordinary repository policy.

   **Delivery strategy.** At feature-document creation, forecast authored changed lines (additions + deletions, generated files excluded) and keep a running count from work-unit commits. Choose one strategy per feature: `ask-on-risk` (default — when the budget is reached, ask once for `stacked-to-main` or `feature-branch-chain`), `auto-chain` (ask only for a missing chain strategy and slice automatically), `single-pr`, or `exception-ok` (acknowledge and document). Cache the strategy and slice boundaries, including which commits each PR holds, in the feature document. Resolve the `work-unit-commits` and `chained-pr` skills by name before planning or creating any PR; never hardcode their paths.

   The ~400-authored-lines-per-task figure is a **planning heuristic only** — not an acceptance criterion, hard cap, counter-trigger, automatic stop, forced split, or RDD trigger. If the correct solution naturally exceeds it, explain why briefly and continue. Never delete spaces, comments, or tests for cosmetic line savings.

7. **Close.** Report the Output Contract below.

## Output Contract

A closed task reports, in this order:

- the verified outcome;
- every failed, skipped, or pending check;
- the next step;
- the **Risk line**: `Risk: item N (reason)` or `Risk: none`, numbered against the High Risk table. Before writing `Risk: none`, check whether the diff changes code that existing behavior the request did not mention also uses (shared options, parsers, helpers, validation); if it does, that is item 3.

A tracked task ends **pending** only with the user's explicit stop, or with one **Needs your decision** result naming the open blockers or the missing proof. Partial, blocked, unavailable, or exhausted proof becomes that one result — never more verification.

Delivery follows ordinary repository policy. Once review closes, commit, push, PR, and release remain separate human decisions; a review outcome is informational and never authorizes delivery.

## References

- Installed `gentle-orchestrator` agent contract (managed by `gentle-ai`) — the authority this skill mirrors.
- `docs/odd-protocol-chat.md` — the chat-runtime adaptation; same classification, triggers, and non-negotiables, different mechanism column.
- `README.md` — project purpose and documentation map.
- `AGENTS.md` — project execution rules, `just` recipes, and the audit-subagent threshold.
- `odd/tasks/` — feature documents produced by step 5.
