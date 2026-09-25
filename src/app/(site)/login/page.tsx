import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/dal";
import GoogleButton from "@/components/auth/GoogleButton";
import LoginForm from "@/components/auth/LoginForm";
import { safeCallbackUrl } from "@/lib/url";

export const metadata: Metadata = {
  title: "Вход — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Нямаш достъп до администраторския панел с този профил.",
  CredentialsSignin: "Грешен имейл или парола.",
  OAuthAccountNotLinked: "Този имейл вече се използва с друг метод за вход.",
  AccessDenied: "Входът беше отказан.",
  Configuration:
    "Входът с Google не е конфигуриран. Провери GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // Falls back to the profile rather than the home page: someone who chose to sign in
  // wants their account, and landing back on the marketing page looks like it failed.
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/profile");
  const error = typeof params.error === "string" ? params.error : undefined;

  const user = await getCurrentUser();

  // Already signed in and allowed where they were going — skip the page. Someone bounced
  // off /admin still needs the explanation, so that case falls through.
  if (user && error !== "forbidden") redirect(callbackUrl);

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-white/10 bg-navy-800 p-7 sm:p-8">
        <h1 className="text-xl font-bold">Вход</h1>
        <p className="mt-1 text-sm text-white/60">
          Влез, за да управляваш резервациите и профила си.
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

        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wide text-white/35">или</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <GoogleButton label="Вход с Google" />
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Нямаш профил?{" "}
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="font-medium text-brand-400 transition-colors hover:text-brand-300"
          >
            Създай профил
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-white/35">
          Не е нужен профил, за да резервираш — може и като гост.
        </p>
      </div>
    </div>
  );
}
