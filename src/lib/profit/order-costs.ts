import { prisma } from "@/lib/prisma";

export type OrderOverheads = {
  freeGiftCost: number;
  bubbleMailerCost: number;
  cardCost: number;
  stickerCost: number;
  totalPerOrder: number;
};

const DEFAULTS: Omit<OrderOverheads, "totalPerOrder"> = {
  freeGiftCost: 0.88,
  bubbleMailerCost: 0.69,
  cardCost: 0.01,
  stickerCost: 0.06,
};

export async function getOrderOverheads(storeId: string): Promise<OrderOverheads> {
  const cfg = await prisma.orderCostConfig.findUnique({ where: { storeId } });
  const v = cfg
    ? {
        freeGiftCost: Number(cfg.freeGiftCost),
        bubbleMailerCost: Number(cfg.bubbleMailerCost),
        cardCost: Number(cfg.cardCost),
        stickerCost: Number(cfg.stickerCost),
      }
    : DEFAULTS;
  return { ...v, totalPerOrder: v.freeGiftCost + v.bubbleMailerCost + v.cardCost + v.stickerCost };
}

export async function upsertOrderCostConfig(
  storeId: string,
  data: Partial<Omit<OrderOverheads, "totalPerOrder">>,
) {
  return prisma.orderCostConfig.upsert({
    where: { storeId },
    update: data,
    create: { storeId, ...DEFAULTS, ...data },
  });
}
