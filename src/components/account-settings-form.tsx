"use client";

import { useState, type FormEvent } from "react";
import { updateAccountSettings } from "@/lib/account-settings-actions";

export interface AccountSettingsExisting {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  notifyByEmail: boolean;
  notifyByText: boolean;
  notifyByAgentCallback: boolean;
}

// The frequency chooser (real-time / daily digest / both) was removed
// 2026-09-27: important updates always go out right away and everything else
// in one daily update (notifications.ts, notification-digest.ts).
// communication_frequency is no longer written here and is dropped later.
const NOTIFICATION_RHYTHM_HELPER =
  "We send important updates right away, and everything else in one daily update.";

const CHANNEL_FLOOR_HINT =
  "Add another way to reach you before turning this one off — we need at least one.";

export function AccountSettingsForm({ existing }: { existing: AccountSettingsExisting }) {
  const [firstName, setFirstName] = useState(existing.firstName ?? "");
  const [lastName, setLastName] = useState(existing.lastName ?? "");
  const [phone, setPhone] = useState(existing.phone ?? "");
  const [notifyByEmail, setNotifyByEmail] = useState(existing.notifyByEmail);
  const [notifyByText, setNotifyByText] = useState(existing.notifyByText);
  const [notifyByAgentCallback, setNotifyByAgentCallback] = useState(existing.notifyByAgentCallback);
  // THE FLOOR IS "THE LAST ONE STANDING", NOT "EMAIL SPECIFICALLY", and
  // guarding only email is not enough -- caught in testing: with email off
  // and text on, unchecking text still reached a zero-channel state. So
  // whichever channel is the sole remaining one is the one that locks.
  // This also leaves a genuine text-only or callback-only preference
  // intact, which a hard email requirement would have overwritten -- a
  // real customer runs text-only today.
  const channelsOn = [notifyByEmail, notifyByText, notifyByAgentCallback].filter(Boolean).length;
  const locks = (on: boolean) => on && channelsOn === 1;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    // Checkboxes are controlled via state above, not left to native
    // checked-only serialization -- set explicitly so an unchecked box
    // reliably sends "off" instead of just being absent from formData.
    formData.set("notify_by_email", notifyByEmail ? "on" : "off");
    formData.set("notify_by_text", notifyByText ? "on" : "off");
    formData.set("notify_by_agent_callback", notifyByAgentCallback ? "on" : "off");

    const res = await updateAccountSettings(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-semibold text-zinc-400 uppercase">Account settings</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-zinc-400">
            First name <span className="text-amber-400">(required)</span>
          </label>
          <input
            type="text"
            name="first_name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">
            Last name <span className="text-amber-400">(required)</span>
          </label>
          <input
            type="text"
            name="last_name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-400">
            Phone <span className="text-amber-400">(required)</span>
          </label>
          <input
            type="tel"
            name="phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-zinc-400">How should we reach you?</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
          {/*
            Email is the FLOOR, not a fixed value. It can be switched off in
            favour of text or a callback -- a real customer does exactly that
            today -- but it cannot be switched off when it is the LAST channel
            standing, because that leaves an account we have no way to contact
            at all. The guarantee binds precisely when it is needed and stays
            out of the way otherwise.
          */}
          <label
            className={`flex items-center gap-2 text-sm ${
              locks(notifyByEmail) ? "text-zinc-400" : "text-zinc-300"
            }`}
            title={locks(notifyByEmail) ? CHANNEL_FLOOR_HINT : undefined}
          >
            <input
              type="checkbox"
              checked={notifyByEmail}
              disabled={locks(notifyByEmail)}
              onChange={(e) => setNotifyByEmail(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            Email
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${
              locks(notifyByText) ? "text-zinc-400" : "text-zinc-300"
            }`}
            title={locks(notifyByText) ? CHANNEL_FLOOR_HINT : undefined}
          >
            <input
              type="checkbox"
              checked={notifyByText}
              disabled={locks(notifyByText)}
              onChange={(e) => setNotifyByText(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            Text
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${
              locks(notifyByAgentCallback) ? "text-zinc-400" : "text-zinc-300"
            }`}
            title={locks(notifyByAgentCallback) ? CHANNEL_FLOOR_HINT : undefined}
          >
            <input
              type="checkbox"
              checked={notifyByAgentCallback}
              disabled={locks(notifyByAgentCallback)}
              onChange={(e) => setNotifyByAgentCallback(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            Phone call
          </label>
        </div>
        {channelsOn === 1 && (
          <p className="mt-2 text-xs text-zinc-500">{CHANNEL_FLOOR_HINT}</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">{NOTIFICATION_RHYTHM_HELPER}</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save settings"}
        </button>
        {success && <span className="text-xs text-emerald-400">Saved.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}
