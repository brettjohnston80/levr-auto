"use client";

import { useState } from "react";
import { resendInviteAction, resetTwoFactorAction } from "@/lib/agent-team-actions";
import { TEAM_COPY } from "@/lib/agent-team-copy";
import type { TeamMember } from "@/lib/agent-team";

const smallButton =
  "rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-60";

function MemberActions({ member }: { member: TeamMember }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"reset" | "resend" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run(kind: "reset" | "resend") {
    setBusy(kind);
    setError(null);
    setMessage(null);
    const r = kind === "reset" ? await resetTwoFactorAction(member.id) : await resendInviteAction(member.id);
    setBusy(null);
    setConfirming(false);
    if (r.ok) {
      setMessage(r.message);
      if (kind === "reset") setDone(true);
    } else {
      setError(r.error);
    }
  }

  if (!member.canReset && !member.canResend) return null;
  return (
    <div className="space-y-2">
      {member.canReset && !done && !confirming && (
        <button type="button" className={smallButton} onClick={() => setConfirming(true)}>
          {TEAM_COPY.resetTwoFactor}
        </button>
      )}
      {confirming && (
        <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-sm text-amber-200">{TEAM_COPY.resetConfirm(member.name)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("reset")}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {busy === "reset" ? TEAM_COPY.resetting : TEAM_COPY.resetConfirmButton}
            </button>
            <button type="button" disabled={busy !== null} className={smallButton} onClick={() => setConfirming(false)}>
              {TEAM_COPY.cancel}
            </button>
          </div>
        </div>
      )}
      {member.canResend && (
        <button type="button" disabled={busy !== null} className={smallButton} onClick={() => run("resend")}>
          {busy === "resend" ? TEAM_COPY.resendingInvite : TEAM_COPY.resendInvite}
        </button>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Status({ member }: { member: TeamMember }) {
  const tone = member.status === "ready" ? "text-emerald-400" : "text-amber-300";
  return <span className={tone}>{TEAM_COPY.status[member.status]}</span>;
}

function NameCell({ member }: { member: TeamMember }) {
  return (
    <span className="text-white">
      {member.name}
      {member.isYou && <span className="ml-2 text-xs text-zinc-500">({TEAM_COPY.you})</span>}
      {member.isTest && (
        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
          {TEAM_COPY.testBadge}
        </span>
      )}
    </span>
  );
}

// One set of rows (cards on phones, a grid on wider screens), so a half-done
// confirm survives a window resize.
const GRID = "sm:grid sm:grid-cols-[1.3fr_1.6fr_0.6fr_0.6fr_0.9fr_1.4fr] sm:gap-4";

export function TeamList({ members }: { members: TeamMember[] }) {
  const c = TEAM_COPY.columns;
  return (
    <div className="text-sm">
      <div className={`hidden border-b border-white/10 py-2 text-zinc-500 ${GRID}`}>
        <span>{c.name}</span>
        <span>{c.email}</span>
        <span>{c.role}</span>
        <span>{c.levrid}</span>
        <span>{c.status}</span>
        <span />
      </div>
      <ul className="space-y-3 sm:space-y-0">
        {members.map((m) => (
          <li
            key={m.id}
            data-agent-row={m.email}
            className={`rounded-lg border border-white/10 bg-zinc-900/60 p-4 sm:items-start sm:rounded-none sm:border-0 sm:border-b sm:border-white/5 sm:bg-transparent sm:px-0 sm:py-3 ${GRID}`}
          >
            <NameCell member={m} />
            <p className="mt-1 break-all text-zinc-400 sm:mt-0">{m.email}</p>
            <p className="mt-1 text-zinc-400 sm:hidden">
              {TEAM_COPY.roleLabels[m.role]}
              {m.levrid !== null && ` · LEVRID ${m.levrid}`} · <Status member={m} />
            </p>
            <span className="hidden text-zinc-300 sm:block">{TEAM_COPY.roleLabels[m.role]}</span>
            <span className="hidden text-zinc-300 sm:block">{m.levrid ?? "—"}</span>
            <span className="hidden sm:block">
              <Status member={m} />
            </span>
            {m.canReset || m.canResend ? (
              <div className="mt-3 sm:mt-0">
                <MemberActions member={m} />
              </div>
            ) : (
              <span className="hidden sm:block" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
