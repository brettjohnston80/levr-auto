"use client";

import { useState } from "react";
import type { DraftSocialPost } from "@/lib/social-queue";
import { updateSocialPostDraft, approveSocialPost, regenerateSocialPost, attachSocialPostImage } from "@/lib/social-actions";
import { ImageAttachField } from "@/components/image-attach-field";

const TEXTAREA_CLASS = "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white";

const THEME_LABELS: Record<string, string> = {
  spotlight_monday: "Spotlight Monday",
  ask_around_tuesday: "Ask-Around Tuesday",
  customer_testimonial: "Customer Testimonial",
  throwback_thursday: "Throwback Thursday",
  deal_of_the_week: "Deal of the Week",
  news_recap_saturday: "News Recap Saturday",
  sunday_question: "Sunday Question",
};

function formatWeekOf(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function SocialPostReviewForm({ post }: { post: DraftSocialPost }) {
  const [captionX, setCaptionX] = useState(post.captionX);
  const [captionFacebook, setCaptionFacebook] = useState(post.captionFacebook);
  const [captionInstagram, setCaptionInstagram] = useState(post.captionInstagram);
  const [captionLinkedin, setCaptionLinkedin] = useState(post.captionLinkedin ?? "");

  const [busy, setBusy] = useState<"save" | "approve" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const hasLinkedin = post.applicablePlatforms.includes("linkedin");
  const edits = {
    captionX,
    captionFacebook,
    captionInstagram,
    captionLinkedin: hasLinkedin ? captionLinkedin : null,
  };

  async function handleSave() {
    setBusy("save");
    setError(null);
    const result = await updateSocialPostDraft(post.id, edits);
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
    const result = await approveSocialPost(post.id, edits);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
    }
    // On success the post leaves 'draft' and the server-refreshed list
    // (via revalidatePath) naturally drops it from this page.
  }

  async function handleRegenerate() {
    setBusy("regenerate");
    setError(null);
    const result = await regenerateSocialPost(post.id);
    setBusy(null);
    setConfirmingRegenerate(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{THEME_LABELS[post.theme] ?? post.theme}</h2>
          <p className="text-xs text-zinc-500">Week of {formatWeekOf(post.weekStart)}</p>
        </div>
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
        {hasLinkedin ? (
          <div>
            <label className="block text-xs font-medium text-zinc-400">LinkedIn caption</label>
            <textarea
              value={captionLinkedin}
              onChange={(e) => setCaptionLinkedin(e.target.value)}
              rows={3}
              className={TEXTAREA_CLASS}
            />
          </div>
        ) : (
          <div className="flex items-center text-xs text-zinc-600">No LinkedIn slot — this theme falls on a weekend.</div>
        )}
      </div>

      <div className="mt-5">
        <ImageAttachField
          imageUrl={post.imageUrl}
          onUpload={async (file) => {
            const fd = new FormData();
            fd.set("image", file);
            return attachSocialPostImage(post.id, fd);
          }}
        />
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
            Discard the current captions and regenerate?
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
