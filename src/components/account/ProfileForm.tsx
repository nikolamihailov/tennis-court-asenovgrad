"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { updateProfileAction, type AccountFormState } from "@/server/actions/account";
import { FormMessage, RequiredLegend, TextField } from "@/components/ui/Field";

export default function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
  signInMethod,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  signInMethod: string;
}) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="Име"
          autoComplete="given-name"
          defaultValue={firstName ?? ""}
          required
          error={state.errors?.firstName}
        />
        <TextField
          name="lastName"
          label="Фамилия"
          autoComplete="family-name"
          defaultValue={lastName ?? ""}
          required
          error={state.errors?.lastName}
        />
      </div>

      {/* Read-only: the email identifies the account, ties guest bookings to it and is
          what Google matches on, so changing it here would quietly detach all three. */}
      <TextField
        name="email"
        label="Имейл"
        type="email"
        defaultValue={email}
        readOnly
        disabled
        hint={`Използва се за вход (${signInMethod}). За промяна се свържете с клуба.`}
      />

      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        autoComplete="tel"
        placeholder="0888 123 456"
        defaultValue={phone ?? ""}
        error={state.errors?.phone}
      />

      {state.message && (
        <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <RequiredLegend />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? "Запазване…" : "Запази промените"}
        </button>
      </div>
    </form>
  );
}
