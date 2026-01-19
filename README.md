# Remesitas Cloudflare

Remittance platform for Cuba built on Cloudflare's edge computing stack.

## Tech Stack

- **Frontend**: SvelteKit + TailwindCSS
- **Backend**: Hono.js on Cloudflare Workers
- **Database**: Cloudflare D1 + Drizzle ORM
- **Storage**: Cloudflare R2
- **Auth**: Custom JWT

## Project Structure

```
remesitas-cloudflare/
├── packages/
│   ├── api/              # Hono.js Workers API
│   ├── web/              # SvelteKit frontend
│   └── shared/           # Shared types & validators
├── migrations/           # D1 SQL migrations
└── turbo.json           # Turborepo config
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account

### Installation

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter @remesitas/shared build
```

### Development

```bash
# Run all packages in dev mode
pnpm dev

# Or run individually
pnpm --filter @remesitas/api dev    # API on :8787
pnpm --filter @remesitas/web dev    # Web on :5173
```

### Database Setup

1. Create D1 database:
```bash
wrangler d1 create remesitas-db
```

2. Update `packages/api/wrangler.toml` with database ID

3. Run migrations:
```bash
pnpm db:migrate
```

### Environment Variables

Create `.dev.vars` in `packages/api/`:

```bash
JWT_SECRET=your-secret-key
ELTOQUE_JWT=your-eltoque-token
CAMBIOCUBA_TOKEN=hRaCcY78gXC3k9WRv01pR7V1fgSxlg
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_SMS_FROM=+1234567890
TWILIO_WHATSAPP_FROM=+1234567890
VAPID_PUBLIC_KEY=your-vapid-public
VAPID_PRIVATE_KEY=your-vapid-private
VAPID_EMAIL=your-email
```

## Deployment

### API (Cloudflare Workers)

```bash
pnpm --filter @remesitas/api deploy
```

### Web (Cloudflare Pages)

```bash
pnpm --filter @remesitas/web deploy
```

## Features

### Exchange Rate System
- Multi-source: ElToque API (primary) + CambioCuba (fallback)
- Per-currency auto-update control
- Manual rate override
- Rate history tracking
- Public rates page

### User Roles
- **Admin**: Full system access
- **Repartidor**: Delivery management
- **Revendedor**: Reseller panel with commission tracking

### Remittance Lifecycle
`solicitud` → `pendiente` → `en_proceso` → `entregada` → `facturada`

### Notifications
- SMS for USA (+1)
- WhatsApp for Cuba (+53)
- PWA push notifications

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Admin
- `GET/POST /api/admin/usuarios`
- `GET/PUT/DELETE /api/admin/usuarios/:id`
- `GET/POST /api/admin/comisiones`
- `GET/PUT /api/admin/configuracion`

### Remesas
- `GET/POST /api/remesas`
- `GET/PUT /api/remesas/:id`
- `POST /api/remesas/:id/asignar`
- `POST /api/remesas/:id/aprobar`
- `POST /api/remesas/:id/cancelar`

### Exchange Rates
- `GET /api/tasas`
- `PUT /api/tasas/admin/:moneda`
- `POST /api/tasas/admin/fetch`
- `GET /api/tasas/admin/historial`

### Public
- `GET /api/publico/tasas`
- `POST /api/publico/solicitar`
- `GET /api/publico/rastrear/:codigo`

## License

Private - All rights reserved
