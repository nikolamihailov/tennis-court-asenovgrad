"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";

import { updateProfileAction, type AccountFormState } from "@/server/actions/account";
import { FormMessage, TextField } from "@/components/ui/Field";

export default function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
  isGoogleAccount,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  isGoogleAccount: boolean;
}) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateProfileAction,
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Edit mode, derived rather than synced.
   *
   * Entering edit records the action state at that moment. A submit replaces that state
   * with a new object, so:
   *   - a successful save no longer matches and edit mode closes;
   *   - a failed one does not close it, because `!state.ok` keeps it open so the errors
   *     can be fixed in place.
   *
   * Doing this with an effect that watched `state.ok` would set state during render's
   * commit — the cascading-render pattern React's lint rules reject.
   */
  const [editingFrom, setEditingFrom] = useState<AccountFormState | null>(null);
  const isEditing = editingFrom !== null && (state === editingFrom || !state.ok);

  function startEditing() {
    setEditingFrom(state);
  }

  function cancelEditing() {
    // Native reset restores every defaultValue, discarding whatever was typed.
    formRef.current?.reset();
    setEditingFrom(null);
  }

  // A Google account's name is re-read from the Google profile on every sign-in, so it is
  // never editable here — the next sign-in would undo it. The Server Action enforces the
  // same rule, since a disabled input stops a browser and nothing else.
  const nameLocked = isGoogleAccount;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="Име"
          placeholder="Иван"
          autoComplete="given-name"
          defaultValue={firstName ?? ""}
          required={!nameLocked}
          readOnly={!isEditing && !nameLocked}
          disabled={nameLocked}
          hint={nameLocked ? "Управлява се от Google профила ти." : undefined}
          error={state.errors?.firstName}
        />
        <TextField
          name="lastName"
          label="Фамилия"
          placeholder="Петров"
          autoComplete="family-name"
          defaultValue={lastName ?? ""}
          required={!nameLocked}
          readOnly={!isEditing && !nameLocked}
          disabled={nameLocked}
          hint={nameLocked ? "Управлява се от Google профила ти." : undefined}
          error={state.errors?.lastName}
        />
      </div>

      {/* Locked for everyone: the email identifies the account, ties guest bookings to it
          and is what Google matches on, so changing it would detach all three. */}
      <TextField
        name="email"
        label="Имейл"
        type="email"
        placeholder="ivan@example.com"
        defaultValue={email}
        disabled
        hint={`Използва се за вход (${isGoogleAccount ? "Google" : "имейл и парола"}). За промяна се свържете с клуба.`}
      />

      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        placeholder="0888 123 456"
        autoComplete="tel"
        defaultValue={phone ?? ""}
        readOnly={!isEditing}
        error={state.errors?.phone}
      />

      {state.message && (
        <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
      )}

      <div className="flex justify-end gap-3">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={pending}
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:text-white disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 size={16} className="animate-spin" />}
              {pending ? "Запазване…" : "Запази промените"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-5 py-2.5 text-sm font-semibold text-brand-400 transition-colors hover:border-brand-500 hover:bg-brand-500/15 hover:text-brand-300"
          >
            <Pencil size={15} />
            Редактирай
          </button>
        )}
      </div>
    </form>
  );
}
