# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ecommerce intelligence & operations dashboard for **1OF1 Fútbol** — a Shopify-based football merchandise business. Tracks profit, stock, ad spend, influencers, physical sales (clubs), cashflow, and social content scheduling (Instagram/TikTok/Facebook) in one place.

## Meta Ads knowledge base (`Facebook Ads/`)

Separate from `business-context/` (which is brand/product/persona background only). `Facebook Ads/` is a living, evolving knowledge base for running Meta ad campaigns for the brand:
- `Facebook Ads/01 - Estrategia e Analise.md` — current campaign structure, decisions made (and why), backlog of things to test, and a dated results log.
- `Facebook Ads/Copys por Formato/` — one file per creative format (e.g. GRWM video, static images), each with ready-to-use copy per angle.

When working on ads for this brand:
- **Read this folder first** before giving ad strategy/copy advice — don't repeat analysis already done.
- **Be critical, not agreeable** — question weak copy, flag policy/legal risk (e.g. unauthorized use of real athletes' names, fabricated stats), and push back on angles that don't match the creative.
- **After giving new advice, decisions, or copy, update the relevant file** in `Facebook Ads/` so the next session starts from the improved state instead of redoing the same reasoning. Add real results to the log in `01 - Estrategia e Analise.md` whenever the user shares performance data, so recommendations keep getting sharper over time instead of resetting each session.
- Keep `Facebook Ads/` separate from `business-context/` — don't move ad-strategy content back into business-context.

## Business context knowledge base (`business-context/`)

This is the standing reference for what the brand *is* — personas, sales angles, product characteristics, brand values, copy banks. It's not ad-campaign execution (that's `Facebook Ads/`, see above).

- Whenever a conversation surfaces something new and durable about the business — a new persona insight, a pain/desire not yet captured, a product fact, a brand-voice preference, a lesson about what resonates with customers — **add it to the relevant file in `business-context/`** (or propose a new file if nothing fits), not just answer in chat and lose it.
- Goal: every session should make this knowledge base a little more accurate, so future conversations start smarter instead of re-deriving the same understanding of the business from scratch.
- Don't dump ad-specific tactics/results here — those belong in `Facebook Ads/`. This folder is for durable "what is true about this brand and its customers," not "what we tested last week."

## Workflow

**Depois de cada alteração de código: faz sempre commit e deploy logo a seguir**, sem perguntar. Deploy = `git push origin main` (o Vercel faz deploy automático do `main`). Corre `npm run typecheck` antes do commit.
**⚠️ Regra do dono (reforçada a 24 Set 2026): isto vale para QUALQUER pedido que mexa em código ou docs do repo.** Mal a alteração esteja feita e verificada: typecheck → commit → `git push origin main` (= produção). Nunca deixar alterações só locais nem perguntar "queres que faça deploy?".

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
| `/clubs` | Physical Sales | Club list, monthly commission summary, sale registration |
| `/clubs/[clubId]` | Club Detail | Per-product pricing, commission tier config, sales history |
| `/customers` | Customers | Shopify customer sync |
| `/influencers` | Influencers | Pipeline by status, ROI tracking, discount codes |
| `/ads` | Ads | Ad campaign metrics (Meta/Google/TikTok) |
| `/expenses` | Expenses | Categorised expenses, recurring support |
| `/visao-mensal` | Monthly overview | Month-by-month since Dec 2024: site + physical sales, ads, expenses, profit (COGS) vs real cash (stock purchases), cumulative (`src/lib/dashboard/monthly.ts`) |
| `/finance` | Finance | Cashflow timeline (Shopify payouts + Eupago + expenses) |
| `/manual-sales` | Manual sales | Legacy; superseded by /clubs for physical sales |
| `/instagram` | Instagram | IG account insights + Reel scheduling (Meta Graph API) |
| `/facebook` | Facebook | Page insights + post scheduling (Meta Graph API) |
| `/tiktok` | TikTok | Draft video uploads (TikTok Content Posting API) |
| `/grwm` | GRWM Scheduler | Queues GRWM Reels/videos for cross-posting; published daily by cron |
| `/encomendas` | Purchase orders | Supplier purchase orders (`PurchaseOrder`/`PurchaseOrderItem`), production/transport cost tracking |
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

