// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { StudentProfile } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		interface Locals {
			// Populated by hooks.server.ts from the `opensim_session` cookie.
			// `null` means "unauthenticated"; route loaders/actions use this
			// to gate /academico/* and to render personalised chrome.
			user: StudentProfile | null;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
