-- Row Level Security policies for Dashboard-1OF1.
-- Defense-in-depth: even though authz happens in server actions, the DB
-- refuses leaks if a query ever runs under the anon/authenticated role.
-- Run AFTER `prisma db push` so tables exist.

-- Helper: current store ids owned by the authenticated user.
create or replace function public.current_user_store_ids()
returns setof text
language sql stable security definer set search_path = public as $$
  select id from public.stores where "ownerId" = auth.uid();
$$;

-- Enable RLS on every app table.
alter table public.app_users               enable row level security;
alter table public.stores                  enable row level security;
alter table public.integrations            enable row level security;
alter table public.products                enable row level security;
alter table public.product_variants        enable row level security;
alter table public.customers               enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.refunds                 enable row level security;
alter table public.stock_movements         enable row level security;
alter table public.suppliers               enable row level security;
alter table public.influencers             enable row level security;
alter table public.influencer_shipments    enable row level security;
alter table public.influencer_shipment_items enable row level security;
alter table public.influencer_payments     enable row level security;
alter table public.expenses                enable row level security;
alter table public.manual_sales            enable row level security;
alter table public.manual_sale_items       enable row level security;
alter table public.ad_campaigns            enable row level security;
alter table public.ad_metrics              enable row level security;
alter table public.uploads                 enable row level security;
alter table public.analytics_snapshots     enable row level security;
alter table public.audit_logs              enable row level security;

-- app_users: a user can read/update their own row.
create policy "app_users self read" on public.app_users
  for select using (id = auth.uid());
create policy "app_users self update" on public.app_users
  for update using (id = auth.uid());

-- stores: owner-only.
create policy "stores owner all" on public.stores
  for all using ("ownerId" = auth.uid())
  with check ("ownerId" = auth.uid());

-- Macro: store-scoped tables.
-- All these have a storeId column; policy says "row's store must be ours".
do $$
declare t text;
begin
  foreach t in array array[
    'integrations','products','product_variants','customers','orders',
    'stock_movements','suppliers','influencers','influencer_shipments',
    'expenses','manual_sales','ad_campaigns','uploads','analytics_snapshots'
  ] loop
    execute format($f$
      create policy "%1$s store scope" on public.%1$s
        for all using ("storeId" in (select public.current_user_store_ids()))
        with check ("storeId" in (select public.current_user_store_ids()));
    $f$, t);
  end loop;
end$$;

-- Child rows without a direct storeId — join up to parent.
create policy "order_items via order" on public.order_items
  for all using ("orderId" in (select id from public.orders where "storeId" in (select public.current_user_store_ids())))
  with check ("orderId" in (select id from public.orders where "storeId" in (select public.current_user_store_ids())));

create policy "refunds via order" on public.refunds
  for all using ("orderId" in (select id from public.orders where "storeId" in (select public.current_user_store_ids())))
  with check ("orderId" in (select id from public.orders where "storeId" in (select public.current_user_store_ids())));

create policy "manual_sale_items via sale" on public.manual_sale_items
  for all using ("manualSaleId" in (select id from public.manual_sales where "storeId" in (select public.current_user_store_ids())))
  with check ("manualSaleId" in (select id from public.manual_sales where "storeId" in (select public.current_user_store_ids())));

create policy "influencer_shipment_items via shipment" on public.influencer_shipment_items
  for all using ("shipmentId" in (select id from public.influencer_shipments where "storeId" in (select public.current_user_store_ids())))
  with check ("shipmentId" in (select id from public.influencer_shipments where "storeId" in (select public.current_user_store_ids())));

create policy "influencer_payments via influencer" on public.influencer_payments
  for all using ("influencerId" in (select id from public.influencers where "storeId" in (select public.current_user_store_ids())))
  with check ("influencerId" in (select id from public.influencers where "storeId" in (select public.current_user_store_ids())));

create policy "ad_metrics via campaign" on public.ad_metrics
  for all using ("campaignId" in (select id from public.ad_campaigns where "storeId" in (select public.current_user_store_ids())))
  with check ("campaignId" in (select id from public.ad_campaigns where "storeId" in (select public.current_user_store_ids())));

-- audit_logs: owner reads their own actions.
create policy "audit own" on public.audit_logs
  for select using ("userId" = auth.uid());
