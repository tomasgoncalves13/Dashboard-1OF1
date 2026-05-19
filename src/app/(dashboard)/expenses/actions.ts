"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";

async function getStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");
  return { store, userId: user.id };
}

export async function addExpense(data: {
  category: string;
  amount: number;
  vendor?: string;
  description?: string;
  incurredOn: string;
  recurring: boolean;
  recurringPeriod?: string;
}) {
  const { store, userId } = await getStore();
  await prisma.expense.create({
    data: {
      storeId: store.id,
      createdById: userId,
      category: data.category as never,
      amount: data.amount.toFixed(2),
      vendor: data.vendor,
      description: data.description,
      incurredOn: new Date(data.incurredOn),
      recurring: data.recurring,
      recurringPeriod: (data.recurringPeriod as never) ?? null,
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/finance");
}

export async function deleteExpense(expenseId: string) {
  const { store } = await getStore();
  await prisma.expense.delete({ where: { id: expenseId, storeId: store.id } });
  revalidatePath("/expenses");
  revalidatePath("/finance");
}
