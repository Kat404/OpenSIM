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
			model: createOpenAICompatible({
				name: "openai-compatible",
				baseURL: "https://api.minimax.io/v1",
				apiKey: process.env.LLM_API_KEY,
			}).chatModel("MiniMax-M3"),
			system: "You are a thorough QA agent. Verify every outcome.",
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
