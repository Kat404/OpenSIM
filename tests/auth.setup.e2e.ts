/**
 * OpenSIM — e2e sign-in setup.
 *
 * Runs once per run and saves the authenticated state under a named session,
 * so `e2e explore --session alumno` and any test that takes `{ session:
 * "alumno" }` start signed in. The session is encrypted in `.e2e/sessions/`
 * and deleted at cleanup; there is no state file to commit, which is the
 * whole point over Playwright's `storageState`.
 *
 * Must stay top level. A setup test inside `describe` is `COLLECTION_ERROR`.
 */
import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test.setup(
	"sign in as the demo student",
	{ sessions: ["alumno"] },
	async ({ app, screen, browser, session }) => {
		const user = credentials.user("alumno");

		await app.open("/login");
		await screen.getByLabel("Número de control").fill(user.username);
		await screen.getByLabel("Contraseña").fill(user.password);
		await screen.getByRole("button", "Entrar").tap();

		// Prove it before saving: a session that saved a failed login would fail
		// every dependent test with a confusing `setup-failed`.
		await expect(browser).toHaveURL("/dashboard");
		await session.save("alumno");
	},
);
