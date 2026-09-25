/**
 * Form primitives.
 *
 * Every form in the app was building its own label/input/error markup, which is how the
 * required fields ended up unmarked and the error styling drifted. These are plain
 * presentational components with no hooks, so they work in Server and Client Components
 * alike.
 */

/**
 * The red asterisk.
 *
 * Hidden from assistive technology on purpose: the input carries `required`, which screen
 * readers already announce, so exposing the asterisk too would have them say "star" after
 * every label.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-400">
      *
    </span>
  );
}

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Defaults to `name`. Pass one when a form can appear more than once on a page. */
  id?: string;
  wrapperClassName?: string;
};

export function TextField({
  name,
  label,
  error,
  hint,
  required,
  id = name,
  wrapperClassName = "",
  ...rest
}: FieldProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "required">) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="block text-xs font-medium text-white/70">
        {label}
        {required && <RequiredMark />}
      </label>

      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        // read-only is styled apart from disabled: a field you are merely viewing should
        // stay legible, while one you may never edit is dimmed.
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 read-only:border-transparent read-only:bg-navy-900/60 read-only:text-white/70 focus:border-brand-500 disabled:opacity-50"
        {...rest}
      />

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-white/35">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  required,
  id = name,
  wrapperClassName = "",
  children,
  ...rest
}: FieldProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id" | "name" | "required">) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="block text-xs font-medium text-white/70">
        {label}
        {required && <RequiredMark />}
      </label>

      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-500"
        {...rest}
      >
        {children}
      </select>

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-white/35">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level error or success message. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role="alert"
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${
        tone === "success"
          ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {children}
    </p>
  );
}
