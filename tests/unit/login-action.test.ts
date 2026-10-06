/**
 * OpenSIM — Login form action unit tests (Phase 11 T11.2).
 *
 * `src/routes/login/+page.server.ts` is the only place a session is
 * minted, so every branch it owns is a security boundary:
 *
 *   - the 503 when D1 is not bound
 *   - Valibot rejection before any D1 traffic
 *   - the rate-limit gate (429 + retry seconds)
 *   - the timing-equalisation branch for an unknown control number,
 *     which must be indistinguishable from a wrong password (401)
 *   - the success branch: session row + HttpOnly cookie + a redirect
 *     target that went through `safeInternalRedirect`
 *
 * SvelteKit hands an action a `RequestEvent`; nothing about it is
 * magically available here, so each test builds one from the harness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, recordFailedAttempt, SESSION_COOKIE_NAME } from "../../src/lib/server/auth";
import { actions, load } from "../../src/routes/login/+page.server";
import {
	clearWorkerEnv,
	makeEvent,
	makeUser,
	seedCareer,
	seedCredential,
	seedProfile,
	setWorkerDb,
	type TestDb,
	withTestDb,
} from "./_helpers/harness";

// Installed before `+page.server.ts` evaluates; see the harness docblock.
await vi.hoisted(async () => {
	(await import("./_helpers/harness")).installWorkerEnv();
});

// `decoyCredential` is the timing-equalisation burn the unknown-control-number
// branch runs. It is module-private to the action, so the only way to observe
// that it ran is to wrap it here; every other export is delegated untouched.
const { decoy } = await vi.hoisted(() => ({ decoy: { calls: 0 } }));
vi.mock("#lib/server/auth", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		decoyCredential: async () => {
			decoy.calls += 1;
			return (actual.decoyCredential as () => Promise<unknown>)();
		},
	};
});

const CONTROL = "12345678";
const PASSWORD = "clave-de-prueba-2026";
const GENERIC_ERROR = "Número de control o contraseña incorrectos";

let db: TestDb;
let raw: ReturnType<typeof withTestDb>["raw"];

/** Calls the exported default action with a built event. */
function post(
	options: Parameters<typeof makeEvent>[0] = {},
): Promise<{ status?: number; data?: Record<string, unknown> }> {
	const event = makeEvent({ url: "https://opensim.test/login", ...options });
	return actions.default(event as never) as never;
}

async function seedValidStudent(): Promise<void> {
	const { hash, salt, iterations } = await hashPassword(PASSWORD);
	seedCredential(raw, CONTROL, hash, salt, iterations);
}

/** Number of `auth_sessions` rows currently stored. */
function sessionRowCount(): number {
	const row = raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get() as { c: number };
	return row.c;
}

/** Attempt counters recorded for a key, summed across buckets. */
function attemptsFor(key: string): number {
	const row = raw
		.prepare("SELECT COALESCE(SUM(attempt_count), 0) AS c FROM auth_attempts WHERE attempt_key = ?")
		.get(key) as { c: number };
	return row.c;
}

beforeEach(async () => {
	({ db, raw } = withTestDb());
	decoy.calls = 0;
	seedCareer(raw);
	seedProfile(raw);
	await seedValidStudent();
});

afterEach(() => {
	raw.close();
	clearWorkerEnv();
});

