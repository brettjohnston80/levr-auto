"use server";

import "server-only";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

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
