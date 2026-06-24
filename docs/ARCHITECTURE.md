# Appointment Booking App — Architecture

Production-ready Shopify embedded SaaS for merchant appointment scheduling.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Shopify Remix App Template (React Router v7) |
| Language | TypeScript |
| Admin UI | Shopify Polaris + App Bridge |
| Storefront | Theme App Extension (React + Tailwind) |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | Zod |
| Billing | Shopify Billing API |
| Calendar | Google Calendar API |
| Video | Zoom API |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Shopify Admin (Embedded)                     │
│  Polaris UI ──► Remix Loaders/Actions ──► Prisma ──► PostgreSQL│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Theme App Extension (Storefront Widget)             │
│  React + Tailwind ──► App Proxy / Public API ──► Booking Engine │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   Google Calendar        Zoom API          Email (Resend)
```

## Folder Structure

```
appointment-booking/
├── app/
│   ├── components/
│   │   ├── admin/          # Polaris admin UI components
│   │   ├── booking/        # Shared booking UI primitives
│   │   └── common/         # Layout, navigation, shared UI
│   ├── lib/
│   │   ├── billing/        # Shopify Billing API (Phase 6)
│   │   ├── booking/        # Slot generation, validation (Phase 2)
│   │   ├── email/          # Notification templates (Phase 2)
│   │   ├── integrations/
│   │   │   ├── google/     # Google OAuth + Calendar (Phase 4)
│   │   │   └── zoom/       # Zoom OAuth + meetings (Phase 5)
│   │   ├── security/       # Encryption, rate limiting, CSRF
│   │   ├── translations/   # i18n framework (Phase 7)
│   │   ├── validation/     # Zod schemas for all APIs
│   │   └── constants.ts    # App-wide constants
│   ├── models/             # Database access layer (server-only)
│   │   ├── merchant.server.ts
│   │   ├── service.server.ts
│   │   ├── meeting-type.server.ts
│   │   ├── availability.server.ts
│   │   ├── booking.server.ts
│   │   ├── customer.server.ts
│   │   ├── subscription.server.ts
│   │   └── translation.server.ts
│   ├── routes/
│   │   ├── app/            # Embedded admin pages
│   │   │   ├── _index.tsx          # Dashboard
│   │   │   ├── services.tsx
│   │   │   ├── availability.tsx
│   │   │   ├── meeting-types.tsx
│   │   │   ├── bookings.tsx
│   │   │   ├── integrations.tsx
│   │   │   ├── billing.tsx
│   │   │   ├── translations.tsx
│   │   │   └── settings.tsx
│   │   └── api/            # JSON API routes (storefront + integrations)
│   │       ├── services.ts
│   │       ├── meeting-types.ts
│   │       ├── availability.ts
│   │       ├── bookings.ts
│   │       ├── google.connect.ts
│   │       ├── zoom.connect.ts
│   │       ├── billing.subscribe.ts
│   │       └── translations.ts
│   ├── types/
│   │   └── database.ts     # Re-exported Prisma types
│   ├── db.server.ts
│   └── shopify.server.ts
├── extensions/
│   └── booking-widget/     # Theme App Extension (Phase 3)
│       ├── blocks/
│       ├── assets/
│       └── locales/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── INSTALLATION.md
│   └── DEPLOYMENT.md       # Phase 8
└── docker-compose.yml
```

## Data Model

### Entity Relationship Overview

```
Merchant (1) ──► (*) Service ──► (*) ServiceMeetingType (*) ◄── MeetingType
     │                                                              │
     ├── (*) AvailabilityRule                                      │
     ├── (*) ClosedDate                                            │
     ├── (*) Customer ──► (*) Booking ◄── Service                  │
     │                         └── MeetingType ─────────────────────┘
     ├── (0..1) GoogleConnection
     ├── (0..1) ZoomConnection
     ├── (0..1) Subscription
     └── (*) Translation
