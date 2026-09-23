import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { requireMigrationUrl } from "./database-url";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

// Same resolution as prisma7.config.ts, so seeding and migrating always agree on which
// endpoint they talk to.
const connectionString = requireMigrationUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * The three courts the marketing site already advertised, now as real rows.
 *
 * Prices are in euro. They were 20 / 20 / 25 lv., converted at the fixed rate of
 * 1.95583 and rounded to whole euro, so the real price is unchanged for customers.
 */
const courts = [
  {
    name: "Корт 1",
    surface: "CLAY" as const,
    isIndoor: false,
    pricePerHour: 10,
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
    pricePerHour: 10,
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
    pricePerHour: 13,
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
        // Deliberately no name: the row is a placeholder until this person signs in with
        // Google, and the linkAccount event then fills in their real name. Seeding a
        // fake one here would stick forever, because there is nothing to overwrite it.
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
