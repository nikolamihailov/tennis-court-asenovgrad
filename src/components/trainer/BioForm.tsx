"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { updateBioAction, type TrainerFormState } from "@/server/actions/trainer";

/** The short introduction customers read when choosing a trainer. */
export default function BioForm({ bio }: { bio: string | null }) {
  const [state, formAction, pending] = useActionState<TrainerFormState, FormData>(
    updateBioAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="bio"
        rows={4}
        maxLength={600}
        defaultValue={bio ?? ""}
        aria-label="Представяне"
        placeholder="Например: Бивш състезател, 10 години опит с деца и начинаещи."
        className="w-full rounded-lg border border-white/10 bg-navy-900 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-brand-500"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Запази
        </button>
        {state.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={`text-sm ${state.ok ? "text-brand-400" : "text-red-300"}`}
          >
            {state.message}
          </p>
        )}
        {state.errors?.bio && (
          <p role="alert" className="text-sm text-red-300">
            {state.errors.bio}
          </p>
        )}
      </div>
    </form>
  );
}
