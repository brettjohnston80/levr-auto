"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfiguratorSelection, TrimPreference } from "@/lib/configurator-matching";
import { normalizeRanked, statesAnOpinion } from "@/lib/ranked-list";
import { isOfferedModelYear } from "@/lib/intake-vehicle-options";
import { loadInventoryBlock } from "@/lib/inventory-block";
import { inventoryBlockCopy } from "@/lib/inventory-block-copy";
import { syncListingsForMakeModel } from "@/lib/marketcheck-sync";

export type FinalizeResult = { ok: true } | { ok: false; error: string };

async function getOwnedAwaitingFinalizationSearch(searchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not signed in." };
  }

  const { data: search, error } = await supabase
    .from("customer_searches")
    .select("id, search_status, make, model, model_year")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !search) {
    return { ok: false as const, error: "That search doesn't exist." };
  }
  if (search.search_status !== "awaiting_finalization") {
    return { ok: false as const, error: "This search has already been finalized." };
  }

  return {
    ok: true as const,
    make: (search.make as string | null) ?? null,
    model: (search.model as string | null) ?? null,
    modelYear: (search.model_year as number | null) ?? null,
  };
}

/**
 * Server-side half of the zero-inventory block for the customer's own
 * actions. The /finalize screen never offers either action while blocked,
 * so this is only reached from a tab left open while inventory changed
 * underneath it -- which is exactly why a UI-only block is not enough.
 * Null (no refusal) whenever the switch is off.
 */
async function customerInventoryRefusal(check: {
  make: string | null;
  model: string | null;
  modelYear: number | null;
}): Promise<string | null> {
  const block = await loadInventoryBlock(check.make, check.model, check.modelYear);
  return block ? inventoryBlockCopy(block, check.make ?? "", check.model ?? "").heading : null;
}

/**
 * Customer chooses the call path on /finalize -- just marks the intent so
 * an agent can follow up manually (surfaces in /internal/outreach, see
 * getFinalizationQueue in outreach-queue.ts). No real calendar/scheduling
 * integration yet, deliberately (see roadmap "Call scheduling" note) -- a
 * human reaches out the same way outreach and switching already work.
 */
export async function requestFinalizationCall(searchId: string): Promise<FinalizeResult> {
  const check = await getOwnedAwaitingFinalizationSearch(searchId);
  if (!check.ok) return check;

  // A blocked search is not offered a call (an agent cannot finalize it
  // either), and a stale tab must not be able to request one anyway.
  const refusal = await customerInventoryRefusal(check);
  if (refusal) return { ok: false, error: refusal };

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_searches")
    .update({ call_requested_at: new Date().toISOString() })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization")
    .is("call_requested_at", null);

  if (error) {
    return { ok: false, error: `Failed to request a call: ${error.message}` };
  }

  revalidatePath(`/finalize/${searchId}`);
  revalidatePath("/internal/outreach");
  return { ok: true };
}

/**
 * The two states in which the customer's vehicle can still be corrected
 * for free: paid but not yet finalized (/finalize), and finalized but
 * still inside the 24h refinement window (/account).
 *
 * What actually unites them is not the status names -- it is that
 * solidified_at is still unset, i.e. THE SEARCH HAS NOT STARTED. No agent
 * has made a call, no dealer has been contacted, nothing has been
 * negotiated. Both conditions are always checked together; the status list
 * alone would be a weaker rule that happens to be equivalent today.
 */
const VEHICLE_EDITABLE_STATUSES = ["awaiting_finalization", "pending_refinement"] as const;

/** Same wording whether the read guard or the write-race guard rejects. */
const SEARCH_ALREADY_STARTED =
  "Your search has already started, so the vehicle can\u2019t be changed here. Use \u201cSwitch it myself\u201d from your account instead.";

