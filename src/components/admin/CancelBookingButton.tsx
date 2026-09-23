"use client";

import { useActionState, useState } from "react";
import { Loader2, X } from "lucide-react";

import { cancelBookingAction, type AdminFormState } from "@/server/actions/admin";

/**
 * Cancelling frees the court and emails the customer, so it asks for confirmation and an
 * optional reason rather than firing on a single click.
 */
export default function CancelBookingButton({
  bookingId,
  reference,
}: {
  bookingId: string;
  reference: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    cancelBookingAction,
    {},
  );

  if (state.ok) {
    return <span className="text-xs text-white/40">Отказана</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
      >
        Откажи
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />

      <div className="flex items-center gap-2">
        <input
          name="reason"
          placeholder="Причина (по избор)"
          aria-label={`Причина за отказ на ${reference}`}
          className="w-44 rounded-lg border border-white/10 bg-navy-900 px-2.5 py-1.5 text-xs outline-none placeholder:text-white/25 focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          Потвърди
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Затвори"
          className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white"
        >
          <X size={12} />
        </button>
      </div>

      {state.message && (
        <p role="alert" className="text-xs text-red-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
