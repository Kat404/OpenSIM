/**
 * OpenSIM — e2e agentic end-to-end configuration.
 *
 * The agent steps run against a real browser and a real model gateway, which
 * makes two things true that this file exists to enforce:
 *
 * 1. **The target is pinned to localhost.** `APP_URL` is read from the
 *    environment so the suite can attach to an already-running dev server, but
 *    a non-loopback host is rejected outright. Without that check, one env var
 *    turns a test run into an agent driving the production Worker — and this
 *    app's production database holds the demo student.
 *
 * 2. **No key is written here.** The gateway credential comes from
 *    `LLM_API_KEY`, which lives in `.env` and is gitignored. Never inline it.
 *
 * Telemetry is a separate concern and is disabled through `E2E_TELEMETRY_DISABLED`,
 * not through this file — see `.env` and the `justfile`.
 *
 * Model: `MiniMax-M3`, per MiniMax's OpenAI-compatible API reference. The other
 * ids that endpoint accepts are the M2.x variants and `MiniMax-M3.1-Flash-Preview`,
 * which the vendor gates behind the M Plan and MiniMax Code rather than behind a
 * plain API key. The gateway is MiniMax's, so a first-party OpenAI model id would
 * 404 here — that is what the scaffolded `gpt-6-luna` would have done.
 */
import { existsSync } from "node:fs";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";
import { withTolerantStructuredOutput } from "./e2e-structured-output-shim";

// e2e deliberately loads no `.env` of its own (reference/config.mdx
// §Loading). Without this line the model key and the telemetry opt-out are
// both inert, and a run fails with "Please carry the API secret key" rather
// than anything naming the missing variable. Guarded because
// `loadEnvFile` throws when the file is absent, and every worker re-imports
// this config.
if (existsSync(".env")) process.loadEnvFile(".env");

/** The dev server port. Matches `playwright.config.ts` and the SvelteKit default. */
const LOCAL_ORIGIN = "http://localhost:5173";

function resolveLocalUrl(): string {
	const raw = process.env.APP_URL ?? LOCAL_ORIGIN;
	const url = new URL(raw);
	// `localhost` and `127.0.0.1` are the only acceptable hosts. Anything else
	// is either the production Worker or a typo, and in both cases the agent
	// would be driving something that is not a throwaway.
	if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
		throw new Error(
			`APP_URL must point at a local dev server. Got "${url.hostname}". ` +
				"e2e drives a real browser with a real model, so it must never be " +
				"pointed at the deployed Worker.",
		);
	}
	return url.origin;
}

