import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/dal";
import GoogleButton from "@/components/auth/GoogleButton";
import RegisterForm from "@/components/auth/RegisterForm";
import { safeCallbackUrl } from "@/lib/url";

export const metadata: Metadata = {
  title: "Създай профил — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/profile");

  if (await getCurrentUser()) redirect(callbackUrl);

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-white/10 bg-navy-800 p-7 sm:p-8">
        <h1 className="text-xl font-bold">Създай профил</h1>
        <p className="mt-1 text-sm text-white/60">
          С профил виждаш всичките си резервации на едно място.
        </p>

        <div className="mt-6">
          <RegisterForm />
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
          <GoogleButton label="Продължи с Google" />
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Вече имаш профил?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-400 transition-colors hover:text-brand-300"
          >
            Влез
          </Link>
        </p>
      </div>
    </div>
  );
}
