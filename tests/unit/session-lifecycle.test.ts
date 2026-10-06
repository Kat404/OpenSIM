/**
 * OpenSIM — Session lifecycle unit tests (Phase 11 T11.3).
 *
 * The session primitives in `src/lib/server/auth.ts` are the only
 * durable state in the auth path: a row in `auth_sessions` is what
 * makes `locals.user` non-null for the rest of the request. Every
 * helper here runs against the real migration SQL through the shared
 * harness, so these assertions read back actual rows.
 *
 * Covered:
 *   - createSession: stores the SHA-256 of the token, never the raw
 *     token, and hands back a 30-day expiry
 *   - validateSessionToken: valid / unknown token / already-expired row
 *   - invalidateSession: deletes exactly the presented token's row
 *   - invalidateAllSessions (Phase 9 T9.4): bulk delete per student
 *   - extendSession (Phase 9 T9.5): slides the expiry forward, and
 *     REFUSES to resurrect an already-expired row
 *   - getUserFromSessionToken: profile lookup through a valid session
 *   - getCredential: present / absent
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createSession,
	extendSession,
	getCredential,
	getUserFromSessionToken,
	invalidateAllSessions,
	invalidateSession,
	validateSessionToken,
} from "../../src/lib/server/auth";
import { seedCareer, seedProfile, type TestDb, withTestDb } from "./_helpers/harness";

const CONTROL = "12345678";
const OTHER_CONTROL = "87654321";

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

/** Number of `auth_sessions` rows currently stored. */
function sessionRowCount(): number {
	const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
	return row.c;
}

/** Overwrites the stored expiry of every session row. */
function setExpiry(date: Date): void {
	raw.prepare("UPDATE auth_sessions SET expires_at = ?").run(Math.floor(date.getTime() / 1000));
}

/** The expiry currently persisted for the single stored session row. */
function storedExpirySeconds(): number {
	const row = raw.prepare("SELECT expires_at FROM auth_sessions").get() as { expires_at: number };
	return row.expires_at;
}

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
	seedProfile(raw, { controlNumber: OTHER_CONTROL, fullName: "Grace Hopper Ramirez" });
});

afterEach(() => {
	raw.close();
});

describe("createSession", () => {
	it("returns a raw token and an expiry 30 days out", async () => {
		const before = Date.now();
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const delta = session.expiresAt.getTime() - before;
		expect(delta).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
		expect(delta).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
	});

	it("stores sha256(token) as the row id, never the raw token", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const row = raw.prepare("SELECT id, student_control_number FROM auth_sessions").get() as {
			id: string;
			student_control_number: string;
		};
		expect(row.id).not.toBe(session.id);
		expect(row.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(row.student_control_number).toBe(CONTROL);
	});

	it("records the user agent and IP hash the caller passed", async () => {
		await createSession(db, CONTROL, "Mozilla/5.0 (unit)", "deadbeef");
		const row = raw.prepare("SELECT user_agent, ip_hash FROM auth_sessions").get() as {
			user_agent: string | null;
			ip_hash: string | null;
		};
		expect(row.user_agent).toBe("Mozilla/5.0 (unit)");
		expect(row.ip_hash).toBe("deadbeef");
	});

	it("writes a row that validateSessionToken then accepts", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const validated = await validateSessionToken(db, session.id);
		expect(validated?.controlNumber).toBe(CONTROL);
	});
});

describe("validateSessionToken", () => {
	it("returns the control number and expiry for a live session", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const validated = await validateSessionToken(db, session.id);
		expect(validated).not.toBeNull();
		expect(validated?.controlNumber).toBe(CONTROL);
		// Sub-second precision is lost at the D1 wire (unix seconds), so
		// compare to the second — which is the granularity production has.
		const validatedExpiry = (validated as { expiresAt: Date }).expiresAt;
		expect(Math.floor(validatedExpiry.getTime() / 1000)).toBe(
			Math.floor(session.expiresAt.getTime() / 1000),
		);
	});

	it("returns null for a token that was never issued", async () => {
		expect(await validateSessionToken(db, "no-such-token")).toBeNull();
	});

	it("returns null for an expired row but leaves the row in place", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		setExpiry(new Date(Date.now() - 60_000));

		expect(await validateSessionToken(db, session.id)).toBeNull();
		// Validation is read-only; the cron prune owns the DELETE (R8-8).
		expect(sessionRowCount()).toBe(1);
	});

	it("refuses a row whose expiry is exactly now", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		setExpiry(new Date(Date.now()));
		expect(await validateSessionToken(db, session.id)).toBeNull();
	});
});

