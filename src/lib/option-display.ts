// Display names for configurator options, shared by every customer and agent
// surface (client-safe, no server imports).
//
// GM marks dealer- or port-installed accessories with its "LPO" code (Limited
// Production Option), usually as a "LPO, " prefix. The stored name keeps GM's
// text as received; what people see drops the code (Brett, 2026-10-17) and
// shows a "Dealer-installed" tag instead.

const LPO_PREFIX = /^LPO(?:,\s*|\s+)/;
const LPO_SUFFIX = /,\s*LPO$/;

/** True when GM's own name carries the LPO code ("LPO, …", "LPO …" or "…, LPO"). */
export function hasLpoCode(name: string): boolean {
  const n = name.trim();
  return LPO_PREFIX.test(n) || LPO_SUFFIX.test(n);
}

/** The name as shown: GM's LPO code removed, everything else unchanged. */
export function displayOptionName(name: string): string {
  const n = name.trim();
  const cleaned = n.replace(LPO_PREFIX, "").replace(LPO_SUFFIX, "").trim();
  return cleaned.length > 0 ? cleaned : n;
}

/**
 * A package's contents as shown. The import splits contents on commas, so
 * GM's "LPO, Roof rack cross rails" arrives as a bare "LPO" item followed by
 * the item itself: the bare code is dropped and each item's code removed.
 */
export function displayPackageContents(items: string[]): string[] {
  return items.filter((i) => i.trim() !== "LPO").map(displayOptionName);
}

/** The approved tag text (Brett, 2026-10-17). */
export const DEALER_INSTALLED_TAG = "Dealer-installed";
