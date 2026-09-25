"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { registerAction, type AccountFormState } from "@/server/actions/account";
import { FormMessage, TextField } from "@/components/ui/Field";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    registerAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
        autoComplete="email"
        placeholder="ivan@example.com"
        required
        error={state.errors?.email}
      />

      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        autoComplete="tel"
        placeholder="0888 123 456"
        hint="По избор. Ползваме го само ако се наложи да се свържем с теб."
        error={state.errors?.phone}
      />

      <TextField
        name="password"
        label="Парола"
        type="password"
        placeholder="•••••••••"
        autoComplete="new-password"
        required
        hint="Поне 8 символа."
        error={state.errors?.password}
      />

      <TextField
        name="confirmPassword"
        label="Повтори паролата"
        type="password"
        placeholder="•••••••••"
        autoComplete="new-password"
        required
        error={state.errors?.confirmPassword}
      />

      {state.message && <FormMessage>{state.message}</FormMessage>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? "Създаване…" : "Създай профил"}
      </button>
    </form>
  );
}