```

### Key Design Decisions

1. **Merchant as tenant root** — Every domain entity is scoped to `merchantId`. Shopify `shop` domain is the unique tenant identifier.

2. **Service ↔ MeetingType many-to-many** — A service can support multiple meeting modalities (e.g., Consultation via Zoom or Phone).

3. **Availability as weekly rules + closed dates** — `AvailabilityRule` stores per-day working hours; `ClosedDate` blocks specific calendar dates.

4. **Booking slot uniqueness** — `@@unique([merchantId, bookingDate, startTime])` prevents double bookings at the database level.

5. **Time storage** — Times stored as `HH:mm` strings in merchant timezone; `bookingDate` as `DATE` type.

6. **OAuth token security** — Tokens stored encrypted at the application layer using `ENCRYPTION_KEY`.

7. **Session model** — Retained for Shopify `@shopify/shopify-app-session-storage-prisma` compatibility.

## Booking Engine (Phase 2)

```
Input: serviceId, meetingTypeId, date, startTime, customer
  │
  ├─ Validate service active
  ├─ Validate meeting type active + linked to service
  ├─ Check date not in closedDates
  ├─ Check day has enabled availabilityRule
  ├─ Check startTime within working hours
  ├─ Check slot endTime fits within working hours
  ├─ Check no existing booking at same slot
  │
  └─ Create booking (status: PENDING → CONFIRMED)
       ├─ Google Calendar event (if connected)
       ├─ Zoom meeting (if type = ZOOM)
       └─ Confirmation email
```

### Slot Generation Algorithm

1. Load merchant availability for the requested day of week.
2. Reject if day disabled or date is closed.
3. Generate slots at `SLOT_INTERVAL_MINUTES` (15 min) increments.
4. Filter slots where `slotStart + service.durationMinutes <= endTime`.
5. Remove slots overlapping existing non-cancelled bookings.

## API Routes

| Method | Route | Auth | Phase |
|--------|-------|------|-------|
| GET | `/api/services` | App Proxy / Public | 2 |
| GET | `/api/meeting-types` | App Proxy / Public | 2 |
| GET | `/api/availability` | App Proxy / Public | 2 |
| POST | `/api/bookings` | App Proxy / Public | 2 |
| GET | `/api/bookings` | Admin session | 2 |
| POST | `/api/google/connect` | Admin session | 4 |
| POST | `/api/zoom/connect` | Admin session | 5 |
| POST | `/api/billing/subscribe` | Admin session | 6 |
| GET | `/api/translations` | Public | 7 |
| POST | `/api/translations` | Admin session | 7 |

All request bodies validated with Zod schemas in `app/lib/validation/`.

## Security

| Concern | Implementation |
|---------|----------------|
| Admin auth | Shopify session via `authenticate.admin()` |
| Storefront API | App Proxy HMAC verification |
| OAuth tokens | AES-256-GCM encryption at rest |
| CSRF | React Router + Shopify session tokens |
| Input validation | Zod on all API routes |
| Rate limiting | In-memory / Redis token bucket per IP |
| SQL injection | Prisma parameterized queries |

## Billing Plans

| Plan | Interval | Booking Limit | Premium Features |
|------|----------|---------------|------------------|
| Free | — | 10/month | Basic |
| Shopify Test | — | Unlimited | Dev only |
| Test | — | Unlimited | Dev only |
| Legacy Access | — | Unlimited | All |
| Annual Premium | ANNUAL | Unlimited | All |

Plan enforcement checked in booking creation and integration routes.

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Architecture + Prisma schema | ✅ Complete |
| 2 | Admin dashboard + database layer | ✅ Complete |
| 3 | Theme App Extension + booking widget | ✅ Complete |
| 4 | Google Calendar integration | ✅ Complete |
| 5 | Zoom integration | ✅ Complete |
| 6 | Shopify Billing | ✅ Complete |
| 7 | Translations + RTL | ✅ Complete |
| 8 | Testing + production hardening | ✅ Complete |

## Admin Navigation

- **Dashboard** — Overview stats, recent bookings
- **Services** — CRUD for bookable services
- **Availability** — Weekly hours + closed dates
- **Meeting Types** — Zoom, Phone, WhatsApp, In Store
- **Bookings** — Table with filters, view/cancel
- **Integrations** — Google + Zoom OAuth
- **Billing** — Plan selection and status
- **Translations** — Storefront label overrides
- **Settings** — Timezone, email, widget defaults