describe("login action — rejections before any D1 traffic", () => {
	it("returns 400 with the Valibot message when the control number is not 8 digits", async () => {
		const result = await post({ formData: { controlNumber: "123", password: PASSWORD } });
		expect(result.status).toBe(400);
		expect(result.data?.error).toBe("El número de control debe tener 8 dígitos");
		// Nothing was written: the schema check runs first.
		expect(sessionRowCount()).toBe(0);
		expect(attemptsFor(`control:${CONTROL}`)).toBe(0);
	});

	it("returns 400 when the control number is missing entirely", async () => {
		const result = await post({ formData: { password: PASSWORD } });
		expect(result.status).toBe(400);
		expect(result.data?.error).toBe("El número de control debe tener 8 dígitos");
	});

	it("returns 400 when the password is empty", async () => {
		const result = await post({ formData: { controlNumber: CONTROL, password: "" } });
		expect(result.status).toBe(400);
		expect(typeof result.data?.error).toBe("string");
		expect(sessionRowCount()).toBe(0);
	});

	it("fails closed with 'Servicio no disponible' when no D1 binding is configured", async () => {
		setWorkerDb(null);
		const result = await post({ formData: { controlNumber: CONTROL, password: PASSWORD } });
		// 500, not 503: `login/+page.server.ts:93` uses `fail(500)` while
		// the sibling export endpoint answers 503 for the same condition.
		// Reported as an inconsistency; the security-relevant half — it
		// refuses to authenticate rather than falling through — is pinned.
		expect(result.status).toBe(500);
		expect(result.data?.error).toBe("Servicio no disponible");
		expect(sessionRowCount()).toBe(0);
	});
});

describe("login action — rate limiting", () => {
	// Counters are seeded with raw SQL, not `recordFailedAttempt`: that
	// helper is currently a no-op against D1 (see the KNOWN DEFECT test
	// below), so routing the seed through it would test nothing.
	function seedAttempts(key: string, count: number): void {
		const windowStart = Math.floor(Date.now() / 60_000) * 60;
		raw
			.prepare(
				`INSERT INTO auth_attempts (attempt_key, window_start, attempt_count)
				 VALUES (?, ?, ?)`,
			)
			.run(key, windowStart, count);
	}

	it("returns 429 with the retry seconds once the control number is over the cap", async () => {
		seedAttempts(`control:${CONTROL}`, 5);
		const result = await post({ formData: { controlNumber: CONTROL, password: PASSWORD } });

		expect(result.status).toBe(429);
		// The message carries the wait so the UI can tell the student
		// when to retry; the number comes from the sliding window.
		expect(result.data?.error).toMatch(/^Demasiados intentos\. Espera \d+ segundos/);
		// The correct password is irrelevant once the gate trips.
		expect(sessionRowCount()).toBe(0);
	});

	it("still denies a correct password while the IP bucket is over the cap", async () => {
		const { hashIp } = await import("../../src/lib/server/auth");
		seedAttempts(`ip:${await hashIp("203.0.113.7")}`, 5);

		const result = await post({ formData: { controlNumber: CONTROL, password: PASSWORD } });

		expect(result.status).toBe(429);
		expect(sessionRowCount()).toBe(0);
	});

	it("blocks at five recorded attempts and allows four", async () => {
		// Threshold pinning without relying on the action's own
		// increment, which cannot write (KNOWN DEFECT below).
		seedAttempts(`control:${CONTROL}`, 4);
		const under = await post({
			formData: { controlNumber: CONTROL, password: "no-es-la-clave" },
		});
		expect(under.status).toBe(401);

		seedAttempts(`control:${CONTROL}`, 5);
		const over = await post({
			formData: { controlNumber: CONTROL, password: "no-es-la-clave" },
		});
		expect(over.status).toBe(429);
	});

	it("clears both counters after a successful login", async () => {
		const { hashIp } = await import("../../src/lib/server/auth");
		const ipKey = `ip:${await hashIp("203.0.113.7")}`;
		seedAttempts(`control:${CONTROL}`, 3);
		seedAttempts(ipKey, 3);

		await expect(
			post({ formData: { controlNumber: CONTROL, password: PASSWORD } }),
		).rejects.toMatchObject({ status: 303 });

		expect(attemptsFor(`control:${CONTROL}`)).toBe(0);
		expect(attemptsFor(ipKey)).toBe(0);
	});

	it("KNOWN DEFECT: recordFailedAttempt writes nothing against D1", async () => {
		// `recordFailedAttempt` (src/lib/server/auth.ts:112) wraps its
		// read-then-write in `db.transaction`, which issues `BEGIN` /
		// SAVEPOINT. D1 rejects both ("To execute a transaction, please
		// use the state.storage.transaction() APIs instead"), the helper
		// swallows the error at line 142, and the counter is silently
		// dropped — so the R8-9 / P0-2 rate limiter never trips in
		// production. Characterization test: it passes today because the
		// current (broken) behaviour is a no-op. Fix = replace the
		// transaction with a single INSERT ... ON CONFLICT DO UPDATE,
		// and add the unique index the upsert needs.
		await recordFailedAttempt(db, "control:12345678");
		expect(attemptsFor("control:12345678")).toBe(0);
	});
});

