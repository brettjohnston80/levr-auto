"use client";

import { useState, type FormEvent } from "react";
import { updateAccountPassword } from "@/lib/auth-actions";

/**
 * Password change for a signed-in customer, from /account. A separate form
 * with its own submit button -- deliberately not folded into
 * AccountSettingsForm, which already owns one save action for profile/
 * notification fields. Conflating the two would mean one submit button
 * covering two independent outcomes (e.g. a name save succeeding while a
 * password change fails for an unrelated reason), which is confusing to
 * report back cleanly. Same three-field shape and 8-character minimum as
 * /signup and /auth/reset-password (SignupForm, ResetPasswordPage) -- one
 * rule, not a fourth invented one.
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("current_password", currentPassword);
    formData.set("new_password", newPassword);

    const result = await updateAccountPassword(formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <p className="text-xs font-semibold text-zinc-400 uppercase">Change password</p>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-400">Current password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-zinc-400">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
            <span className="mt-1 block text-xs text-zinc-500">At least 8 characters.</span>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">Confirm new password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Change password"}
        </button>
        {success && <span className="text-xs text-emerald-400">Password changed.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}
