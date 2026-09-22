import "server-only";
import { resolveColorImages } from "@/lib/vehicle-color-images";
import { resolveFeatureImages } from "@/lib/vehicle-feature-images";
import { resolveColorSwatches } from "@/lib/vehicle-color-swatches";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHOICE_AVAILABILITY,
  configuratorFuelClass,
  listingPowertrainClass,
  matchConfiguratorTrim,
  sortChoices,
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

// CHOICE_AVAILABILITY now lives in configurator-matching.ts (2026-09-16) --
// see its own comment there for why: the ranked-trim-union redesign needs
// the identical rule shared with a client component, which cannot import
// this file at all (`server-only` above). The single-trim
// `categoryHasRealChoice` this file used to export is gone with it --
// finalize-actions.ts's write-time engagement gate now uses
// `categoryHasRealChoiceAcrossTrims` instead, fed the union of rows across
// every trim the customer ranked, not just one.

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

// sortChoices now lives in configurator-matching.ts (2026-09-16) -- the
// model-wide union display (finalize-self-service.tsx) needs the identical
// ordering rule for its rankable/auto-excluded lists, and that's a client
// component this `server-only` file can never be imported from.

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
  // Keyed separately from `candidates` rather than widening
  // ConfiguratorTrimCandidate itself -- body_style has nothing to do with
  // matchConfiguratorTrim's own matching logic (trim string/year/
  // powertrain only), it's purely for resolveWheelImage's defensive check
  // once a trim is already resolved, so it doesn't belong on the type
  // every matching function receives.
  const bodyStyleById = new Map<string, string | null>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("configurator_trims")
      .select("id, make, model, trim, model_year, fuel_type, body_style")
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
      bodyStyleById.set(r.id as string, (r.body_style as string | null) ?? null);
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

  const build = (trimId: string): ConfiguratorQuestions =>
    buildConfiguratorQuestions(trimId, byTrim.get(trimId) ?? [], make, model, bodyStyleById.get(trimId) ?? null);

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

/**
 * Assembles one trim's full ConfiguratorQuestions from its already-fetched
 * option rows. Factored out of getConfiguratorQuestionsForTrims's own
 * `build()` closure (2026-09-18) so getConfiguratorQuestionsForResolvedTrimIds
 * below can produce byte-identical results from a different entry point --
 * two independent copies of this ~50-line assembly could too easily drift
 * on some future rule change (a new category, a new gating tweak) that only
 * gets applied to one of them.
 */
function buildConfiguratorQuestions(
  trimId: string,
  rows: OptionRow[],
  make: string,
  model: string,
  bodyStyle: string | null,
): ConfiguratorQuestions {
  const pick = (category: string, allowed: Set<string>) => {
    const choices = rows
      .filter((r) => r.category === category && allowed.has(r.availability))
      .map(toChoice)
      .sort(sortChoices);
    // Photos come from two independent pipelines, each behind its own
    // switch: colours (exterior, interior) and features. Seating is a
    // layout with nothing worth photographing.
    const names = choices.map((c) => c.name);
    const isColorCategory = category === "exterior_color" || category === "interior";
    const images = isColorCategory
      ? resolveColorImages(make, model, category, names)
      : category === "feature"
        ? resolveFeatureImages(make, model, names)
        : null;
    // Swatches ride on the SAME switch as the colour photos (no separate
    // toggle) and are additive alongside them, never a replacement --
    // only ever populated for the same two categories the photos cover.
    const swatches = isColorCategory ? resolveColorSwatches(make, model, category, names) : null;
    if (!images && !swatches) return choices;
    return choices.map((c) => ({
      ...c,
      imageUrl: images ? (images[c.name] ?? null) : c.imageUrl,
      swatch: swatches ? (swatches[c.name] ?? null) : c.swatch,
    }));
  };

  // A colour/interior/seating question needs a real CHOICE -- offering a
  // single option is not a question, it is a statement. A feature list
  // needs only one obtainable item to be worth asking about.
  const atLeastTwo = (list: ConfiguratorChoice[]) => (list.length > 1 ? list : []);

  // RAW computed first, gated derived from it (2026-09-16) -- this trim's
  // own real availability data must not be thrown away just because THIS
  // trim alone doesn't clear the atLeastTwo bar. A trim with exactly one
  // real interior colour (Nightshade: "Black SofTex/fabric mixed media
  // trim") genuinely offers that colour -- atLeastTwo correctly keeps it
  // out of ITS OWN customer-facing question, but the ranked-trim-union
  // redesign (2026-09-16) needs to know it's available on Nightshade
  // regardless, once Nightshade is ranked alongside another trim whose
  // own count clears the bar. The gated fields below are exactly what
  // atLeastTwo(raw) already computed before this change -- unchanged,
  // still what a single resolved trim's own question set shows.
  const exteriorColorRaw = pick("exterior_color", CHOICE_AVAILABILITY);
  const interiorRaw = pick("interior", CHOICE_AVAILABILITY);
  const seatingRaw = pick("seating", CHOICE_AVAILABILITY);
  // Names only -- combination preferences (2026-09-17) needs to know
  // which features this trim already includes by default, to tell that
  // apart from genuinely unbuildable. rows here never went through
  // FEATURE_AVAILABILITY, so this is a separate pick() call, not a slice
  // of `features` below.
  const featuresStandard = [
    ...new Set(
      rows.filter((r) => r.category === "feature" && r.availability === "standard").map((r) => r.name),
    ),
  ];
  // wheels/roof/drivetrain (2026-09-19, trim comparison view) -- same
  // CHOICE_AVAILABILITY filter as exteriorColorRaw/interiorRaw/
  // seatingRaw, no atLeastTwo gate (nothing asks a question about
  // these), no separate *Standard split (nothing here is ever ranked or
  // refused, so there's no want/exclude distinction to preserve). See
  // ConfiguratorQuestions' own comment on these three fields for the
  // real per-category data shape this was built against.
  const wheels = pick("wheels", CHOICE_AVAILABILITY);
  const roof = pick("roof", CHOICE_AVAILABILITY);
  const drivetrain = pick("drivetrain", CHOICE_AVAILABILITY);

  return {
    configuratorTrimId: trimId,
    bodyStyle,
    exteriorColor: atLeastTwo(exteriorColorRaw),
    interior: atLeastTwo(interiorRaw),
    seating: atLeastTwo(seatingRaw),
    // Features never had an atLeastTwo gate -- pick("feature", ...) was
    // already this trim's raw, ungated list, so exposing it a second
    // time under a Raw name would only invite the two to drift apart.
    features: pick("feature", FEATURE_AVAILABILITY),
    exteriorColorRaw,
    interiorRaw,
    seatingRaw,
    featuresStandard,
    wheels,
    roof,
    drivetrain,
  };
}

