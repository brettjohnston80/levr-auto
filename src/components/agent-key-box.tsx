"use client";

import { useState } from "react";

/**
 * The authenticator key, grouped in fours so it's easy to read and type, with a
 * copy button. On a phone the agent usually can't scan a QR code on the same
 * screen, so this is how they set up. The button copies the key WITHOUT the
 * spaces, which every authenticator app accepts.
 */
export function AgentKeyBox({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const grouped = secret.replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") ?? secret;
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (some in-app browsers): the key stays selectable to copy by hand.
    }
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <code
        aria-label="Authenticator key"
        className="min-w-0 flex-1 rounded bg-zinc-100 px-2 py-2 font-mono text-base tracking-wider break-words select-all"
      >
        {grouped}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
      >
        {copied ? "Copied" : "Copy key"}
      </button>
    </div>
  );
}
