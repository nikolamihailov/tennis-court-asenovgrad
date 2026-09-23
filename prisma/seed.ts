import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * The three courts the marketing site already advertised, now as real rows.
 * Prices and surfaces match what src/components/Courts.tsx used to hardcode.
 */
const courts = [
  {
    name: "Корт 1",
    surface: "CLAY" as const,
    isIndoor: false,
    pricePerHour: 20,
    description: "Класически глинен корт на открито.",
    imageUrl: "/images/court.jpg",
    openingHour: 8,
    closingHour: 22,
    sortOrder: 1,
  },
  {
    name: "Корт 2",
    surface: "CLAY" as const,
    isIndoor: false,
    pricePerHour: 20,
    description: "Глинен корт на открито с вечерно осветление.",
    imageUrl: "/images/court.jpg",
    openingHour: 8,
    closingHour: 22,
    sortOrder: 2,
  },
  {
    name: "Корт 3",
    surface: "HARD" as const,
    isIndoor: true,
    pricePerHour: 25,
    description: "Закрит корт с твърда настилка — игра при всякакво време.",
    imageUrl: "/images/court.jpg",
    openingHour: 8,
    closingHour: 22,
    sortOrder: 3,
  },
];

async function main() {
  // Idempotent: seeding twice must not create duplicate courts. Court has no natural
  // unique key, so this matches on name rather than using upsert.
  for (const court of courts) {
    const existing = await prisma.court.findFirst({
      where: { name: court.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.court.update({ where: { id: existing.id }, data: court });
      console.log(`updated court ${court.name}`);
    } else {
      await prisma.court.create({ data: court });
      console.log(`created court ${court.name}`);
    }
  }

  // There is no "promote to admin" screen in 0.1.0 — this is how the first admin is made.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();

  if (adminEmail) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: {
        email: adminEmail,
        role: "ADMIN",
        isGuest: false,
        name: "Администратор",
        firstName: "Администратор",
      },
      select: { email: true },
    });

    console.log(`granted ADMIN to ${admin.email}`);
    console.log(
      "Sign in with Google using that address — the account links by verified email.",
    );
  } else {
    console.log(
      "SEED_ADMIN_EMAIL not set; no admin created. Set it and re-run to grant access.",
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