describe("invalidateSession", () => {
	it("removes only the presented token's row", async () => {
		const mine = await createSession(db, CONTROL, "vitest", "iphash");
		const theirs = await createSession(db, OTHER_CONTROL, "other-agent", "iphash");
		expect(sessionRowCount()).toBe(2);

		await invalidateSession(db, mine.id);
		expect(sessionRowCount()).toBe(1);
		expect(await validateSessionToken(db, mine.id)).toBeNull();
		// The other student's session survives — the delete is scoped to
		// the hashed token, not to the student.
		expect(await validateSessionToken(db, theirs.id)).not.toBeNull();
	});

	it("is a no-op for a token with no row", async () => {
		await createSession(db, CONTROL, "vitest", "iphash");
		await invalidateSession(db, "never-issued");
		expect(sessionRowCount()).toBe(1);
	});
});

describe("invalidateAllSessions", () => {
	it("removes every session belonging to the student and returns the count", async () => {
		await createSession(db, CONTROL, "a", "ip");
		await createSession(db, CONTROL, "b", "ip");
		const survivor = await createSession(db, OTHER_CONTROL, "other", "ip");
		expect(sessionRowCount()).toBe(3);

		expect(await invalidateAllSessions(db, CONTROL)).toBe(2);
		expect(sessionRowCount()).toBe(1);
		expect(await validateSessionToken(db, survivor.id)).not.toBeNull();
	});

	it("reports 0 when the student has no sessions", async () => {
		expect(await invalidateAllSessions(db, CONTROL)).toBe(0);
	});

	it("leaves an already-expired row sweepable by the prune, not by this helper's count", async () => {
		await createSession(db, CONTROL, "vitest", "iphash");
		setExpiry(new Date(Date.now() - 60_000));
		expect(await invalidateAllSessions(db, CONTROL)).toBe(1);
		expect(sessionRowCount()).toBe(0);
	});
});

describe("extendSession", () => {
	it("slides a live session's expiry forward", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		// Park the row one day from expiry so the extension is observable.
		const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
		setExpiry(soon);

		const renewed = await extendSession(db, session.id);
		expect(renewed).not.toBeNull();
		expect(renewed?.getTime()).toBeGreaterThan(soon.getTime() + 20 * 24 * 60 * 60 * 1000);
		expect(storedExpirySeconds()).toBe(Math.floor((renewed as Date).getTime() / 1000));
	});

	it("refuses to extend an already-expired row and leaves it expired", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const expired = new Date(Date.now() - 60_000);
		setExpiry(expired);

		// The `expiresAt > now` predicate is the whole point: a renewal
		// must never resurrect a session the validator already rejects.
		expect(await extendSession(db, session.id)).toBeNull();
		expect(storedExpirySeconds()).toBe(Math.floor(expired.getTime() / 1000));
		expect(await validateSessionToken(db, session.id)).toBeNull();
	});

	it("returns null for a token with no row", async () => {
		expect(await extendSession(db, "never-issued")).toBeNull();
	});
});

describe("getUserFromSessionToken", () => {
	it("returns the student's profile for a valid session", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const user = await getUserFromSessionToken(db, session.id);
		expect(user?.controlNumber).toBe(CONTROL);
		expect(user?.fullName).toBe("Ada Lovelace Ortiz");
	});

	it("returns null for an unknown token", async () => {
		expect(await getUserFromSessionToken(db, "no-such-token")).toBeNull();
	});

	it("returns null when the session is valid but the profile row was deleted", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		raw.prepare("DELETE FROM student_profiles WHERE control_number = ?").run(CONTROL);
		expect(await getUserFromSessionToken(db, session.id)).toBeNull();
	});

	it("returns null for an expired session even though the row still exists", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		setExpiry(new Date(Date.now() - 60_000));
		expect(await getUserFromSessionToken(db, session.id)).toBeNull();
		expect(sessionRowCount()).toBe(1);
	});
});

describe("getCredential", () => {
	it("returns hash, salt and iteration count for a known control number", async () => {
		raw
			.prepare(
				`INSERT INTO student_credentials
					(control_number, password_hash, password_salt, password_iterations)
				 VALUES (?, ?, ?, ?)`,
			)
			.run(CONTROL, "hash-value", "salt-value", 10_000);

		expect(await getCredential(db, CONTROL)).toEqual({
			passwordHash: "hash-value",
			passwordSalt: "salt-value",
			passwordIterations: 10_000,
		});
	});

	it("returns undefined for an unknown control number", async () => {
		expect(await getCredential(db, "00000000")).toBeUndefined();
	});
});
