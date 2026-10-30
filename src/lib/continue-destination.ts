import "server-only";
import { createAdminClient } from "./supabase/admin";
import { searchDestination } from "./search-destination";

/**
 * Where the customer continues from (BAE #1, 2026-10-30), read for one customer id. Used by
 * login(), which can't redirect through /account/continue (a server action can't follow a
 * redirect into a page that redirects again), and by /account/continue for the email links.
 * A light read: no offer is stamped as delivered.
 */
export async function continueDestinationFor(customerId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from("customer_searches")
    .select("id, search_status, paid_at, make, model")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });
  return searchDestination(
    (data ?? []).map((s) => ({
      id: s.id as string,
      searchStatus: s.search_status as string,
      paidAt: (s.paid_at as string | null) ?? null,
      make: (s.make as string | null) ?? null,
      model: (s.model as string | null) ?? null,
    })),
  );
}
