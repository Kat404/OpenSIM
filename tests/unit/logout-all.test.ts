/**
 * OpenSIM — Bulk session revocation endpoint unit tests.
 *
 * `POST /login/logout-all` is the path that revokes EVERY session of
 * the signed-in student, not just the one presented by the browser.
 * Its contract, from `src/routes/login/logout-all/+server.ts`:
 *   - delete all `auth_sessions` rows of the signed-in student
 *   - leave every other student's sessions untouched
 *   - clear the cookie in the browser
 *   - 303 to `/login?reason=sessions-revoked`
 *   - do nothing at all when nobody is signed in
 *
 * The primitive itself (`invalidateAllSessions`) is covered by
 * `tests/unit/session-lifecycle.test.ts`; what this file pins is the
 * wiring — that a real request path reaches it, and only for the
 * student who asked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
	createSession,
	getUserFromSessionToken,
	SESSION_COOKIE_NAME,
} from "../../src/lib/server/auth";
import { POST } from "../../src/routes/login/logout-all/+server";
import {
	clearWorkerEnv,
	makeCookies,
	makeUser,
	seedCareer,
	seedProfile,
	setWorkerDb,
	type TestDb,
	withTestDb,
} from "./_helpers/harness";

await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

const CONTROL = "12345678";
const OTHER = "87654321";

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

function sessionRowCount(): number {
	const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
	return row.c;
}

/** Calls the exported POST handler as the signed-in student. */
function revokeWith(
	cookies: ReturnType<typeof makeCookies>,
	user: ReturnType<typeof makeUser> | null = makeUser(),
) {
	return POST({ cookies, locals: { user } } as never);
}

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw, { controlNumber: CONTROL, fullName: "Ada Lovelace Ortiz" });
	// A second student, so the scoped delete has rows it must not touch
	// (auth_sessions has an FK to student_profiles).
	seedProfile(raw, { controlNumber: OTHER, fullName: "Grace Hopper Ramirez" });
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("POST /login/logout-all", () => {
	it("revokes every session of the signed-in student, not just the presented one", async () => {
		const current = await createSession(db, CONTROL, "vitest-current", "ip");
		const other = await createSession(db, CONTROL, "vitest-other", "ip");
		expect(sessionRowCount()).toBe(2);

		await expect(
			revokeWith(makeCookies({ [SESSION_COOKIE_NAME]: current.id })),
		).rejects.toMatchObject({ status: 303 });

		expect(sessionRowCount()).toBe(0);
		expect(await getUserFromSessionToken(db, current.id)).toBeNull();
		expect(await getUserFromSessionToken(db, other.id)).toBeNull();
	});

	it("leaves another student's sessions alone", async () => {
		const mine = await createSession(db, CONTROL, "vitest", "ip");
		const theirs = await createSession(db, OTHER, "someone-else", "ip");

		await expect(revokeWith(makeCookies({ [SESSION_COOKIE_NAME]: mine.id }))).rejects.toMatchObject(
			{ status: 303 },
		);

		expect(sessionRowCount()).toBe(1);
		expect(await getUserFromSessionToken(db, theirs.id)).not.toBeNull();
	});

	it("clears the cookie and redirects to /login?reason=sessions-revoked", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		await expect(revokeWith(cookies)).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=sessions-revoked",
		});

		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});

	it("revokes nothing and keeps the cookie when nobody is signed in", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		await expect(revokeWith(cookies, null)).rejects.toMatchObject({
			status: 303,
			location: "/login",
		});

		expect(sessionRowCount()).toBe(1);
		expect(await getUserFromSessionToken(db, session.id)).not.toBeNull();
		expect(cookies.entries()).toHaveProperty(SESSION_COOKIE_NAME);
	});

	it("completes the revocation when no D1 binding is configured", async () => {
		setWorkerDb(null);
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: "orphan-token" });

		await expect(revokeWith(cookies)).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=sessions-revoked",
		});

		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});
});
