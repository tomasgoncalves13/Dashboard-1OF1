# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ecommerce intelligence & operations dashboard for **1OF1 Fútbol** — a Shopify-based football merchandise business. Tracks profit, stock, ad spend, influencers, physical sales (clubs), and cashflow in one place.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run inngest:dev  # Inngest local dev server (localhost:8288) — run alongside dev
npm run build        # prisma generate + next build
npm run typecheck    # tsc --noEmit (no test suite yet)
npm run lint         # ESLint

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema to DB without migration (dev only)
npm run db:migrate   # Create and apply a named migration
npm run db:studio    # Prisma Studio GUI
npm run db:seed      # Bootstrap AppUser + Store (requires SEED_USER_ID, SEED_USER_EMAIL env vars)
```

After any change to `prisma/schema.prisma`, run `npm run db:generate` before running the app.

## Architecture

**Stack:** Next.js 15 (App Router) · TypeScript strict · PostgreSQL via Supabase · Prisma 6 ORM · Supabase Auth · Inngest (background jobs) · Tailwind + shadcn/ui

### App Router structure

Route groups separate auth from the main shell:
- `(auth)/login/` — public, no layout wrapper
- `(dashboard)/` — authenticated shell with sidebar; all feature modules live here

### Modules (sidebar routes)

| Route | Module | Description |
|-------|--------|-------------|
| `/dashboard` | Overview | KPI grid, revenue chart, money-to-bank |
| `/orders` | Orders | Shopify order list with profit breakdown |
| `/costs` | Cost catalog | Product unit costs + per-order overheads config |
| `/products` | Catalog | Product/variant management |
| `/inventory` | Inventory | Stock per variant, movement log, adjust dialog |
| `/clubs` | Physical Sales | Club management, physical sale registration, monthly commission |
| `/customers` | Customers | Shopify customer sync |
| `/influencers` | Influencers | Pipeline by status, ROI tracking, discount codes |
| `/ads` | Ads | Ad campaign metrics (Meta/Google/TikTok) |
| `/expenses` | Expenses | Categorised expenses, recurring support |
| `/finance` | Finance | Cashflow timeline (Shopify payouts + Eupago + expenses) |
| `/manual-sales` | Manual sales | Legacy; superseded by /clubs for physical sales |
| `/imports` | Imports | Excel/CSV upload wizard |
| `/settings` | Settings | Shopify sync trigger |

### Data flow

1. **Server Components** fetch data directly via Prisma (no API layer for reads)
2. **Server Actions** handle all writes (form submissions, mutations)
3. **Client Components** use Supabase browser client for auth state only
4. **Inngest** handles durable async work (syncs, snapshot computation, retroactive recalculation)

Every query must be scoped to `storeId` — retrieve it via `getSessionUser()` from `src/lib/supabase/server.ts`.

### Auth & tenancy

`getSessionUser()` returns the authenticated user. Use `prisma.store.findFirst({ where: { ownerId: user.id } })` to get the store. Prisma runs as `postgres` role (bypasses RLS), so manually scoping by `storeId` is required.

### Profit engine

**Online orders (Shopify):**
- COGS = Σ (quantity × variant.unitCost)
- packagingCost = `OrderCostConfig` per-order overhead (bubbleMailer + card + sticker + freeGift grip socks, always 1× per order)
- paymentFees = Σ Shopify transaction fees
- grossProfit = revenueNet − COGS
- netProfit = grossProfit − packagingCost − paymentFees − attributedAdSpend − influencerCost − otherCosts

**`OrderCostConfig`** (one per store, configurable in `/costs`): freeGiftCost (0.88€), bubbleMailerCost (0.69€), cardCost (0.01€), stickerCost (0.06€). Changing config triggers `profit/recalculate.all` Inngest job to retroactively update all orders.

**Physical sales (clubs + self):**
- COGS = Σ (quantity × variant.unitCost)
- grossProfit = revenue − COGS
- Commission = progressive tier (calcClubCommission in `src/lib/clubs/commission.ts`)
- Commission is computed at month level (not per-sale) in `getMonthlyClubSummaries()`
- Physical sales have NO bubble/card/sticker/freeGift costs

**Commission tiers (progressive, like tax brackets):**
```
commissionTiers: [{upTo: 100, rate: 0.25}, {upTo: 300, rate: 0.30}, {upTo: null, rate: 0.35}]
```
First 100€ → 25%, next 200€ → 30%, above 300€ → 35%. Rio Tinto has `commissionEnabled: false`.

### Stock engine

- `ProductVariant.stockOnHand` is the source of truth
- Every inventory change writes a `StockMovement` (signed quantity + type + reference)
- `registerPhysicalSale()` in `src/lib/clubs/service.ts` auto-decrements stock and writes movements
- Manual adjustments via `/inventory` → `adjustStock()` Server Action

### Token security

Third-party API tokens are AES-256-GCM encrypted before DB storage. Use `encrypt`/`decrypt` from `src/lib/crypto.ts`. Key is `APP_ENCRYPTION_KEY` (32-byte hex).

### Background jobs (Inngest)

Job definitions: `src/lib/inngest/functions.ts`. Served at `src/app/api/inngest/route.ts`. Run `npm run inngest:dev` locally.

| Event | Job |
|-------|-----|
| `shopify/sync.full` | Full Shopify sync |
| `shopify/sync.incremental` | Incremental sync |
| `shopify/order.updated` | Single order re-sync |
| `analytics/snapshot.compute` | Recompute one day |
| `profit/recalculate.all` | Retroactive profit recalculation + 90 days of snapshots |
| cron `0 3 * * *` | Daily snapshot refresh (7 days) |
| cron `0 * * * *` | Hourly Shopify pull safety net |

### Finance / Cashflow

`src/lib/finance/cashflow.ts` provides:
- `getCashflowEntries()` — timeline merging Shopify payouts + Eupago payouts (cash in) + expenses + influencer payments (cash out)
- `getMonthlyCashflow()` — 6-month bar chart data

### Analytics snapshot

`src/lib/analytics/snapshot.ts` computes daily rollups covering **both** ecommerce and physical sales. Fields: `revenue`, `orders`, `grossProfit`, `netProfit` (ecommerce) + `physicalRevenue`, `physicalCogs`, `physicalProfit`, `clubCommissions` (physical).

## Key files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | DB schema (35+ models) |
| `src/lib/supabase/server.ts` | `getSessionUser()` — required in all authenticated server code |
| `src/lib/profit/calculate.ts` | Online order profit breakdown |
| `src/lib/profit/order-costs.ts` | OrderCostConfig service (per-order overheads) |
| `src/lib/profit/recalculate.ts` | Retroactive recalculation (all orders in store) |
| `src/lib/clubs/commission.ts` | Progressive commission calculator |
| `src/lib/clubs/service.ts` | Club CRUD, physical sale registration, monthly summaries |
| `src/lib/finance/cashflow.ts` | Cashflow timeline + monthly aggregation |
| `src/lib/analytics/snapshot.ts` | Daily rollup (ecommerce + physical) |
| `src/lib/dashboard/kpis.ts` | KPI query helpers |
| `src/lib/shopify/sync/orders.ts` | Order ingestion + profit calculation |
| `src/components/ui/` | shadcn/ui primitives (regenerate via shadcn CLI, don't edit manually) |

## Environment variables

See `.env.example`. Critical:
- `DATABASE_URL` — pooled (pgbouncer) for runtime
- `DIRECT_URL` — direct port 5432 for migrations
- `APP_ENCRYPTION_KEY` — 32-byte hex; required for integration tokens
- `SHOPIFY_WEBHOOK_SECRET` — HMAC verification
- `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` — Inngest auth
