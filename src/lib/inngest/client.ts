import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "dashboard-1of1",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export type Events = {
  "shopify/order.created": { data: { storeId: string; orderId: string } };
  "shopify/order.updated": { data: { storeId: string; orderId: string } };
  "shopify/sync.full": { data: { storeId: string } };
  "shopify/sync.incremental": { data: { storeId: string; since: string } };
  "meta/sync.daily": { data: { storeId: string; since: string } };
  "analytics/snapshot.compute": { data: { storeId: string; date: string } };
  "profit/recalculate.order": { data: { orderId: string } };
  "profit/recalculate.all": { data: { storeId: string } };
};
