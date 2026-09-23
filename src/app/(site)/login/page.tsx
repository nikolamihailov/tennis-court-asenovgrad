import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Вход — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Нямаш достъп до администраторския панел с този профил.",
  OAuthAccountNotLinked:
    "Този имейл вече се използва с друг метод за вход.",
  AccessDenied: "Входът беше отказан.",
  Configuration:
    "Входът с Google не е конфигуриран. Провери GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.",
};

/**
 * `callbackUrl` is echoed back into a redirect after sign-in, so it must be a path on
 * this site — accepting an absolute URL would make the login page an open redirect.
 *
 * Rejecting anything that is not a single leading "/" followed by a non-slash covers
 * both `//evil.com` (protocol-relative) and `/\evil.com`, which browsers normalise to
 * the same thing. Backslashes are rejected outright rather than enumerated.
 */
function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (value === "/") return "/";
  if (!/^\/[^/\\]/.test(value)) return "/";
  if (value.includes("\\")) return "/";
  return value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const error = typeof params.error === "string" ? params.error : undefined;

  const user = await getCurrentUser();

  // Already signed in and allowed where they were going — skip the page. A non-admin who
  // was bounced off /admin still needs to see the explanation, so that case falls through.
  if (user && error !== "forbidden") redirect(callbackUrl);

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
      <div className="rounded-2xl border border-white/10 bg-navy-800 p-8">
        <h1 className="text-xl font-bold">Вход</h1>
        <p className="mt-1 text-sm text-white/60">
          Влез с Google, за да управляваш резервациите си.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            {ERROR_MESSAGES[error] ?? "Възникна грешка при входа."}
          </p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-navy-950 transition-opacity hover:opacity-90"
          >
            <GoogleMark />
            Вход с Google
          </button>
        </form>

        <p className="mt-6 text-xs text-white/40">
          Не е нужен профил, за да резервираш — може да го направиш и като гост.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
