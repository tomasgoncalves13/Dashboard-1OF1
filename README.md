# Dashboard-1OF1

Ecommerce intelligence & operations dashboard for **1OF1 Fútbol** — a single source of truth for Shopify orders, real profit, stock, influencers, ads and manual/club sales.

> **Status:** Phase 0 complete — architecture, schema, auth, layout. Phases 1–7 build modules vertically (DB → API → UI per module).

---

## Stack

| Layer        | Choice                                                         |
|--------------|----------------------------------------------------------------|
| Framework    | Next.js 15 (App Router, Server Actions, RSC)                   |
| Language     | TypeScript (strict)                                            |
| Database     | Postgres (Supabase)                                            |
| ORM          | Prisma 6                                                       |
| Auth         | Supabase Auth (`@supabase/ssr`)                                |
| Storage      | Supabase Storage (invoices, Excel uploads)                     |
| Background   | Inngest (Vercel-compatible, type-safe events)                  |
| UI           | Tailwind + shadcn/ui + Radix primitives                        |
| Charts       | Recharts                                                       |
| Forms        | react-hook-form + zod                                          |
| State        | Zustand (client-only, sparingly)                               |
| Deploy       | Vercel                                                         |

## Folder layout

```
src/
  app/
    (auth)/login                  Login page (public)
    (dashboard)/                  Authenticated shell
      dashboard/                  KPIs & overview
      orders/ products/ inventory/ customers/
      influencers/ ads/ expenses/ manual-sales/
      imports/ settings/
    api/
      inngest/                    Inngest serve endpoint
      webhooks/shopify/           Shopify webhook receiver (HMAC verified)
  components/
    ui/                           shadcn primitives
    layout/                       Sidebar, Topbar
  lib/
    prisma.ts                     Prisma singleton
    supabase/                     server / browser / admin clients
    inngest/                      client + function registry
    crypto.ts                     AES-256-GCM for third-party tokens
    utils.ts                      cn, money/number/percent formatters
prisma/
  schema.prisma                   Full database schema
  seed.ts                         Bootstrap your AppUser + default Store
supabase/
  rls.sql                         Row Level Security policies
```

## Phase plan

| Phase | Module                | Outcome                                                              |
|-------|-----------------------|----------------------------------------------------------------------|
| 0     | **Foundations** (done) | Project, schema, auth, layout, RLS                                  |
| 1     | Shopify sync          | OAuth + orders/products/customers/inventory, webhooks                |
| 2     | Catalog & costs       | Product/variant editor, bulk cost edit, CSV in/out                   |
| 3     | Stock engine          | Movement log, auto-decrement, low-stock alerts, valuation            |
| 4     | Meta Ads              | Spend / ROAS / CPA per campaign, blended MER                         |
| 5     | Influencers           | DB, shipments, payments, per-influencer ROI                          |
| 6     | Expenses + Manual     | Categorised expenses, recurring, manual/club/event sales             |
| 7     | Excel importer        | Wizard with column mapping, dedupe, history                          |
| 8     | Polish                | Command palette, mobile, animations, perf                            |

Each phase is end-to-end (DB → API → UI). Modules ship one at a time so each one is testable with real data.

---

## Setup

### 1. Supabase project
1. Create a project at https://supabase.com
2. Settings → Database → copy the **Connection string** (pooled, `?pgbouncer=true`) into `DATABASE_URL`
3. Copy the direct (port 5432) string into `DIRECT_URL`
4. Settings → API → copy `URL`, `anon`, `service_role` keys

### 2. Env
```bash
cp .env.example .env
# fill in Supabase + Shopify + Meta + Inngest values
# generate APP_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install + DB
```bash
npm install
npm run db:push          # create tables in Supabase
# Then in Supabase SQL editor, run supabase/rls.sql to apply RLS
```

### 4. Create your user
In Supabase Dashboard → Authentication → Users → Add user (email/password).
Copy the user's UUID, then:
```bash
SEED_USER_ID=<uuid> SEED_USER_EMAIL=tomasag2005@gmail.com npm run db:seed
```

### 5. Run
```bash
npm run dev              # http://localhost:3000
npm run inngest:dev      # http://localhost:8288  (separate terminal)
```

---

## Architecture notes

**Why Prisma + Supabase Auth + RLS.** Prisma queries run as the `postgres` role and bypass RLS by design. Authorization is enforced in server actions / route handlers (load the Supabase session, scope every query by `storeId`). RLS is kept enabled as defense-in-depth for the rare case an `anon`/`authenticated` connection ever hits a table.

**Why Inngest.** Vercel functions are short-lived. Shopify full syncs, Meta daily pulls and analytics rollups need durable execution, retries and concurrency control. Inngest gives that with no infra. The full event catalogue is typed in `src/lib/inngest/client.ts`.

**Profit engine.** Each `Order` stores a *denormalized* profit breakdown: revenue, COGS (snapshotted from variant cost at sale time), shipping cost, packaging, payment fees, attributed ad spend, influencer cost, gross & net profit, margin. Dashboards aggregate this directly — no joins, no recomputation. A daily `AnalyticsSnapshot` rolls everything per day for fast date-range queries.

**Stock engine.** `ProductVariant.stockOnHand` is the source of truth. *Every* change writes a `StockMovement` row (signed quantity + reason + reference). Shopify webhooks, manual sales, club sales and influencer shipments all decrement through the same path.

**Token security.** All third-party tokens (Shopify, Meta) are stored encrypted with AES-256-GCM in `integrations.accessToken`. Key in `APP_ENCRYPTION_KEY`, never in the DB. See `src/lib/crypto.ts`.

**Multi-store ready.** Schema supports many stores per user (each Store has its own integrations and data). UI currently assumes the default store; multi-store switcher comes when needed.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import on Vercel
3. Set every env var from `.env.example`
4. Build command: `npm run build` (runs `prisma generate` first)
5. After first deploy, register Inngest at https://app.inngest.com pointing to `https://YOUR-DOMAIN/api/inngest`
6. Register Shopify webhooks pointing to `https://YOUR-DOMAIN/api/webhooks/shopify`

---

## Next session

When you come back, confirm which module to tackle first. Recommended start: **Phase 1 — Shopify**. Bring your Shopify Custom App credentials and I'll wire the full sync end-to-end.
