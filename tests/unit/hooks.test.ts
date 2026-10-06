/**
 * OpenSIM — `hooks.server.ts` handle() unit tests (Phase 11 T11.1).
 *
 * `handle` is the one piece of middleware every request in the app
 * passes through, and until now nothing tested it. Its contract:
 *
 *   1. `locals.user` starts as `null` and is replaced only by a
 *      session token that survives `validateSessionToken`.
 *   2. A stale token clears the cookie on the client and prunes the row.
 *   3. A live token is slid forward (`extendSession`, Phase 9 T9.5) and
 *      the cookie is re-set so the browser expiry tracks the row.
 *   4. Six security headers are stamped on every response, overwriting
 *      whatever a downstream handler set.
 *   5. A failed renewal must NOT reject an already-valid session.
 *
 * `resolve` is injected by the framework, so these tests hand it a stub
 * and assert both what it received and what `handle` returned.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle } from "../../src/hooks.server";
import {
	createSession,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
	sessionCookieOptions,
} from "../../src/lib/server/auth";
import {
	clearWorkerEnv,
	makeCookies,
	seedCareer,
	seedProfile,
	type TestDb,
	withTestDb,
} from "./_helpers/harness";

// `cloudflare:workers` resolves to the adapter's virtual module, which needs
// a runtime platform proxy that does not exist under Vitest. Installing the
// harness env must happen before `src/hooks.server.ts` is evaluated, so it
// goes through `vi.hoisted`.
await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

const CONTROL = "12345678";

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

/** A `resolve` that records the event it saw and returns a stub Response. */
function stubResolve(headers: Record<string, string> = {}) {
	const seen: { event: unknown } = { event: null };
	const resolve = async (event: unknown) => {
		seen.event = event;
		return new Response("ok", { status: 200, headers });
	};
	return { resolve, seen };
}

/** The event shape `handle` reads: `locals` + `cookies`. */
function makeEvent(cookieValue?: string) {
	const cookies = makeCookies(cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {});
	return { locals: {} as Record<string, unknown>, cookies };
}

function sessionRowCount(): number {
	const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
	return row.c;
}

beforeEach(() => {
	({ db, raw } = withTestDb());
	seedCareer(raw);
	seedProfile(raw);
});

afterEach(() => {
	// Deliberately NOT `vi.restoreAllMocks()`: that also drops the
	// `cloudflare:workers` module mock installed above, and every later
	// test would fall back to the unresolvable virtual module. The one
	// spy this file installs restores itself.
	raw.close();
	clearWorkerEnv();
});

describe("handle — locals.user", () => {
	it("defaults locals.user to null when no session cookie is presented", async () => {
		const event = makeEvent();
		const { resolve, seen } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.locals.user).toBeNull();
		// `resolve` still ran — the hook never short-circuits the request.
		expect(seen.event).toBe(event);
	});

	it("populates locals.user from a valid session token", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const event = makeEvent(session.id);
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.locals.user).toMatchObject({
			controlNumber: CONTROL,
			fullName: "Ada Lovelace Ortiz",
		});
	});

	it("leaves locals.user null for a token with no row", async () => {
		const event = makeEvent("never-issued-token");
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.locals.user).toBeNull();
	});

	it("leaves locals.user null when the session has expired", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		raw
			.prepare("UPDATE auth_sessions SET expires_at = ?")
			.run(Math.floor((Date.now() - 60_000) / 1000));
		const event = makeEvent(session.id);
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.locals.user).toBeNull();
	});

	it("leaves locals.user null when no D1 binding is configured", async () => {
		clearWorkerEnv();
		const event = makeEvent("some-token");
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.locals.user).toBeNull();
	});
});

describe("handle — stale cookie handling", () => {
	it("deletes the cookie and prunes the row for an expired session", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		raw
			.prepare("UPDATE auth_sessions SET expires_at = ?")
			.run(Math.floor((Date.now() - 60_000) / 1000));
		const event = makeEvent(session.id);
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.cookies.ops).toContainEqual({
			type: "delete",
			name: SESSION_COOKIE_NAME,
			options: { path: "/" },
		});
		expect(event.cookies.entries()).not.toHaveProperty(SESSION_COOKIE_NAME);
		// Best-effort prune actually reached D1.
		expect(sessionRowCount()).toBe(0);
	});

	it("does not delete the cookie when the session is valid", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const event = makeEvent(session.id);
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		expect(event.cookies.ops.filter((op) => op.type === "delete")).toHaveLength(0);
		expect(sessionRowCount()).toBe(1);
	});
});

