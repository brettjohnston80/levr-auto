import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The zero-inventory block (model-year redesign, Step 5, 2026-09-14).
 *
 * A paid search whose committed vehicle has nothing to search for must not
 * be finalized -- by the customer OR by an agent. Finalizing starts the
 * 24h window, then solidification, then the Day-30 guarantee clock, all
 * against a commitment nobody can act on. Two triggers, each with its own
 * customer message:
 *
 *   - "year":  the make/model has listings, but none for the committed
 *              year (other years are available -- change the year).
 *   - "model": the make/model has no listings in ANY year (a sync that
 *              never landed, or a genuine MarketCheck gap/outage).
 *
 * "Listings" means exactly what the /finalize trim list is built from:
 * rows for the make/model with a non-null trim. The block and the trim
 * list therefore can never disagree about whether there is anything to
 * pick.
 */

/**
 * ⚠ MASTER OFF-SWITCH FOR THE ZERO-INVENTORY BLOCK. Currently DISABLED.
 *
 * WHY IT IS OFF (2026-09-14): NOT a code problem. The MarketCheck monthly
 * API quota is exhausted -- every sync call returns 429 "Monthly API quota
 * exhausted" -- so no new make/model can acquire listings. With the block
 * on, every customer committing to a model that is not already synced (all
 * but 6 today) would be blocked with no way forward. Built and verified
 * with this set to true locally; shipped false.
 *
 * ⚠ FLIPPING THIS ON REQUIRES CONFIRMING THE QUOTA HAS RECOVERED FIRST --
 * a real sync call succeeding, not an assumption from the calendar. It is a
 * conscious risk decision, like the image switches, and must never be
 * recorded as "resolved" merely because the switch was flipped.
 *
 * Gated at the data layer: every loader below returns "not blocked" while
 * this is false, so no caller can apply the block by accident and the
 * product behaves exactly as it did before Step 5.
 */
export const MODEL_YEAR_INVENTORY_BLOCK_ENABLED = false;

export type InventoryBlock =
  | { kind: "year"; committedYear: number; otherYears: number[] }
  | { kind: "model" };

/**
 * Pure decision from the model years of a make/model's listings. Shared by
 * the /finalize page (which already has those listings loaded) and every
 * server action (which loads them), so the two can never reach different
 * answers for the same search.
 *
 * A null committed year (a search predating the required year) can only
 * trip the whole-model trigger: there is no year to be missing.
 */
export function computeInventoryBlock(
  listingYears: (number | null | undefined)[],
  committedYear: number | null,
): InventoryBlock | null {
  if (listingYears.length === 0) return { kind: "model" };
  if (committedYear == null) return null;
  if (listingYears.some((y) => y === committedYear)) return null;
  const otherYears = [...new Set(listingYears.filter((y): y is number => y != null))].sort(
    (a, b) => a - b,
  );
  // Listings exist but none carry a year at all: there is no other year to
  // offer, so the honest message is the whole-model one.
  if (otherYears.length === 0) return { kind: "model" };
  return { kind: "year", committedYear, otherYears };
}

const PAGE_SIZE = 1000;

/**
 * Model years of every trimmed listing for a make/model. Paginated --
 * PostgREST truncates a plain select at 1,000 rows silently, and a capped
 * read here could miss the one year that makes a search unblocked.
 */
export async function loadListingYears(make: string, model: string): Promise<(number | null)[]> {
  const admin = createAdminClient();
  const years: (number | null)[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("listings")
      .select("id, year")
      .eq("make", make)
      .eq("model", model)
      .not("trim", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`loadListingYears: ${error.message}`);
    years.push(...(data ?? []).map((r) => (r.year as number | null) ?? null));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return years;
}

/** Server-side gate for actions. Always null while the switch is off. */
export async function loadInventoryBlock(
  make: string | null,
  model: string | null,
  committedYear: number | null,
): Promise<InventoryBlock | null> {
  if (!MODEL_YEAR_INVENTORY_BLOCK_ENABLED) return null;
  if (!make || !model) return null;
  return computeInventoryBlock(await loadListingYears(make, model), committedYear);
}
