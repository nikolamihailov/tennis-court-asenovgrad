"use client";

import { useActionState, useId } from "react";
import { Loader2 } from "lucide-react";

import {
  createCourtAction,
  updateCourtAction,
  type AdminFormState,
} from "@/server/actions/admin";
import type { CourtDTO } from "@/server/courts";

/**
 * Create/edit form for a court.
 *
 * `court` absent means create. The two actions share a shape so the form body is one
 * piece of markup rather than two that drift apart.
 */
export default function CourtForm({
  court,
  onDone,
}: {
  court?: CourtDTO;
  onDone?: () => void;
}) {
  const action = court ? updateCourtAction : createCourtAction;
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    action,
    {},
  );

  // The create form and an edit form can be open at the same time. Without a unique
  // prefix both would emit id="name", and clicking either label would focus the first
  // one on the page.
  const idPrefix = useId();

  return (
    <form action={formAction} className="space-y-4">
      {court && <input type="hidden" name="id" value={court.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          idPrefix={idPrefix}
          name="name"
          label="Име"
          defaultValue={court?.name}
          required
          error={state.errors?.name}
        />

        <div>
          <label
            htmlFor={`${idPrefix}surface`}
            className="block text-xs text-white/60"
          >
            Настилка
          </label>
          <select
            id={`${idPrefix}surface`}
            name="surface"
            defaultValue={court?.surface ?? "CLAY"}
            className="mt-1 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="CLAY">Глина</option>
            <option value="HARD">Твърда настилка</option>
          </select>
        </div>

        <Field
          idPrefix={idPrefix}
          name="pricePerHour"
          label="Цена на час (лв.)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={court?.pricePerHour}
          required
          error={state.errors?.pricePerHour}
        />

        <Field
          idPrefix={idPrefix}
          name="sortOrder"
          label="Подредба"
          type="number"
          min="0"
          defaultValue={court?.sortOrder ?? 0}
          error={state.errors?.sortOrder}
        />

        <Field
          idPrefix={idPrefix}
          name="openingHour"
          label="Отваря в (час)"
          type="number"
          min="0"
          max="23"
          defaultValue={court?.openingHour ?? 8}
          required
          error={state.errors?.openingHour}
        />

        <Field
          idPrefix={idPrefix}
          name="closingHour"
          label="Затваря в (час)"
          type="number"
          min="1"
          max="24"
          defaultValue={court?.closingHour ?? 22}
          required
          error={state.errors?.closingHour}
        />
      </div>

      <Field
        idPrefix={idPrefix}
        name="description"
        label="Описание"
        defaultValue={court?.description ?? ""}
        error={state.errors?.description}
      />

      <Field
        idPrefix={idPrefix}
        name="imageUrl"
        label="Снимка (път или URL)"
        defaultValue={court?.imageUrl ?? "/images/court.jpg"}
        error={state.errors?.imageUrl}
      />

      <div className="flex flex-wrap gap-6">
        <Checkbox name="isIndoor" label="Закрит корт" defaultChecked={court?.isIndoor} />
        <Checkbox
          name="isActive"
          label="Активен (виден за клиенти)"
          defaultChecked={court?.isActive ?? true}
        />
      </div>

      {state.message && (
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "border border-brand-500/30 bg-brand-500/10 text-brand-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {court ? "Запази промените" : "Създай корт"}
        </button>

        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white"
          >
            Затвори
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  idPrefix = "",
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
  idPrefix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `${idPrefix}${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-xs text-white/60">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className="mt-1 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-brand-500"
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

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-white/80">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-white/20 bg-navy-900 accent-brand-500"
      />
      {label}
    </label>
  );
}
