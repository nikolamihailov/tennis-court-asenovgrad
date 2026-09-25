"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { loginAction, type AccountFormState } from "@/server/actions/account";
import { FormMessage, TextField } from "@/components/ui/Field";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <TextField
        name="email"
        label="Имейл"
        type="email"
        autoComplete="email"
        placeholder="ivan@example.com"
        required
        error={state.errors?.email}
      />

      <div>
        <TextField
          name="password"
          label="Парола"
          type="password"
          placeholder="•••••••••"
          autoComplete="current-password"
          required
          error={state.errors?.password}
        />
        {/* No reset flow yet, so this does not pretend to be a link. */}
        <p className="mt-1.5 text-right text-xs text-white/35">
          Забравена парола? Свържете се с клуба.
        </p>
      </div>

      {state.message && <FormMessage>{state.message}</FormMessage>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {pending ? "Влизане…" : "Вход"}
      </button>
    </form>
  );
}
