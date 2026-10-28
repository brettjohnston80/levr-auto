"use client";

import { WITHDRAW_COPY, WITHDRAW_REASONS } from "@/lib/offer-entry-draft-copy";

// The reason choice shared by "Withdraw this offer" and "Release this accepted offer".
export function WithdrawReasonFields({
  idPrefix,
  reasonCode,
  note,
  onReasonCode,
  onNote,
}: {
  idPrefix: string;
  reasonCode: string;
  note: string;
  onReasonCode: (code: string) => void;
  onNote: (note: string) => void;
}) {
  return (
    <span className="flex w-full max-w-md flex-col gap-1">
      <span className="text-xs text-zinc-300">{WITHDRAW_COPY.heading}</span>
      <label htmlFor={`${idPrefix}-reason`} className="text-xs text-zinc-400">
        {WITHDRAW_COPY.reasonLabel}
      </label>
      <select
        id={`${idPrefix}-reason`}
        value={reasonCode}
        onChange={(e) => onReasonCode(e.target.value)}
        className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
      >
        <option value="">—</option>
        {WITHDRAW_REASONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-note`} className="text-xs text-zinc-400">
        {WITHDRAW_COPY.noteLabel}
      </label>
      <textarea
        id={`${idPrefix}-note`}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        maxLength={500}
        className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
      />
    </span>
  );
}

/** Client-side check before sending; the server checks the same. Returns the refusal line or null. */
export function withdrawReasonProblem(reasonCode: string, note: string): string | null {
  if (!reasonCode) return WITHDRAW_COPY.refusals.reason_missing;
  if (reasonCode === "other" && !note.trim()) return WITHDRAW_COPY.refusals.note_required;
  return null;
}
