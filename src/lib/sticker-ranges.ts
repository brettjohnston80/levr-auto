import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { liveConfiguratorBatchId } from "./configurator-live";
import { maxFactoryOptionsCents, normalizeTrim, type OptionForMax, type StickerRange } from "./sticker-check";

type Admin = ReturnType<typeof createAdminClient>;

export function stickerRangeKey(make: string, model: string, modelYear: number | null): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${modelYear ?? ""}`;
}

/**
 * The expected sticker range for each trim of each vehicle (Brett,
 * 2026-10-17), for the Log Offer sticker warning. Base + destination comes
 * from the live Matchmaker dataset (true_starting_price_cents); the top of the
 * range adds every factory option the live configurator batch prices. A
 * vehicle with no model year, or no dataset rows, gets no ranges (and so no
 * warning from our data; the listing check still applies).
 */
export async function getStickerRanges(
  admin: Admin,
  vehicles: { make: string; model: string; modelYear: number | null }[],
): Promise<Map<string, StickerRange[]>> {
  const out = new Map<string, StickerRange[]>();
  const wanted = new Map<string, { make: string; model: string; modelYear: number }>();
  for (const v of vehicles) {
    if (v.modelYear == null) continue;
    wanted.set(stickerRangeKey(v.make, v.model, v.modelYear), { make: v.make, model: v.model, modelYear: v.modelYear });
  }
  if (wanted.size === 0) return out;

  const { data: batch } = await admin.from("vehicle_dataset_batches").select("id").eq("is_live", true).maybeSingle();
  if (!batch) return out;

  for (const [key, v] of wanted) {
    const { data: rows, error } = await admin
      .from("vehicles")
      .select("trim, true_starting_price_cents")
      .eq("dataset_batch_id", batch.id)
      .ilike("make", v.make)
      .ilike("model", v.model)
      .eq("model_year", v.modelYear);
    if (error || !rows || rows.length === 0) continue;

    const base = new Map<string, { trim: string; low: number; high: number }>();
    for (const r of rows) {
      const price = r.true_starting_price_cents as number | null;
      if (!price) continue;
      const t = normalizeTrim(r.trim as string);
      const cur = base.get(t);
      if (cur) {
        cur.low = Math.min(cur.low, price);
        cur.high = Math.max(cur.high, price);
      } else base.set(t, { trim: r.trim as string, low: price, high: price });
    }

    // Factory options from the make's live configurator batch, dearest
    // build per trim name.
    const optionsMax = new Map<string, number>();
    const batchId = await liveConfiguratorBatchId(admin, v.make);
    if (batchId) {
      const { data: trims } = await admin
        .from("configurator_trims")
        .select("id, trim")
        .eq("batch_id", batchId)
        .ilike("make", v.make)
        .ilike("model", v.model)
        .eq("model_year", v.modelYear);
      const ids = (trims ?? []).map((t) => t.id as string);
      const byTrim = new Map<string, OptionForMax[]>();
      for (let i = 0; i < ids.length; i += 100) {
        for (let from = 0; ; from += 1000) {
          const { data: opts, error: oe } = await admin
            .from("configurator_options")
            .select("trim_id, category, availability, price_cents, package_name, package_price_cents, dealer_installed")
            .in("trim_id", ids.slice(i, i + 100))
            .order("id")
            .range(from, from + 999);
          if (oe || !opts) break;
          for (const o of opts) {
            const list = byTrim.get(o.trim_id as string) ?? [];
            list.push({
              category: o.category as string,
              availability: o.availability as string,
              priceCents: (o.price_cents as number | null) ?? null,
              packageName: (o.package_name as string | null) ?? null,
              packagePriceCents: (o.package_price_cents as number | null) ?? null,
              dealerInstalled: Boolean(o.dealer_installed),
            });
            byTrim.set(o.trim_id as string, list);
          }
          if (opts.length < 1000) break;
        }
      }
      for (const t of trims ?? []) {
        const n = normalizeTrim(t.trim as string);
        optionsMax.set(n, Math.max(optionsMax.get(n) ?? 0, maxFactoryOptionsCents(byTrim.get(t.id as string) ?? [])));
      }
    }

    out.set(
      key,
      [...base.entries()].map(([n, b]) => ({ trim: b.trim, lowCents: b.low, highCents: b.high + (optionsMax.get(n) ?? 0) })),
    );
  }
  return out;
}
