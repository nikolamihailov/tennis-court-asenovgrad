"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, UserRoundX } from "lucide-react";

import { createBookingAction, type BookingFormState } from "@/server/actions/booking";
import {
  bookingTotal,
  formatDuration,
  formatEur,
  LIGHTING_PRICE,
  MAX_RACKETS,
  RACKET_PRICE,
  trainerFeeFor,
  type BookingDuration,
} from "@/lib/pricing";
import { TextField } from "@/components/ui/Field";
import {
  CourtHeading,
  DurationPicker,
  FilterChip,
  SlotGrid,
} from "@/components/booking/SlotGrid";
import TrainerPicker, { trainerHoursOn } from "@/components/booking/TrainerPicker";
import Avatar from "@/components/ui/Avatar";
import { WEEKDAY_SHORT } from "@/lib/time";
import type { CourtAvailability } from "@/server/availability";
import type { TrainerDTO } from "@/server/trainers";

type CurrentUser = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

type Selection = {
  courtId: string;
  courtName: string;
  start: number;
  duration: BookingDuration;
  /** "09:30 – 11:00" */
  label: string;
  price: number;
  isIndoor: boolean;
};

export default function BookingBoard({
  availability,
  date,
  minDate,
  maxDate,
  selectedCourtId,
  trainers = [],
  selectedTrainerId,
  currentUser,
  mode = "customer",
  basePath = "/booking",
  action = createBookingAction,
}: {
  availability: CourtAvailability[];
  date: string;
  minDate: string;
  maxDate: string;
  selectedCourtId?: string;
  /** Bookable trainers. The picker is hidden when there are none. */
  trainers?: TrainerDTO[];
  /** The trainer the slots were computed for, from the URL. */
  selectedTrainerId?: string;
  currentUser?: CurrentUser | null;
  /**
   * "trainer" is the trainer booking for a student from their panel: no trainer picker
   * (it is always them), the form asks for the student instead of the signed-in person,
   * and the trainer's weekly hours do not hide any slots.
   */
  mode?: "customer" | "trainer";
  /** Where date/court changes navigate to. */
  basePath?: string;
  action?: (previous: BookingFormState, formData: FormData) => Promise<BookingFormState>;
}) {
  const isTrainerMode = mode === "trainer";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [duration, setDuration] = useState<BookingDuration>(60);
  const [isRefreshing, startTransition] = useTransition();
  const [racketCount, setRacketCount] = useState(0);
  const [lighting, setLighting] = useState(false);

  const trainer = trainers.find((candidate) => candidate.id === selectedTrainerId);
  const trainerWorksToday =
    isTrainerMode || !trainer ? true : trainerHoursOn(trainer, date) !== null;

  // Lighting is only sold on outdoor courts; the indoor one is lit anyway.
  const canAddLighting = selection ? !selection.isIndoor : false;

  // A preview only: the server recomputes the fee from the trainer's current rate.
  const trainerFee =
    selection && trainer ? trainerFeeFor(trainer.hourlyRate, selection.duration) : 0;

  const total = selection
    ? bookingTotal({
        courtPrice: selection.price,
        racketCount,
        lighting,
        isIndoor: selection.isIndoor,
        trainerFee,
      })
    : 0;

  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    action,
    {},
  );

  const summaryRef = useRef<HTMLElement>(null);

  /**
   * Bring the summary panel into view after a slot is picked.
   *
   * On phones the panel is the last thing in the page, below every court, so tapping a
   * slot looks like it did nothing — the form is several screens down. On large screens
   * the panel is `lg:sticky` and already beside the list, so scrolling there would be
   * jarring rather than helpful, hence the width check.
   */
  useEffect(() => {
    if (!selection) return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    summaryRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, [selection]);

  function updateQuery(next: {
    date?: string;
    courtId?: string | null;
    trainerId?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.date) params.set("date", next.date);
    if (next.courtId === null) params.delete("courtId");
    else if (next.courtId) params.set("courtId", next.courtId);
    // The trainer changes which slots exist, so it lives in the URL and the server
    // recomputes availability for them — like the date, unlike the duration.
    if (next.trainerId === null) params.delete("trainerId");
    else if (next.trainerId) params.set("trainerId", next.trainerId);

    // Changing the day invalidates a slot chosen on the previous day.
    setSelection(null);

    // Wrapped in a transition so `isRefreshing` can dim the stale slots while the server
    // fetches the new day. loading.tsx does not cover this: it only replaces a segment
    // being mounted, and this is the same route with different search params, so without
    // a pending state the old availability would sit there looking current.
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-navy-800 p-5">
          <label className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-navy-900 px-4 py-3">
            <CalendarDays size={18} className="text-white/50" />
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(event) => updateQuery({ date: event.target.value })}
              aria-label="Дата"
              className="bg-transparent text-sm text-white outline-none scheme-dark"
            />
          </label>

          {isRefreshing && (
            <span className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 size={14} className="animate-spin" />
              Зареждане…
            </span>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={!selectedCourtId}
              onClick={() => updateQuery({ courtId: null })}
            >
              Всички кортове
            </FilterChip>
            {availability.map(({ court }) => (
              <FilterChip
                key={court.id}
                active={selectedCourtId === court.id}
                onClick={() => updateQuery({ courtId: court.id })}
              >
                {court.name}
              </FilterChip>
            ))}
          </div>

          {/* Every length's slots are already loaded, so switching needs no round trip.
              The slot list is different for each length, so a pick does not carry over. */}
          <DurationPicker
            value={duration}
            onChange={(next) => {
              setDuration(next);
              setSelection(null);
            }}
          />
        </div>

        {trainers.length > 0 && !isTrainerMode && (
          <div
            className={`transition-opacity ${isRefreshing ? "pointer-events-none opacity-50" : ""}`}
          >
            <TrainerPicker
              trainers={trainers}
              selectedId={trainer?.id}
              date={date}
              onSelect={(trainerId) => updateQuery({ trainerId })}
            />
          </div>
        )}

        {availability.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/5 bg-navy-800 p-6 text-white/60">
            Няма налични кортове за избраната дата.
          </p>
        )}

        {/* On the trainer's day off every court would say "no free slots"; one clear
            message with the days they do work is more useful than three empty grids. */}
        {trainer && !trainerWorksToday && availability.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/5 bg-navy-800 p-6 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50">
              <UserRoundX size={20} />
            </span>
            <div className="flex-1 text-sm">
              <p className="font-medium">{trainer.name} не работи на тази дата.</p>
              <p className="mt-0.5 text-white/50">
                {trainer.hours.length > 0
                  ? `Работни дни: ${[...new Set(trainer.hours.map((h) => h.weekday))]
                      .map((day) => WEEKDAY_SHORT[day])
                      .join(", ")}. Избери друга дата или друг треньор.`
                  : "Треньорът все още няма работни часове. Избери друг треньор."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateQuery({ trainerId: null })}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              Без треньор
            </button>
          </div>
        )}

        {/* Dimmed and inert while the new day loads, so the slots on screen are never
            mistaken for the ones being asked for. aria-busy tells screen readers. */}
        <div
          aria-busy={isRefreshing}
          className={`mt-6 space-y-6 transition-opacity ${
            isRefreshing ? "pointer-events-none opacity-50" : ""
          } ${trainer && !trainerWorksToday ? "hidden" : ""}`}
        >
          {availability.map(({ court, slots }) => (
            <section
              key={court.id}
              className="rounded-2xl border border-white/5 bg-navy-800 p-6"
            >
              <CourtHeading court={court} duration={duration} />

              <SlotGrid
                slots={slots[duration]}
                selectedStart={
                  selection?.courtId === court.id && selection.duration === duration
                    ? selection.start
                    : null
                }
                onSelect={(slot) => {
                  setSelection({
                    courtId: court.id,
                    courtName: court.name,
                    start: slot.start,
                    duration,
                    label: slot.label,
                    price: court.prices[duration],
                    isIndoor: court.isIndoor,
                  });
                  // Lighting is not offered indoors, so a leftover tick from a
                  // previously selected outdoor court must not carry over.
                  if (court.isIndoor) setLighting(false);
                }}
              />
            </section>
          ))}
        </div>
      </div>

      {/* scroll-mt keeps the heading clear of the sticky navbar when scrolled into view */}
      <aside ref={summaryRef} className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-navy-800 p-6">
          <h2 className="font-semibold">Детайли за резервацията</h2>

          {!selection ? (
            <p className="mt-3 text-sm text-white/60">
              Избери свободен час от списъка, за да продължиш.
            </p>
          ) : (
            <form action={formAction} className="mt-4 space-y-4">
              <input type="hidden" name="courtId" value={selection.courtId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="startMinute" value={selection.start} />
              <input type="hidden" name="duration" value={selection.duration} />
              {trainer && !isTrainerMode && (
                <input type="hidden" name="trainerId" value={trainer.id} />
              )}

              <dl className="space-y-1.5 rounded-lg bg-navy-900 p-4 text-sm">
                <Row label="Корт" value={selection.courtName} />
                <Row label="Дата" value={date} />
                <Row label="Час" value={selection.label} />
                <Row label="Продължителност" value={formatDuration(selection.duration)} />
              </dl>

              {trainer && !isTrainerMode && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-500/20 bg-navy-900 p-3 text-sm">
                  <Avatar
                    src={trainer.image}
                    firstName={trainer.firstName}
                    lastName={trainer.lastName}
                    email={null}
                    size={36}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-white/50">Тренировка с</p>
                    <p className="truncate font-medium">{trainer.name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-white/10 bg-navy-900 p-4">
                <p className="text-xs uppercase tracking-wide text-white/40">Допълнително</p>

                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="racketCount" className="text-sm">
                    Ракети под наем
                    <span className="block text-xs text-white/40">
                      {formatEur(RACKET_PRICE)} за брой
                    </span>
                  </label>
                  <select
                    id="racketCount"
                    name="racketCount"
                    value={racketCount}
                    onChange={(event) => setRacketCount(Number(event.target.value))}
                    className="rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    {Array.from({ length: MAX_RACKETS + 1 }, (_, count) => (
                      <option key={count} value={count} className="bg-navy-900">
                        {count}
                      </option>
                    ))}
                  </select>
                </div>

                {canAddLighting && (
                  <label className="flex items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      name="lighting"
                      checked={lighting}
                      onChange={(event) => setLighting(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-navy-800 accent-brand-500"
                    />
                    <span>
                      Осветление
                      <span className="block text-xs text-white/40">
                        {formatEur(LIGHTING_PRICE)} — за игра по тъмно на открит корт
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <dl className="space-y-1.5 rounded-lg bg-navy-900 p-4 text-sm">
                <Row
                  label={`Корт (${formatDuration(selection.duration)})`}
                  value={formatEur(selection.price)}
                />
                {racketCount > 0 && (
                  <Row
                    label={`Ракети × ${racketCount}`}
                    value={formatEur(racketCount * RACKET_PRICE)}
                  />
                )}
                {lighting && canAddLighting && (
                  <Row label="Осветление" value={formatEur(LIGHTING_PRICE)} />
                )}
                {trainer && (
                  <Row
                    label={`Треньор (${formatDuration(selection.duration)})`}
                    value={formatEur(trainerFee)}
                  />
                )}
                <div className="mt-1 border-t border-white/10 pt-2">
                  <Row label="Общо" value={formatEur(total)} strong />
                </div>
              </dl>

              {isTrainerMode ? (
                <StudentFields errors={state.errors} />
              ) : currentUser ? (
                <div className="rounded-lg border border-white/10 bg-navy-900 p-4 text-sm">
                  <p className="text-white/60">Резервираш като</p>
                  <p className="mt-0.5 font-medium">
                    {[currentUser.firstName, currentUser.lastName]
                      .filter(Boolean)
                      .join(" ") || currentUser.email}
                  </p>
                  {!currentUser.phone && (
                    <TextField
                      wrapperClassName="mt-3"
                      name="phone"
                      label="Телефон"
                      type="tel"
                      placeholder="0888 123 456"
                      error={state.errors?.phone}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      name="firstName"
                      label="Име"
                      placeholder="Иван"
                      autoComplete="given-name"
                      required
                      error={state.errors?.firstName}
                    />
                    <TextField
                      name="lastName"
                      label="Фамилия"
                      placeholder="Петров"
                      autoComplete="family-name"
                      required
                      error={state.errors?.lastName}
                    />
                  </div>
                  <TextField
                    name="email"
                    label="Имейл"
                    type="email"
                    placeholder="ivan@example.com"
                    autoComplete="email"
                    required
                    hint="Изпращаме потвърждението тук."
                    error={state.errors?.email}
                  />
                  <TextField
                    name="phone"
                    label="Телефон"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0888 123 456"
                    error={state.errors?.phone}
                  />
                </div>
              )}

              <TextField
                name="notes"
                label="Бележка"
                placeholder="Например: нужни са ни ракети"
                error={state.errors?.notes}
              />

              {(state.message || state.errors?.startMinute || state.errors?.form) && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {state.message ?? state.errors?.startMinute ?? state.errors?.form}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <Loader2 size={16} className="animate-spin" />}
                {pending
                  ? "Изпращане…"
                  : isTrainerMode
                    ? "Запиши тренировката"
                    : "Потвърди резервацията"}
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * Who the trainer is booking for. Only a name and one way to reach them are required —
 * the point is to book someone who phoned and may have no email at all.
 */
function StudentFields({ errors }: { errors?: Record<string, string> }) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-navy-900 p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">Ученик</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          name="firstName"
          label="Име"
          placeholder="Иван"
          autoComplete="off"
          required
          error={errors?.firstName}
        />
        <TextField
          name="lastName"
          label="Фамилия"
          placeholder="Петров"
          autoComplete="off"
          error={errors?.lastName}
        />
      </div>
      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        autoComplete="off"
        placeholder="0888 123 456"
        error={errors?.phone}
      />
      <TextField
        name="email"
        label="Имейл"
        type="email"
        autoComplete="off"
        placeholder="по избор"
        hint="Телефон или имейл — поне едно. С имейл ученикът получава потвърждение."
        error={errors?.email}
      />
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-white/50"}>{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}
