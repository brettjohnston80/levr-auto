import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  configuratorFuelClass,
  listingPowertrainClass,
  matchConfiguratorTrim,
  type ConfiguratorChoice,
  type ConfiguratorQuestions,
  type ConfiguratorTrimCandidate,
  type MatchOutcome,
  type PowertrainClass,
} from "@/lib/configurator-matching";
import type { TrimOption } from "@/lib/finalize-trims";

// Server-side read path for the configurator question flow (step 7 of 9).
//
// Reads through the admin client because configurator_* has RLS enabled
// with zero policies (service-role only, same convention as listings and
// every other internal table here).
//
// PAGINATION IS MANDATORY, NOT DEFENSIVE. PostgREST caps a plain select at
// 1,000 rows and truncates SILENTLY -- reproduced against these exact
// tables on 2026-09-09: a bare select on configurator_options returned
// 1,000 of a real 4,855. A capped read here would not error, it would just
// quietly drop colours a customer could have picked. Every row-returning
// query in this file pages explicitly.

const PAGE_SIZE = 1000;
/** Keeps `.in()` filters to a sane URL length; unrelated to the row cap. */
const ID_CHUNK = 100;

/** A listing, reduced to only what gating needs. */
export interface GatingListing {
  trim: string | null;
  year: number | null;
  /** MarketCheck build.powertrain_type, selected as a scalar. */
  powertrain: string | null;
}

interface OptionRow {
  trim_id: string;
  category: string;
  name: string;
  availability: string;
  price_cents: number | null;
  price_is_included: boolean;
  package_name: string | null;
  package_price_cents: number | null;
  package_contents: string[] | null;
}

/**
 * A colour, interior or seating layout is a CHOICE even when it costs
 * nothing -- a car has exactly one exterior colour, and the free ones are
 * the most common answer. Excluding 'standard' there would throw away most
 * of the question. 'unavailable' is excluded everywhere: never offer what
 * the car cannot be built with.
 */
const CHOICE_AVAILABILITY = new Set(["standard", "standalone", "package_only"]);

/**
 * A FEATURE is different. 'standard' means it already comes with the car,
 * so asking "do you want it?" is a question with no consequence -- and a
 * yes recorded against it would tell an agent to go negotiate for
 * something every build already has. Features are standard-excluded.
 */
const FEATURE_AVAILABILITY = new Set(["standalone", "package_only"]);

function toChoice(row: OptionRow): ConfiguratorChoice {
  return {
    name: row.name,
    availability: row.availability as ConfiguratorChoice["availability"],
    priceCents: row.price_cents,
    priceIsIncluded: row.price_is_included,
    packageName: row.package_name,
    packagePriceCents: row.package_price_cents,
    packageContents: row.package_contents,
  };
}

