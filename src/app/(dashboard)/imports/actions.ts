"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { importEupagoPayouts } from "@/lib/eupago/import-payouts";

export async function uploadEupagoPayoutsAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("No store");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");

  const text = await file.text();
  const result = await importEupagoPayouts(store.id, text);

  revalidatePath("/imports");
  revalidatePath("/dashboard");
  return result;
}
