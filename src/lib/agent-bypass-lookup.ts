"use server";

import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

export interface CustomerCandidate {
  id: string;
  fullName: string | null;
  email: string;
}

export type SearchCustomersResult = CustomerCandidate[] | { error: string };

const MIN_QUERY_LENGTH = 2;
const MAX_CANDIDATES = 20;

/**
 * Search stage of the bypass lookup flow (Pass 3, CLAUDE.md) — matches
 * against customers.full_name and customers.email, since full_name only
 * lives there and email is the only pre-filterable field available without
 * pulling every auth.users row to filter client-side. Two separate ILIKE
 * queries merged in application code, not a single `.or()` filter string —
 * PostgREST's `.or()` syntax treats commas/periods/parens in the filter
 * string as syntax, so interpolating raw agent-typed text into one would
 * risk a malformed filter (or worse) on input containing those characters.
 * Bound `.ilike()` calls don't have that risk.
 *
 * customers.email is only used here as a fuzzy search seed — never trusted
 * for display or identity once a candidate is found. Each result's email is
 * re-resolved from auth.users (the authoritative source) via the Auth Admin
 * API before being returned, per the non-uniqueness/denormalization finding
 * logged under CLAUDE.md's "Key learnings & principles".
 */
export async function searchCustomers(query: string): Promise<SearchCustomersResult> {
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

  const [{ data: byName, error: nameError }, { data: byEmail, error: emailError }] = await Promise.all([
    admin.from("customers").select("id, full_name, email").ilike("full_name", pattern).limit(MAX_CANDIDATES),
    admin.from("customers").select("id, full_name, email").ilike("email", pattern).limit(MAX_CANDIDATES),
  ]);

  if (nameError || emailError) {
    return { error: (nameError ?? emailError)?.message ?? "Search failed." };
  }

  const byId = new Map<string, { id: string; full_name: string | null; email: string }>();
  for (const row of [...(byName ?? []), ...(byEmail ?? [])]) {
    byId.set(row.id, row);
  }

  const candidates = [...byId.values()].slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return [];
  }

  const resolved = await Promise.all(
    candidates.map(async (c) => {
      const { data } = await admin.auth.admin.getUserById(c.id);
      return {
        id: c.id,
        fullName: c.full_name,
        email: data.user?.email ?? c.email,
      };
    })
  );

  return resolved;
}

export interface CustomerSearchSummary {
  id: string;
  make: string;
  model: string;
  searchStatus: string;
}

export type GetCustomerSearchesResult = CustomerSearchSummary[] | { error: string };

/** Second stage — every search (any status) belonging to a chosen customer. */
export async function getCustomerSearchesForBypass(customerId: string): Promise<GetCustomerSearchesResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_searches")
    .select("id, make, model, search_status")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return (data ?? []).map((s) => ({
    id: s.id,
    make: s.make,
    model: s.model,
    searchStatus: s.search_status,
  }));
}
