"use client";

import { useActionState, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, MapPin, Sparkles } from "lucide-react";

import { createBookingAction, type BookingFormState } from "@/server/actions/booking";
import {
  bookingTotal,
  formatEur,
  LIGHTING_PRICE,
  MAX_RACKETS,
  RACKET_PRICE,
} from "@/lib/pricing";
import type { CourtAvailability } from "@/server/availability";

const SURFACE_LABEL: Record<string, string> = {
  CLAY: "Глина",
  HARD: "Твърда настилка",
};

type CurrentUser = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

type Selection = {
  courtId: string;
  courtName: string;
  hour: number;
  price: number;
  isIndoor: boolean;
};

export default function BookingBoard({
  availability,
  date,
  minDate,
  maxDate,
  selectedCourtId,
  currentUser,
}: {
  availability: CourtAvailability[];
  date: string;
  minDate: string;
  maxDate: string;
  selectedCourtId?: string;
  currentUser?: CurrentUser | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [racketCount, setRacketCount] = useState(0);
  const [lighting, setLighting] = useState(false);

  // Lighting is only sold on outdoor courts; the indoor one is lit anyway.
  const canAddLighting = selection ? !selection.isIndoor : false;

  const total = selection
    ? bookingTotal({
        pricePerHour: selection.price,
        racketCount,
        lighting,
        isIndoor: selection.isIndoor,
      })
    : 0;

  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    createBookingAction,
    {},
  );

  function updateQuery(next: { date?: string; courtId?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.date) params.set("date", next.date);
    if (next.courtId === null) params.delete("courtId");
    else if (next.courtId) params.set("courtId", next.courtId);

    // Changing the day invalidates a slot chosen on the previous day.
    setSelection(null);
    router.push(`/booking?${params.toString()}`);
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
        </div>

        {availability.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/5 bg-navy-800 p-6 text-white/60">
            Няма налични кортове за избраната дата.
          </p>
        )}

        <div className="mt-6 space-y-6">
          {availability.map(({ court, slots }) => {
            const freeCount = slots.filter((slot) => slot.available).length;

            return (
              <section
                key={court.id}
                className="rounded-2xl border border-white/5 bg-navy-800 p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{court.name}</h2>
                    <div className="mt-1 flex items-center gap-4 text-xs text-white/60">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {SURFACE_LABEL[court.surface] ?? court.surface}
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles size={13} />
                        {court.isIndoor ? "Закрит" : "Открит"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatEur(court.pricePerHour)}
                    <span className="font-normal text-white/50"> / час</span>
                  </p>
                </div>

                {freeCount === 0 ? (
                  <p className="mt-4 text-sm text-white/50">
                    Няма свободни часове за този ден.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {slots.map((slot) => {
                      const isSelected =
                        selection?.courtId === court.id && selection.hour === slot.hour;

                      return (
                        <button
                          key={slot.hour}
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelection({
                              courtId: court.id,
                              courtName: court.name,
                              hour: slot.hour,
                              price: court.pricePerHour,
                              isIndoor: court.isIndoor,
                            });
                            // Lighting is not offered indoors, so a leftover tick from a
                            // previously selected outdoor court must not carry over.
                            if (court.isIndoor) setLighting(false);
                          }}
                          title={
                            slot.reason === "booked"
                              ? "Часът е зает"
                              : slot.reason === "past"
                                ? "Часът вече е минал"
                                : undefined
                          }
                          className={[
                            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            isSelected
                              ? "border-brand-500 bg-brand-500 text-navy-950"
                              : slot.available
                                ? "border-white/10 bg-navy-900 text-white hover:border-brand-500/60"
                                : "cursor-not-allowed border-white/5 bg-navy-900/40 text-white/25 line-through",
                          ].join(" ")}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
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
              <input type="hidden" name="hour" value={selection.hour} />

              <dl className="space-y-1.5 rounded-lg bg-navy-900 p-4 text-sm">
                <Row label="Корт" value={selection.courtName} />
                <Row label="Дата" value={date} />
                <Row
                  label="Час"
                  value={`${String(selection.hour).padStart(2, "0")}:00 – ${String(
                    selection.hour + 1,
                  ).padStart(2, "0")}:00`}
                />
              </dl>

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
                <Row label="Корт (1 час)" value={formatEur(selection.price)} />
                {racketCount > 0 && (
                  <Row
                    label={`Ракети × ${racketCount}`}
                    value={formatEur(racketCount * RACKET_PRICE)}
                  />
                )}
                {lighting && canAddLighting && (
                  <Row label="Осветление" value={formatEur(LIGHTING_PRICE)} />
                )}
                <div className="mt-1 border-t border-white/10 pt-2">
                  <Row label="Общо" value={formatEur(total)} strong />
                </div>
              </dl>

              {currentUser ? (
                <div className="rounded-lg border border-white/10 bg-navy-900 p-4 text-sm">
                  <p className="text-white/60">Резервираш като</p>
                  <p className="mt-0.5 font-medium">
                    {[currentUser.firstName, currentUser.lastName]
                      .filter(Boolean)
                      .join(" ") || currentUser.email}
                  </p>
                  {!currentUser.phone && (
                    <Input
                      className="mt-3"
                      name="phone"
                      label="Телефон (по избор)"
                      type="tel"
                      placeholder="0888 123 456"
                      error={state.errors?.phone}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      name="firstName"
                      label="Име"
                      required
                      error={state.errors?.firstName}
                    />
                    <Input
                      name="lastName"
                      label="Фамилия"
                      required
                      error={state.errors?.lastName}
                    />
                  </div>
                  <Input
                    name="email"
                    label="Имейл"
                    type="email"
                    required
                    error={state.errors?.email}
                  />
                  <Input
                    name="phone"
                    label="Телефон (по избор)"
                    type="tel"
                    placeholder="0888 123 456"
                    error={state.errors?.phone}
                  />
                  <p className="text-xs text-white/40">
                    Изпращаме потвърждение на този имейл.
                  </p>
                </div>
              )}

              <Input
                name="notes"
                label="Бележка (по избор)"
                placeholder="Например: нужни са ни ракети"
                error={state.errors?.notes}
              />

              {(state.message || state.errors?.hour || state.errors?.form) && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {state.message ?? state.errors?.hour ?? state.errors?.form}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <Loader2 size={16} className="animate-spin" />}
                {pending ? "Изпращане…" : "Потвърди резервацията"}
              </button>
            </form>
          )}
        </div>
      </aside>
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-500 text-navy-950"
          : "border border-white/10 bg-navy-900 text-white/70 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Input({
  name,
  label,
  error,
  className = "",
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs text-white/60">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className="mt-1 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-brand-500"
        {...rest}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
