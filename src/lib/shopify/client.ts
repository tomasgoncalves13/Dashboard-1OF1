// Shopify Admin GraphQL client.
// Uses Admin API access token directly (Custom App). One store for now —
// when multi-store, swap envs for a per-Store record from `integrations`.

const VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-01";

export type ShopifyConfig = {
  shop: string;        // e.g. fx5ern-wp.myshopify.com
  accessToken: string;
};

export function getShopifyConfig(): ShopifyConfig {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !accessToken) throw new Error("Shopify env missing (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN)");
  return { shop, accessToken };
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
  extensions?: { cost?: { actualQueryCost?: number; throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
};

export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  config: ShopifyConfig = getShopifyConfig(),
): Promise<T> {
  const url = `https://${config.shop}/admin/api/${VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL ${res.status}: ${text.slice(0, 500)}`);
  }

  const json: GraphQLResponse<T> = await res.json();
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Shopify GraphQL returned no data");

  // Be polite — back off when throttled.
  const status = json.extensions?.cost?.throttleStatus;
  if (status && status.currentlyAvailable < 200) {
    const waitMs = ((200 - status.currentlyAvailable) / status.restoreRate) * 1000;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)));
  }

  return json.data;
}

// Extract Shopify GID id ("gid://shopify/Product/123") → "123"
export function gidToId(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const m = gid.match(/\/(\d+)$/);
  return m?.[1] ?? null;
}