export default {
	// Accounts the tests sign in with. The password is deliberately absent:
	// `E2E_USER_ALUMNO_PASSWORD` (uppercased name, non-alphanumerics to `_`)
	// overrides `credentials.alumno.password` at load time, so the secret lives
	// only in `.env` and never in this file, in `report.json`, or in the
	// config's printed source. Set it there; do not add a fallback here.
	//
	// The control number stays inline because a credential's `username` is a
	// plain string by design. It is invented demo data (see AGENTS.md).
	//
	// `12345678` since 2026-10-19, and the reason is the whole point of the
	// agentic lane: this student has 49 rows in `student_progress` (175
	// approved credits, 3 complementary ones), so a judgment can be made
	// about DATA. With the previous `99999999` — zero rows — every screen
	// rendered an empty state and the tests could only assert things that
	// could not fail; the enrolment-term test even passed against the code
	// it was written to catch, because the bug it hunted was only reachable
	// for a student who has history.
	//
	// The Playwright suite deliberately keeps `99999999`: the deterministic
	// gate must see the empty state, because some of its specs assert it.
	credentials: {
		alumno: {
			username: "12345678",
		},
	},

	agents: {
		default: {
			// This gateway does not implement `response_format`, so the model is
			// wrapped in `withTolerantStructuredOutput` (e2e-structured-output-shim.ts).
			// Measured, not assumed, and reproducible with the scripts in scripts/.
			//
			// `agent.assert` / `agent.extract` need valid structured output. What
			// was actually wrong here, in order of discovery:
			//
			// 1. Model ids came from a comment in this file, not from the docs.
			//    `GET /v1/models` is the authority and lists eight; a made-up id
			//    returns 400 "unknown model", so the gateway does not substitute.
			// 2. `judgmentTimeout` was left at the default of 30 s
			//    (DEFAULT_JUDGMENT_TIMEOUT_MS in
			//    node_modules/e2e/dist/config/agent.js). A reasoning model reading
			//    this app's 329-330 node pages blows past it, and the runner
			//    reports STEP_TIMEOUT, which reads like a test bug and is not one.
			//    Raised to 120 s; the per-test timeout went to 300 s to match.
			// 3. With those fixed the error changed back to MODEL_OUTPUT_INVALID,
			//    and THAT one is the provider, but not for the reason first
			//    assumed. Measured with scripts/probe-response-format.mjs
			//    (2026-10-15, 12 calls per mode): all three `response_format`
			//    modes score 0, yet the JSON that comes back is VALID and its
			//    values are RIGHT. What the model will not do is repeat the key
			//    it was given — `withTemario` comes back as `publicadas` or
			//    `publicados`, and it does that even when handed the exact key it
			//    likes best. It sometimes also answers with several candidate
			//    objects and prose around them.
			//
			//    So the shim drops `response_format`, picks the candidate object
			//    that fits the requested shape and renames its keys. It never
			//    touches a value, so a wrong guess fails an assertion instead of
			//    passing a test.
			//
			// Ruled out with measurement, so nobody repeats them:
			//
			//   · Unknown ids silently substituted — no, a bogus id 400s.
			//   · The connection — no, 0 network events in 24 calls, ~1 s median
			//     against a 120 s budget (scripts/probe-models.mjs).
			//   · Thinking blocks — no, M3 "skips thinking" per the docs.
			//   · Token budget — no, 4 000 and 12 000 max_tokens score alike.
			//   · Retries — no, 12 → 36 model calls with the pass rate unmoved,
			//     which is why no test carries a `retries` key.
			//   · Tool-calling itself — it works ~80% of the time
			//     (scripts/probe-sdk-path.ts), but the runner's judgments do not
			//     use it.
			//
			// A gateway that DOES honour `response_format` should be used without
			// the shim; `E2E_MODEL` swaps the id but not the wrapper, so point
			// the config at `withTolerantStructuredOutput` only while the endpoint
			// needs it. vitest and Playwright remain the gate either way, and
			// `just qa-fast` does not depend on any of this.
			model: withTolerantStructuredOutput(
				createOpenAICompatible({
					name: "openai-compatible",
					baseURL: "https://api.minimax.io/v1",
					apiKey: process.env.LLM_API_KEY,
					// NOT set, deliberately. The SDK picks `response_format` from this
					// flag and nothing else (node_modules/@ai-sdk/openai-compatible/
					// dist/index.js:430):
					//
					//   true  → { type: "json_schema", json_schema: {...} }
					//   false → { type: "json_object" }
					//
					// Measured against this endpoint with
					// scripts/probe-response-format.mjs, ALL THREE variants
					// (no flag, json_object, json_schema) score 0: the flag changes
					// what is sent and the endpoint honours none of them. The shim
					// above strips the flag's result on the way back, so this stays
					// false — the least specific request. Set it to true ONLY for a
					// provider that implements `json_schema`. The flag name is
					// `supportsStructuredOutputs`; `structuredOutputs` is silently
					// ignored, which is how it went missing before.
					supportsStructuredOutputs: false,
					// MiniMax-M3 is the operator's decision (2026-10-14), not the
					// sweep's winner: the measured sweep ranked M2.7 higher. M3 stays
					// because the actor lane leans on tool-calling. Both ids are real
					// ones from GET /v1/models; `MiniMax-M3.1-Flash-Preview` is not on
					// this account and 400s.
				}).chatModel(process.env.E2E_MODEL ?? "MiniMax-M3"),
			),
			// The default judgment budget is 30 s
			// (DEFAULT_JUDGMENT_TIMEOUT_MS in node_modules/e2e/dist/config/agent.js).
			// That is tuned for a fast model on a small screen; a MiniMax
			// reasoning model reading this app's 329-330 node pages blows
			// straight past it, and the runner reports STEP_TIMEOUT, which reads
			// like a test problem and is not one. Raised to 120 s.
			judgmentTimeout: 120_000,
			// Spanish, like the UI: every string the model reads comes from the
			// app, so judging it in the app's language is the consistent choice.
			system:
				"Agente de QA. La aplicación está en español: lee las pantallas en español y responde sobre lo que se ve, sin inventar datos.",
			context:
				"OpenSIM es el sistema de gestión académica del Instituto Tecnológico de Morelia. v1 cubre solo la carrera de Ingeniería en Sistemas Computacionales. Cuando una pantalla no muestra un dato, no lo completes: es correcto que falte.",
		},
	},
	targets: [
		{
			engine: web(),
			app: {
				url: resolveLocalUrl(),
				// The runner owns the dev server: it starts it, waits for the
				// URL to answer, and stops it at the end. That matches how
				// `just test-e2e` already sequences the Playwright suite, so
				// neither runner needs a server the developer started by hand.
				command: {
					executable: "pnpm",
					args: ["dev"],
					log: ".e2e/logs/app.log",
				},
			},
		},
	],
} satisfies E2EConfig;
