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
 * no source publishes the catalogue timetable: that test is
 * `tests/reinscripcion-term.e2e.ts`, and since 2026-10-19 it runs against a
 * student with a history, so it reaches the bug it was written for.
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

	// The credential is the catalogue student, `12345678`: 175 approved
	// credits, 49 rows in `student_progress`, 3 complementary ones. The
	// old comment here said the seed destroyed that credential on every
	// re-run, which stopped being true when the profile write became an
	// upsert (`ON CONFLICT ... DO UPDATE`, no DELETE, so nothing cascades
	// into `student_credentials`). The agentic lane signs in as this
	// student for the same reason: a judgment about DATA needs a student
	// who has data.
	//
	// The greeting is matched loosely on purpose — the fixture's first
	// name is synthetic PII and may change — and the identity is pinned
	// by the data instead: the placeholder student has no record at all,
	// so the approved credits on the panel are what proves who signed in.
	await expect(screen.getByRole("heading", /^Bienvenido, /)).toBeVisible();
	await expect(screen.getByText("175 / 260")).toBeVisible();
});
