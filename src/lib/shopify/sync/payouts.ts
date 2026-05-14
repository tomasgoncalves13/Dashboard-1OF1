import { prisma } from "@/lib/prisma";
import { shopifyGraphQL, gidToId } from "../client";

const PAYOUTS_QUERY = /* GraphQL */ `
  query Payouts($cursor: String) {
    shopifyPaymentsAccount {
      id
      payouts(first: 100, after: $cursor, sortKey: ISSUED_AT) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            status
            issuedAt
            net { amount currencyCode }
            summary {
              chargesGross { amount }
              chargesFee { amount }
              refundsFeeGross { amount }
              refundsFee { amount }
              adjustmentsGross { amount }
              adjustmentsFee { amount }
            }
          }
        }
      }
    }
  }
`;

type PayoutNode = {
  id: string;
  status: string;
  issuedAt: string;
  net: { amount: string; currencyCode: string };
  summary: {
    chargesGross: { amount: string };
    chargesFee: { amount: string };
    refundsFeeGross: { amount: string };
    refundsFee: { amount: string };
    adjustmentsGross: { amount: string };
    adjustmentsFee: { amount: string };
  };
};

type Page = {
  shopifyPaymentsAccount: {
    payouts: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: PayoutNode }[];
    };
  } | null;
};

export async function syncPayouts(storeId: string) {
  let cursor: string | null = null;
  let total = 0;

  do {
    const data: Page = await shopifyGraphQL<Page>(PAYOUTS_QUERY, { cursor });
    const account = data.shopifyPaymentsAccount;
    if (!account) return { payoutsSynced: 0, note: "Shopify Payments not enabled" };

    for (const { node } of account.payouts.edges) {
      const shopifyId = gidToId(node.id)!;
      await prisma.payout.upsert({
        where: { storeId_shopifyId: { storeId, shopifyId } },
        update: {
          status: node.status,
          issuedAt: new Date(node.issuedAt),
          net: node.net.amount,
          currency: node.net.currencyCode,
          chargesGross: node.summary.chargesGross.amount,
          chargesFee: node.summary.chargesFee.amount,
          refundsGross: node.summary.refundsFeeGross.amount,
          refundsFee: node.summary.refundsFee.amount,
          adjustmentsGross: node.summary.adjustmentsGross.amount,
          adjustmentsFee: node.summary.adjustmentsFee.amount,
        },
        create: {
          storeId,
          shopifyId,
          status: node.status,
          issuedAt: new Date(node.issuedAt),
          net: node.net.amount,
          currency: node.net.currencyCode,
          chargesGross: node.summary.chargesGross.amount,
          chargesFee: node.summary.chargesFee.amount,
          refundsGross: node.summary.refundsFeeGross.amount,
          refundsFee: node.summary.refundsFee.amount,
          adjustmentsGross: node.summary.adjustmentsGross.amount,
          adjustmentsFee: node.summary.adjustmentsFee.amount,
        },
      });
      total++;
    }

    cursor = account.payouts.pageInfo.hasNextPage ? account.payouts.pageInfo.endCursor : null;
  } while (cursor);

  return { payoutsSynced: total };
}
