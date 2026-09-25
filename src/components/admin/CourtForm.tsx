"use client";

import { useActionState, useId } from "react";
import { Loader2 } from "lucide-react";

import {
  createCourtAction,
  updateCourtAction,
  type AdminFormState,
} from "@/server/actions/admin";
import {
  FormMessage,
  RequiredLegend,
  SelectField,
  TextField,
} from "@/components/ui/Field";
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
  const fieldId = (name: string) => `${idPrefix}${name}`;

  return (
    <form action={formAction} className="space-y-4">
      {court && <input type="hidden" name="id" value={court.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={fieldId("name")}
          name="name"
          label="Име"
          defaultValue={court?.name}
          required
          error={state.errors?.name}
        />

        <SelectField
          id={fieldId("surface")}
          name="surface"
          label="Настилка"
          defaultValue={court?.surface ?? "CLAY"}
          required
          error={state.errors?.surface}
        >
          <option value="CLAY">Глина</option>
          <option value="HARD">Твърда настилка</option>
        </SelectField>

        <TextField
          id={fieldId("pricePerHour")}
          name="pricePerHour"
          label="Цена на час (€)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={court?.pricePerHour}
          required
          error={state.errors?.pricePerHour}
        />

        <TextField
          id={fieldId("sortOrder")}
          name="sortOrder"
          label="Подредба"
          type="number"
          min="0"
          defaultValue={court?.sortOrder ?? 0}
          error={state.errors?.sortOrder}
        />

        <TextField
          id={fieldId("openingHour")}
          name="openingHour"
          label="Отваря в (час)"
          type="number"
          min="0"
          max="23"
          defaultValue={court?.openingHour ?? 8}
          required
          error={state.errors?.openingHour}
        />

        <TextField
          id={fieldId("closingHour")}
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

      <TextField
        id={fieldId("description")}
        name="description"
        label="Описание"
        defaultValue={court?.description ?? ""}
        error={state.errors?.description}
      />

      <TextField
        id={fieldId("imageUrl")}
        name="imageUrl"
        label="Снимка (път или URL)"
        defaultValue={court?.imageUrl ?? "/images/court.jpg"}
        error={state.errors?.imageUrl}
      />

      <div className="flex flex-wrap gap-6">
        <Checkbox
          id={fieldId("isIndoor")}
          name="isIndoor"
          label="Закрит корт"
          defaultChecked={court?.isIndoor}
        />
        <Checkbox
          id={fieldId("isActive")}
          name="isActive"
          label="Активен (виден за клиенти)"
          defaultChecked={court?.isActive ?? true}
        />
      </div>

      {state.message && (
        <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
      )}

      <div className="flex flex-wrap items-center gap-3">
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

        <RequiredLegend className="ml-auto" />
      </div>
    </form>
  );
}

function Checkbox({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-white/80">
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-white/20 bg-navy-900 accent-brand-500"
      />
      {label}
    </label>
  );
}
