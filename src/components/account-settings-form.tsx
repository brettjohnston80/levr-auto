"use client";

import { useState, type FormEvent } from "react";
import { updateAccountSettings } from "@/lib/account-settings-actions";
import type { CommunicationFrequency } from "@/lib/communication-preferences";

export interface AccountSettingsExisting {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  notifyByEmail: boolean;
  notifyByText: boolean;
  notifyByAgentCallback: boolean;
  communicationFrequency: CommunicationFrequency;
}

export function AccountSettingsForm({ existing }: { existing: AccountSettingsExisting }) {
  const [firstName, setFirstName] = useState(existing.firstName ?? "");
  const [lastName, setLastName] = useState(existing.lastName ?? "");
  const [phone, setPhone] = useState(existing.phone ?? "");
  const [notifyByEmail, setNotifyByEmail] = useState(existing.notifyByEmail);
  const [notifyByText, setNotifyByText] = useState(existing.notifyByText);
  const [notifyByAgentCallback, setNotifyByAgentCallback] = useState(existing.notifyByAgentCallback);
  const [frequency, setFrequency] = useState<CommunicationFrequency>(existing.communicationFrequency);
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
    // frequency is a button-toggle pair, not a native form control, so it
    // never lands in FormData on its own -- set it explicitly, same as the
    // checkboxes above.
    formData.set("communication_frequency", frequency);

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
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={notifyByEmail}
              onChange={(e) => setNotifyByEmail(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={notifyByText}
              onChange={(e) => setNotifyByText(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
            />
            Text message
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={notifyByAgentCallback}
              onChange={(e) => setNotifyByAgentCallback(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
            />
            A personal agent calls me
          </label>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-zinc-400">How often?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setFrequency("real_time")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              frequency === "real_time" ? "bg-emerald-500 text-zinc-950" : "border border-white/10 text-zinc-400"
            }`}
          >
            Real-time updates
          </button>
          <button
            type="button"
            onClick={() => setFrequency("daily_digest")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              frequency === "daily_digest"
                ? "bg-emerald-500 text-zinc-950"
                : "border border-white/10 text-zinc-400"
            }`}
          >
            Daily digest
          </button>
        </div>
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
