// Minimal types for the query responses we actually use. Not a full SDK —
// just enough to make sync code type-safe.

export type Money = { amount: string; currencyCode?: string };
export type ShopMoneyBag = { shopMoney: { amount: string } };

export type ShopifyProductNode = {
  id: string;
  title: string;
  handle: string | null;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  featuredImage: { url: string } | null;
  variants: { edges: { node: ShopifyVariantNode }[] };
};

export type ShopifyVariantNode = {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  inventoryItem: { id: string; unitCost: Money | null } | null;
};

export type ShopifyCustomerNode = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  numberOfOrders: number | string;
  amountSpent: Money;
  createdAt: string;
  updatedAt: string;
  emailMarketingConsent: { marketingState: string } | null;
  defaultAddress: { country: string | null; city: string | null } | null;
};

export type ShopifyOrderNode = {
  id: string;
  name: string;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  paymentGatewayNames: string[];
  currencyCode: string;
  customer: { id: string } | null;
  shippingAddress: { country: string | null; city: string | null } | null;
  subtotalPriceSet: ShopMoneyBag;
  totalDiscountsSet: ShopMoneyBag;
  totalShippingPriceSet: ShopMoneyBag;
  totalTaxSet: ShopMoneyBag;
  totalPriceSet: ShopMoneyBag;
  totalRefundedSet: ShopMoneyBag;
  lineItems: { edges: { node: ShopifyLineItemNode }[] };
  transactions: ShopifyTransaction[];
};

export type ShopifyLineItemNode = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  discountedUnitPriceSet: ShopMoneyBag;
  originalUnitPriceSet: ShopMoneyBag;
  variant: { id: string; inventoryItem: { unitCost: Money | null } | null } | null;
};

export type ShopifyTransaction = {
  id: string;
  status: string;
  kind: string;
  amountSet: ShopMoneyBag;
  fees: { amount: { amount: string } }[];
};
