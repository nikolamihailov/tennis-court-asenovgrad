"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import {
  fieldErrors,
  loginSchema,
  profilePhoneOnlySchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation";

/** Work factor for bcrypt. 12 is the current sensible default. */
const BCRYPT_ROUNDS = 12;

export type AccountFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

/**
 * Register with email and password.
 *
 * An email that already has a row is not automatically an error. A guest row is created
 * by the act of booking, so most people registering will already have one, and refusing
 * them would be absurd. Claiming that row upgrades it in place and keeps their booking
 * history — the same upgrade a Google sign-in performs.
 *
 * What is refused is claiming a row that someone already controls: one with a password,
 * or with a linked Google account. Those belong to somebody.
 *
 * Note this trusts the email without verifying it, exactly as guest booking and Google
 * account-linking already do. See the deferred list in ROADMAP.md.
 */
export async function registerAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { firstName, lastName, email, phone, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isGuest: true,
      _count: { select: { accounts: true } },
    },
  });

  if (existing?.passwordHash) {
    return {
      errors: { email: "Вече има регистрация с този имейл. Влезте вместо това." },
    };
  }

  if (existing && existing._count.accounts > 0) {
    return {
      errors: {
        email: "Този имейл вече се използва с Google. Влезте с Google.",
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const data = {
    firstName,
    lastName,
    phone,
    passwordHash,
    name: `${firstName} ${lastName}`.trim(),
    isGuest: false,
  };

  if (existing) {
    await db.user.update({ where: { id: existing.id }, data });
  } else {
    await db.user.create({ data: { ...data, email, role: "USER" } });
  }

  // Sign in straight away rather than bouncing to the login page to retype what was just
  // typed. signIn redirects, which throws, so nothing after this runs.
  await signIn("credentials", { email, password, redirectTo: "/profile" });

  return {};
}

/**
 * Sign in with email and password.
 *
 * Auth.js reports every credentials failure as CredentialsSignin, and that is the only
 * thing shown back: saying whether the email exists would let anyone enumerate accounts.
 */
export async function loginAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const callbackUrl = formData.get("callbackUrl");
  const redirectTo =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : "/profile";

  try {
    await signIn("credentials", { ...parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Грешен имейл или парола." };
    }
    // signIn throws a redirect on success; rethrowing lets Next handle it.
    throw error;
  }

  return {};
}

/**
 * Update the fields a customer owns. Email is identity and role is staff-only.
 *
 * What counts as "owned" depends on how they sign in. A Google account's name is re-read
 * from the Google profile on every sign-in, so accepting one here would be a lie — the
 * next sign-in would overwrite it. Those accounts may change only their phone number, and
 * that is enforced here rather than only by the disabled inputs, which a direct POST
 * would bypass.
 */
export async function updateProfileAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();

  const googleAccount = await db.account.findFirst({
    where: { userId: user.id, provider: "google" },
    select: { userId: true },
  });

  if (googleAccount) {
    const parsed = profilePhoneOnlySchema.safeParse({ phone: formData.get("phone") });
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    await db.user.update({
      where: { id: user.id },
      // Null rather than undefined, so clearing the field actually clears the column.
      data: { phone: parsed.data.phone ?? null },
    });

    revalidatePath("/profile");
    return { ok: true, message: "Телефонът е обновен." };
  }

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { firstName, lastName, phone } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      phone: phone ?? null,
      name: `${firstName} ${lastName}`.trim(),
    },
  });

  revalidatePath("/profile");
  return { ok: true, message: "Профилът е обновен." };
}

/** Sign out from anywhere. */
export async function signOutAction() {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/" });
  redirect("/");
}
