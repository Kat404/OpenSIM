/**
 * OpenSIM — e2e smoke test.
 *
 * The login test is **deliberately deterministic**. Signing in with a
 * credential is not a flow that changes, so the agent earns nothing there: it
 * would spend a gateway call to rediscover two labelled inputs that
 * `screen.getByLabel` already names. Worse, a `Secret` is loaded while
 * signing in, and this runner has no origin allowlist — an agent that
 * navigates can carry that secret to another site. Not worth the exposure to
 * learn something a locator already knows.
 *
 * The agent lane belongs on `/reinscripcion`, where the flow does change and
 * no source publishes the catalogue timetable. That test is not written yet;
 * see `odd/tasks/phase-9-unblock.md`.
 *
 * The password reaches the field as a `Secret`, so it is never part of the
 * model input, the report, or a screenshot. The control number is a plain
 * string by design and is invented demo data.
 *
 * Both targets must be localhost — `e2e.config.ts` refuses anything else.
 */
import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("app opens", async ({ app, browser }) => {
	await app.open("/");
	await expect(browser.locator("body")).toBeVisible();
});

test("signs in with the demo student credential", async ({ app, screen, browser }) => {
	const user = credentials.user("alumno");

	await app.open("/login");
	await screen.getByLabel("Número de control").fill(user.username);
	await screen.getByLabel("Contraseña").fill(user.password);
	await screen.getByRole("button", "Entrar").tap();

	await expect(browser).toHaveURL("/dashboard");
	// The credential belongs to `99999999`, the placeholder student with no
	// enrolment history. The 175-credit student is `12345678`, whose
	// credential the seed destroys on every re-run, so the suite cannot
	// depend on it.
	await expect(screen.getByRole("heading", "Bienvenido, Estudiante")).toBeVisible();
});
