# CLAUDE.md - Remesitas Cloudflare

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Remesitas Cloudflare is a modern remittance platform built on Cloudflare's edge stack:
- **API**: Hono.js on Cloudflare Workers
- **Frontend**: SvelteKit on Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Cache**: Cloudflare KV

## Commands

### Install Dependencies
```bash
pnpm install
```

### Development

**First-time setup:**
```bash
# 1. Create local secrets file
cp packages/api/.dev.vars.example packages/api/.dev.vars
# Edit .dev.vars with your values (JWT_SECRET is required)

# 2. Apply local database migrations
pnpm db:migrate
```

**Start dev servers:**
```bash
pnpm dev                    # Run all packages (API :8787, Web :5173)
pnpm --filter api dev       # API only
pnpm --filter web dev       # Web only
```

### Build
```bash
pnpm build                  # Build all packages
```

### Deploy

**Full Deploy (API + Web):**
```bash
pnpm run deploy:all
```

**Deploy API Only:**
```bash
pnpm run deploy:api
```

**Deploy Web Only:**
```bash
pnpm run deploy:web
```

**Windows Batch Script:**
```bash
deploy.bat
```

### Database
```bash
pnpm db:migrate             # Apply migrations locally
pnpm db:migrate:prod        # Apply migrations to production
pnpm db:studio              # Open Drizzle Studio
```

## Production URLs

- **API**: https://remesitas-api.alfre891013.workers.dev
- **Web**: https://remesitas-web.pages.dev
- **GitHub**: https://github.com/alfre891013/remesitas-cloudflare

## Cloudflare Resources

| Resource | ID/Name |
|----------|---------|
| D1 Database | `remesitas-db` (0ec6a875-8822-4498-8015-1fcf7bba9691) |
| R2 Bucket | `remesitas-storage` |
| KV Namespace | `CACHE` (e7cfb9582b7e4321913d18650e5d9e87) |
| Workers | `remesitas-api` |
| Pages | `remesitas-web` |

## Secrets (Cloudflare)

Required secrets (set via `wrangler secret put <NAME>`):
- `JWT_SECRET` - JWT signing key
- `VAPID_PUBLIC_KEY` - Web Push public key
- `VAPID_PRIVATE_KEY` - Web Push private key
- `VAPID_EMAIL` - VAPID contact email

Optional (for notifications):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`

## Architecture

### Packages
```
packages/
├── api/          # Hono.js Workers API (94 endpoints)
│   ├── src/
│   │   ├── routes/       # API routes by feature
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Auth, validation
│   │   └── db/           # Drizzle schema
│   └── wrangler.toml     # Workers config
├── web/          # SvelteKit frontend (17 pages)
│   ├── src/
│   │   ├── routes/       # Pages by role
│   │   ├── lib/          # Components, stores, utils
│   │   └── static/       # PWA assets, icons
│   └── svelte.config.js
└── shared/       # Shared types & validators
    └── src/
        ├── types/
        ├── constants/
        └── validators/
```

### Database Tables
- `usuarios` - User accounts with roles
- `remesas` - Remittance transactions
- `tasas_cambio` - Exchange rates
- `comisiones` - Commission rules
- `pagos_revendedor` - Reseller payments
- `movimientos_contables` - Accounting ledger
- `movimientos_efectivo` - Cash movements
- `configuracion` - Key-value config
- `suscripciones_push` - Push subscriptions

## User Roles

- **Admin**: Full system control (`/admin/*`)
- **Repartidor**: Delivery management (`/repartidor/*`)
- **Revendedor**: Reseller panel (`/revendedor/*`)
- **Public**: Request remittances (`/solicitar`, `/rastrear`)

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Deploy Checklist

Before deploying, ensure:
1. All changes committed to git
2. `pnpm build` succeeds without errors
3. wrangler.toml has correct resource IDs
4. Secrets are set in Cloudflare

After deploying, verify:
1. API health: `curl https://remesitas-api.alfre891013.workers.dev/api/tasas`
2. Web loads: https://remesitas-web.pages.dev
3. Login works with admin/admin123
4. No console errors (CSP, service worker)

## Troubleshooting

### CSP Errors
The `_headers` file in `packages/web/static/` configures CSP. It allows `'unsafe-eval'` for SvelteKit.

### Service Worker Errors
Service worker caches files individually to avoid `addAll()` failures.

### API Proxy
`_redirects` file proxies `/api/*` to Workers API.

### Node.js Compatibility
Workers use `nodejs_compat` flag. If issues occur, check wrangler.toml compatibility settings.

## Scheduled Tasks

Exchange rates auto-update every 12 hours via cron: `0 */12 * * *`
