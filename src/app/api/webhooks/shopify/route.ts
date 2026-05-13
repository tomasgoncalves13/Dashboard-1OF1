import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleShopifyWebhook } from "@/lib/shopify/webhooks";

export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook secret missing" }, { status: 500 });

  const raw = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const computed = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(hmacHeader);
  const b = Buffer.from(computed);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { /* empty body topics */ }

  await handleShopifyWebhook(topic, shop, body);
  return NextResponse.json({ ok: true });
}
