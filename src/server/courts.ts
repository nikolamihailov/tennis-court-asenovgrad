import "server-only";

import { db } from "@/lib/db";
import type { CourtPrices } from "@/lib/pricing";
import type { CourtSurface } from "@/generated/prisma/enums";

/**
 * A court, flattened for the client.
 *
 * Prisma returns `Decimal` for money columns, which cannot cross the Server/Client
 * Component boundary — it is a class instance, not a plain value. Every read path
 * converts to `number` here so no component has to remember to. The three price columns
 * are gathered into `prices`, keyed by duration, so callers index by the chosen length
 * instead of switching over column names.
 */
export type CourtDTO = {
  id: string;
  name: string;
  surface: CourtSurface;
  isIndoor: boolean;
  prices: CourtPrices;
  description: string | null;
  imageUrl: string | null;
  openingHour: number;
  closingHour: number;
  isActive: boolean;
  sortOrder: number;
};

const courtSelect = {
  id: true,
  name: true,
  surface: true,
  isIndoor: true,
  price60: true,
  price90: true,
  price120: true,
  description: true,
  imageUrl: true,
  openingHour: true,
  closingHour: true,
  isActive: true,
  sortOrder: true,
} as const;

type Money = { toString(): string };

type CourtRow = {
  price60: Money;
  price90: Money;
  price120: Money;
} & Omit<CourtDTO, "prices">;

/** The three price columns as a duration-keyed record of numbers. */
export function toCourtPrices(row: { price60: Money; price90: Money; price120: Money }): CourtPrices {
  return {
    60: Number(row.price60.toString()),
    90: Number(row.price90.toString()),
    120: Number(row.price120.toString()),
  };
}

function toCourtDTO({ price60, price90, price120, ...court }: CourtRow): CourtDTO {
  return { ...court, prices: toCourtPrices({ price60, price90, price120 }) };
}

/** Courts customers can book, in display order. */
export async function listActiveCourts(): Promise<CourtDTO[]> {
  const courts = await db.court.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: courtSelect,
  });

  return courts.map(toCourtDTO);
}

/** Every court, including deactivated ones. Admin view. */
export async function listAllCourts(): Promise<CourtDTO[]> {
  const courts = await db.court.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: courtSelect,
  });

  return courts.map(toCourtDTO);
}
