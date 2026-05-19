import { inngest } from "./client";
import { fullSync, incrementalSync } from "@/lib/shopify/sync";
import { syncSingleOrder } from "@/lib/shopify/sync/single-order";
import { computeAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import { recalculateAllOrderProfits } from "@/lib/profit/recalculate";

export const shopifyFullSync = inngest.createFunction(
  { id: "shopify-full-sync", concurrency: { limit: 1, key: "event.data.storeId" }, retries: 3 },
  { event: "shopify/sync.full" },
  async ({ event, step }) => {
    return step.run("full-sync", () => fullSync(event.data.storeId));
  },
);

export const shopifyIncrementalSync = inngest.createFunction(
  { id: "shopify-incremental-sync", concurrency: { limit: 1, key: "event.data.storeId" }, retries: 3 },
  { event: "shopify/sync.incremental" },
  async ({ event, step }) => {
    return step.run("incremental-sync", () => incrementalSync(event.data.storeId, event.data.since));
  },
);

export const shopifyOrderUpdated = inngest.createFunction(
  { id: "shopify-order-updated", retries: 5 },
  { event: "shopify/order.updated" },
  async ({ event, step }) => {
    return step.run("ingest-order", () => syncSingleOrder(event.data.storeId, event.data.orderId));
  },
);

export const computeSnapshot = inngest.createFunction(
  { id: "analytics-snapshot-compute", retries: 2 },
  { event: "analytics/snapshot.compute" },
  async ({ event, step }) => {
    return step.run("compute", () => computeAnalyticsSnapshot(event.data.storeId, event.data.date));
  },
);

// Triggered when OrderCostConfig changes — recalculates profit on all historical orders.
export const profitRecalculateAll = inngest.createFunction(
  { id: "profit-recalculate-all", concurrency: { limit: 1, key: "event.data.storeId" }, retries: 2 },
  { event: "profit/recalculate.all" },
  async ({ event, step }) => {
    const result = await step.run("recalculate", () =>
      recalculateAllOrderProfits(event.data.storeId),
    );
    // After recalculation, refresh snapshots for the last 90 days
    const { prisma } = await import("@/lib/prisma");
    for (let d = 0; d < 90; d++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - d);
      const iso = date.toISOString().slice(0, 10);
      await step.run(`snapshot-${iso}`, () =>
        computeAnalyticsSnapshot(event.data.storeId, iso),
      );
    }
    return result;
  },
);

// Daily cron: refresh snapshots for the last 7 days (handles late refunds/edits).
export const dailySnapshotCron = inngest.createFunction(
  { id: "analytics-snapshot-daily" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const { prisma } = await import("@/lib/prisma");
    const stores = await prisma.store.findMany({ select: { id: true } });
    for (const s of stores) {
      for (let d = 0; d < 7; d++) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - d);
        const iso = date.toISOString().slice(0, 10);
        await step.run(`snapshot-${s.id}-${iso}`, () => computeAnalyticsSnapshot(s.id, iso));
      }
    }
  },
);

// Hourly: incremental Shopify pull as safety net for missed webhooks.
export const hourlyShopifyPull = inngest.createFunction(
  { id: "shopify-hourly-pull" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const { prisma } = await import("@/lib/prisma");
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const stores = await prisma.store.findMany({
      where: { integrations: { some: { provider: "SHOPIFY", status: "CONNECTED" } } },
      select: { id: true },
    });
    for (const s of stores) {
      await step.run(`pull-${s.id}`, () => incrementalSync(s.id, since));
    }
  },
);

export const functions = [
  shopifyFullSync,
  shopifyIncrementalSync,
  shopifyOrderUpdated,
  computeSnapshot,
  profitRecalculateAll,
  dailySnapshotCron,
  hourlyShopifyPull,
];
