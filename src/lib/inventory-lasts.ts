import "server-only";
import { createAdminClient } from "./supabase/admin";
import { whileInventoryLasts } from "./guarantee-exceptions";

/**
 * While inventory lasts (GX-2; data/while-inventory-lasts.json): a listed make, model or model
 * year is offered only while `listings` holds at least one car for it. Returns a filter for a
 * list of vehicle rows. Unlisted rows always pass; one count query per listed make/model/year in
 * the input, so it stays cheap. Intake runs it per request, Matchmaker at build.
 */
export async function whileInventoryLastsFilter<T extends { make: string | null; model: string | null }>(
  rows: T[],
  yearOf: (row: T) => number | null,
): Promise<(row: T) => boolean> {
  const keys = new Map<string, { make: string; model: string; year: number | null; byYear: boolean }>();
  for (const r of rows) {
    if (!r.make || !r.model) continue;
    const entry = whileInventoryLasts(r.make, r.model, yearOf(r));
    if (!entry) continue;
    const byYear = Boolean(entry.model_year);
    const year = byYear ? yearOf(r) : null;
    keys.set(`${r.make}|${r.model}|${year ?? "*"}`, { make: r.make, model: r.model, year, byYear });
  }
  if (keys.size === 0) return () => true;
  const admin = createAdminClient();
  const inStock = new Set<string>();
  await Promise.all(
    [...keys.entries()].map(async ([k, v]) => {
      let q = admin.from("listings").select("id", { count: "exact", head: true }).eq("make", v.make).eq("model", v.model);
      if (v.byYear && v.year != null) q = q.eq("year", v.year);
      const { count, error } = await q;
      // A failed count keeps the vehicle offered rather than hiding it on a glitch.
      if (error || (count ?? 0) > 0) inStock.add(k);
    }),
  );
  return (r) => {
    if (!r.make || !r.model) return true;
    const entry = whileInventoryLasts(r.make, r.model, yearOf(r));
    if (!entry) return true;
    const year = entry.model_year ? yearOf(r) : null;
    return inStock.has(`${r.make}|${r.model}|${year ?? "*"}`);
  };
}
