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
	credentials: {
		alumno: {
			username: "99999999",
		},
	},

	agents: {
		default: {
			// THE AGENTIC LANE DOES NOT CURRENTLY RUN. Kept configured and
			// kept measured rather than quietly switched off.
			//
			// `agent.assert` / `agent.extract` need valid structured output.
			// Measured against this gateway with `scripts/probe-models.mjs`
			// and `scripts/probe-budget.mjs`, on the exact tool-calling shape
			// those steps send:
			//
			//   MiniMax-M3    temp 0  →   0-20%   (once read "7 de 68" backwards)
			//   MiniMax-M2.5  temp 0  →  50-60%  ← configured here, the best of them
			//   MiniMax-M2.1  temp 0  →  25%
			//   MiniMax-M2    temp 0  →  25%
			//
			// M2.5 is the least bad id and is what stays. But 60% was measured
			// on a SYNTHETIC one-line question. Against this app's real screens
			// (329-330 accessibility nodes) the rate is 0: six tests, 36 model
			// calls, every one MODEL_OUTPUT_INVALID. Raising `max_tokens` does
			// not help (4 000 and 12 000 score identically) — the failures are
			// `finish_reason: stop` with no tool call, i.e. the model choosing
			// to answer in prose. `retries` were tried and removed: cost went
			// up 3x and the pass rate did not move.
			//
			// To make this lane work, point `E2E_MODEL` at a model that answers
			// tool-calling reliably; the tests in tests/phase10-pages.e2e.ts are
			// sound and need no changes. Until then vitest and Playwright remain
			// the gate, and `just qa-fast` does not depend on any of this.
			model: createOpenAICompatible({
				name: "openai-compatible",
				baseURL: "https://api.minimax.io/v1",
				apiKey: process.env.LLM_API_KEY,
			}).chatModel(process.env.E2E_MODEL ?? "MiniMax-M2.5"),
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
