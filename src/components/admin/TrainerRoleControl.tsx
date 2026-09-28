"use client";

import { useActionState, useState } from "react";
import { GraduationCap, Loader2, X } from "lucide-react";

import {
  grantTrainerAction,
  revokeTrainerAction,
  setTrainerRateAction,
  type AdminFormState,
} from "@/server/actions/admin";
import { formatEur } from "@/lib/pricing";

/** A sensible starting rate; the admin changes it in the same form. */
const DEFAULT_RATE = 15;

/**
 * The trainer column of the users table.
 *
 * A registered user gets "make trainer", which asks for an hourly rate first — a trainer
 * without one cannot be booked. An existing trainer shows their rate, with inline edit
 * and revoke. Guests and admins get nothing: guests cannot sign in to a dashboard, and an
 * account holds one role.
 */
export default function TrainerRoleControl({
  userId,
  role,
  isGuest,
  hourlyRate,
}: {
  userId: string;
  role: "USER" | "ADMIN" | "TRAINER";
  isGuest: boolean;
  hourlyRate: number | null;
}) {
  const [mode, setMode] = useState<"idle" | "grant" | "rate" | "revoke">("idle");

  const [grantState, grant, granting] = useActionState<AdminFormState, FormData>(
    async (previous, formData) => {
      const result = await grantTrainerAction(previous, formData);
      if (result.ok) setMode("idle");
      return result;
    },
    {},
  );
  const [rateState, saveRate, savingRate] = useActionState<AdminFormState, FormData>(
    async (previous, formData) => {
      const result = await setTrainerRateAction(previous, formData);
      if (result.ok) setMode("idle");
      return result;
    },
    {},
  );
  const [revokeState, revoke, revoking] = useActionState<AdminFormState, FormData>(
    async (previous, formData) => {
      const result = await revokeTrainerAction(previous, formData);
      if (result.ok) setMode("idle");
      return result;
    },
    {},
  );

  if (role === "ADMIN" || isGuest) {
    return <span className="text-xs text-white/25">—</span>;
  }

  if (role === "USER") {
    if (mode !== "grant") {
      return (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setMode("grant")}
            className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 px-3 py-1.5 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-500/10"
          >
            <GraduationCap size={13} />
            Направи треньор
          </button>
          <Feedback state={revokeState} />
        </div>
      );
    }

    return (
      <RateForm
        userId={userId}
        action={grant}
        pending={granting}
        state={grantState}
        defaultRate={hourlyRate ?? DEFAULT_RATE}
        submitLabel="Потвърди"
        hint="Ще получи имейл"
        onCancel={() => setMode("idle")}
      />
    );
  }

  // TRAINER
  if (mode === "rate") {
    return (
      <RateForm
        userId={userId}
        action={saveRate}
        pending={savingRate}
        state={rateState}
        defaultRate={hourlyRate ?? DEFAULT_RATE}
        submitLabel="Запази"
        onCancel={() => setMode("idle")}
      />
    );
  }

  if (mode === "revoke") {
    return (
      <form action={revoke} className="flex flex-col items-end gap-2">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-xs text-white/60">Премахни ролята „треньор“?</p>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={revoking}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {revoking && <Loader2 size={12} className="animate-spin" />}
            Премахни
          </button>
          <CancelButton onClick={() => setMode("idle")} />
        </div>
        <Feedback state={revokeState} />
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/70">
          {hourlyRate !== null ? `${formatEur(hourlyRate)} / час` : "—"}
        </span>
        <button
          type="button"
          onClick={() => setMode("rate")}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 transition-colors hover:text-white"
        >
          Ставка
        </button>
        <button
          type="button"
          onClick={() => setMode("revoke")}
          className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10"
        >
          Премахни
        </button>
      </div>
      <Feedback state={grantState.ok ? grantState : rateState.ok ? rateState : revokeState} />
    </div>
  );
}

function RateForm({
  userId,
  action,
  pending,
  state,
  defaultRate,
  submitLabel,
  hint,
  onCancel,
}: {
  userId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  state: AdminFormState;
  defaultRate: number;
  submitLabel: string;
  hint?: string;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          € / час
          <input
            name="hourlyRate"
            type="number"
            min={0}
            step="0.5"
            required
            defaultValue={defaultRate}
            className="w-20 rounded-lg border border-white/10 bg-navy-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:opacity-60"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {submitLabel}
        </button>
        <CancelButton onClick={onCancel} />
      </div>
      {hint && !state.message && <p className="text-[11px] text-white/35">{hint}</p>}
      <Feedback state={state} />
    </form>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Затвори"
      className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white"
    >
      <X size={12} />
    </button>
  );
}

function Feedback({ state }: { state: AdminFormState }) {
  const message =
    state.message ?? Object.values(state.errors ?? {}).find(Boolean) ?? null;
  if (!message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`max-w-64 text-right text-xs ${state.ok ? "text-brand-400" : "text-red-300"}`}
    >
      {message}
    </p>
  );
}
