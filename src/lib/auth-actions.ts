"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function attemptLogin(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { ok: !error, error: error?.message };
}

async function attemptSignup(email: string, password: string, redirectPath: string, phone?: string) {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const metadata: Record<string, string> = {};
  if (phone) metadata.phone = phone;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: Object.keys(metadata).length > 0 ? metadata : undefined,
      emailRedirectTo: `${siteUrl}${redirectPath}`,
    },
  });

  return { ok: !error, error: error?.message };
}

// Form-action versions — used by the standalone /login and /signup pages.
// Redirect on completion.

// LEVRating Phase B: lets a signed-out survey-link click land on /login and
// come back to the survey after signing in, without any new auth
// mechanism -- just a redirect-back on the existing password flow. Must be
// a same-origin relative path only, or this becomes an open redirect.
function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false; // protocol-relative
  if (path.includes("://")) return false;
  return true;
}

export async function login(formData: FormData) {
  const next = formData.get("next") as string | null;
  const result = await attemptLogin(
    formData.get("email") as string,
    formData.get("password") as string
  );

  if (!result.ok) {
    const nextParam = isSafeRedirectPath(next) ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=${encodeURIComponent(result.error!)}${nextParam}`);
  }

  redirect(isSafeRedirectPath(next) ? next : "/account");
}

export async function signup(formData: FormData) {
  const phone = (formData.get("phone") as string)?.trim();

  const result = await attemptSignup(
    formData.get("email") as string,
    formData.get("password") as string,
    "/auth/callback",
    phone || undefined
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

// Used by /forgot-password. Always redirects with the same generic message
// regardless of whether the email actually has an account — resetPasswordForEmail
// doesn't error on an unknown address, and echoing a different message for
// "not found" would let someone enumerate real accounts by email.
export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
  }

  redirect(
    `/forgot-password?message=${encodeURIComponent(
      "If an account exists for that email, a reset link is on its way."
    )}`
  );
}

// Used by /auth/reset-password, which establishes the session itself
// client-side (parses the recovery link's hash-fragment tokens and calls
// setSession()) before this ever runs — updateUser() just acts on whatever
// session is currently active. Signs out afterward so the user has to log
// back in with the new password, matching the redirect-to-login UX and
// doubling as a real verification that the new password actually works.
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

// Password change for an ALREADY-signed-in customer, from /account.
// Different from updatePasswordFromRecovery above in one load-bearing way:
// that one runs after a recovery link has already proven identity via a
// token, so it trusts the session outright. This one runs from an ordinary
// browsing session, where the only thing that's actually been proven is
// "a cookie for this browser is valid right now" -- not that the person
// currently at the keyboard is the account owner (a shared/public computer
// left signed in is the real scenario this guards against). Supabase's own
// updateUser({ password }) has no such check built in -- it will happily
// accept the change off the session alone, confirmed directly against this
// project's real Supabase config, not assumed from docs. The current-
// password re-check below is therefore an APPLICATION-level decision, not
// something Supabase requires: re-authenticate via signInWithPassword
// first, using the session's own known email, and only call updateUser if
// that succeeds. A wrong current password fails here with no password
// changed; a correct one re-confirms the session (harmless — same user,
// same account) before the real update.
export async function updateAccountPassword(formData: FormData) {
  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: "Not signed in." };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// Inline versions — used by the intake-flow auth gate modal. Return a result
// instead of redirecting, so the caller can stay on the same page.

export async function loginInline(email: string, password: string) {
  return attemptLogin(email, password);
}

export async function signupInline(email: string, password: string, phone?: string) {
  // Sends confirmed users back to the homepage (where the intake flow lives)
  // rather than /account, so the pending-search resume logic can pick up.
  // Neither name nor notification preferences are collected here anymore --
  // both live in account settings now, and default/stay null via the DB
  // trigger/column defaults the same way any signup path that omits them
  // always has.
  return attemptSignup(email, password, `/auth/callback?next=${encodeURIComponent("/")}`, phone);
}
