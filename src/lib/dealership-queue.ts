"use server";

import "server-only";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { dealerIdentityKey } from "./dealer-aliases";

/**
 * LEVRating Phase A -- listings stays untouched raw sourced data (no
 * dealership_id/alias FK added to it), so every listing count here is
 * computed by grouping a narrow (dealer_name, dealer_city, dealer_state)
 * fetch in application code, same convention already used by
 * outreach-queue.ts's per-dealer aggregation and inventory-count.ts's
 * Haversine pass.
 */
async function getListingCountsByIdentity(): Promise<Map<string, number>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("listings").select("dealer_name, dealer_city, dealer_state");

  if (error) {
    throw new Error(`Failed to load listings for dealer counts: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.dealer_name) continue;
    const key = dealerIdentityKey(row.dealer_name, row.dealer_city, row.dealer_state);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface UnconfirmedAlias {
  id: string;
  dealerName: string;
  dealerCity: string | null;
  dealerState: string | null;
  listingCount: number;
  createdAt: string;
}

/** Every dealer_aliases row with dealership_id null, sorted by listing count descending -- surfaces the highest-impact dealers first. */
export async function getUnconfirmedAliases(): Promise<UnconfirmedAlias[]> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    throw new Error("Not authorized.");
  }

  const admin = createAdminClient();
  const [{ data: aliases, error: aliasError }, counts] = await Promise.all([
    admin
      .from("dealer_aliases")
      .select("id, dealer_name, dealer_city, dealer_state, created_at")
      .is("dealership_id", null)
      .order("created_at", { ascending: true }),
    getListingCountsByIdentity(),
  ]);

  if (aliasError) {
    throw new Error(`Failed to load unconfirmed dealer aliases: ${aliasError.message}`);
  }

  const rows = (aliases ?? []).map((a) => ({
    id: a.id,
    dealerName: a.dealer_name,
    dealerCity: a.dealer_city,
    dealerState: a.dealer_state,
    listingCount: counts.get(dealerIdentityKey(a.dealer_name, a.dealer_city, a.dealer_state)) ?? 0,
    createdAt: a.created_at,
  }));

  return rows.sort((a, b) => b.listingCount - a.listingCount);
}

export interface DealershipAliasSummary {
  id: string;
  dealerName: string;
  dealerCity: string | null;
  dealerState: string | null;
}

export interface DealershipSalesperson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface ConfirmedDealership {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  createdAt: string;
  aliases: DealershipAliasSummary[];
  listingCount: number;
  salespeople: DealershipSalesperson[];
}

/** Every confirmed dealerships row, with its linked aliases, total listing count, and salespeople. */
export async function getConfirmedDealerships(): Promise<ConfirmedDealership[]> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    throw new Error("Not authorized.");
  }

  const admin = createAdminClient();
  const [
    { data: dealerships, error: dealershipsError },
    { data: aliases, error: aliasesError },
    { data: salespeople, error: salespeopleError },
    counts,
  ] = await Promise.all([
    admin.from("dealerships").select("id, name, city, state, created_at").order("created_at", { ascending: false }),
    admin
      .from("dealer_aliases")
      .select("id, dealer_name, dealer_city, dealer_state, dealership_id")
      .not("dealership_id", "is", null),
    admin
      .from("dealership_salespeople")
      .select("id, dealership_id, name, phone, email")
      .order("created_at", { ascending: true }),
    getListingCountsByIdentity(),
  ]);

  if (dealershipsError) {
    throw new Error(`Failed to load dealerships: ${dealershipsError.message}`);
  }
  if (aliasesError) {
    throw new Error(`Failed to load confirmed dealer aliases: ${aliasesError.message}`);
  }
  if (salespeopleError) {
    throw new Error(`Failed to load dealership salespeople: ${salespeopleError.message}`);
  }

  const aliasesByDealership = new Map<string, DealershipAliasSummary[]>();
  const countByDealership = new Map<string, number>();
  for (const a of aliases ?? []) {
    if (!a.dealership_id) continue;
    const summary: DealershipAliasSummary = {
      id: a.id,
      dealerName: a.dealer_name,
      dealerCity: a.dealer_city,
      dealerState: a.dealer_state,
    };
    const existing = aliasesByDealership.get(a.dealership_id) ?? [];
    existing.push(summary);
    aliasesByDealership.set(a.dealership_id, existing);

    const listingCount = counts.get(dealerIdentityKey(a.dealer_name, a.dealer_city, a.dealer_state)) ?? 0;
    countByDealership.set(a.dealership_id, (countByDealership.get(a.dealership_id) ?? 0) + listingCount);
  }

  const salespeopleByDealership = new Map<string, DealershipSalesperson[]>();
  for (const s of salespeople ?? []) {
    const existing = salespeopleByDealership.get(s.dealership_id) ?? [];
    existing.push({ id: s.id, name: s.name, phone: s.phone, email: s.email });
    salespeopleByDealership.set(s.dealership_id, existing);
  }

  return (dealerships ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    city: d.city,
    state: d.state,
    createdAt: d.created_at,
    aliases: aliasesByDealership.get(d.id) ?? [],
    listingCount: countByDealership.get(d.id) ?? 0,
    salespeople: salespeopleByDealership.get(d.id) ?? [],
  }));
}

export interface DealershipSearchResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export type SearchDealershipsResult = DealershipSearchResult[] | { error: string };

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 20;

/** Powers the "Merge into existing" picker -- matches against name/city/state on already-confirmed dealerships. */
export async function searchDealerships(query: string): Promise<SearchDealershipsResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { error: "Not authorized." };
  }

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const admin = createAdminClient();
  const pattern = `%${trimmed}%`;
  const columns = "id, name, city, state";

  const [
    { data: byName, error: nameError },
    { data: byCity, error: cityError },
    { data: byState, error: stateError },
  ] = await Promise.all([
    admin.from("dealerships").select(columns).ilike("name", pattern).limit(MAX_RESULTS),
    admin.from("dealerships").select(columns).ilike("city", pattern).limit(MAX_RESULTS),
    admin.from("dealerships").select(columns).ilike("state", pattern).limit(MAX_RESULTS),
  ]);

  const firstError = nameError ?? cityError ?? stateError;
  if (firstError) {
    return { error: firstError.message ?? "Search failed." };
  }

  const byId = new Map<string, DealershipSearchResult>();
  for (const row of [...(byName ?? []), ...(byCity ?? []), ...(byState ?? [])]) {
    byId.set(row.id, row);
  }

  return [...byId.values()].slice(0, MAX_RESULTS);
}