/**
 * Corrects the make/model on a search that has not started yet, in place
 * and free of charge. Shared by /finalize and /account's 24h edit form --
 * one implementation, so the two surfaces cannot drift on what is allowed.
 *
 * THIS IS NOT A SWITCH, AND THE DISTINCTION IS THE WHOLE DESIGN. A switch
 * changes the vehicle on a search that is already RUNNING -- solidified,
 * with agents doing real dealer outreach against it -- so it costs $100,
 * supersedes the old row, resets the guarantee clocks and consumes the one
 * free-switch allowance. None of that has happened here: nothing has been
 * searched for, and no agent has spent a minute on the old vehicle.
 * Charging for a correction at that point would be charging for nothing.
 *
 * SO THIS DELIBERATELY TOUCHES NONE OF THE SWITCH MACHINERY. It does not
 * call switch_customer_search, does not create a superseding row, does not
 * write superseded_by_id / pending_switch_make / pending_switch_model /
 * switch_requested_at, and above all NEVER writes
 * customers.free_switch_used_at -- a customer who corrects a typo here
 * must still have their real free switch available later, when it
 * actually costs the business something.
 *
 * ONCE SOLIDIFIED, THE ONLY ROUTE TO A DIFFERENT VEHICLE IS THE PAID
 * SWITCH FLOW. That boundary is enforced here rather than by the calling
 * page, because both surfaces are reachable from a tab left open while the
 * hourly solidify cron runs underneath them.
 */
/**
 * MODEL YEAR IS THE THIRD FIELD, NOT A SEPARATE ACTION (2026-09-14). A
 * different year is a different car -- different trims, different
 * inventory, different packages -- so a year-only change invalidates
 * exactly what a make/model change does, and runs through exactly the same
 * guards. A second action would have duplicated the solidified_at
 * write-race guard, which is the part most likely to drift. Same boundary
 * too: free before solidification, the paid switch after.
 */
export async function updateSearchVehicle(
  searchId: string,
  make: string,
  model: string,
  modelYear: number | null,
): Promise<FinalizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: search, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, search_status, solidified_at, paid_at")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !search) {
    return { ok: false, error: "That search doesn't exist." };
  }
  if (!search.paid_at) {
    return { ok: false, error: "This search hasn't been paid for yet." };
  }
  const editable = (VEHICLE_EDITABLE_STATUSES as readonly string[]).includes(
    search.search_status as string,
  );
  if (!editable || search.solidified_at) {
    // Deliberately names the real route rather than failing blankly --
    // this is reachable from a tab left open while the solidify cron ran.
    return { ok: false, error: SEARCH_ALREADY_STARTED };
  }

  // One check covers all three fields: a year is only ever offered for a
  // make/model that exists in the live dataset. Same gate intake uses, so
  // the two surfaces can never disagree about which cars are committable.
  if (modelYear == null || !Number.isInteger(modelYear)) {
    return { ok: false, error: "Choose a model year for this vehicle." };
  }
  if (!(await isOfferedModelYear(make, model, modelYear))) {
    return { ok: false, error: "Pick a make, model, and model year from the list." };
  }

  const admin = createAdminClient();

  // Everything downstream of make/model describes the OLD vehicle, so it
  // all goes. A trim, a colour ranking, or a researched build carried
  // across to a different car would be an answer the customer never gave
  // -- the same reasoning that clears configurator answers when trim
  // changes, one level up.
  for (const table of ["search_option_selections", "search_trim_preferences"]) {
    const { error } = await admin.from(table).delete().eq("search_id", searchId);
    if (error) return { ok: false, error: `Failed to clear old selections: ${error.message}` };
  }

  // The status/solidified guards are repeated as WRITE conditions, not
  // just read checks. The gap between the read above and this update is
  // exactly where the hourly solidify cron could land, and losing that
  // race must mean "no rows updated", never "vehicle changed on a search
  // that has already started".
  const { data: updated, error } = await admin
    .from("customer_searches")
    .update({
      make,
      model,
      model_year: modelYear,
      trim: null,
      colors: [],
      required_options: [],
      // Carried over from Matchmaker, and they described the old vehicle.
      matchmaker_price_cents: null,
      matchmaker_model_year: null,
    })
    .eq("id", searchId)
    .in("search_status", VEHICLE_EDITABLE_STATUSES)
    .is("solidified_at", null)
    .select("id");

  if (error) {
    return { ok: false, error: `Failed to update the vehicle: ${error.message}` };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: SEARCH_ALREADY_STARTED };
  }

  // Real inventory for the new make/model, so the trim picker is not empty
  // when the page re-renders. Same call the Stripe webhook makes at
  // payment time, and non-fatal for the same reason: the vehicle change
  // has already succeeded, and MarketCheck being slow or down must not
  // undo it. An empty trim list degrades to a plain text field.
  try {
    await syncListingsForMakeModel(make, model);
  } catch (syncError) {
    console.error(
      `updateSearchVehicle: on-demand MarketCheck sync failed for ${make} ${model}:`,
      syncError instanceof Error ? syncError.message : syncError,
    );
  }

  revalidatePath(`/finalize/${searchId}`);
  revalidatePath("/account");
  return { ok: true };
}

