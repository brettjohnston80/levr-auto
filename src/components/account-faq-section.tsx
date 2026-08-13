"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "support@levrauto.com";

export function AccountFaqSection({ customerEmail }: { customerEmail: string }) {
  const [expanded, setExpanded] = useState(false);

  const subject = "Request to change my search";
  const body = [
    "Hi LEVR,",
    "",
    "I'd like to change my search.",
    "",
    "Current make/model:",
    "New make/model I'd like instead:",
    "",
    `Account email: ${customerEmail}`,
  ].join("\n");

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold text-white">Need to change your search?</h2>
        <span className="text-zinc-400">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 text-sm text-zinc-400">
          <p>
            Switching to a different make/model is handled by your LEVR agent, not self-service — it
            closes out your current search and starts a fresh 30-day guarantee window on the new
            vehicle (a $100 fee applies).
          </p>
          <p>Email us and we&apos;ll take care of it:</p>
          <a
            href={mailtoHref}
            className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
          >
            Email LEVR to request a change
          </a>
        </div>
      )}
    </div>
  );
}
