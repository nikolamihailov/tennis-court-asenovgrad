import type { Metadata } from "next";

import BookingBoard from "@/components/booking/BookingBoard";
import { getCurrentUser } from "@/lib/dal";
import { addDaysToIsoDate, clubToday, isValidIsoDate } from "@/lib/time";
import { getAvailability, BOOKING_HORIZON_DAYS } from "@/server/availability";
import { listActiveTrainers } from "@/server/trainers";

export const metadata: Metadata = {
  title: "Резервация — Тенис клуб Асеновград",
  description: "Виж свободните часове и резервирай корт онлайн.",
};

export default async function BookingPage({ searchParams }: PageProps<"/booking">) {
  const params = await searchParams;

  const today = clubToday();
  const requestedDate = typeof params.date === "string" ? params.date : undefined;

  // Clamp rather than error: a stale link or a hand-edited URL should still show
  // something useful instead of a validation page.
  const date =
    requestedDate && isValidIsoDate(requestedDate) && requestedDate >= today
      ? requestedDate
      : today;

  const courtId = typeof params.courtId === "string" ? params.courtId : undefined;

  const [trainers, user] = await Promise.all([listActiveTrainers(), getCurrentUser()]);

  // An unknown or revoked trainer in the URL (an old link) falls back to "no trainer"
  // rather than an error, the same way a bad date does. A trainer is never offered
  // themselves: booking a session with yourself makes no sense.
  const bookable = trainers.filter((trainer) => trainer.id !== user?.id);
  const requestedTrainer = typeof params.trainerId === "string" ? params.trainerId : undefined;
  const trainer = bookable.find((candidate) => candidate.id === requestedTrainer);

  const availability = await getAvailability(date, { courtId, trainerId: trainer?.id });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Резервация на корт</h1>
        <p className="mt-1 text-white/60">
          Избери дата, продължителност и свободен час
          {bookable.length > 0 ? " — сам или с треньор" : ""}. Плащането е на място в клуба.
        </p>
      </header>

      <BookingBoard
        availability={availability}
        date={date}
        minDate={today}
        maxDate={addDaysToIsoDate(today, BOOKING_HORIZON_DAYS)}
        selectedCourtId={courtId}
        trainers={bookable}
        selectedTrainerId={trainer?.id}
        currentUser={
          user && {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
          }
        }
      />
    </div>
  );
}
