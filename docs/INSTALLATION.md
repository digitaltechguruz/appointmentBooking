# Installation Guide

## Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL 16+ (or Docker)
- Shopify Partner account
- Shopify CLI (`npm install -g @shopify/cli@latest`)

## 1. Clone and Install

```bash
cd appointment-booking
npm install
```

## 2. Database Setup

### Option A: Docker (recommended)

```bash
docker compose up -d
```

### Option B: Existing PostgreSQL

Create a database and note the connection string.

## 3. Environment Variables

```bash
cp .env.example .env
```

Fill in required values:

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | From Partner Dashboard → App → Client credentials |
| `SHOPIFY_API_SECRET` | App client secret |
| `SCOPES` | `write_products,read_customers` (extend as needed) |
| `SHOPIFY_APP_URL` | Set automatically by `shopify app dev` |
| `DATABASE_URL` | `postgresql://bookingapp:bookingapp@localhost:5432/appointment_booking?schema=public` |
| `ENCRYPTION_KEY` | 32-byte random key (base64). Generate: `openssl rand -base64 32` |

Integration variables (Phases 4–5) can be added later:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`

## 4. Run Migrations

```bash
npm run setup
# Equivalent to: prisma generate && prisma migrate deploy
```

For development with migration creation:

```bash
npx prisma migrate dev
```

## 5. Link Shopify App

```bash
npm run config:link
```

Or create a new app in the Partner Dashboard and update `shopify.app.toml`.

## 6. Start Development Server

```bash
npm run dev
```

Press `P` to open the app URL and install on a development store.

## 7. Verify Installation

1. App loads in Shopify Admin embedded frame
2. Database tables created (check with `npx prisma studio`)
3. Merchant record created on first app load (Phase 2)

## Troubleshooting

### Database connection refused

Ensure PostgreSQL is running:

```bash
docker compose ps
# or
pg_isready -h localhost -p 5432
```

### Migration errors

Reset development database (⚠️ destroys data):

```bash
npx prisma migrate reset
```

### Shopify auth issues

- Confirm `SHOPIFY_APP_URL` matches your tunnel URL
- Reinstall the app on your dev store after URL changes

## Next Steps

After installation, proceed with **Phase 2** to enable the admin dashboard and database layer.