**⚠️ Política de envio (regra fixa do negócio, confirmada pelo dono a 23 Set 2026; usar SEMPRE em contas de margem, ofertas e planos):**
- Encomendas **abaixo de €40**: o cliente paga **€4,95** de envio.
- A partir de **€40**: envio **grátis** para o cliente. A regra é permanente, também na Black Friday e nas promoções.
- O envio custa **sempre €5,40** à empresa, por encomenda, seja qual for o valor.
- Por isso: encomenda < €40 → o envio custa-nos só €0,45 líquidos; encomenda ≥ €40 → custa-nos €5,40 inteiros. Nas ofertas, chegar aos €40 elimina o envio pago pelo cliente.
- (O `OrderCostConfig` também tem `shippingEU` = €8,60 para envios fora de Portugal; os €5,40 são os envios nacionais, que são quase todos.)

**IVA (dono, 24 Set 2026):** hoje a empresa **ainda não paga IVA**, mas vai ter de passar a pagar **23%**. Os preços de venda mantêm-se, por isso o IVA sai de dentro da faturação: IVA = faturação × 23/123 (~18,7%). O simulador `/plano-q4` tem o card "Lucro com IVA" (pior caso, sem IVA dedutível nas compras). Em contas de margem e ofertas, mostrar sempre também a versão com IVA.

**`OrderCostConfig`** (one per store, configurable in `/costs`): freeGiftCost (0.88€), bubbleMailerCost (0.69€), cardCost (0.01€), stickerCost (0.06€). Changing config triggers `profit/recalculate.all` Inngest job to retroactively update all orders.

**Physical sales (clubs + self):**
- Stored as `ManualSale` records with `clubId` FK (despite the model name, all physical sales go through this table)
- COGS = Σ (quantity × variant.unitCost)
- grossProfit = revenue − COGS
- Commission = progressive tier (calcClubCommission in `src/lib/clubs/commission.ts`)
- Commission is computed at month level (not per-sale) in `getMonthlyClubSummaries()`
- Physical sales have NO bubble/card/sticker/freeGift costs
- **⚠️ Meias Antiderrapantes (grip socks) vendidas a clubes são SEMPRE tamanho Criança (EU 36-40 / `Grip Sock <Cor> (Kids)`) — nunca Adulto/EU 40-48, sem exceções.** Ao escrever qualquer script ou registar qualquer venda física para um clube, usa sempre a variante EU 36-40 para meias. Este erro já aconteceu 2× (scripts que escolheram a variante Adulto por engano) e foi corrigido retroativamente na BD — não repetir.
- **⚠️ Caneleiras Embutidas vendidas a clubes NUNCA são tamanho XL (`Built-In Shin Pad XL`).** A distribuição real de tamanhos em vendas a clubes tende a ser S/M/L. Antes de escrever um script de venda a um clube com caneleiras, confirma a distribuição de tamanhos com o dono do negócio em vez de adivinhar — já houve pelo menos 1 venda (Rio Tinto) corrigida retroativamente por ter sido registada com XL indevidamente.

- **Cor de cada clube (meias Kids):** Candal = **Azul**, Canidelo = **Verde**, Rio Tinto = **Amarelo**. Todos os clubes vendem também meias **Branco** e **Preto** Kids. Rio Tinto vendeu ~20 caneleiras (sobretudo de criança) entre Nov e Jan do ano passado.

**Commission tiers (progressive, like tax brackets):**
```
commissionTiers: [{upTo: 100, rate: 0.25}, {upTo: 300, rate: 0.30}, {upTo: null, rate: 0.35}]
```
First 100€ → 25%, next 200€ → 30%, above 300€ → 35%. Rio Tinto has `commissionEnabled: false`.

### Stock engine

