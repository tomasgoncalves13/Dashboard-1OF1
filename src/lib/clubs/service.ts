import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calcClubCommission } from "./commission";
import { consumeStock } from "@/lib/inventory/consume";

// ── Club CRUD ──────────────────────────────────────────────

export async function getClubs(storeId: string) {
  return prisma.club.findMany({
    where: { storeId },
    include: { productPrices: { include: { product: { select: { id: true, title: true } } } } },
    orderBy: { name: "asc" },
  });
}

export async function getClub(storeId: string, clubId: string) {
  return prisma.club.findFirst({
    where: { id: clubId, storeId },
    include: {
      productPrices: { include: { product: { select: { id: true, title: true, imageUrl: true } } } },
    },
  });
}

export async function createClub(
  storeId: string,
  data: {
    name: string;
    commissionEnabled: boolean;
    commissionTiers: Prisma.InputJsonValue;
    notes?: string;
  },
) {
  return prisma.club.create({ data: { storeId, ...data } });
}

export async function updateClub(
  storeId: string,
  clubId: string,
  data: {
    name?: string;
    commissionEnabled?: boolean;
    commissionTiers?: Prisma.InputJsonValue;
    isActive?: boolean;
    notes?: string;
  },
) {
  return prisma.club.update({ where: { id: clubId, storeId }, data });
}

export async function upsertClubProductPrice(
  clubId: string,
  productId: string,
  unitPrice: number,
) {
  return prisma.clubProductPrice.upsert({
    where: { clubId_productId: { clubId, productId } },
    update: { unitPrice },
    create: { clubId, productId, unitPrice },
  });
}

// ── Monthly commission summary ────────────────────────────

export type MonthlyClubSummary = {
  clubId: string;
  clubName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  commission: number;
  netProfit: number;
};

export async function getMonthlyClubSummaries(
  storeId: string,
  year: number,
  month: number, // 1-12
): Promise<MonthlyClubSummary[]> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const clubs = await prisma.club.findMany({
    where: { storeId },
    select: { id: true, name: true, commissionEnabled: true, commissionTiers: true },
  });

  const results: MonthlyClubSummary[] = [];

  for (const club of clubs) {
    const sales = await prisma.manualSale.findMany({
      where: { storeId, clubId: club.id, soldAt: { gte: from, lt: to } },
      select: { total: true, cogsTotal: true, grossProfit: true },
    });

    const revenue = sales.reduce((s, r) => s + Number(r.total), 0);
    const cogs = sales.reduce((s, r) => s + Number(r.cogsTotal), 0);
    const grossProfit = sales.reduce((s, r) => s + Number(r.grossProfit), 0);
    const commission = calcClubCommission(revenue, club.commissionEnabled, club.commissionTiers);

    results.push({
      clubId: club.id,
      clubName: club.name,
      revenue,
      cogs,
      grossProfit,
      commission,
      netProfit: grossProfit - commission,
    });
  }

  return results;
}

// ── Physical sale registration ─────────────────────────────

export type SaleItem = {
  variantId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export async function registerPhysicalSale(
  storeId: string,
  data: {
    channel: "CLUB" | "MANUAL" | "EVENT" | "POPUP" | "WHOLESALE";
    clubId?: string;
    eventName?: string;
    customerName?: string;
    notes?: string;
    soldAt: Date;
    items: SaleItem[];
  },
) {
  const subtotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cogsTotal = data.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const grossProfit = subtotal - cogsTotal;

  const movementType = data.channel === "CLUB" ? "CLUB_SALE" : "MANUAL_SALE";

  return prisma.$transaction(async (tx) => {
    const sale = await tx.manualSale.create({
      data: {
        storeId,
        channel: data.channel,
        clubId: data.clubId ?? null,
        eventName: data.eventName,
        customerName: data.customerName,
        notes: data.notes,
        soldAt: data.soldAt,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        cogsTotal: cogsTotal.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        netProfit: grossProfit.toFixed(2), // commission subtracted at month level
        items: {
          create: data.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toFixed(2),
            unitCost: i.unitCost.toFixed(2),
            totalRevenue: (i.unitPrice * i.quantity).toFixed(2),
            totalCost: (i.unitCost * i.quantity).toFixed(2),
          })),
        },
      },
    });

    // Decrement physical stock via each variant's recipe
    for (const item of data.items) {
      await consumeStock(tx, {
        storeId,
        variantId: item.variantId,
        saleQty: item.quantity,
        type: movementType,
        reference: sale.id,
      });
    }

    return sale;
  });
}
