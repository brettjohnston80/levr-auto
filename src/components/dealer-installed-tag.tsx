import { DEALER_INSTALLED_TAG } from "@/lib/option-display";

/**
 * The "Dealer-installed" tag (wording approved by Brett, 2026-10-17), shown
 * next to any option or package installed by the dealer/port rather than
 * the factory. One component for customer and agent views so the two can't
 * drift.
 */
export function DealerInstalledTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded border border-sky-400/40 bg-sky-400/10 px-1.5 py-px text-[10px] font-medium leading-4 text-sky-300 ${className}`}
    >
      {DEALER_INSTALLED_TAG}
    </span>
  );
}
