/**
 * `POST /login/logout-all` — the cookie it clears (S1 / S6).
 *
 * The endpoint, the plain logout and the stale-cookie path in the
 * hooks all clear the SAME cookie. S6 asks them to clear it the same
 * way, so the deletion payload is asserted here: a hand-rolled
 * `{ path: "/" }` would pass every behavioural test (the cookie
 * disappears either way) and still be the second implementation the
 * finding asked to delete.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
	clearSessionCookieOptions,
	createSession,
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

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw, { controlNumber: CONTROL, fullName: "Ada Lovelace Ortiz" });
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("POST /login/logout-all — cookie clearing", () => {
	it("clears the session cookie with the shared options", async () => {
		const session = await createSession(db, CONTROL, "vitest", "ip");
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		await expect(POST({ cookies, locals: { user: makeUser() } } as never)).rejects.toMatchObject({
			status: 303,
		});

		expect(cookies.ops).toContainEqual({
			type: "delete",
			name: SESSION_COOKIE_NAME,
			options: clearSessionCookieOptions,
		});
	});

	it("an anonymous POST clears nothing at all", async () => {
		const session = await createSession(db, CONTROL, "vitest", "ip");
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: session.id });

		await expect(POST({ cookies, locals: { user: null } } as never)).rejects.toMatchObject({
			status: 303,
			location: "/login",
		});

		expect(cookies.ops).toHaveLength(0);
	});

	it("without a D1 binding it still clears the cookie and redirects", async () => {
		setWorkerDb(null);
		const cookies = makeCookies({ [SESSION_COOKIE_NAME]: "orphan" });

		await expect(POST({ cookies, locals: { user: makeUser() } } as never)).rejects.toMatchObject({
			status: 303,
			location: "/login?reason=sessions-revoked",
		});

		expect(cookies.ops).toContainEqual({
			type: "delete",
			name: SESSION_COOKIE_NAME,
			options: clearSessionCookieOptions,
		});
	});
});
