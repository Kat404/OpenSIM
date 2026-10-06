# OpenSIM — CF-3 Auth Library: Comparative Analysis

**Project:** OpenSIM (Open Source — Sistema Integral Modular)
**Document scope:** Magic Link authentication implementation strategy for SvelteKit 3 + Cloudflare D1 + Workers.
**Status:** SUPERSEDED — CLOSED 2026-10-02. Resolved as a native single-file implementation (Lucia-style pattern, no library) in `src/lib/server/auth.ts`: Web Crypto PBKDF2/SHA-256, `auth_sessions` + `student_credentials` tables, HttpOnly+Secure+SameSite=Lax cookies, **0 npm auth packages, 0 external services** (Resend cancelled; `/login/recuperar` is an informational support view). Source of truth: `odd/tasks/opensim.md:18` and `odd/tasks/opensim.md:29`. The four-option analysis below is preserved verbatim as the historical record — its recommendation (a) was only half-adopted: the Lucia single-file pattern shipped, the Resend leg did not.
**Author:** OpenCode audit on behalf of Kat404.
**Date:** 2026-10-02.

---

## Executive Summary

OpenSIM's CF-3 is the unresolved decision of which authentication library to adopt for passwordless Magic Link. Four candidates are viable; each fits a different trade-off point along the axes of *dependency footprint*, *control over implementation*, *time to working flow*, and *long-term maintenance risk*. The recommendation is **option (a) Lucia single-file + Resend HTTP**, scored against the project's FOSS-first principles, Cloudflare-native deployment target, and the minimal-feature surface (Magic Link only, no social providers).

| Rank | Option | Recommendation rationale |
| --- | --- | --- |
| 1 | (a) Lucia single-file + Resend | 0 runtime deps, MIT, FOSS-pure, Cloudflare-native, ~150 LOC |
| 2 | (c) Better-Auth | Speed-to-mvp, Magic Link out-of-box, but vendor pattern |
| 3 | (b) Custom @oslojs + Resend | 2 deps, full control, more custom code than (a) |
| 4 | (d) Auth.js | Heaviest, opinionated, only justified if multi-provider required |

---

## Context

OpenSIM is a FOSS rewrite of TecNM Morelia's academic management system. The student-facing UI in Phase 1+ of the v2 spec relies on a single authentication method: **Magic Link** delivered to the institutional email account. There is no password, no second factor in scope, no social provider. The backend persistence layer is Cloudflare D1 (SQLite at the edge), the runtime is Cloudflare Workers, and the deployment target is Cloudflare Pages.

