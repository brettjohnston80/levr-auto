"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setOfferHighlight, setOfferNote } from "@/lib/offer-highlight-actions";

const NOTE_MAX_LENGTH = 500;

// Shared by the offer card and the offer detail modal, so the two surfaces
// can't drift on behavior or wording. Only ever rendered for a PENDING
// offer -- the server actions also refuse anything else.

export function HighlightToggle({ offerId, highlighted }: { offerId: string; highlighted: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const res = await setOfferHighlight(offerId, !highlighted);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-pressed={highlighted}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          highlighted
            ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
            : "border-white/15 text-zinc-300 hover:bg-white/5"
        }`}
      >
        {highlighted ? "★ Highlighted" : "☆ Highlight"}
      </button>
      {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
    </span>
  );
}

export function NoteEditor({ offerId, note }: { offerId: string; note: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    setSaving(true);
    setError(null);
    const res = await setOfferNote(offerId, value);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        {note ? (
          <>
            <p className="text-sm text-zinc-300">
              Your note: <span className="text-zinc-200">&ldquo;{note}&rdquo;</span>
            </p>
            <div className="mt-2 flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDraft(note);
                  setEditing(true);
                }}
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                Edit note
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save("")}
                className="text-zinc-400 underline hover:text-white disabled:opacity-50"
              >
                Remove note
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
            className="text-sm text-emerald-400 underline hover:text-emerald-300"
          >
            Add a note for your agent
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={3}
        autoFocus
        placeholder="e.g. Would they do $31,000? Is the sunroof included?"
        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
        <span>Only your LEVR agent sees this note.</span>
        <span>
          {draft.length}/{NOTE_MAX_LENGTH}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(draft)}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