/**
 * Real specs for a set of ALREADY-RESOLVED configurator trims --
 * search_trim_preferences.configurator_trim_id persists exactly which
 * researched build each ranked trim resolved to at finalize time, so this
 * skips straight to fetching real options for those known ids. No
 * candidate matching against inventory trim strings/powertrains (that's
 * what getConfiguratorQuestionsForTrims above is for, when the caller only
 * has raw inventory data to start from) -- the identity question was
 * already answered once, at finalize time, and is not re-asked here.
 *
 * Used by getVehicleDetails (customer-dashboard.ts) to show real prices/
 * package contents on /account/vehicle once a search has been finalized.
 */
export async function getConfiguratorQuestionsForResolvedTrimIds(
  trimIds: string[],
  make: string,
  model: string,
): Promise<Record<string, ConfiguratorQuestions>> {
  const result: Record<string, ConfiguratorQuestions> = {};
  if (trimIds.length === 0) return result;

  const admin = createAdminClient();
  const optionRows: OptionRow[] = [];
  for (let i = 0; i < trimIds.length; i += ID_CHUNK) {
    const chunk = trimIds.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from("configurator_options")
        .select(
          "id, trim_id, category, name, availability, price_cents, price_is_included, package_name, package_price_cents, package_contents",
        )
        .in("trim_id", chunk)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return result;
      optionRows.push(...((data ?? []) as unknown as OptionRow[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  // body_style, fetched alongside options rather than folded into
  // matching data -- this entry point never runs matchConfiguratorTrim
  // (its ids are already resolved), so there's no ConfiguratorTrimCandidate
  // to piggyback on here either way. Small, un-paginated `.in()` is safe:
  // trimIds is a customer's own ranked-trim set, never near PostgREST's
  // 1,000-row cap.
  const bodyStyleById = new Map<string, string | null>();
  for (let i = 0; i < trimIds.length; i += ID_CHUNK) {
    const chunk = trimIds.slice(i, i + ID_CHUNK);
    const { data } = await admin.from("configurator_trims").select("id, body_style").in("id", chunk);
    for (const r of data ?? []) {
      bodyStyleById.set(r.id as string, (r.body_style as string | null) ?? null);
    }
  }

  const byTrim = new Map<string, OptionRow[]>();
  for (const r of optionRows) {
    const list = byTrim.get(r.trim_id) ?? [];
    list.push(r);
    byTrim.set(r.trim_id, list);
  }

  for (const trimId of trimIds) {
    result[trimId] = buildConfiguratorQuestions(
      trimId,
      byTrim.get(trimId) ?? [],
      make,
      model,
      bodyStyleById.get(trimId) ?? null,
    );
  }
  return result;
}

/** Re-exported so callers need only one import for the common case. */
export { configuratorFuelClass };
