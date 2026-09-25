"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

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

  // A Google account's name is re-read from the Google profile on every sign-in, so
  // editing it here would be undone at the next one. The fields are shown, because seeing
  // what the club has on file is the point of the page, but they are not editable — and
  // the Server Action refuses them too, since disabled inputs stop nothing but a browser.
  const nameHint = isGoogleAccount ? "Управлява се от Google профила ти." : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="Име"
          placeholder="Иван"
          autoComplete="given-name"
          defaultValue={firstName ?? ""}
          required={!isGoogleAccount}
          disabled={isGoogleAccount}
          hint={nameHint}
          error={state.errors?.firstName}
        />
        <TextField
          name="lastName"
          label="Фамилия"
          placeholder="Петров"
          autoComplete="family-name"
          defaultValue={lastName ?? ""}
          required={!isGoogleAccount}
          disabled={isGoogleAccount}
          hint={nameHint}
          error={state.errors?.lastName}
        />
      </div>

      {/* Read-only for everyone: the email identifies the account, ties guest bookings to
          it and is what Google matches on, so changing it would detach all three. */}
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
        error={state.errors?.phone}
      />

      {state.message && (
        <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
      )}

      <div className="flex justify-end">
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
