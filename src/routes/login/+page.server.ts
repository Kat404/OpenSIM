/**
 * OpenSIM — Login form action.
 *
 * Handles POST submissions to `/login`. Validates the form with
 * Valibot, looks up the credential row, verifies the password via
 * PBKDF2, creates a session, and sets the HttpOnly cookie before
 * redirecting to /dashboard (or to the `redirectTo` query param if
 * the user was bounced here from a protected route).
 *
 * Note: /dashboard is a Phase 3 route. Until it exists the redirect
 * will 404 — the auth flow itself is still correct and verifiable
 * via the `opensim_session` cookie set in the response.
 */

import { fail, redirect, type Actions } from '@sveltejs/kit';
// `cloudflare:workers` is a URI-style specifier that the adapter's
// Vite plugin resolves at runtime. tsc can't resolve it as a regular
// module, so we cast through the locally-declared `OpenSimWorkerEnv`
// interface (see src/cloudflare-workers.d.ts).
import { env as workerEnv } from 'cloudflare:workers';
import type { OpenSimWorkerEnv } from '../../cloudflare-workers';
import * as v from 'valibot';
import {
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
	createSession,
	getCredential,
	hashIp,
	sessionCookieOptions,
	verifyPassword
} from '#lib/server/auth';
import { getDb } from '#lib/server/db';

const env = workerEnv as OpenSimWorkerEnv;

const LoginSchema = v.object({
	controlNumber: v.pipe(
		v.string('Número de control requerido'),
		v.trim(),
		v.regex(/^\d{8}$/, 'El número de control debe tener 8 dígitos')
	),
	password: v.pipe(
		v.string('Contraseña requerida'),
		v.minLength(1, 'La contraseña es obligatoria'),
		v.maxLength(256, 'La contraseña es demasiado larga')
	)
});

type LoginFormFailure = { error: string };

const GENERIC_AUTH_ERROR = 'Número de control o contraseña incorrectos';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const raw = {
			controlNumber: String(formData.get('controlNumber') ?? ''),
			password: String(formData.get('password') ?? '')
		};

		const parsed = v.safeParse(LoginSchema, raw);
		if (!parsed.success) {
			const first = parsed.issues[0]?.message ?? 'Datos inválidos';
			return fail<LoginFormFailure>(400, { error: first });
		}
		const { controlNumber, password } = parsed.output;

		// In SvelteKit 3 + @sveltejs/adapter-cloudflare 8, the worker's
		// env bindings are accessed via the `cloudflare:workers` virtual
		// module (set up by the adapter's Vite plugin in dev, by the
		// worker runtime in production).
		if (!env.DB) {
			return fail<LoginFormFailure>(500, { error: 'Servicio no disponible' });
		}
		const db = getDb(env.DB);
		const credential = await getCredential(db, controlNumber);
		if (!credential) {
			// Run a dummy verify to keep timing similar across branches.
			await verifyPassword(password, 'AAAA', 'AAAA', 100_000).catch(() => false);
			return fail<LoginFormFailure>(401, { error: GENERIC_AUTH_ERROR });
		}

		const ok = await verifyPassword(
			password,
			credential.passwordHash,
			credential.passwordSalt,
			credential.passwordIterations
		);
		if (!ok) {
			return fail<LoginFormFailure>(401, { error: GENERIC_AUTH_ERROR });
		}

		const userAgent = event.request.headers.get('user-agent') ?? '';
		const clientIp = event.getClientAddress();
		const ipHash = await hashIp(clientIp);

		const session = await createSession(db, controlNumber, userAgent, ipHash);

		event.cookies.set(SESSION_COOKIE_NAME, session.id, {
			...sessionCookieOptions,
			maxAge: SESSION_MAX_AGE_SECONDS,
			expires: session.expiresAt
		});

		const redirectTo = event.url.searchParams.get('redirectTo');
		const target =
			redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
				? redirectTo
				: '/dashboard';
		throw redirect(303, target);
	}
};
