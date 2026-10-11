"use client";

import { useState } from "react";
import { refreshSearchInventory } from "@/lib/outreach-actions";

const REFRESH_LIMIT_MS = 24 * 3_600_000;

// Fixed time zone so the server render and the browser agree.
function formatCentral(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT"
  );
}

/**
 * Agent-only. Shows when this make/model's inventory was last pulled from
 * MarketCheck and lets an agent refresh it, at most once per model per day
 * (enforced on the server; see refreshSearchInventory).
 */
export function RefreshInventoryButton({
  searchId,
  lastSyncedAt,
}: {
  searchId: string;
  lastSyncedAt: string | null;
}) {
  const [synced, setSynced] = useState(lastSyncedAt);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const res = await refreshSearchInventory(searchId);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSynced(res.lastSyncedAt);
    setMessage(
      res.refreshed
        ? `Refreshed — ${res.upserted} listings updated.`
        : `Already refreshed in the last day. Next refresh available ${formatCentral(
            new Date(new Date(res.lastSyncedAt).getTime() + REFRESH_LIMIT_MS).toISOString(),
          )}.`,
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      <span>{synced ? `Inventory last refreshed ${formatCentral(synced)}` : "Inventory not refreshed yet"}</span>
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
      >
        {submitting ? "Refreshing…" : "Refresh inventory"}
      </button>
      {message && <span className="text-zinc-400">{message}</span>}
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
