"use client";

import { useState } from "react";
import { addAgentAction, resendInviteAction } from "@/lib/agent-team-actions";
import { TEAM_COPY } from "@/lib/agent-team-copy";

const input =
  "mt-1 block w-full rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-base text-white placeholder-zinc-500 focus:border-emerald-400 focus:outline-none sm:text-sm";

export function AddAgentForm({ canAddLeads }: { canAddLeads: boolean }) {
  const [busy, setBusy] = useState<"add" | "resend" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendId, setResendId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy("add");
    setMessage(null);
    setError(null);
    setResendId(null);
    const r = await addAgentAction({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      role: String(fd.get("role") ?? "agent"),
    });
    setBusy(null);
    if (r.ok) {
      setMessage(r.message);
      form.reset();
    } else {
      setError(r.error);
      setResendId(r.resendAgentId ?? null);
    }
  }

  async function onResend() {
    if (!resendId) return;
    setBusy("resend");
    const r = await resendInviteAction(resendId);
    setBusy(null);
    if (r.ok) {
      setError(null);
      setResendId(null);
      setMessage(r.message);
    } else {
      setError(r.error);
    }
  }

  return (
    <form onSubmit={onSubmit} data-add-agent className="space-y-4 rounded-lg border border-white/10 bg-zinc-900/60 p-5">
      <label className="block text-sm text-zinc-300">
        {TEAM_COPY.name}
        <input name="name" required maxLength={100} autoComplete="off" className={input} />
      </label>
      <label className="block text-sm text-zinc-300">
        {TEAM_COPY.workEmail}
        <input name="email" type="email" required autoComplete="off" className={input} />
      </label>
      <label className="block text-sm text-zinc-300">
        {TEAM_COPY.role}
        <select name="role" defaultValue="agent" className={input}>
          <option value="agent">{TEAM_COPY.roleLabels.agent}</option>
          {canAddLeads && <option value="lead">{TEAM_COPY.roleLabels.lead}</option>}
          {canAddLeads && <option value="admin">{TEAM_COPY.roleLabels.admin}</option>}
        </select>
      </label>
      <p className="text-sm text-zinc-400">{TEAM_COPY.helpLine}</p>
      <button
        type="submit"
        disabled={busy !== null}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy === "add" ? TEAM_COPY.sendingInvite : TEAM_COPY.sendInvite}
      </button>
      {message && (
        <p role="status" className="text-sm text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          {resendId && (
            <button
              type="button"
              onClick={onResend}
              disabled={busy !== null}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-60"
            >
              {busy === "resend" ? TEAM_COPY.resendingInvite : TEAM_COPY.resendInvite}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
