import "server-only";

import type { createAdminClient } from "./supabase/admin";
import { isOfferedModelYear } from "./intake-vehicle-options";
import { PICKUP_TRAVEL_MISSING_ERROR, travelFromValue, travelToColumns } from "./pickup-travel";
import type { IntakeChoices } from "./intake-choices";

export type { IntakeChoices, MatchmakerContext } from "./intake-choices";

type AdminClient = ReturnType<typeof createAdminClient>;

// Sign-up-to-payment fix (approved 2026-09-30, docs/plans/signup-to-payment-plan.md).
// The ONE place an unpaid search is created or changed, shared by intake
// (signed in), the intake pop-up's sign-up (before the email is confirmed),
// undecided intake, and the Review and pay page's edits -- so the checks
// can't drift between them.
//
// A customer has at most ONE unpaid search in play: saving reuses their
// latest unpaid row instead of inserting another (every intake save used to
// add a row; the 2026-09-30 journey test ended with three). Older duplicate
// unpaid rows from before this change are left alone; only the latest is
// ever shown or edited.
//
// Callers establish who the customer is (session, or the account sign-up
// just created) before calling; these functions write with the admin client.

type Columns = Record<string, unknown>;

/** Checks the choices and returns the columns to write, or the error to show. */
export async function validateIntakeChoices(
  choices: IntakeChoices,
): Promise<{ ok: true; columns: Columns } | { ok: false; error: string }> {
  if (choices.kind === "undecided") {
    return {
      ok: true,
      columns: {
        make: null,
        model: null,
        model_year: null,
        pickup_travel_choice: null,
        pickup_travel_miles: null,
        pickup_travel_set_at: null,
        matchmaker_price_cents: null,
        matchmaker_model_year: null,
      },
    };
  }

  // Model year is a hard commitment (2026-09-14), re-checked against the
  // live dataset rather than trusted from the select.
  const modelYear = choices.modelYear;
  if (
    !choices.make ||
    !choices.model ||
    modelYear == null ||
    !Number.isInteger(modelYear) ||
    !(await isOfferedModelYear(choices.make, choices.model, modelYear))
  ) {
    return { ok: false, error: "Choose a model year for this vehicle." };
  }

  const travel = travelFromValue(choices.pickupTravel);
  if (!travel) {
    return { ok: false, error: PICKUP_TRAVEL_MISSING_ERROR };
  }

  return {
    ok: true,
    columns: {
      make: choices.make,
      model: choices.model,
      model_year: modelYear,
      zip: choices.zip || null,
      ...travelToColumns(travel),
      pickup_travel_set_at: new Date().toISOString(),
      // Explicit nulls: a search not from a Matchmaker card is recorded as
      // definitively having no Matchmaker context, not merely unset.
      matchmaker_price_cents: choices.matchmaker?.priceCents ?? null,
      matchmaker_model_year: choices.matchmaker?.modelYear ?? null,
    },
  };
}

export interface UnpaidSearchSummary {
  id: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  zip: string | null;
  pickupTravelChoice: string | null;
  pickupTravelMiles: number | null;
  createdAt: string;
}

const UNPAID_COLUMNS = "id, make, model, model_year, zip, pickup_travel_choice, pickup_travel_miles, created_at";

function toSummary(row: Record<string, unknown>): UnpaidSearchSummary {
  return {
    id: row.id as string,
    make: (row.make as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    modelYear: (row.model_year as number | null) ?? null,
    zip: (row.zip as string | null) ?? null,
    pickupTravelChoice: (row.pickup_travel_choice as string | null) ?? null,
    pickupTravelMiles: (row.pickup_travel_miles as number | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** The customer's latest unpaid search (the one in play), or null. */
export async function getLatestUnpaidSearch(admin: AdminClient, customerId: string): Promise<UnpaidSearchSummary | null> {
  const { data, error } = await admin
    .from("customer_searches")
    .select(UNPAID_COLUMNS)
    .eq("customer_id", customerId)
    .is("paid_at", null)
    .eq("search_status", "awaiting_finalization")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load unpaid search: ${error.message}`);
  return data ? toSummary(data) : null;
}

/** One specific unpaid search, only if it's this customer's and still unpaid. */
export async function getOwnUnpaidSearch(
  admin: AdminClient,
  customerId: string,
  searchId: string,
): Promise<UnpaidSearchSummary | null> {
  const { data } = await admin
    .from("customer_searches")
    .select(UNPAID_COLUMNS)
    .eq("id", searchId)
    .eq("customer_id", customerId)
    .is("paid_at", null)
    .eq("search_status", "awaiting_finalization")
    .maybeSingle();
  return data ? toSummary(data) : null;
}

/**
 * Saves the customer's intake as their unpaid search: updates their latest
 * unpaid search if there is one, otherwise creates it. The write re-checks
 * paid_at IS NULL, so a payment landing in between can't be overwritten.
 */
export async function saveUnpaidSearch(
  admin: AdminClient,
  customerId: string,
  choices: IntakeChoices,
): Promise<{ ok: true; searchId: string } | { ok: false; error: string }> {
  const valid = await validateIntakeChoices(choices);
  if (!valid.ok) return valid;

  const existing = await getLatestUnpaidSearch(admin, customerId);
  if (existing) {
    const { data, error } = await admin
      .from("customer_searches")
      .update(valid.columns)
      .eq("id", existing.id)
      .eq("customer_id", customerId)
      .is("paid_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data) return { ok: true, searchId: data.id as string };
    // Paid in the meantime: fall through and start a new unpaid search.
  }

  const { data, error } = await admin
    .from("customer_searches")
    .insert({ customer_id: customerId, ...valid.columns })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, searchId: data.id as string };
}

/** Edits one specific unpaid search (the Review and pay page). */
export async function updateOwnUnpaidSearch(
  admin: AdminClient,
  customerId: string,
  searchId: string,
  choices: IntakeChoices,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const valid = await validateIntakeChoices(choices);
  if (!valid.ok) return valid;
  const existing = await getOwnUnpaidSearch(admin, customerId, searchId);
  if (!existing) return { ok: false, error: "This search has already been paid for, so it can't be changed here." };
  const columns = { ...valid.columns };
  // Matchmaker context describes the car picked on Matchmaker: keep it
  // unless the make or model actually changed (a ZIP edit mustn't wipe it).
  if (existing.make === columns.make && existing.model === columns.model) {
    delete columns.matchmaker_price_cents;
    delete columns.matchmaker_model_year;
  }
  const { data, error } = await admin
    .from("customer_searches")
    .update(columns)
    .eq("id", searchId)
    .eq("customer_id", customerId)
    .is("paid_at", null)
    .eq("search_status", "awaiting_finalization")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "This search has already been paid for, so it can't be changed here." };
  return { ok: true };
}

/** A real customer = a customer with at least one paid search. */
export async function customerHasPaidSearch(admin: AdminClient, customerId: string): Promise<boolean> {
  const { count } = await admin
    .from("customer_searches")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .not("paid_at", "is", null);
  return (count ?? 0) > 0;
}
