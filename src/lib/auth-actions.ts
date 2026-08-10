"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function attemptLogin(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { ok: !error, error: error?.message };
}

async function attemptSignup(
  email: string,
  password: string,
  fullName: string | undefined,
  redirectPath: string
) {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${siteUrl}${redirectPath}`,
    },
  });

  return { ok: !error, error: error?.message };
}

// Form-action versions — used by the standalone /login and /signup pages.
// Redirect on completion.

export async function login(formData: FormData) {
  const result = await attemptLogin(
    formData.get("email") as string,
    formData.get("password") as string
  );

  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.error!)}`);
  }

  redirect("/account");
}

export async function signup(formData: FormData) {
  const fullName = formData.get("fullName") as string;

  const result = await attemptSignup(
    formData.get("email") as string,
    formData.get("password") as string,
    fullName || undefined,
    "/auth/callback"
  );

  if (!result.ok) {
    redirect(`/signup?error=${encodeURIComponent(result.error!)}`);
  }

  redirect(`/signup?message=${encodeURIComponent("Check your email to confirm your account.")}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Used by /auth/reset-password. Relies on the session already established by
// /auth/callback's code exchange (the recovery email link routes through
// there first) — updateUser() acts on whatever session is currently active.
// Signs out afterward so the user has to log back in with the new password,
// matching the redirect-to-login UX and doubling as a real verification that
// the new password actually works.
export async function updatePasswordFromRecovery(formData: FormData) {
  const password = formData.get("password") as string;

  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.auth.signOut();
  return { ok: true };
}

// Inline versions — used by the intake-flow auth gate modal. Return a result
// instead of redirecting, so the caller can stay on the same page.

export async function loginInline(email: string, password: string) {
  return attemptLogin(email, password);
}

export async function signupInline(email: string, password: string, fullName?: string) {
  // Sends confirmed users back to the homepage (where the intake flow lives)
  // rather than /account, so the pending-search resume logic can pick up.
  return attemptSignup(email, password, fullName, `/auth/callback?next=${encodeURIComponent("/")}`);
}