These constraints narrow the auth library search significantly. The library must:
1. Operate in the Workers runtime (no `node:crypto`, no `Buffer`, no `fs`).
2. Use Web Crypto API (`crypto.subtle`) or a Workers-compatible primitive library.
3. Not require a long-running connection or external state (sessions are stateless or D1-backed).
4. Be MIT-licensed (FOSS-only constraint from the project's principles).
5. Not introduce a database abstraction (Drizzle ORM is already the source of truth).

Email delivery is treated as a separate concern (Resend, Cloudflare Email Routing, SMTP, etc.) but is constrained by the Workers runtime: any solution using `nodemailer` requires a Node-compatible runtime, which `adapter-cloudflare 8.0.0` does not provide without `nodejs_compat` flag and a polyfilled `net.Socket`.

---

## Common ground across all four options

| Concern | Shared by all four |
| --- | --- |
| Magic Link flow shape | Email contains single-use token URL → server validates → sets session cookie |
| Token storage | D1 table (`auth_tokens`) with `id`, `user_id`, `expires_at`, `consumed_at` |
| Session cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, signed/encrypted payload |
| Email transport | Outbound HTTP fetch (Workers-native) to a transactional email API |
| User model | Existing `student_profiles` row keyed by `controlNumber` (no separate `users` table) |
| CSRF | SvelteKit form actions handle origin checks; no extra library needed |
| Rate limiting | To be implemented at the `hooks.server.ts` layer (KV-based) |

The four options diverge on **how much of the above each library owns** versus **how much is application code**.

---

## Option (a) — Lucia single-file session + Resend HTTP

### Source of truth

- Lucia v3 was deprecated in March 2025.
- The maintainer (`pilcrowOnPaper`) published a single-file replacement at <https://github.com/lucia-auth/lucia/blob/main/lucia/index.ts> (MIT).
- Reference implementation: <https://lucia-auth.com/sessions/cookies/sveltekit>.

### Characteristics

- **License:** MIT.
- **Runtime deps:** 0. The "library" is a single TypeScript file (`session.ts`, ~200 lines) imported into the project.
- **Bundle impact:** +0 KB (no third-party runtime).
- **Required primitives:** `crypto.subtle` (built into Workers) for HMAC-SHA256 session token signing.
- **Storage:** D1 table `auth_sessions` (`id`, `user_id`, `expires_at`).

### Advantages

- Zero supply-chain surface. Nothing to `pnpm audit`, nothing to update.
- Exact fit with the project's FOSS principles (no SaaS, no telemetry, no remote calls).
- The single-file reference is small enough to fully internalize — no "magic" the team doesn't understand.
- Token rotation, cookie signing, CSRF mitigation are all explicit application code, easy to audit.
- Cloudflare Workers compatibility is trivial (only uses `crypto.subtle` and standard `fetch`).

### Disadvantages

- You own the entire surface. Bugs in session validation are your bugs.
- No "official" community support channel; mailing list / GitHub Discussions only.
- No plugin ecosystem (every feature is hand-rolled).
- The single-file pattern is documented but not packaged — no versioned releases, no changelog.
- Magic Link email-template logic is custom (you write the HTML email body).

### Gaps to audit before adoption

1. **Single-file version drift.** The reference file is the source of truth, but its commit history is not versioned. Pin to a specific commit SHA when vendoring.
2. **Cookie attribute compliance.** The reference uses `HttpOnly` + `Secure`; verify `__Host-` prefix for production to lock down the cookie name.
3. **Session-fixation mitigations.** Confirm the reference rotates session IDs on auth events. Document explicitly if not.
4. **Token entropy.** Verify the reference uses ≥128 bits of entropy for session IDs (`crypto.getRandomValues(new Uint8Array(20))` or similar).
5. **Replay protection.** Confirm consumed tokens are marked in D1 atomically (`UPDATE ... WHERE consumed_at IS NULL`).
6. **Email template accessibility.** Custom HTML email should be screen-reader-friendly (table-based layout, alt text on images, ≥4.5:1 contrast).
7. **Resend API key handling.** API key must live in `wrangler secret put RESEND_API_KEY`, never in source or `.env` files committed to the repo.
8. **DNS for `mail.from`.** Resend requires verified sending domain; for TecNM Morelia, this is `sim.tecnm.mx` or similar.
9. **D1 migration for `auth_sessions` and `auth_tokens`.** Add tables to `drizzle/0000_*.sql` or generate a new migration.

### Estimated work

- ~150 LOC for auth flow.
- ~30 min for setup (vendor single-file, write migrations, configure Resend).
- ~1h for tests (Vitest covering token generation, validation, expiry, replay).
- ~30 min for hook integration (`hooks.server.ts`).

---

## Option (b) — Custom with @oslojs primitives + Resend HTTP

### Source of truth

- Oslo (formerly Oslo, now `@oslojs/*` family) at <https://oslojs.dev> — modular MIT-licensed primitives.
- Specific packages: `@oslojs/crypto`, `@oslojs/encoding`, `@oslojs/jwt` (optional).

### Characteristics

- **License:** MIT.
- **Runtime deps:** 2-3 packages from the `@oslojs` family.
- **Bundle impact:** ~15 KB minified+gzipped.
- **Required primitives:** None from stdlib; everything comes from Oslo.
- **Storage:** D1, same as (a).

### Advantages

- Composable: pick only the primitives you need (e.g., just SHA-256 hashing, no JWT).
- Each package is single-purpose and audited separately.
- TypeScript-native with no decorators or runtime metaprogramming.
- Oslo is maintained by the same person as the original Lucia; long-term commitment signal.

### Disadvantages

- Still 2+ deps, which violates the "zero supply chain" property of (a).
- More verbose than (a) for Magic Link specifically — Oslo doesn't ship a "session" abstraction, only primitives.
- Less battle-tested in production than (a)'s single-file pattern (which inherits the production history of all Lucia users).
- Magic Link is hand-rolled; no template.

### Gaps to audit before adoption

1. **Worker runtime compatibility of each `@oslojs` package.** Some packages assume Node-style APIs; check for `Buffer` usage (Workers polyfill via `nodejs_compat` flag may be required).
2. **Versioning policy.** Oslo packages have not always stayed semver-strict. Pin exact versions.
3. **Subtree of package lockfile.** Verify no transitive deps sneak in (`pnpm ls --depth=1` on the project).
4. Same audit items 2-9 from option (a) apply.

### Estimated work

- ~250 LOC for auth flow (more glue code than (a) since you compose primitives).
- ~45 min for setup.
- ~1h for tests.
- ~30 min for hook integration.

---

## Option (c) — Better-Auth + Resend plugin

### Source of truth

- Better-Auth at <https://www.better-auth.com> — framework-agnostic auth library.
- Plugin: `better-auth/plugins/magic-link` (or similar) for passwordless.
- SvelteKit integration: official adapter at <https://www.better-auth.com/docs/integrations/svelte>.

### Characteristics

- **License:** MIT.
- **Runtime deps:** `better-auth` core + `magic-link` plugin (counts as 1 logical dep but may be 2 npm packages).
- **Bundle impact:** ~40 KB minified+gzipped.
- **Storage:** Drizzle adapter for Better-Auth (uses the existing Drizzle schema).

### Advantages

- Magic Link flow is pre-built: token generation, email template, callback URL, session creation.
- SvelteKit adapter is officially supported and tracks the framework's API changes.
- Schema management via Drizzle adapter integrates with the existing migrations.
- Active community, frequent releases, growing ecosystem.
- Type-safe end-to-end via Better-Auth's `auth()` client helper.

### Disadvantages

- Opinionated schema additions: Better-Auth may add tables/columns not in the v2 spec.
- "Magic" surface: how token validation, session signing, and CSRF are implemented is not always transparent.
- Vendor pattern: switching away later means rewriting integration.
- Update risk: minor versions can introduce breaking config changes (smaller than Auth.js but real).
- Some advanced features (rate limiting, anomaly detection) are paid/hosted in their cloud offering; the FOSS core is solid but the value-add is in the SaaS.

### Gaps to audit before adoption

1. **Drizzle adapter for SvelteKit 3 / Drizzle 0.45.3.** Confirm adapter version matrix — SvelteKit 3 is recent; verify the adapter was tested against it.
2. **Schema conflicts.** Better-Auth's required tables (`user`, `session`, `account`, `verification`) may collide or extend the v2 spec's `student_profiles` and the proposed `auth_sessions`. Decide: separate tables vs extend existing.
3. **Email template customization.** The Magic Link plugin ships a default HTML email; verify it can be replaced cleanly with a Spanish, institutional template.
4. **Edge runtime parity.** Better-Auth's middleware must run in Workers; check for `node:fs` or `node:net` references in the build output.
5. **Token TTL defaults.** Confirm Magic Link token expiry is configurable to a sensible value (10-15 min recommended).
6. Same audit items 2, 3, 6, 7, 8, 9 from option (a) apply.
7. **License of plugins.** Confirm all required plugins are MIT (some "pro" plugins may be source-available but not OSI-approved).

### Estimated work

- ~80 LOC for glue code (most of the flow is in the library).
- ~15 min for setup.
- ~30 min for tests (mostly integration tests, not unit tests of library internals).
- ~30 min for hook integration + Drizzle adapter config.

---

## Option (d) — Auth.js (NextAuth fork) with SvelteKit adapter

### Source of truth

- Auth.js at <https://authjs.dev> (formerly NextAuth).
- SvelteKit adapter: `@auth/sveltekit` at <https://authjs.dev/reference/sveltekit>.
- Email provider with Nodemailer (default) or a custom HTTP-based provider for Resend.

### Characteristics

- **License:** MIT (core). Plugin/provider license varies; verify each.
- **Runtime deps:** `@auth/core` + `@auth/sveltekit` + `nodemailer` (or custom Resend provider) = 3+ packages.
- **Bundle impact:** ~80 KB minified+gzipped.
- **Storage:** Drizzle adapter is community-maintained; not first-class.

### Advantages

- Largest provider ecosystem: Google, GitHub, Microsoft, Apple, etc. all built-in.
- Battle-tested at scale (origin in NextAuth, deployed by Vercel/Auth0 for years).
- CSRF, session rotation, JWT vs database session — all configurable.
- Spanish-language documentation in many places.

### Disadvantages

- **Heaviest footprint** of all four options; violates the FOSS-minimal principle of OpenSIM.
- **SvelteKit adapter is community-tier**, not first-party. Lag risk when SvelteKit ships breaking changes (SvelteKit 3 just released).
- **Nodemailer requires `nodejs_compat`** Workers flag and a polyfilled SMTP transport. Operational complexity for sending email from Workers.
- **Config schema evolves** between major versions; upgrade risk is high.
- **Magic Link is a "provider" in Auth.js**, not the canonical flow — patterns are less idiomatic.
- **JWT vs database session debate** applies; choosing wrong has security implications.

### Gaps to audit before adoption

1. **SvelteKit 3 compatibility of `@auth/sveltekit`.** This is critical — the package may not have been updated for SvelteKit 3's new init flow (`pnpm dlx sv add` instead of `pnpm create svelte`).
2. **Workers compatibility of Nodemailer.** Without `nodejs_compat`, Nodemailer fails. With it, cold start time increases.
3. **Drizzle adapter maturity.** The community adapter at <https://authjs.dev/reference/adapter/drizzle> may not be tested against Drizzle 0.45.3.
4. **Resend as custom provider.** Writing a custom Auth.js email provider is well-documented but adds boilerplate.
5. **License review of every transitive dep.** Auth.js's plugin graph pulls in a wide tree.
6. Same audit items 6, 7, 8, 9 from option (a) apply.

### Estimated work

- ~80 LOC for glue code, ~150 LOC for the custom Resend provider.
- ~25 min for setup.
- ~1h for tests (config-driven, harder to unit test).
- ~1h for hook integration + adapter config.

---

## Panorama: FOSS auth landscape, Oct 2026

The passwordless / Magic Link space has consolidated around three forces in 2024-2026:

1. **Lucia's deprecation** (March 2025) created a vacuum that Oslo's primitives, Better-Auth, and a handful of single-file reference implementations are filling. There is no single "Lucia successor" — each option inherits a different slice of the original project's responsibility.
2. **Cloudflare's promotion of edge-native auth** via Workers + D1 + KV has produced a new wave of opinionated libraries (Better-Auth among them) that assume edge deployment as the default. This trend favors (a), (b), and (c) over (d), which predates the edge-first era.
3. **SvelteKit 3's release** (early 2026) broke a number of adapter patterns that relied on SvelteKit 2's `svelte.config.js` + `@sveltejs/adapter-*` flow. Every auth library in this comparison had to update its SvelteKit integration. Audit items above for each option call this out explicitly.

For OpenSIM specifically — FOSS-only, Cloudflare-native, Spanish UI, single auth method (Magic Link), education-sector data — the dominant considerations are:

- **Supply chain:** minimize deps (favors (a)).
- **Edge runtime:** must work in Workers (favors (a), (b), (c); neutral on (d) with effort).
- **Long-term maintenance:** who owns the code, what happens if the upstream project dies (favors (a) where the team owns everything).
- **Time to working flow:** Magic Link in production this week (favors (c)).
- **Spanish email template + institutional branding:** all four require custom email; (a) and (b) have the most flexibility; (c) has a plugin that needs override; (d) is provider-themed out-of-the-box.

---

## Audit checklist (universal)

Before adopting **any** option, verify:

1. **D1 migrations:** `auth_sessions` and `auth_tokens` (or equivalent) tables exist in the schema and migration files.
2. **Session cookie attributes:** `HttpOnly`, `Secure`, `__Host-` prefix in production, `SameSite=Lax`.
3. **Token entropy:** ≥128 bits per token, generated via `crypto.getRandomValues`.
4. **Token expiry:** ≤15 minutes for Magic Link; ≤30 days for sessions (refreshable).
5. **Replay protection:** consumed tokens cannot be reused; expired tokens are rejected.
6. **Rate limiting:** at least 5 Magic Link requests per email per hour; KV-backed.
7. **Email DNS:** SPF, DKIM, DMARC records for the sending domain.
8. **Email accessibility:** table-based HTML, alt text, ≥4.5:1 contrast.
9. **Audit logging:** auth events (request, success, failure) logged with timestamp and `controlNumber`.
10. **WCAG AA compatibility:** login form meets contrast and keyboard navigation requirements.
11. **wrangler secret:** `RESEND_API_KEY` (or equivalent) stored in Cloudflare secret store, not in source.
12. **.gitignore:** `.dev.vars`, `.env*` ignored; `worker-configuration.d.ts` is generated, not committed.
13. **Tests:** Vitest unit tests for token validation, session cookie integrity, replay protection.
14. **Documentation:** `odd/` directory gets a `cf-3-decision.md` recording the chosen option and rationale (this document can serve as input).

---

## Recommendation

**Option (a) — Lucia single-file session + Resend HTTP.**

Reasoning, in order of weight:

1. The project is FOSS-first and 0 deps aligns with that.
2. Cloudflare Workers + D1 + Web Crypto API is the entire stack needed; nothing else is required.
3. Magic Link is the only flow; no plugin ecosystem needed.
4. Update risk is zero — the team owns the code.
5. The single-file pattern is documented, MIT, and small enough to fully internalize (~200 LOC).
6. Spanish email template is custom anyway, so losing Better-Auth's default template is not a real cost.

Alternative recommendation: **option (c) Better-Auth** if the team prefers speed-to-mvp over FOSS purity. The Drizzle adapter and SvelteKit integration are mature; Magic Link is a single config flag. The trade-off is +40 KB bundle, vendor pattern, and a license review of every plugin.

**Avoid (d) Auth.js** unless multiple OAuth providers are required (which is out of scope for the v2 spec).

**Defer (b) Custom @oslojs** unless the team has specific primitives from Oslo they want to reuse (e.g., for password hashing in a future flow). For Magic Link alone, (a) is shorter and clearer.

---

## References

- Lucia project status: <https://github.com/lucia-auth/lucia> (deprecated March 2025; successor patterns documented in the repo and at <https://lucia-auth.com>).
- Auth Book: <https://authbook.dev> (concepts reference, by the same maintainer as Lucia).
- Oslo primitives: <https://oslojs.dev>.
- Better-Auth: <https://www.better-auth.com>.
- Auth.js: <https://authjs.dev>.
- Resend email API: <https://resend.com/docs/api-reference/emails/send-email>.
- Cloudflare Email Workers: <https://developers.cloudflare.com/email-routing/email-workers/>.
- Cloudflare Web Crypto API: <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>.
- SvelteKit hooks documentation: <https://svelte.dev/docs/kit/hooks>.
- WCAG 2.1 AA authentication: <https://www.w3.org/WAI/WCAG21/Understanding/>.
- OpenSIM v2 spec, §9 (Decisiones Técnicas) and §11 (Estrategia de Datos): <https://github.com/>... (this repo).