export type FinalizeDetails = {
  trim: string;
  colors: string[];
  requiredOptions: string[];
  selections?: ConfiguratorSelection[];
  /**
   * The customer's ranked trim list. When present it is authoritative:
   * the legacy `trim` column and the configurator build whose options get
   * validated are both derived from its #1 entry, server-side. There is
   * deliberately no separate configuratorTrimId field -- see
   * writeTrimPreferences.
   */
  trimPreferences?: TrimPreference[];
};

/** A browser can post anything; this cap keeps one request from being pathological. */
const MAX_RANKED_ITEMS = 60;

/**
 * Persists the customer's configurator answers to search_option_selections.
 *
 * DELIBERATELY IGNORES the package name, price and contents the client
 * sent. Only the category, the option name and the customer's ordering
 * (rank, or an exclusion) are taken from the browser; everything an agent
 * will act on is re-read from configurator_options here. That closes the
 * obvious hole -- a crafted
 * request claiming a $0 price on a $1,850 package would otherwise send an
 * agent into a real negotiation holding a number nobody ever researched.
 * A selection that does not correspond to a real, obtainable option on
 * this exact trim is dropped rather than stored.
 *
 * Runs BEFORE the status flip, and deletes this search's existing rows
 * first, so it is safely repeatable: a failure part-way leaves the search
 * still awaiting finalization with rows the next attempt overwrites,
 * never a finalized search carrying half its answers.
 */
async function writeConfiguratorSelections(
  admin: ReturnType<typeof createAdminClient>,
  searchId: string,
  configuratorTrimId: string | null | undefined,
  selections: ConfiguratorSelection[] | undefined,
): Promise<
  { ok: true; colors: string[]; requiredOptions: string[] } | { ok: false; error: string }
