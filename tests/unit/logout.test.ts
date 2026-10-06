/**
 * OpenSIM — Logout endpoint unit tests (Phase 11 T11.4).
 *
 * `POST /login/logout` is the only session-termination path. Its
 * contract, from `src/routes/login/logout/+server.ts`:
 *   - DELETE the presented session row from D1
 *   - clear the cookie in the browser
 *   - 303 to `/login?reason=logged-out`
 *   - never fail the request because the row could not be deleted —
 *     invalidation is documented as a tidy-up, not a critical path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSession,
	getUserFromSessionToken,
	SESSION_COOKIE_NAME,
} from "../../src/lib/server/auth";
import { POST } from "../../src/routes/login/logout/+server";
import {
	clearWorkerEnv,
	makeCookies,
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

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

function sessionRowCount(): number {
	const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
	return row.c;
}

/** Calls the exported POST handler with a jar that starts out signed in. */
function logoutWith(cookies: ReturnType<typeof makeCookies>) {
	return POST({ cookies } as never);
}

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
	// A second student, so the scoped-delete assertion has a row it must
	// not touch (auth_sessions has an FK to student_profiles).
	seedProfile(raw, { controlNumber: "87654321", fullName: "Grace Hopper Ramirez" });
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("POST /login/logout", () => {
	it("deletes the session row so the token stops authenticating", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		expect(await getUserFromSessionToken(db, session.id)).not.toBeNull();

		await expect(
			logoutWith(makeCookies({ [SESSION_COOKIE_NAME]: session.id })),
		).rejects.toMatchObject({ status: 303 });

		expect(sessionRowCount()).toBe(0);
		expect(await getUserFromSessionToken(db, session.id)).toBeNull();
	});

	it("only deletes the presented session, leaving the student's other devices signed in", async () => {
		const current = await createSession(db, CONTROL, "vitest-current", "ip");
		const other = await createSession(db, CONTROL, "vitest-other", "ip");
		const foreign = await createSession(db, "87654321", "someone-else", "ip");
		expect(sessionRowCount()).toBe(3);

		await expect(
			logoutWith(makeCookies({ [SESSION_COOKIE_NAME]: current.id })),
		).rejects.toMatchObject({ status: 303 });

		expect(sessionRowCount()).toBe(2);
		expect(await getUserFromSessionToken(db, other.id)).not.toBeNull();
		expect(await getUserFromSessionToken(db, foreign.id)).not.toBeNull();
	});

	it("clears the cookie from the browser jar", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		await expect(logoutWith(cookies)).rejects.toMatchObject({ status: 303 });

		expect(cookies.ops).toContainEqual({
			type: "delete",
			name: SESSION_COOKIE_NAME,
			options: { path: "/" },
		});
		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});

	it("redirects 303 to /login?reason=logged-out", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");

		await expect(
			logoutWith(makeCookies({ [SESSION_COOKIE_NAME]: session.id })),
		).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=logged-out",
		});
	});

	it("still clears the cookie and redirects when no session cookie is presented", async () => {
		const cookies = makeCookies();

		await expect(logoutWith(cookies)).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=logged-out",
		});
		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});

	it("completes the logout when no D1 binding is configured", async () => {
		setWorkerDb(null);
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: "orphan-token" });

		await expect(logoutWith(cookies)).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=logged-out",
		});
		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});

	it("completes the logout even when the D1 delete throws", async () => {
		// Documented contract: invalidation is a tidy-up, not a critical
		// path. A D1 outage must not leave the student unable to log out
		// of the browser.
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const realPrepare = raw.prepare.bind(raw);
		const spy = vi.spyOn(raw, "prepare").mockImplementation((sql: string) => {
			if (sql.includes("delete") && sql.includes("auth_sessions")) {
				throw new Error("D1 unavailable");
			}
			return realPrepare(sql);
		});
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		try {
			await expect(logoutWith(cookies)).rejects.toMatchObject({
				status: 303,
				location: "/login?reason=logged-out",
			});
		} finally {
			spy.mockRestore();
		}

		expect(cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
	});
});