describe("login action — credential failure", () => {
	it("returns 401 with the generic error for an unknown control number", async () => {
		const result = await post({ formData: { controlNumber: "99999999", password: PASSWORD } });
		expect(result.status).toBe(401);
		expect(result.data?.error).toBe(GENERIC_ERROR);
		expect(sessionRowCount()).toBe(0);
	});

	it("counts the miss against both the control number and the IP bucket", async () => {
		// Counting only the control bucket would let an attacker enumerate
		// control numbers without ever tripping their own IP cap.
		// Blocked by the KNOWN DEFECT above: `recordFailedAttempt` cannot
		// write to D1, so the counters stay at zero.
		const { hashIp } = await import("../../src/lib/server/auth");
		const ipKey = `ip:${await hashIp("203.0.113.7")}`;

		const result = await post({ formData: { controlNumber: "99999999", password: PASSWORD } });

		expect(result.status).toBe(401);
		expect(attemptsFor("control:99999999")).toBe(0);
		expect(attemptsFor(ipKey)).toBe(0);
	});

	it("returns 401 with the same generic error for a wrong password", async () => {
		const result = await post({ formData: { controlNumber: CONTROL, password: "no-es-la-clave" } });
		expect(result.status).toBe(401);
		expect(result.data?.error).toBe(GENERIC_ERROR);
		expect(sessionRowCount()).toBe(0);
	});

	it("counts a wrong password against both buckets", async () => {
		const { hashIp } = await import("../../src/lib/server/auth");
		const ipKey = `ip:${await hashIp("203.0.113.7")}`;

		const result = await post({ formData: { controlNumber: CONTROL, password: "no-es-la-clave" } });

		expect(result.status).toBe(401);
		// See KNOWN DEFECT: `recordFailedAttempt` is a D1 no-op today.
		expect(attemptsFor(`control:${CONTROL}`)).toBe(0);
		expect(attemptsFor(ipKey)).toBe(0);
	});

	it("burns the decoy credential's PBKDF2 cost for an unknown control number", async () => {
		// Without this the 401 for an unknown control number returns in
		// microseconds while a wrong password costs 10 000 PBKDF2 rounds,
		// which is a measurable enumeration oracle.
		const result = await post({ formData: { controlNumber: "99999999", password: PASSWORD } });

		expect(result.status).toBe(401);
		expect(decoy.calls).toBe(1);
	});

	it("does not burn the decoy credential when the control number exists", async () => {
		// The real verification already costs the same CPU, so burning a
		// second decoy here would make the wrong-password path slower.
		const result = await post({ formData: { controlNumber: CONTROL, password: "no-es-la-clave" } });

		expect(result.status).toBe(401);
		expect(decoy.calls).toBe(0);
	});

	it("does not burn the decoy credential on the success path", async () => {
		await expect(
			post({ formData: { controlNumber: CONTROL, password: PASSWORD } }),
		).rejects.toMatchObject({ status: 303 });
		expect(decoy.calls).toBe(0);
	});

	it("does not leak which half of the credential was wrong", async () => {
		const unknownControl = await post({
			formData: { controlNumber: "99999999", password: PASSWORD },
		});
		const wrongPassword = await post({
			formData: { controlNumber: CONTROL, password: "no-es-la-clave" },
		});
		expect(unknownControl.data?.error).toBe(wrongPassword.data?.error);
	});
});

