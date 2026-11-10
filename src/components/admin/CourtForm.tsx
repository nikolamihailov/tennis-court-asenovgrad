"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createCourtAction,
  updateCourtAction,
  type AdminFormState,
} from "@/server/actions/admin";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { BOOKING_DURATIONS, formatDuration, type BookingDuration } from "@/lib/pricing";
import type { CourtDTO } from "@/server/courts";

const PRICE_PLACEHOLDER: Record<BookingDuration, string> = {
  60: "10.00",
  90: "15.00",
  120: "20.00",
};

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
          placeholder="Корт 1"
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
          id={fieldId("sortOrder")}
          name="sortOrder"
          label="Подредба"
          placeholder="1"
          type="number"
          min="0"
          defaultValue={court?.sortOrder ?? 0}
          error={state.errors?.sortOrder}
        />

        <TextField
          id={fieldId("openingHour")}
          name="openingHour"
          label="Отваря в (час)"
          placeholder="8"
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
          placeholder="22"
          type="number"
          min="1"
          max="24"
          defaultValue={court?.closingHour ?? 22}
          required
          error={state.errors?.closingHour}
        />
      </div>

      {/* One price per game length, set independently so longer games can be discounted. */}
      <fieldset>
        <legend className="text-xs font-medium text-white/70">Цени (€)</legend>
        <div className="mt-1.5 grid gap-4 sm:grid-cols-3">
          {BOOKING_DURATIONS.map((duration) => (
            <TextField
              key={duration}
              id={fieldId(`price${duration}`)}
              name={`price${duration}`}
              label={formatDuration(duration)}
              placeholder={PRICE_PLACEHOLDER[duration]}
              type="number"
              step="0.01"
              min="0"
              defaultValue={court?.prices[duration]}
              required
              error={state.errors?.[`price${duration}`]}
            />
          ))}
        </div>
      </fieldset>

      <TextField
        id={fieldId("description")}
        name="description"
        label="Описание"
        placeholder="Глинен корт на открито"
        defaultValue={court?.description ?? ""}
        error={state.errors?.description}
      />

      <ImagePicker
        id={fieldId("image")}
        currentUrl={court?.imageUrl ?? null}
        error={state.errors?.image}
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

      </div>
    </form>
  );
}

/** Same limit and types as src/lib/court-images.ts, checked here for instant feedback. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const DEFAULT_IMAGE = "/images/court.jpg";

/**
 * Photo upload with a preview.
 *
 * The file travels with the rest of the form to the Server Action, which validates it
 * again and stores it in Vercel Blob. Without a pick, an edit keeps the current photo.
 */
function ImagePicker({
  id,
  currentUrl,
  error,
}: {
  id: string;
  currentUrl: string | null;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // React resets the form's uncontrolled fields after each action, which empties the file
  // input. The preview and the remove box are React state, so they follow the same event.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setPreview(null);
      setRemove(false);
      setClientError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);

    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      // Rejected here so a 10 MB phone photo fails instantly instead of after the upload.
      event.target.value = "";
      setPreview(null);
      setClientError("Снимката е твърде голяма — максимум 4 MB.");
      return;
    }

    setRemove(false);
    setPreview(URL.createObjectURL(file));
  }

  function clearPick() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setClientError(null);
  }

  const shown = preview ?? (remove ? DEFAULT_IMAGE : currentUrl || DEFAULT_IMAGE);
  const shownError = clientError ?? error;
  const errorId = shownError ? `${id}-error` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-white/70">
        Снимка
      </label>

      <div className="mt-1.5 flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* A blob: preview cannot go through next/image, so plain <img> for all three cases. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shown}
          alt="Снимка на корта"
          className="h-28 w-44 shrink-0 rounded-lg border border-white/10 object-cover"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            name="image"
            accept={ACCEPTED_IMAGE_TYPES}
            onChange={onPick}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={errorId}
            className="block w-full text-sm text-white/70 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
          />
          <p className="text-xs text-white/35">JPG, PNG или WebP, до 4 MB.</p>

          {preview && (
            <button
              type="button"
              onClick={clearPick}
              className="text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
            >
              Откажи новата снимка
            </button>
          )}

          {currentUrl && !preview && (
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                name="removeImage"
                checked={remove}
                onChange={(event) => setRemove(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-navy-900 accent-brand-500"
              />
              Премахни снимката (ще се показва стандартната)
            </label>
          )}

          {shownError && (
            <p id={errorId} role="alert" className="text-xs text-red-400">
              {shownError}
            </p>
          )}
        </div>
      </div>
    </div>
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
