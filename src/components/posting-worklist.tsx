"use client";

import { useState } from "react";
import type { WorklistItem } from "@/lib/social-queue";
import { markPlatformPosted } from "@/lib/social-actions";

const PLATFORM_LABELS: Record<string, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

const THEME_LABELS: Record<string, string> = {
  spotlight_monday: "Spotlight Monday",
  ask_around_tuesday: "Ask-Around Tuesday",
  customer_testimonial: "Customer Testimonial",
  throwback_thursday: "Throwback Thursday",
  deal_of_the_week: "Deal of the Week",
  news_recap_saturday: "News Recap Saturday",
  sunday_question: "Sunday Question",
};

function itemLabel(item: WorklistItem): string {
  return item.sourceType === "article" ? item.label : (THEME_LABELS[item.label] ?? item.label);
}

/** Read-only manual copy-paste worklist, except for the "Mark posted" action per item. */
export function PostingWorklist({ items }: { items: WorklistItem[] }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleMarkPosted(item: WorklistItem) {
    const key = `${item.sourceType}:${item.sourceId}:${item.platform}`;
    setBusyKey(key);
    setErrors((prev) => ({ ...prev, [key]: "" }));

    const result = await markPlatformPosted(item.sourceType, item.sourceId, item.platform);
    setBusyKey(null);

    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [key]: result.error }));
    }
    // On success, revalidatePath refreshes this page's server data and the
    // item naturally drops off the list.
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing approved and due right now.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const key = `${item.sourceType}:${item.sourceId}:${item.platform}`;
        return (
          <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">
                  {PLATFORM_LABELS[item.platform] ?? item.platform} — due{" "}
                  {new Date(item.scheduledAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Chicago",
                  })}{" "}
                  Central
                </p>
                <p className="mt-1 text-sm font-medium text-white">{itemLabel(item)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.captionText}</p>
              </div>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic Storage URL
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-md border border-white/10 object-cover"
                />
              )}
            </div>

            {errors[key] && <p className="mt-2 text-sm text-red-400">{errors[key]}</p>}

            <button
              type="button"
              onClick={() => handleMarkPosted(item)}
              disabled={busyKey === key}
              className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busyKey === key ? "Marking…" : "Mark posted"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
