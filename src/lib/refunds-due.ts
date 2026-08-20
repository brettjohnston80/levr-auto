import "server-only";
import { createAdminClient } from "./supabase/admin";

export interface RefundDueSearch {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  customerEmail: string | null;
  customerName: string | null;
  resolvedAt: string | null;
}

/**
 * Every customer_searches row whose Day-30 guarantee assessment came back
 * 'refunded' — the worklist for a human to go process the actual Stripe
 * refund manually (see src/lib/guarantee-assessment.ts). Read-only: nothing
 * here marks a row as processed, since triggering real refunds is a
 * deliberately separate, later piece of work.
 *
 * resolvedAt is guarantee_resolved_at, a dedicated column set once, only at
 * the moment of resolution — immune to drift from any later, unrelated
 * update to the row (unlike updated_at, which every write path touches).
 */
export async function getRefundsDueQueue(): Promise<RefundDueSearch[]> {
  const admin = createAdminClient();

  const { data: searches, error: searchesError } = await admin
    .from("customer_searches")
    .select("id, make, model, trim, customer_id, guarantee_resolved_at")
    .eq("guarantee_status", "refunded")
    .order("guarantee_resolved_at", { ascending: true });

  if (searchesError) {
    throw new Error(`Failed to load refunds-due queue: ${searchesError.message}`);
  }
  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("customers")
    .select("id, email, first_name, last_name")
    .in("id", customerIds);

  if (customersError) {
    throw new Error(`Failed to load customers for refunds-due queue: ${customersError.message}`);
  }

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  return searches.map((search) => {
    const customer = customerById.get(search.customer_id);
    return {
      id: search.id,
      make: search.make,
      model: search.model,
      trim: search.trim,
      customerEmail: customer?.email ?? null,
      customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || null,
      resolvedAt: search.guarantee_resolved_at,
    };
  });
}
