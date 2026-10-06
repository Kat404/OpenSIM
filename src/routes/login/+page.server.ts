/**
 * OpenSIM — Login form action.
 *
 * Handles POST submissions to `/login`. Validates the form with
 * Valibot, looks up the credential row, verifies the password via
 * PBKDF2, creates a session, and sets the HttpOnly cookie before
 * redirecting to /dashboard (or to the `redirectTo` query param if
 * the user was bounced here from a protected route).
 *
 * Also exposes a `load` function: an already-authenticated user
 * landing on /login is bounced to /dashboard (this is the old
 * `hooks.server.ts` behavior, now owned by the login page itself
 * since hooks no longer knows about route paths).
 */

// `cloudflare:workers` is a URI-style specifier that the adapter's
// Vite plugin resolves at runtime. tsc can't resolve it as a regular
// module, so we cast through the locally-declared `OpenSimWorkerEnv`
// interface (see src/cloudflare-workers.d.ts).
import { env as workerEnv } from "cloudflare:workers";
import { type Actions, fail, redirect, type ServerLoad } from "@sveltejs/kit";
import * as v from "valibot";
import {
	clearRateLimit,
	createSession,
	decoyCredential,
	getCredential,
	hashIp,
	isRateLimited,
	recordFailedAttempt,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
	sessionCookieOptions,
	verifyPassword,
} from "#lib/server/auth";
import { getDb } from "#lib/server/db";
import { safeInternalRedirect } from "#lib/utils/redirect";
import type { OpenSimWorkerEnv } from "../../cloudflare-workers";

const env = workerEnv as OpenSimWorkerEnv;

const LoginSchema = v.object({
	controlNumber: v.pipe(
		v.string("Número de control requerido"),
		v.trim(),
		v.regex(/^\d{8}$/, "El número de control debe tener 8 dígitos"),
	),
	password: v.pipe(
		v.string("Contraseña requerida"),
		v.minLength(1, "La contraseña es obligatoria"),
		v.maxLength(256, "La contraseña es demasiado larga"),
	),
});

type LoginFormFailure = { error: string };

const GENERIC_AUTH_ERROR = "Número de control o contraseña incorrectos";
const RATE_LIMITED_ERROR = (sec: number) =>
	`Demasiados intentos. Espera ${sec} segundos antes de volver a intentar.`;

export const load: ServerLoad = async ({ locals, url }) => {
	// If the visitor already has a valid session, do not let them
	// re-land on /login. Bounce to /dashboard (or wherever they were
	// trying to go via `?redirectTo=`, validated below).
	if (locals.user) {
		const raw = url.searchParams.get("redirectTo");
		const target = safeInternalRedirect(raw);
		throw redirect(303, target);
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const raw = {
			controlNumber: String(formData.get("controlNumber") ?? ""),
			password: String(formData.get("password") ?? ""),
		};

		const parsed = v.safeParse(LoginSchema, raw);
		if (!parsed.success) {
			const first = parsed.issues[0]?.message ?? "Datos inválidos";
			return fail<LoginFormFailure>(400, { error: first });
		}
		const { controlNumber, password } = parsed.output;

		// In SvelteKit 3 + @sveltejs/adapter-cloudflare 8, the worker's
		// env bindings are accessed via the `cloudflare:workers` virtual
		// module (set up by the adapter's Vite plugin in dev, by the
		// worker runtime in production).
		if (!env.DB) {
			return fail<LoginFormFailure>(500, { error: "Servicio no disponible" });
		}
		const db = getDb(env.DB);
		const clientIp = event.getClientAddress();
		const ipHash = await hashIp(clientIp);
		const controlKey = `control:${controlNumber}`;
		const ipKey = `ip:${ipHash}`;

		// Rate limit (audit R8-9 / P0-2). Both keys are checked; deny
		// if EITHER is over the 5/15min threshold. The IP check protects
		// against spraying across many control numbers from one network;
		// the control check protects against hammering one account from
		// many networks.
		const [controlLimit, ipLimit] = await Promise.all([
			isRateLimited(db, controlKey),
			isRateLimited(db, ipKey),
		]);
		const blocked = controlLimit.limited ? controlLimit : ipLimit.limited ? ipLimit : null;
		if (blocked) {
			return fail<LoginFormFailure>(429, { error: RATE_LIMITED_ERROR(blocked.retryAfterSec) });
		}

		const credential = await getCredential(db, controlNumber);
		if (!credential) {
			// Burn the same CPU as a real verification so a missing
			// control number is not distinguishable from a wrong
			// password by timing. Uses production iteration count and
			// salt/derived sizes; see `decoyCredential`.
			const decoy = await decoyCredential();
			await verifyPassword(password, decoy.hash, decoy.salt, decoy.iterations).catch(() => false);
			// Count against BOTH keys so an attacker can't enumerate by
			// trying many control numbers (control: miss) without
			// tripping their own IP cap, and a legitimate user mistyping
			// doesn't fill the bucket uncontested.
			await Promise.all([recordFailedAttempt(db, controlKey), recordFailedAttempt(db, ipKey)]);
			return fail<LoginFormFailure>(401, { error: GENERIC_AUTH_ERROR });
		}

		const ok = await verifyPassword(
			password,
			credential.passwordHash,
			credential.passwordSalt,
			credential.passwordIterations,
		);
		if (!ok) {
			await Promise.all([recordFailedAttempt(db, controlKey), recordFailedAttempt(db, ipKey)]);
			return fail<LoginFormFailure>(401, { error: GENERIC_AUTH_ERROR });
		}

		// Successful login: clear counters for this account + IP so a
		// legitimate user who finally remembered the password doesn't
		// hit the wall on the next attempt from the same place.
		await Promise.all([clearRateLimit(db, controlKey), clearRateLimit(db, ipKey)]);

		const userAgent = event.request.headers.get("user-agent") ?? "";

		const session = await createSession(db, controlNumber, userAgent, ipHash);

		event.cookies.set(SESSION_COOKIE_NAME, session.id, {
			...sessionCookieOptions,
			maxAge: SESSION_MAX_AGE_SECONDS,
			expires: session.expiresAt,
		});

		const redirectTo = event.url.searchParams.get("redirectTo");
		const target = safeInternalRedirect(redirectTo);
		throw redirect(303, target);
	},
};