> {
  const { error: clearError } = await admin
    .from("search_option_selections")
    .delete()
    .eq("search_id", searchId);
  if (clearError) {
    return { ok: false, error: clearError.message };
  }
  if (!configuratorTrimId || !selections || selections.length === 0) {
    return { ok: true, colors: [], requiredOptions: [] };
  }

  // Authoritative option data for this trim, paginated -- PostgREST caps a
  // plain select at 1,000 rows and truncates silently, and a truncated read
  // here would drop a legitimate answer as if it were fabricated.
  const PAGE_SIZE = 1000;
  const options: {
    category: string;
    name: string;
    availability: string;
    price_cents: number | null;
    package_name: string | null;
    package_price_cents: number | null;
    package_contents: string[] | null;
  }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("configurator_options")
      .select(
        "id, category, name, availability, price_cents, package_name, package_price_cents, package_contents",
      )
      .eq("trim_id", configuratorTrimId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { ok: false, error: error.message };
    options.push(...((data ?? []) as unknown as typeof options));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const byKey = new Map(options.map((o) => [`${o.category}::${o.name}`, o]));
  const seen = new Set<string>();
  const kept: { s: ConfiguratorSelection; option: (typeof options)[number] }[] = [];
  for (const s of selections.slice(0, MAX_RANKED_ITEMS)) {
    const key = `${s.category}::${s.selection}`;
    // The table is unique on (search_id, category, selection); a repeated
    // answer is the same answer, not a second one.
    if (seen.has(key)) continue;
    const option = byKey.get(key);
    if (!option || option.availability === "unavailable") continue;

    const isFeature = s.category === "feature";
    // A feature the trim already includes is not a question, so a "yes"
    // against it is not an answer worth sending to an agent.
    if (isFeature && option.availability === "standard") continue;
    // Features are NEVER ranked -- they are independent adds with no
    // meaningful ordering between them -- but since 2026-09-14 they CAN be
    // excluded: "explicitly does not want this" is a real instruction,
    // distinct from saying nothing. A rank on a feature is still nonsense
    // and is dropped rather than stored as a half-populated row.
    if (isFeature && s.rankPosition != null) continue;
    // A ranked entry that is neither ranked nor excluded says nothing.
    if (!isFeature && !statesAnOpinion(s)) continue;

    seen.add(key);
    kept.push({ s, option });
  }

  // Renumber per category -- the unique index is on (search_id, category,
  // rank_position), so each category is its own independent list.
  const rows: Record<string, unknown>[] = [];
  const rankedColors: { name: string; rankPosition: number }[] = [];
  const features: string[] = [];
  const categories = [...new Set(kept.map((k) => k.s.category))];

  for (const category of categories) {
    const inCategory = kept.filter((k) => k.s.category === category);
    if (category === "feature") {
      for (const { s, option } of inCategory) {
        // required_options is a list of things to GET. A refused feature
        // reaching it would read to every legacy surface as something the
        // customer WANTS -- the exact inversion of what they said, and the
        // same trap excluded colours are already kept out of.
        if (!s.excluded) features.push(option.name);
        rows.push(buildSelectionRow(searchId, "feature", "feature", option, null, s.excluded));
      }
      continue;
    }
    const { ranked, excluded } = normalizeRanked(inCategory, (k) => k.s);
    for (const { item, rankPosition } of ranked) {
      if (category === "exterior_color") {
        rankedColors.push({ name: item.option.name, rankPosition });
      }
      rows.push(
        buildSelectionRow(searchId, category, "ranked", item.option, rankPosition, false),
      );
    }
    for (const { item } of excluded) {
      rows.push(buildSelectionRow(searchId, category, "ranked", item.option, null, true));
    }
  }

  if (rows.length > 0) {
    const { error } = await admin.from("search_option_selections").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // The legacy columns are derived from what was ACTUALLY stored, not from
  // a parallel list the client computed. That is what makes "colours in
  // rank order, exclusions omitted" true by construction rather than by
  // two code paths happening to agree -- an excluded colour reaching
  // `colors` would read to every existing agent surface as a colour the
  // customer wants, the exact inversion of what they said.
  return {
    ok: true,
    colors: rankedColors.sort((a, b) => a.rankPosition - b.rankPosition).map((c) => c.name),
    requiredOptions: features,
  };
}

/**
 * One search_option_selections row with EVERY column present.
 *
 * The full key set is not tidiness. PostgREST unions the keys across a bulk
 * insert and sends an explicit NULL for any key a row omits, which defeats
 * the column default -- a row leaving out price_unknown fails the NOT NULL
 * constraint and takes the whole insert down with it. Found the hard way
 * while verifying step 3 (2026-09-14). Ranked rows and feature rows have
 * genuinely different populated fields, so they are exactly the mixed-shape
 * case that triggers it.
 */
function buildSelectionRow(
  searchId: string,
  category: string,
  questionKind: "ranked" | "feature",
  option: {
    availability: string;
    name: string;
    price_cents: number | null;
    package_name: string | null;
    package_price_cents: number | null;
    package_contents: string[] | null;
  },
  rankPosition: number | null,
  excluded: boolean,
): Record<string, unknown> {
  const inPackage = option.availability === "package_only" && option.package_name != null;
  return {
    search_id: searchId,
    category,
    question_kind: questionKind,
    selection: option.name,
    rank_position: rankPosition,
    excluded,
    package_name: inPackage ? option.package_name : null,
    package_price_cents: inPackage ? option.package_price_cents : null,
    package_contents: inPackage ? option.package_contents : null,
    price_unknown: inPackage ? option.package_price_cents == null : option.price_cents == null,
  };
}

/**
 * Persists the customer's ranked trim list, and resolves which researched
 * build (if any) their #1 choice corresponds to.
 *
 * RETURNING the #1's configurator trim id is the point, not a convenience.
 * The caller feeds it straight into writeConfiguratorSelections, so the
 * options a customer's colour/feature answers get validated against are
 * ALWAYS the options of the trim they ranked first -- there is no separate
 * client-supplied field that could point somewhere else. A crafted request
 * cannot rank one trim and have its answers validated against a different
 * build's cheaper packages.
 *
 * configuratorTrimId is re-checked rather than trusted: the claimed build
 * must really exist, be part of the live batch, and belong to this search's
 * make and model. It is deliberately NOT required to match the trim string,
 * because a legitimate match routinely disagrees there -- MarketCheck
 * truncates "XLE Premium" to "XLE", which is exactly the case the matcher
 * exists to bridge. A failed check degrades to null (the agent view then
 * reads "inventory only"), never to a rejected save.
 */
async function writeTrimPreferences(
  admin: ReturnType<typeof createAdminClient>,
  searchId: string,
  make: string | null,
  model: string | null,
  preferences: TrimPreference[] | undefined,
): Promise<
  { ok: true; topTrim: string | null; topConfiguratorTrimId: string | null } | { ok: false; error: string }
> {
  const { error: clearError } = await admin
    .from("search_trim_preferences")
    .delete()
    .eq("search_id", searchId);
  if (clearError) return { ok: false, error: clearError.message };

  if (!preferences || preferences.length === 0) {
    return { ok: true, topTrim: null, topConfiguratorTrimId: null };
  }

  const seen = new Set<string>();
  const cleaned: TrimPreference[] = [];
  for (const p of preferences.slice(0, MAX_RANKED_ITEMS)) {
    const trim = (p.trim ?? "").trim();
    if (!trim) continue;
    // Unique on (search_id, trim, model_year_key), where the key column is
    // coalesce(model_year, -1) -- so an unknown year is one identity, not
    // a NULL that silently dedupes against nothing.
    const key = `${trim.toLowerCase()}::${p.modelYear ?? -1}`;
    if (seen.has(key)) continue;
    if (!statesAnOpinion(p)) continue;
    seen.add(key);
    cleaned.push({ ...p, trim });
  }
  if (cleaned.length === 0) {
    return { ok: true, topTrim: null, topConfiguratorTrimId: null };
  }

  const validIds = await resolveValidConfiguratorTrimIds(admin, cleaned, make, model);
  const { ranked, excluded } = normalizeRanked(cleaned, (p) => p);

  const rows = [...ranked, ...excluded].map(({ item, rankPosition }) => ({
    search_id: searchId,
    trim: item.trim,
    model_year: item.modelYear,
    rank_position: rankPosition,
    excluded: rankPosition == null,
    configurator_trim_id:
      item.configuratorTrimId && validIds.has(item.configuratorTrimId)
        ? item.configuratorTrimId
        : null,
  }));

  const { error } = await admin.from("search_trim_preferences").insert(rows);
  if (error) return { ok: false, error: error.message };

  const top = ranked.find((r) => r.rankPosition === 1);
  return {
    ok: true,
    topTrim: top?.item.trim ?? null,
    topConfiguratorTrimId:
      top?.item.configuratorTrimId && validIds.has(top.item.configuratorTrimId)
        ? top.item.configuratorTrimId
        : null,
  };
}

/** Which of the claimed configurator builds are real, live, and this vehicle. */
async function resolveValidConfiguratorTrimIds(
  admin: ReturnType<typeof createAdminClient>,
  preferences: TrimPreference[],
  make: string | null,
  model: string | null,
): Promise<Set<string>> {
  const claimed = [...new Set(preferences.map((p) => p.configuratorTrimId).filter(Boolean))] as string[];
  if (claimed.length === 0 || !make || !model) return new Set();

  const { data: batch } = await admin
    .from("configurator_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  if (!batch) return new Set();

  const { data, error } = await admin
    .from("configurator_trims")
    .select("id, make, model")
    .eq("batch_id", batch.id)
    .in("id", claimed);
  if (error || !data) return new Set();

  return new Set(
    data
      .filter(
        (t) =>
          String(t.make).toLowerCase() === make.toLowerCase() &&
          String(t.model).toLowerCase() === model.toLowerCase(),
      )
      .map((t) => t.id as string),
  );
}

/**
 * Self-service finalization -- the explicit "this confirms exactly what
 * we'll search for" action (Step 5 of the pending-pivot's "Full flow").
 * This is what actually starts the 24h self-edit window: sets finalized_at
 * and flips search_status to 'pending_refinement', which now means
 * "finalized, window open" rather than its old pre-payment meaning.
 * solidify-pending-searches (search-solidification.ts) anchors off
 * finalized_at, not paid_at, to close that window later.
 */
export async function finalizeSelfService(
  searchId: string,
  details: FinalizeDetails
): Promise<FinalizeResult> {
  const check = await getOwnedAwaitingFinalizationSearch(searchId);
  if (!check.ok) return check;

  // Zero-inventory block, re-checked HERE before anything is written.
  // Finalizing a blocked search would start the 24h window and, through
  // solidification, the Day-30 clock against a vehicle nobody can source.
  const refusal = await customerInventoryRefusal(check);
  if (refusal) return { ok: false, error: refusal };

  const admin = createAdminClient();

  // Configurator answers land first, deliberately. They are written while
  // the search is still awaiting finalization, so a failure here aborts
  // before anything irreversible and the customer can simply retry.
  //
  // Trim preferences go FIRST of all, because their #1 entry decides which
  // build the colour/feature answers are validated against.
  const trims = await writeTrimPreferences(
    admin,
    searchId,
    check.make,
    check.model,
    details.trimPreferences,
  );
  if (!trims.ok) {
    return { ok: false, error: `Failed to save your trim choices: ${trims.error}` };
  }

  const stored = await writeConfiguratorSelections(
    admin,
    searchId,
    trims.topConfiguratorTrimId,
    details.selections,
  );
  if (!stored.ok) {
    return { ok: false, error: `Failed to save your selections: ${stored.error}` };
  }

  const { error } = await admin
    .from("customer_searches")
    .update({
      // `|| null`, not `?? null`: with the free-text trim removed, an
      // unranked trim arrives as an EMPTY STRING rather than null, and
      // ?? would store that verbatim -- giving this column two different
      // representations of "no preference" for every reader to handle.
      trim: trims.topTrim || details.trim || null,
      colors: trims.topConfiguratorTrimId ? stored.colors : details.colors,
      required_options: trims.topConfiguratorTrimId
        ? stored.requiredOptions
        : details.requiredOptions,
      finalized_at: new Date().toISOString(),
      search_status: "pending_refinement",
    })
    .eq("id", searchId)
    .eq("search_status", "awaiting_finalization");

  if (error) {
    return { ok: false, error: `Failed to finalize: ${error.message}` };
  }

  revalidatePath("/account");
  revalidatePath(`/finalize/${searchId}`);
  return { ok: true };
}

/**
 * Self-edit during the 24h window (Step 7a) -- same fields as finalization,
 * but deliberately does NOT touch finalized_at. The window is anchored to
 * the original finalize timestamp and does not reset on edit, so a customer
 * 12 hours in who makes a change stays at 12 hours remaining, not back to
 * 24 -- otherwise the window could be gamed into an indefinite loop via
 * repeated last-minute edits.
 *
 * Relies on search_status = 'pending_refinement' as the gate, same as every
 * other window-dependent action in this codebase (e.g. respondToOffer on
 * status = 'pending') -- there's a small, accepted lag window (up to ~1h,
 * the solidify cron's own cadence) where finalized_at + 24h has technically
 * elapsed but the cron hasn't flipped search_status yet. Not treated as a
 * bug: it's the same tolerance every hourly-cron-gated action in this app
 * already has.
 */
export async function updateFinalizedSearch(
  searchId: string,
  details: FinalizeDetails
): Promise<FinalizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: search, error: fetchError } = await supabase
    .from("customer_searches")
    .select("id, search_status, make, model")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (fetchError || !search) {
    return { ok: false, error: "That search doesn't exist." };
  }
  if (search.search_status !== "pending_refinement") {
    return { ok: false, error: "This search is no longer open for edits." };
  }

  const admin = createAdminClient();

  // The /account edit form is the GENERIC colour/options form -- it has no
  // configurator questions in it (step 7 scope was the finalize flow). So a
  // customer who finalized through the rich flow and then edits here has
  // just restated their preferences using the generic vocabulary, and the
  // rich answers they are replacing must go with them. Leaving both would
  // hand an agent two contradictory statements of intent with nothing to
  // say which one is current.
  //
  // The ranked TRIM list is cleared by the same reasoning and in the same
  // breath: this form writes a single free-text trim, so leaving a ranked
  // list behind would tell an agent to search trims 2..n in an order the
  // customer has just superseded.
  const trims = await writeTrimPreferences(
    admin,
    searchId,
    (search.make as string | null) ?? null,
    (search.model as string | null) ?? null,
    details.trimPreferences,
  );
  if (!trims.ok) {
    return { ok: false, error: `Failed to save your trim choices: ${trims.error}` };
  }

  const stored = await writeConfiguratorSelections(
    admin,
    searchId,
    trims.topConfiguratorTrimId,
    details.selections,
  );
  if (!stored.ok) {
    return { ok: false, error: `Failed to save your selections: ${stored.error}` };
  }

  const { error } = await admin
    .from("customer_searches")
    .update({
      // `|| null`, not `?? null`: with the free-text trim removed, an
      // unranked trim arrives as an EMPTY STRING rather than null, and
      // ?? would store that verbatim -- giving this column two different
      // representations of "no preference" for every reader to handle.
      trim: trims.topTrim || details.trim || null,
      colors: trims.topConfiguratorTrimId ? stored.colors : details.colors,
      required_options: trims.topConfiguratorTrimId
        ? stored.requiredOptions
        : details.requiredOptions,
    })
    .eq("id", searchId)
    .eq("search_status", "pending_refinement");

  if (error) {
    return { ok: false, error: `Failed to save changes: ${error.message}` };
  }

  revalidatePath("/account");
  return { ok: true };
}
