import BookingBoard from "@/components/booking/BookingBoard";
import { requireTrainer } from "@/lib/dal";
import { addDaysToIsoDate, clubToday, isValidIsoDate } from "@/lib/time";
import { trainerCreateBookingAction } from "@/server/actions/trainer";
import { BOOKING_HORIZON_DAYS, getAvailability } from "@/server/availability";
import { getTrainerProfile } from "@/server/trainers";

/**
 * The trainer books a session for a student — typically someone who phoned. Same board
 * as the public booking page, so slots, prices and rules match exactly; it only swaps the
 * "who is booking" part for the student's name and phone or email.
 */
export default async function TrainerBookPage({
  searchParams,
}: PageProps<"/trainer/book">) {
  const trainer = await requireTrainer();
  const params = await searchParams;

  const today = clubToday();
  const maxDate = addDaysToIsoDate(today, BOOKING_HORIZON_DAYS);
  const requestedDate = typeof params.date === "string" ? params.date : undefined;
  const date =
    requestedDate &&
    isValidIsoDate(requestedDate) &&
    requestedDate >= today &&
    requestedDate <= maxDate
      ? requestedDate
      : today;
  const courtId = typeof params.courtId === "string" ? params.courtId : undefined;

  const [profile, availability] = await Promise.all([
    getTrainerProfile(trainer.id),
    // Any hours, not just the published ones: a trainer can agree any time with their own
    // student. Their other sessions and time off still block.
    getAvailability(date, {
      courtId,
      trainerId: trainer.id,
      trainerAnyHours: true,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Нова тренировка</h1>
      <p className="mt-1 text-white/60">
        Запиши тренировка за ученик — например някой, който ти се е обадил по телефона.
        Нужни са само име и телефон или имейл. Показани са всички часове, в които кортът е
        свободен и ти не си зает, дори извън работното ти време.
      </p>

      <BookingBoard
        mode="trainer"
        basePath="/trainer/book"
        action={trainerCreateBookingAction}
        availability={availability}
        date={date}
        minDate={today}
        maxDate={maxDate}
        selectedCourtId={courtId}
        trainers={profile ? [profile] : []}
        selectedTrainerId={profile?.id}
      />
    </div>
  );
}
