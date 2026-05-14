import { prisma } from "@/lib/prisma";
import { listEupagoTransactions, inferMethod, type EupagoTransaction } from "./client";

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Sync all paid transactions from Eupago Management API (last 3 months window).
 * Idempotent — uses trid as the unique key per store.
 */
export async function syncEupagoTransactions(storeId: string) {
  const items = await listEupagoTransactions("paga");
  let upserted = 0;

  for (const t of items) {
    const amount = Number(t.amount ?? 0);
    const fee = Number(t.totalCommission ?? 0);
    const net = +(amount - fee).toFixed(2);
    const dp = toDate(t.datePayment) ?? new Date();
    const data = {
      identifier: t.identifier ?? null,
      reference: t.reference ?? null,
      entity: t.entity ?? null,
      amount: amount.toFixed(2),
      commission: (t.commission ?? 0).toString(),
      commissionIva: (t.commissionIva ?? 0).toString(),
      totalCommission: fee.toString(),
      net: net.toFixed(2),
      status: t.status,
      method: inferMethod(t),
      channelId: t.channelId ?? null,
      channelName: t.channelName ?? null,
      datePayment: dp,
      dateTransfer: toDate(t.dateTransfer),
      bookingDate: toDate(t.bookingDate),
      source: "API",
      raw: t as unknown as object,
    };
    await prisma.eupagoTransaction.upsert({
      where: { storeId_trid: { storeId, trid: t.trid } },
      update: data,
      create: { storeId, trid: t.trid, ...data },
    });
    upserted++;
  }

  return { eupagoSynced: upserted };
}
