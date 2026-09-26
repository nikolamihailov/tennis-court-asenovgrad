"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, CalendarDays, Loader2, Phone, XCircle } from "lucide-react";

import {
  customerCancelAction,
  rescheduleAction,
  type ManageFormState,
} from "@/server/actions/manage";
import { bookingTotal, formatDuration, formatEur, type BookingDuration } from "@/lib/pricing";
import { CourtHeading, DurationPicker, SlotGrid } from "@/components/booking/SlotGrid";
import type { CourtAvailability, Slot } from "@/server/availability";
import type { BookingStatus } from "@/generated/prisma/enums";

type Summary = {
  courtName: string;
  dateLabel: string;
  timeLabel: string;
  totalPrice: number;
  racketCount: number;
  lighting: boolean;
  isIndoor: boolean;
};

type Mode = "choose" | "reschedule" | "cancel";

/**
 * Cancel or move one booking — from the email link (`token`) or the profile (session).
 *
 * The page has already checked access, but both actions check again on the server; the
 * token is sent back with each form for exactly that.
 */
export default function ManageBooking({
  reference,
  token,
  status,
  customerCanChange,
  hasEnded,
  summary,
  court,
  date,
  minDate,
  maxDate,
  current,
  initialDuration,
}: {
  reference: string;
  token?: string;
  status: BookingStatus;
  customerCanChange: boolean;
  hasEnded: boolean;
  summary: Summary;
  /** This court's availability on `date`, without the booking itself. Null if inactive. */
  court: CourtAvailability | null;
  date: string;
  minDate: string;
  maxDate: string;
  /** Where the booking sits now, when `date` is its day. */
  current: { start: number; duration: BookingDuration } | null;
  initialDuration: BookingDuration;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>(
    searchParams.get("date") ? "reschedule" : "choose",
  );
  const [duration, setDuration] = useState<BookingDuration>(initialDuration);
  const [selected, setSelected] = useState<Slot | null>(null);

  function changeDate(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    setSelected(null);
    // Same pattern as the booking page: the transition keeps the old day visible but
    // dimmed while the server fetches the new one.
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  if (!customerCanChange) {
    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <CurrentBooking reference={reference} summary={summary} />
        <aside className="rounded-2xl border border-white/10 bg-navy-800 p-6 lg:self-start">
          <h2 className="font-semibold">
            {status === "CANCELLED"
              ? "Резервацията е отказана"
              : hasEnded
                ? "Резервацията е приключила"
                : "Промяната вече не е възможна онлайн"}
          </h2>
          <p className="mt-3 text-sm text-white/60">
            {status === "CANCELLED"
              ? "Кортът е освободен. Можеш да направиш нова резервация по всяко време."
              : hasEnded
                ? "Тази резервация е в миналото."
                : "Остават по-малко от 2 часа до началото. За промяна или отказ се свържи с клуба по телефона."}
          </p>
          {status === "CONFIRMED" && !hasEnded && (
            <Link
              href="/#contact"
              className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 hover:text-white"
            >
              <Phone size={16} />
              Контакти на клуба
            </Link>
          )}
        </aside>
      </div>
    );
  }

  const newTotal =
    selected && court
      ? bookingTotal({
          courtPrice: court.court.prices[duration],
          racketCount: summary.racketCount,
          lighting: summary.lighting,
          isIndoor: summary.isIndoor,
        })
      : null;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <CurrentBooking reference={reference} summary={summary} />

        {mode === "reschedule" && (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-navy-800 p-5">
              <label className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-navy-900 px-4 py-3">
                <CalendarDays size={18} className="text-white/50" />
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) => event.target.value && changeDate(event.target.value)}
                  aria-label="Нова дата"
                  className="bg-transparent text-sm text-white outline-none scheme-dark"
                />
              </label>

              {isRefreshing && (
                <span className="flex items-center gap-2 text-xs text-white/50">
                  <Loader2 size={14} className="animate-spin" />
                  Зареждане…
                </span>
              )}

              <DurationPicker
                value={duration}
                onChange={(next) => {
                  setDuration(next);
                  setSelected(null);
                }}
              />
            </div>

            <div
              aria-busy={isRefreshing}
              className={`transition-opacity ${
                isRefreshing ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {court ? (
                <section className="rounded-2xl border border-white/5 bg-navy-800 p-6">
                  <CourtHeading court={court.court} duration={duration} />
                  <SlotGrid
                    slots={court.slots[duration]}
                    selectedStart={selected?.start ?? null}
                    currentStart={current?.duration === duration ? current.start : null}
                    onSelect={setSelected}
                  />
                </section>
              ) : (
                <p className="rounded-2xl border border-white/5 bg-navy-800 p-6 text-sm text-white/60">
                  Кортът в момента не приема резервации. Моля, свържи се с клуба.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-navy-800 p-6">
          {mode === "choose" && (
            <>
              <h2 className="font-semibold">Какво искаш да направиш?</h2>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setMode("reschedule")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
                >
                  <CalendarClock size={16} />
                  Премести резервацията
                </button>
                <button
                  type="button"
                  onClick={() => setMode("cancel")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 px-6 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
                >
                  <XCircle size={16} />
                  Откажи резервацията
                </button>
              </div>
            </>
          )}

          {mode === "cancel" && (
            <CancelForm reference={reference} token={token} onBack={() => setMode("choose")} />
          )}

          {mode === "reschedule" && (
            <RescheduleForm
              reference={reference}
              token={token}
              date={date}
              duration={duration}
              selected={selected}
              oldTotal={summary.totalPrice}
              newTotal={newTotal}
              onBack={() => {
                setSelected(null);
                setMode("choose");
              }}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function CurrentBooking({ reference, summary }: { reference: string; summary: Summary }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
        Текуща резервация
      </h2>
      <dl className="mt-4 space-y-1.5 rounded-lg bg-navy-900 p-4 text-sm">
        <Row label="Номер" value={reference} />
        <Row label="Корт" value={summary.courtName} />
        <Row label="Дата" value={summary.dateLabel} />
        <Row label="Час" value={summary.timeLabel} />
        {summary.racketCount > 0 && (
          <Row label="Ракети" value={`${summary.racketCount} бр.`} />
        )}
        {summary.lighting && <Row label="Осветление" value="включено" />}
        <Row label="Общо" value={formatEur(summary.totalPrice)} />
      </dl>
    </section>
  );
}

function CancelForm({
  reference,
  token,
  onBack,
}: {
  reference: string;
  token?: string;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState<ManageFormState, FormData>(
    customerCancelAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reference" value={reference} />
      {token && <input type="hidden" name="token" value={token} />}

      <h2 className="font-semibold">Отказ на резервацията</h2>
      <p className="text-sm text-white/60">
        Кортът ще бъде освободен веднага. Това не може да бъде отменено.
      </p>

      <div>
        <label htmlFor="reason" className="block text-xs font-medium text-white/70">
          Причина (по избор)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={300}
          placeholder="Например: разболях се"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-brand-500"
        />
      </div>

      <ErrorMessage state={state} />

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/90 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? "Отказване…" : "Потвърди отказа"}
      </button>
      <BackButton onClick={onBack} disabled={pending} />
    </form>
  );
}

function RescheduleForm({
  reference,
  token,
  date,
  duration,
  selected,
  oldTotal,
  newTotal,
  onBack,
}: {
  reference: string;
  token?: string;
  date: string;
  duration: BookingDuration;
  selected: Slot | null;
  oldTotal: number;
  newTotal: number | null;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState<ManageFormState, FormData>(
    rescheduleAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reference" value={reference} />
      {token && <input type="hidden" name="token" value={token} />}

      <h2 className="font-semibold">Нов час</h2>

      {!selected ? (
        <p className="text-sm text-white/60">
          Избери дата, продължителност и свободен час от списъка.
        </p>
      ) : (
        <>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="startMinute" value={selected.start} />
          <input type="hidden" name="duration" value={duration} />

          <dl className="space-y-1.5 rounded-lg bg-navy-900 p-4 text-sm">
            <Row label="Дата" value={date} />
            <Row label="Час" value={selected.label} />
            <Row label="Продължителност" value={formatDuration(duration)} />
            {newTotal !== null && newTotal !== oldTotal && (
              <Row label="Досегашна цена" value={formatEur(oldTotal)} />
            )}
            {newTotal !== null && (
              <div className="mt-1 border-t border-white/10 pt-2">
                <Row label="Общо" value={formatEur(newTotal)} strong />
              </div>
            )}
          </dl>
        </>
      )}

      <ErrorMessage state={state} />

      <button
        type="submit"
        disabled={pending || !selected}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? "Преместване…" : "Потвърди новия час"}
      </button>
      <BackButton onClick={onBack} disabled={pending} />
    </form>
  );
}

function ErrorMessage({ state }: { state: ManageFormState }) {
  const message =
    state.message ?? Object.values(state.errors ?? {}).find(Boolean) ?? null;
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      {message}
    </p>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-white/15 px-6 py-2.5 text-sm font-medium text-white/70 hover:text-white disabled:opacity-60"
    >
      Назад
    </button>
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
