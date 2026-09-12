"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfiguratorSelection } from "@/lib/configurator-matching";

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
    .select("id, search_status")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !search) {
    return { ok: false as const, error: "That search doesn't exist." };
  }
  if (search.search_status !== "awaiting_finalization") {
    return { ok: false as const, error: "This search has already been finalized." };
  }

  return { ok: true as const };
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

export type FinalizeDetails = {
  trim: string;
  colors: string[];
  requiredOptions: string[];
  /** The matched configurator build, when the rich flow ran. */
  configuratorTrimId?: string | null;
  selections?: ConfiguratorSelection[];
};

/**
 * Persists the customer's configurator answers to search_option_selections.
 *
 * DELIBERATELY IGNORES the package name, price and contents the client
 * sent. Only the category, the option name and the chosen priority are
 * taken from the browser; everything an agent will act on is re-read from
 * configurator_options here. That closes the obvious hole -- a crafted
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: clearError } = await admin
    .from("search_option_selections")
    .delete()
    .eq("search_id", searchId);
  if (clearError) {
    return { ok: false, error: clearError.message };
  }
  if (!configuratorTrimId || !selections || selections.length === 0) {
    return { ok: true };
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
  const rows = [];
  for (const s of selections) {
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
    // A preference records WHICH value and HOW STRONGLY; without a
    // strength there is no answer to store, and inventing one would tell
    // an agent something the customer never said.
    if (!isFeature && !s.priority) continue;

    seen.add(key);
    const inPackage = option.availability === "package_only" && option.package_name != null;
    rows.push({
      search_id: searchId,
      category: s.category,
      question_kind: isFeature ? "feature" : "preference",
      selection: option.name,
      priority: isFeature ? null : s.priority,
      package_name: inPackage ? option.package_name : null,
      package_price_cents: inPackage ? option.package_price_cents : null,
      package_contents: inPackage ? option.package_contents : null,
      price_unknown: inPackage ? option.package_price_cents == null : option.price_cents == null,
    });
  }

  if (rows.length === 0) return { ok: true };
  const { error } = await admin.from("search_option_selections").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

  const admin = createAdminClient();

  // Configurator answers land first, deliberately. They are written while
  // the search is still awaiting finalization, so a failure here aborts
  // before anything irreversible and the customer can simply retry.
  const stored = await writeConfiguratorSelections(
    admin,
    searchId,
    details.configuratorTrimId,
    details.selections,
  );
  if (!stored.ok) {
    return { ok: false, error: `Failed to save your selections: ${stored.error}` };
  }

  const { error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
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
    .select("id, search_status")
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
  const stored = await writeConfiguratorSelections(
    admin,
    searchId,
    details.configuratorTrimId,
    details.selections,
  );
  if (!stored.ok) {
    return { ok: false, error: `Failed to save your selections: ${stored.error}` };
  }

  const { error } = await admin
    .from("customer_searches")
    .update({
      trim: details.trim || null,
      colors: details.colors,
      required_options: details.requiredOptions,
    })
    .eq("id", searchId)
    .eq("search_status", "pending_refinement");

  if (error) {
    return { ok: false, error: `Failed to save changes: ${error.message}` };
  }

  revalidatePath("/account");
  return { ok: true };
}
