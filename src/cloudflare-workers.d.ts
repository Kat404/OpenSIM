/**
 * OpenSIM — Type shim for the `cloudflare:workers` virtual module.
 *
 * In SvelteKit 3 + @sveltejs/adapter-cloudflare 8, the worker's env
 * bindings (D1, KV, R2, env vars, etc.) are accessed via
 * `import { env } from 'cloudflare:workers'`. The `event.platform`
 * surface from SvelteKit 2 is reserved for third-party platform
 * emulators and is no longer populated by the Cloudflare adapter.
 *
 * The runtime resolution is handled by the adapter:
 *   - In production: the worker's built-in `cloudflare:workers` module
 *     returns the live env (set up by `wrangler deploy`).
 *   - In dev/preview: the adapter's Vite plugin resolves the import
 *     to `src/virtual-cloudflare-workers.js`, which reads from the
 *     `__sveltekit_cloudflare_platform` proxy set up by
 *     `getPlatformProxy()`.
 *
 * TypeScript refuses to resolve `cloudflare:workers` as a regular
 * module path (it looks like an absolute URI), so we declare the
 * module shape here and use a cast at the import sites in
 * hooks.server.ts and +page.server.ts.
 */

export interface OpenSimWorkerEnv {
	DB: D1Database;
	ASSETS: Fetcher;
}

declare module 'cloudflare:workers' {
	export const env: OpenSimWorkerEnv;
	export const caches: CacheStorage;
	export const ctx: ExecutionContext;
	export const cf: IncomingRequestCfProperties | undefined;
	export function withEnv<T>(env: unknown, fn: () => T): T;
	export function withEnvAndExports<T>(env: unknown, exports: unknown, fn: () => T): T;
	export const exports: Record<string, unknown>;
	export const waitUntil: (promise: Promise<unknown>) => void;
}

export {};