- `ProductVariant.stockOnHand` is the source of truth
- Every inventory change writes a `StockMovement` (signed quantity + type + reference)
- Encomendas Shopify só descontam stock quando estão **pagas** (PAID / PARTIALLY_REFUNDED / REFUNDED). As PENDING (MB por pagar) e EXPIRED não descontam; se tinham descontado antes, o sync repõe o stock e apaga esses movimentos (`ingestOrder` em `src/lib/shopify/sync/orders.ts`).
- `registerPhysicalSale()` in `src/lib/clubs/service.ts` auto-decrements stock and writes movements
- Manual adjustments via `/inventory` → `adjustStock()` Server Action
- **Caneleiras Embutidas: variante à venda → tamanho físico (BOM)**: Criança Pequeno / "- Criança" MINI → **S**; Adulto Pequeno, Criança Médio / "- Criança" MIDI → **M**; Adulto Médio, Criança Grande → **L**; Adulto Grande → **XL**. O nome da variante NÃO é o tamanho físico (ex: "Adulto Pequeno" gasta um M). ⚠️ As variantes "Pack Pro - Caneleiras Embutidas · Criança (7-12) / MAXI / *" não têm BOM: se venderem, não descontam stock.

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
| cron `30 3 * * *` | Meta Ads spend (last 7 days) → `AdCampaign`/`AdMetric` (`src/lib/meta/sync-ads.ts`). Backfill: `npx tsx --env-file=.env scripts/sync-meta-ads.mts 2025-07-01` |

**Meta Ads spend lives in the DB** (`AdMetric`, per campaign per day). Finance (`getFinanceBreakdown`, monthly cashflow, cashflow entries) and `/visao-mensal` read it from there; don't also record Meta spend as `Expense` rows (double count).

### Finance / Cashflow

`src/lib/finance/cashflow.ts` provides:
- `getCashflowEntries()` — timeline merging Shopify payouts + Eupago payouts (cash in) + expenses + influencer payments (cash out)
- `getMonthlyCashflow()` — 6-month bar chart data

### Social content scheduling (GRWM)

Separate from Inngest — uses **Vercel crons** (`vercel.json`, `0 17 * * *` and `0 18 * * *` UTC) hitting `src/app/api/cron/grwm/route.ts`, authenticated via `CRON_SECRET` bearer header. Only the run that falls at **18h Lisbon** does anything (so it is 18h all year, summer and winter). Each run publishes the oldest unpublished `GrwmScheduledPost` with `scheduledDate <= today` (queue semantics: a failed run is retried on the next tick, not skipped). **If nothing is scheduled for today, the cron repeats the video cycle forever** (`nextFromCycle`): the cycle is the distinct videos in order of first appearance (16 today); it creates today's post with the video after the last one and wraps back to the first. Posting new/other videos = just schedule them (they take priority); the cycle continues after them. Publishes to Instagram (`src/lib/meta/graph.ts`) and TikTok (`src/lib/tiktok/client.ts`) in parallel per post, tracking `igMediaId`/`tiktokPublishId`/`fbPostId` independently so a partial failure doesn't republish the platforms that already succeeded. Facebook is never posted to directly (no Business Verification) — IG's auto-crosspost to the linked Page covers it. Scheduling itself is done via one-off scripts in `scripts/` (e.g. `schedule-grwm.mjs`, `seed-grwm.mjs`) rather than in-app UI.

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
| `src/lib/meta/graph.ts` | Meta Graph API client (Instagram + Facebook insights, publishing) |
| `src/lib/tiktok/client.ts` | TikTok Content Posting API client |
| `src/app/api/cron/grwm/route.ts` | Vercel cron: publishes next queued GRWM post |
| `src/components/ui/` | shadcn/ui primitives (regenerate via shadcn CLI, don't edit manually) |

## Environment variables

See `.env.example`. Critical:
- `DATABASE_URL` — pooled (pgbouncer) for runtime
- `DIRECT_URL` — direct port 5432 for migrations
- `APP_ENCRYPTION_KEY` — 32-byte hex; required for integration tokens
- `SHOPIFY_WEBHOOK_SECRET` — HMAC verification
- `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` — Inngest auth
- `EUPAGO_CLIENT_ID` + `EUPAGO_CLIENT_SECRET` — Eupago OAuth (Portuguese MB/MBWay payment provider)
- `EUPAGO_API_BASE` — defaults to `https://clientes.eupago.pt`
- `META_APP_ID` / `META_APP_SECRET` / `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` — Meta Graph API (Instagram, Facebook, ads)
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` / `TIKTOK_ACCESS_TOKEN` / `TIKTOK_REFRESH_TOKEN` / `TIKTOK_OPEN_ID` — TikTok Content Posting API
- `CRON_SECRET` — bearer token the Vercel cron sends to `/api/cron/grwm` (not in `.env.example`; must be set manually and match the Vercel cron config)
