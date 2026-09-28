import { redirect } from "next/navigation";

import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * Where sign-in lands when no specific page was asked for.
 *
 * A trainer signs in to run their sessions, so they go straight to the trainer
 * dashboard; everyone else to their profile. The role is read from the database rather
 * than the session, so someone promoted minutes ago is already routed as a trainer.
 */
export default async function AccountPage() {
  const user = await requireUser();

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, trainerProfile: { select: { isActive: true } } },
  });

  redirect(row?.role === "TRAINER" && row.trainerProfile?.isActive ? "/trainer" : "/profile");
}
