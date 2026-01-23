# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remesitas is a remittance platform for Cuba built on Cloudflare's edge stack:
- **API**: Hono.js on Cloudflare Workers (`packages/api`)
- **Frontend**: SvelteKit 5 + TailwindCSS on Cloudflare Pages (`packages/web`)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage**: Cloudflare R2 (delivery photos)
- **Cache**: Cloudflare KV
- **Shared**: TypeScript types, Zod validators, constants (`packages/shared`)

## Commands

```bash
# Install dependencies
pnpm install

# First-time setup
cp packages/api/.dev.vars.example packages/api/.dev.vars  # Then edit with JWT_SECRET
pnpm db:migrate                                            # Apply local migrations

# Development
pnpm dev                      # All packages (API :8787, Web :5173)
pnpm --filter api dev         # API only
pnpm --filter web dev         # Web only

# Type checking
pnpm typecheck                # All packages
pnpm --filter api typecheck   # API only
pnpm --filter web typecheck   # Web only

# Tests
pnpm --filter api test        # Run API tests (vitest)
pnpm --filter api test:watch  # Watch mode

# Database
pnpm db:migrate               # Apply migrations locally
pnpm db:migrate:prod          # Apply migrations to production
pnpm db:studio                # Open Drizzle Studio

# Deploy
pnpm run deploy:all           # Build and deploy everything
pnpm run deploy:api           # API only (Workers)
pnpm run deploy:web           # Web only (Pages)
```

## Architecture

### Monorepo Structure (pnpm workspaces + Turborepo)
- **packages/api**: Hono.js Workers API with JWT auth via `jose`
- **packages/web**: SvelteKit 5 with Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **packages/shared**: Re-exported via `@remesitas/shared`, `@remesitas/shared/types`, etc.

### API Routes (`packages/api/src/routes/`)
Routes organized by feature, each creating a Hono sub-app:
- `auth.ts` - Login, logout, refresh, password change
- `admin.ts` - User management, config, commissions, cash flow
- `remesas.ts` - Remittance CRUD and state transitions
- `tasas.ts` - Exchange rate management and external fetching
- `repartidor.ts` - Delivery driver operations
- `revendedor.ts` - Reseller operations
- `publico.ts` - Public endpoints (no auth required)
- `reportes.ts` - Reporting and analytics

### Middleware (`packages/api/src/middleware/`)
- `authMiddleware` - JWT verification, sets `c.get('auth')` context
- `adminMiddleware` - Requires admin role
- `repartidorMiddleware` - Requires admin or repartidor role
- `revendedorMiddleware` - Requires admin or revendedor role
- `validate` - Zod schema validation middleware

### Database Schema (`packages/api/src/db/schema.ts`)
Drizzle ORM schema defines tables: `usuarios`, `remesas`, `tasasCambio`, `comisiones`, `pagosRevendedor`, `movimientosContables`, `movimientosEfectivo`, `configuracion`, `suscripcionesPush`, `sessions`

### Frontend State (`packages/web/src/lib/`)
- `stores/auth.ts` - Svelte writable store for auth state with localStorage persistence
- `utils/api.ts` - `ApiClient` class with typed helpers, auto token refresh on 401
- `utils/config.ts` - API base URL configuration (dev vs prod)

### Remittance Lifecycle
States: `solicitud` → `pendiente` → `en_proceso` → `entregada` → `facturada` (or `cancelada`)
- `solicitud`: Public request awaiting approval
- `pendiente`: Approved, awaiting assignment to repartidor
- `en_proceso`: Assigned, awaiting delivery
- `entregada`: Delivered by repartidor
- `facturada`: Invoiced/closed

### User Roles
- **admin**: Full access, all `/admin/*` routes
- **repartidor**: Delivery driver, `/repartidor/*` routes, tracks USD/CUP cash balances
- **revendedor**: Reseller, `/revendedor/*` routes, earns commissions

## Key Files

| Purpose | Location |
|---------|----------|
| API entry point | `packages/api/src/index.ts` |
| DB schema | `packages/api/src/db/schema.ts` |
| Auth middleware | `packages/api/src/middleware/auth.ts` |
| Cron handler | `packages/api/src/scheduled.ts` |
| Web API client | `packages/web/src/lib/utils/api.ts` |
| Auth store | `packages/web/src/lib/stores/auth.ts` |
| Shared types | `packages/shared/src/types/index.ts` |
| CSP headers | `packages/web/static/_headers` |
| API proxy | `packages/web/static/_redirects` |
| Wrangler config | `packages/api/wrangler.toml` |

## Production

- **API**: https://remesitas-api.alfre891013.workers.dev
- **Web**: https://remesitas-web.pages.dev
- **Default login**: admin / admin123

### Cloudflare Resources
- D1 Database: `remesitas-db` (0ec6a875-8822-4498-8015-1fcf7bba9691)
- R2 Bucket: `remesitas-storage`
- KV Namespace: `CACHE` (e7cfb9582b7e4321913d18650e5d9e87)

### Required Secrets
Set via `wrangler secret put <NAME>`:
- `JWT_SECRET` - JWT signing key (required)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` - Web Push (optional)
- `TWILIO_*` - SMS/WhatsApp notifications (optional)

## Troubleshooting

**CSP Errors**: `packages/web/static/_headers` configures CSP; allows `'unsafe-eval'` for SvelteKit

**API 404 in production**: Check `_redirects` proxies `/api/*` to Workers API correctly

**Svelte 5 errors**: Use `$state()`, `$derived()`, `$effect()` runes instead of `let` for reactive state. Avoid orphan effects (effects must run during component initialization)

**Node.js APIs in Workers**: `nodejs_compat` flag is enabled in wrangler.toml

**Exchange rate cron**: Runs every 12 hours (`0 */12 * * *`) via `packages/api/src/scheduled.ts`
