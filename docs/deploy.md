# OpenSIM — Deploy a Cloudflare Workers (Phase 5 Tarea 5.2)

Fecha: 2026-10-03
Target: Cloudflare Workers (no Pages) con D1 binding + assets estáticos.
Branch: `feat/phase-1-foundation` @ 51 commits, working tree limpio.

---

## Estado del config

`wrangler.jsonc` está listo para deploy salvo por `database_id` (placeholder) y la autenticación.

```jsonc
{
	"name": "opensim",
	"compatibility_date": "2026-10-01",
	"compatibility_flags": ["nodejs_compat"],
	"main": ".svelte-kit/cloudflare/_worker.js",
	"assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
	"workers_dev": true,
	"preview_urls": true,
	"d1_databases": [{
		"binding": "DB",
		"database_name": "opensim",
		"database_id": "00000000-0000-0000-0000-000000000000",  // ← reemplazar
		"migrations_dir": "drizzle"
	}]
}
```

`nodejs_compat` está activo — necesario para `crypto.subtle` (PBKDF2). `assets` binding sirve los estáticos desde `.svelte-kit/cloudflare` después de `pnpm build`. `workers_dev: true` expone la URL `opensim.<account>.workers.dev` (cambiar a `routes` cuando se configure un dominio custom).

## Prerrequisitos en la máquina del operador

- `wrangler` ≥ 4.145 (instalado vía pnpm; 4.147 disponible). En este host: 4.145.0.
- `pnpm` 9.x
- Credenciales de Cloudflare (OAuth via `wrangler login` o `CLOUDFLARE_API_TOKEN` con los scopes `Account: D1:Edit`, `Account: Workers Scripts:Edit`, `Account: Account Settings:Read`).
- Una cuenta Cloudflare con el subdominio `workers.dev` activo (incluido en el plan Free).

## Procedimiento

### 1. Autenticar contra Cloudflare

```bash
# Opción A — OAuth (abre el browser):
wrangler login

# Opción B — API token (no interactivo, ideal para CI):
export CLOUDFLARE_API_TOKEN="<token-with-D1-Edit-Workers-Edit-scopes>"
wrangler whoami  # confirma que estás autenticado
```

### 2. Crear la base de datos D1 de producción

```bash
wrangler d1 create opensim
# Output:
#   Created D1 database: opensim (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

Tomá el UUID del output y reemplazalo en `wrangler.jsonc` línea `database_id`. **NO commitear el UUID con tu cuenta personal al repo público** — usar una variable de entorno o un archivo `.prod/wrangler.override.jsonc` con `wrangler deploy -c .prod/wrangler.override.jsonc`.

Para mantener el repo limpio, una opción es:

```jsonc
// wrangler.production.jsonc (gitignored)
{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "opensim-prod",
	"d1_databases": [{
		"binding": "DB",
		"database_name": "opensim",
		"database_id": "<UUID>",
		"migrations_dir": "drizzle"
	}]
}
```

Y deployar con `wrangler deploy -c wrangler.production.jsonc`.

### 3. Aplicar las 5 migraciones

```bash
wrangler d1 migrations apply opensim --remote
# Aplica: 0000, 0001, 0002, 0003, 0004
```

### 4. Aplicar el seed (catálogo, sin estudiantes)

```bash
wrangler d1 execute opensim --remote --file=src/lib/server/db/seed.sql
# Carga: 42 asignaturas, 2 especialidades, 9 aliases, 57 prerequisites
# (NO incluye el estudiante de prueba — eso es solo dev)
```

### 5. Build del Worker

```bash
pnpm build
# Genera:
#   .svelte-kit/cloudflare/_worker.js   (main worker)
#   .svelte-kit/cloudflare/             (static assets)
```

### 6. Deploy

```bash
wrangler deploy
# Output:
#   Published opensim (x.xx sec)
#   https://opensim.<account>.workers.dev
```

Capturar la URL final y agregarla a `docs/deploy.md` (sección "URL activa") y a la feature doc `odd/tasks/phase-5.md`.

### 7. Smoke test

```bash
URL="https://opensim.<account>.workers.dev"

# 1. Página de inicio (público, 200)
curl -s -o /dev/null -w "%{http_code}\n" "$URL/"

# 2. Login (público, 200, devuelve HTML)
curl -s -o /dev/null -w "%{http_code}\n" "$URL/login"

# 3. Dashboard (protegido, 303 → /login sin cookie)
curl -s -o /dev/null -w "%{http_code}\n" "$URL/dashboard"
# esperado: 303 (redirect a /login)

# 4. 404 → +error.svelte
curl -s -o /dev/null -w "%{http_code}\n" "$URL/__nope__"
# esperado: 404
```

Los pasos 1-4 son smoke **sin** credenciales. Para validar el flujo autenticado, hace falta provisionar un estudiante real vía flujo de Rectoría (fuera del scope de OpenSIM dev). La auditoría WCAG 5.1 contra el deploy se hace corriendo `pnpm exec playwright test` con `BASE_URL` apuntando a la URL de prod.

## Migrar a un dominio custom (post-MVP)

`wrangler.jsonc` tiene `workers_dev: true`. Para un dominio custom (e.g. `sim.tecnm.mx`):

```jsonc
{
	"workers_dev": false,
	"routes": [{
		"pattern": "sim.tecnm.mx",
		"custom_domain": true
	}]
}
```

Requiere que el dominio use Cloudflare DNS. La propagación DNS tarda lo usual (5-30 min para CNAME setups).

## Variables de entorno y secretos

El proyecto no usa secrets de Cloudflare hoy (la auth es nativa single-file con PBKDF2 sobre D1, sin servicios externos). Si en el futuro se agrega, el patrón es:

```bash
echo "VALUE" | wrangler secret put SECRET_NAME
```

Y consumir con `env.SECRET_NAME` desde el worker. No commitear nunca al repo.

## Costos esperados (plan Free)

- Workers: 100k req/day incluidos
- D1: 5M reads/day + 100k writes/day incluidos
- Assets: ilimitado en el bundle < 1 MB (nosotros: ~80 KB gz JS + ~12 KB gz CSS = sin riesgo)

Para TecNM Morelia (~3,000 estudiantes), el plan Free alcanza holgadamente.

## Rollback

Si un deploy sale mal:

```bash
wrangler rollback
# o:
wrangler deployments list  # ver versiones
wrangler rollback --version-id <id>
```

El `wrangler rollback` mantiene la URL `workers.dev` apuntando a la versión anterior, sin downtime.

## Monitoreo post-deploy

```bash
# Logs en vivo:
wrangler tail

# Métricas en el dashboard:
# https://dash.cloudflare.com/<account>/workers/services/view/opensim
```

## Troubleshooting común

| Síntoma | Causa probable | Fix |
| --- | --- | --- |
| `Authentication error [code: 10000]` | `CLOUDFLARE_API_TOKEN` no tiene los scopes | Regenerar token con D1:Edit + Workers Scripts:Edit |
| `d1_database_id does not exist` | UUID placeholder no reemplazado | Pegar el UUID real del `wrangler d1 create` |
| `Could not resolve binding 'DB'` | `wrangler.jsonc` no tiene el d1_databases entry | Verificar el `d1_databases` block |
| `Module not found: cloudflare:workers` | `nodejs_compat` flag falta | Agregar a `compatibility_flags` |
| 5xx en `/dashboard` | `auth_sessions` table vacía después de seed | Re-aplicar `0001` y `0002` migrations |
| Asset 404s en rutas protegidas | `_worker.js` no incluye el fallback de SvelteKit | Rebuild con `pnpm build` |
