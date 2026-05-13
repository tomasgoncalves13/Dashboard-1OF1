import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Minimal seed — creates the AppUser row for an already-existing Supabase auth user.
// Run after creating your user in Supabase Auth, with:
//   SEED_USER_ID=<uuid> SEED_USER_EMAIL=<email> npm run db:seed

async function main() {
  const id = process.env.SEED_USER_ID;
  const email = process.env.SEED_USER_EMAIL;
  if (!id || !email) {
    console.log("Set SEED_USER_ID and SEED_USER_EMAIL to seed an AppUser. Skipping.");
    return;
  }

  await prisma.appUser.upsert({
    where: { id },
    update: { email },
    create: { id, email, role: "OWNER", fullName: "Tom" },
  });

  await prisma.store.upsert({
    where: { id: "default-store" },
    update: {},
    create: {
      id: "default-store",
      ownerId: id,
      name: "1OF1 Fútbol",
      currency: "EUR",
      timezone: "Europe/Lisbon",
    },
  });

  console.log("Seeded AppUser + default Store.");
}

main().finally(() => prisma.$disconnect());
