"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrimOption } from "@/lib/finalize-trims";
import type { ConfiguratorQuestions } from "@/lib/configurator-matching";
import type { FinalizeInitial } from "@/lib/finalize-initial";
import { EDIT_WINDOW_MS, formatRemaining } from "@/lib/edit-window";
import { FinalizeSelfService } from "@/components/finalize-self-service";

/**
 * Your Car during the 24h window after finalizing (Brett's walkthrough,
 * 2026-10-10): the countdown and a "Make changes" button that reopens the
 * same finalize flow, pre-filled with the saved answers. Customers look in
 * Your Car for anything about their vehicle, so the change option lives
 * here as well as on /account. `children` is the read-only spec view,
 * hidden while editing.
 */
export function FinalizeWindowEdit({
  searchId,
  finalizedAt,
  make,
  model,
  modelYear,
  trimOptions,
  configuratorQuestions,
  initial,
  openOnLoad,
  children,
}: {
  searchId: string;
  finalizedAt: string;
  make: string;
  model: string;
  modelYear: number | null;
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  initial: FinalizeInitial;
  /** ?edit=1 -- arriving from /account's "Make changes". */
  openOnLoad: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const deadline = new Date(finalizedAt).getTime() + EDIT_WINDOW_MS;
  const [now, setNow] = useState<number>(() => Date.now());
  const [editing, setEditing] = useState(openOnLoad);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = deadline - now;
  const windowOpen = remainingMs > 0;

  if (editing && windowOpen) {
    return (
      <FinalizeSelfService
        searchId={searchId}
        make={make}
        model={model}
        trimOptions={trimOptions}
        configuratorQuestions={configuratorQuestions}
        modelYear={modelYear}
        initial={initial}
        onCancel={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <span className={`text-sm font-medium ${windowOpen ? "text-emerald-300" : "text-zinc-500"}`}>
          {formatRemaining(remainingMs)}
        </span>
        {windowOpen && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Make changes
          </button>
        )}
      </div>
      {children}
    </>
  );
}