/** Free/standard first, then cheapest first, then alphabetical. */
function sortChoices(a: ConfiguratorChoice, b: ConfiguratorChoice): number {
  const rank = (c: ConfiguratorChoice) => (c.availability === "standard" ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const price = (c: ConfiguratorChoice) =>
    c.packagePriceCents ?? c.priceCents ?? Number.MAX_SAFE_INTEGER;
  if (price(a) !== price(b)) return price(a) - price(b);
  return a.name.localeCompare(b.name);
}

/** Result for one inventory trim option -- questions, or why not. */
export interface TrimGatingResult {
  outcome: MatchOutcome;
  questions: ConfiguratorQuestions | null;
}

/**
 * Resolves every inventory-derived trim option for a make/model to its
 * configurator questions, where one exists.
 *
 * Returns a map keyed by TrimOption.id (`${trim}::${year}`). A trim absent
 * from the map, or present with `questions: null`, falls back to today's
 * flow completely unchanged -- which is the behaviour for all 34 makes
 * with no configurator data, and for any Toyota/Honda trim that does not
 * resolve unambiguously.
 *
 * Scoped to the LIVE batch only. With no batch promoted this returns an
 * empty map and the whole feature is inert, which is exactly the state
 * step 7 ships in: promotion is step 9.
 */
export async function getConfiguratorQuestionsForTrims(
  make: string | null,
  model: string | null,
  trimOptions: TrimOption[],
  listings: GatingListing[],
): Promise<Map<string, TrimGatingResult>> {
  const empty = new Map<string, TrimGatingResult>();
  if (!make || !model || trimOptions.length === 0) return empty;

  const admin = createAdminClient();

  const { data: batch } = await admin
    .from("configurator_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (!batch) return empty;

  // --- candidate trims for this make/model ------------------------------
  const candidates: ConfiguratorTrimCandidate[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("configurator_trims")
      .select("id, make, model, trim, model_year, fuel_type")
      .eq("batch_id", batch.id)
      .eq("make", make)
      .eq("model", model)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return empty;
    for (const r of data ?? []) {
      candidates.push({
        id: r.id as string,
        make: r.make as string,
        model: r.model as string,
        trim: r.trim as string,
        modelYear: r.model_year as number,
        fuelType: (r.fuel_type as string | null) ?? null,
      });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  if (candidates.length === 0) return empty;

  // --- powertrain classes present per trim option -----------------------
  // Keyed exactly as buildTrimOptions keys its own output, so the two
  // cannot drift apart on how a group is identified.
  const powertrainsByOption = new Map<string, Set<PowertrainClass>>();
  for (const l of listings) {
    if (!l.trim) continue;
    const key = `${l.trim}::${l.year ?? "unknown"}`;
    const set = powertrainsByOption.get(key) ?? new Set<PowertrainClass>();
    set.add(listingPowertrainClass(l.powertrain));
    powertrainsByOption.set(key, set);
  }

  // --- match each option ------------------------------------------------
  const results = new Map<string, TrimGatingResult>();
  const matchedTrimIds = new Set<string>();
  for (const option of trimOptions) {
    const outcome = matchConfiguratorTrim(candidates, {
      trim: option.trim,
      year: option.year,
      powertrains: [...(powertrainsByOption.get(option.id) ?? [])],
    });
    results.set(option.id, { outcome, questions: null });
    if (outcome.matched) matchedTrimIds.add(outcome.configuratorTrimId);
  }
  if (matchedTrimIds.size === 0) return results;

  // --- options for every matched trim -----------------------------------
  const ids = [...matchedTrimIds];
  const optionRows: OptionRow[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from("configurator_options")
        .select(
          "id, trim_id, category, name, availability, price_cents, price_is_included, package_name, package_price_cents, package_contents",
        )
        .in("trim_id", chunk)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return results;
      optionRows.push(...((data ?? []) as unknown as OptionRow[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  const byTrim = new Map<string, OptionRow[]>();
  for (const r of optionRows) {
    const list = byTrim.get(r.trim_id) ?? [];
    list.push(r);
    byTrim.set(r.trim_id, list);
  }

  const build = (trimId: string): ConfiguratorQuestions => {
    const rows = byTrim.get(trimId) ?? [];
    const pick = (category: string, allowed: Set<string>) =>
      rows
        .filter((r) => r.category === category && allowed.has(r.availability))
        .map(toChoice)
        .sort(sortChoices);

    // A colour/interior/seating question needs a real CHOICE -- offering a
    // single option is not a question, it is a statement. A feature list
    // needs only one obtainable item to be worth asking about.
    const atLeastTwo = (list: ConfiguratorChoice[]) => (list.length > 1 ? list : []);

    return {
      configuratorTrimId: trimId,
      exteriorColor: atLeastTwo(pick("exterior_color", CHOICE_AVAILABILITY)),
      interior: atLeastTwo(pick("interior", CHOICE_AVAILABILITY)),
      seating: atLeastTwo(pick("seating", CHOICE_AVAILABILITY)),
      features: pick("feature", FEATURE_AVAILABILITY),
    };
  };

  for (const [optionId, result] of results) {
    if (result.outcome.matched) {
      results.set(optionId, {
        outcome: result.outcome,
        questions: build(result.outcome.configuratorTrimId),
      });
    }
  }
  return results;
}

/** Re-exported so callers need only one import for the common case. */
export { configuratorFuelClass };
