# Production Deployment Guide

## Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL 16+ (managed: RDS, Neon, Supabase, etc.)
- Shopify Partner account with app published or custom distribution
- Domain with HTTPS for app hosting
- Resend account ([resend.com](https://resend.com)) with verified domain
- Google Cloud project (Calendar API + OAuth)
- Zoom Marketplace app (OAuth)

## 1. Database

Provision PostgreSQL and set:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/appointment_booking?schema=public&sslmode=require"
```

Run migrations:

```bash
npm run setup
```

## 2. Environment Variables

Set all variables from `.env.example` in your hosting platform:

| Variable | Required | Notes |
|----------|----------|-------|
| `SHOPIFY_API_KEY` | Yes | Partner Dashboard |
| `SHOPIFY_API_SECRET` | Yes | Partner Dashboard |
| `SHOPIFY_APP_URL` | Yes | Production HTTPS URL |
| `SCOPES` | Yes | `write_products,read_customers` |
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `ENCRYPTION_KEY` | Yes | `openssl rand -base64 32` |
| `GOOGLE_*` | For Calendar | OAuth redirect must match |
| `ZOOM_*` | For Zoom | OAuth redirect must match |
| `RESEND_API_KEY` | For email | [Resend](https://resend.com) API key |
| `RESEND_FROM_EMAIL` | Optional | Fallback sender if Shopify contact email is not synced |

## 3. Build & Deploy

```bash
npm install
npm run build:all   # Extension widget + Remix app
npm run start       # Or use Docker
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:all
CMD ["npm", "run", "docker-start"]
```

### Hosting Options

- **Fly.io / Railway / Render** — Node process + managed Postgres
- **Heroku** — Use `heroku-postgresql` add-on
- **AWS** — ECS/Fargate + RDS

Ensure `PORT` is set by the platform (default 3000).

## 4. Shopify Configuration

```bash
shopify app deploy
```

Verify in Partner Dashboard:

1. **App URL** matches `SHOPIFY_APP_URL`
2. **Allowed redirection URLs** include `/auth/callback`, `/auth/google/callback`, `/auth/zoom/callback`
3. **App proxy** — subpath `booking`, prefix `apps`, URL `/api/proxy`
4. **Theme extension** deployed and available in Theme Editor

## 5. OAuth Redirect URLs

Register in Google Cloud Console:

```
https://YOUR_APP_URL/auth/google/callback
```

Register in Zoom Marketplace:

```
https://YOUR_APP_URL/auth/zoom/callback
```

## 6. Theme Extension Setup

1. Deploy app with `shopify app deploy`
2. In Shopify Admin → Online Store → Themes → Customize
3. Add **Appointment Booking** block to a page, or enable **Appointment Booking Embed** app embed
4. Configure title, colors, and visibility in block settings

## 7. Billing

Managed app pricing is configured in `shopify.server.js` under `billing`. Plans:

- **Free** — DB-only, 10 bookings/month
- **Annual Premium** — Shopify Billing API, $99/year
- **Shopify Test / Test** — $0.01 test charges
- **Legacy Access** — Grandfathered, no charge

Merchants select plans in Admin → Billing.

## 8. Security Checklist

- [ ] `ENCRYPTION_KEY` is unique per environment
- [ ] PostgreSQL uses SSL in production
- [ ] Resend API key stored as secret
- [ ] Rate limiting configured (`RATE_LIMIT_*`)
- [ ] App proxy HMAC validation enabled (default via Shopify SDK)
- [ ] No secrets committed to git

## 9. Monitoring

- Log aggregation for `[email]`, `[google]`, `[zoom]` errors
- Database connection pool monitoring
- Shopify webhook delivery status in Partner Dashboard

## 10. Post-Deploy Verification

1. Install app on test store
2. Create a service + availability in admin
3. Add booking widget to theme
4. Complete a test booking on storefront
5. Verify confirmation email (or dev log)
6. Connect Google/Zoom and confirm integrations
7. Test billing plan selection