describe("handle — sliding session renewal", () => {
	it("re-sets the cookie with a fresh expiry when the session is renewed", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const event = makeEvent(session.id);
		const { resolve } = stubResolve();

		await handle({ event, resolve } as never);

		const set = event.cookies.ops.find((op) => op.type === "set");
		expect(set).toBeDefined();
		if (set?.type !== "set") throw new Error("no cookie was set");
		expect(set.name).toBe(SESSION_COOKIE_NAME);
		// The cookie keeps carrying the same raw token the client holds.
		expect(set.value).toBe(session.id);
		const options = set.options as { maxAge: number; expires?: Date };
		expect(set.options).toMatchObject({ ...sessionCookieOptions, path: "/" });
		expect(options.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
		expect(options.expires).toBeInstanceOf(Date);
		expect((options.expires as Date).getTime()).toBeGreaterThan(Date.now());
	});

	it("actually pushed the row's expiry forward in D1", async () => {
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const soon = Math.floor((Date.now() + 60_000) / 1000);
		raw.prepare("UPDATE auth_sessions SET expires_at = ?").run(soon);

		await handle({ event: makeEvent(session.id), resolve: stubResolve().resolve } as never);

		const row = raw.prepare("SELECT expires_at FROM auth_sessions").get() as {
			expires_at: number;
		};
		// Stored in unix seconds, like every `mode: 'timestamp'` column.
		expect(row.expires_at).toBeGreaterThan(soon + 20 * 24 * 60 * 60);
	});

	it("does not re-set the cookie when the renewal is refused", async () => {
		// A row one second from expiry passes `validateSessionToken`, but
		// by the time `extendSession` runs its `expiresAt > now`
		// predicate may fail. Either way the cookie must not be stamped
		// with an expiry that has no matching row.
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		raw.prepare("UPDATE auth_sessions SET expires_at = ?").run(Math.floor(Date.now() / 1000) - 1);
		const event = makeEvent(session.id);

		await handle({ event, resolve: stubResolve().resolve } as never);

		expect(event.locals.user).toBeNull();
		expect(event.cookies.ops.some((op) => op.type === "set")).toBe(false);
	});

	it("keeps the session valid when extendSession rejects", async () => {
		// D1 hiccup on the renewal write must not cost an already-
		// authenticated student their request.
		const session = await createSession(db, CONTROL, "vitest", "iphash");
		const realPrepare = raw.prepare.bind(raw);
		const spy = vi.spyOn(raw, "prepare").mockImplementation((sql: string) => {
			if (sql.includes("update") && sql.includes("auth_sessions")) {
				throw new Error("D1 unavailable");
			}
			return realPrepare(sql);
		});
		try {
			const event = makeEvent(session.id);
			const { resolve } = stubResolve();

			const response = await handle({ event, resolve } as never);

			expect(response.status).toBe(200);
			expect(event.locals.user).toMatchObject({ controlNumber: CONTROL });
			expect(event.cookies.ops.some((op) => op.type === "set")).toBe(false);
		} finally {
			spy.mockRestore();
		}
	});
});

describe("handle — security headers", () => {
	it("stamps all six headers on the response", async () => {
		const { resolve } = stubResolve();
		const response = await handle({ event: makeEvent(), resolve } as never);

		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
		expect(response.headers.get("Permissions-Policy")).toBe(
			"interest-cohort=(), document-domain=()",
		);
		expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-site");
		expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
	});

	it("overwrites permissive headers a downstream handler added", async () => {
		// A +server.ts that sets `X-Frame-Options: ALLOWALL` must not be
		// able to weaken the app-wide clickjacking guard.
		const { resolve } = stubResolve({
			"X-Frame-Options": "ALLOWALL",
			"Referrer-Policy": "unsafe-url",
			"X-Content-Type-Options": "",
		});
		const response = await handle({ event: makeEvent(), resolve } as never);

		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("leaves unrelated downstream headers alone", async () => {
		const { resolve } = stubResolve({ "Content-Type": "application/pdf" });
		const response = await handle({ event: makeEvent(), resolve } as never);

		expect(response.headers.get("Content-Type")).toBe("application/pdf");
	});

	it("stamps the headers on an error response too", async () => {
		const resolve = async () => new Response("boom", { status: 500 });
		const response = await handle({ event: makeEvent(), resolve } as never);

		expect(response.status).toBe(500);
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
	});
});
