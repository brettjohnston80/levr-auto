"use client";

import { useState } from "react";
import type { DraftArticle } from "@/lib/article-queue";
import { updateArticleDraft, approveArticle, regenerateArticleDraft } from "@/lib/article-actions";

const TEXTAREA_CLASS = "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white";

function scheduleBadge(scheduledPublishAt: string): { label: string; className: string } {
  const daysRemaining = Math.ceil((new Date(scheduledPublishAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) {
    return {
      label: `OVERDUE by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"}`,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }
  if (daysRemaining === 0) {
    return { label: "Scheduled to publish today", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  }
  return {
    label: `Scheduled to publish in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    className: "border-white/10 bg-white/[0.03] text-zinc-400",
  };
}

export function ArticleReviewForm({ article }: { article: DraftArticle }) {
  const [content, setContent] = useState(article.content);
  const [captionX, setCaptionX] = useState(article.captionX);
  const [captionFacebook, setCaptionFacebook] = useState(article.captionFacebook);
  const [captionInstagram, setCaptionInstagram] = useState(article.captionInstagram);
  const [captionLinkedin, setCaptionLinkedin] = useState(article.captionLinkedin);

  const [busy, setBusy] = useState<"save" | "approve" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const edits = { content, captionX, captionFacebook, captionInstagram, captionLinkedin };
  const badge = scheduleBadge(article.scheduledPublishAt);

  async function handleSave() {
    setBusy("save");
    setError(null);
    const result = await updateArticleDraft(article.id, edits);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  async function handleApprove() {
    setBusy("approve");
    setError(null);
    const result = await approveArticle(article.id, edits);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
    }
    // On success the article leaves 'draft' and the server-refreshed list
    // (via revalidatePath) naturally drops it from this page.
  }

  async function handleRegenerate() {
    setBusy("regenerate");
    setError(null);
    const result = await regenerateArticleDraft(article.id);
    setBusy(null);
    setConfirmingRegenerate(false);
    if (!result.ok) {
      setError(result.error);
    }
    // On success the page re-renders with fresh content via revalidatePath
    // + this component's key changing (id:updatedAt), which remounts it
    // with the new draft rather than showing stale local state.
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{article.title}</h2>
          <p className="text-xs text-zinc-500">{article.topic}</p>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="mt-5">
        <label className="block text-xs font-medium text-zinc-400">Content (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className={`${TEXTAREA_CLASS} font-mono`}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-400">X caption</label>
          <textarea value={captionX} onChange={(e) => setCaptionX(e.target.value)} rows={3} className={TEXTAREA_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400">Facebook caption</label>
          <textarea
            value={captionFacebook}
            onChange={(e) => setCaptionFacebook(e.target.value)}
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400">Instagram caption</label>
          <textarea
            value={captionInstagram}
            onChange={(e) => setCaptionInstagram(e.target.value)}
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400">LinkedIn caption</label>
          <textarea
            value={captionLinkedin}
            onChange={(e) => setCaptionLinkedin(e.target.value)}
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {savedAt && !error && <p className="mt-4 text-sm text-emerald-400">Saved.</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>

        {confirmingRegenerate ? (
          <span className="flex items-center gap-2 text-sm text-amber-300">
            Discard the current draft and captions and regenerate?
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy !== null}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-50"
            >
              {busy === "regenerate" ? "Regenerating…" : "Yes, regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRegenerate(false)}
              disabled={busy !== null}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRegenerate(true)}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