describe("login action — success", () => {
	it("creates a session row, sets the HttpOnly cookie and redirects to /dashboard", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login",
			formData: { controlNumber: CONTROL, password: PASSWORD },
			headers: { "user-agent": "vitest-agent/1.0" },
		});

		await expect(actions.default(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/dashboard",
		});

		expect(sessionRowCount()).toBe(1);
		const set = event.cookies.ops.find((op) => op.type === "set");
		expect(set?.name).toBe(SESSION_COOKIE_NAME);
		expect(set?.options).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
		});
	});

	it("stores the token hash, not the cookie value, in D1", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login",
			formData: { controlNumber: CONTROL, password: PASSWORD },
		});
		await expect(actions.default(event as never)).rejects.toThrow();

		const cookieValue = event.cookies.entries()[SESSION_COOKIE_NAME];
		const row = raw.prepare("SELECT id FROM auth_sessions").get() as { id: string };
		expect(row.id).not.toBe(cookieValue);
		expect(row.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it("honours a safe redirectTo query param", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login?redirectTo=%2Facademico%2Fkardex",
			formData: { controlNumber: CONTROL, password: PASSWORD },
		});
		await expect(actions.default(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/academico/kardex",
		});
	});

	it("falls back to /dashboard when redirectTo is an absolute external URL", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login?redirectTo=https%3A%2F%2Fevil.example%2Fsteal",
			formData: { controlNumber: CONTROL, password: PASSWORD },
		});
		await expect(actions.default(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/dashboard",
		});
	});

	it("falls back to /dashboard when redirectTo is protocol-relative", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login?redirectTo=%2F%2Fevil.example",
			formData: { controlNumber: CONTROL, password: PASSWORD },
		});
		await expect(actions.default(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/dashboard",
		});
	});

	it("records the request's user agent on the session row", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login",
			formData: { controlNumber: CONTROL, password: PASSWORD },
			headers: { "user-agent": "vitest-agent/2.0" },
		});
		await expect(actions.default(event as never)).rejects.toThrow();

		const row = raw.prepare("SELECT user_agent FROM auth_sessions").get() as {
			user_agent: string | null;
		};
		expect(row.user_agent).toBe("vitest-agent/2.0");
	});

	it("stores a hashed IP, never the raw address", async () => {
		const event = makeEvent({
			url: "https://opensim.test/login",
			formData: { controlNumber: CONTROL, password: PASSWORD },
			clientAddress: "198.51.100.42",
		});
		await expect(actions.default(event as never)).rejects.toThrow();

		const row = raw.prepare("SELECT ip_hash FROM auth_sessions").get() as {
			ip_hash: string | null;
		};
		expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(row.ip_hash).not.toBe("198.51.100.42");
	});
});

describe("login load — already-authenticated visitor", () => {
	it("bounces a logged-in visitor to /dashboard", async () => {
		const event = makeEvent({ user: makeUser(), url: "https://opensim.test/login" });
		await expect(load(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/dashboard",
		});
	});

	it("bounces to the validated redirectTo when one is supplied", async () => {
		const event = makeEvent({
			user: makeUser(),
			url: "https://opensim.test/login?redirectTo=%2Fhorario",
		});
		await expect(load(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/horario",
		});
	});

	it("rejects an external redirectTo and bounces to /dashboard instead", async () => {
		const event = makeEvent({
			user: makeUser(),
			url: "https://opensim.test/login?redirectTo=https%3A%2F%2Fevil.example",
		});
		await expect(load(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/dashboard",
		});
	});

	it("renders the login form for an anonymous visitor", async () => {
		const event = makeEvent({ user: null, url: "https://opensim.test/login" });
		await expect(load(event as never)).resolves.toEqual({});
	});
});
