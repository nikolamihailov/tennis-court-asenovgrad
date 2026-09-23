import "server-only";

import { db } from "@/lib/db";
import type { CourtSurface } from "@/generated/prisma/enums";

/**
 * A court, flattened for the client.
 *
 * Prisma returns `Decimal` for money columns, which cannot cross the Server/Client
 * Component boundary — it is a class instance, not a plain value. Every read path
 * converts to `number` here so no component has to remember to.
 */
export type CourtDTO = {
  id: string;
  name: string;
  surface: CourtSurface;
  isIndoor: boolean;
  pricePerHour: number;
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
  pricePerHour: true,
  description: true,
  imageUrl: true,
  openingHour: true,
  closingHour: true,
  isActive: true,
  sortOrder: true,
} as const;

type CourtRow = {
  pricePerHour: { toString(): string };
} & Omit<CourtDTO, "pricePerHour">;

function toCourtDTO(court: CourtRow): CourtDTO {
  return { ...court, pricePerHour: Number(court.pricePerHour.toString()) };
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
