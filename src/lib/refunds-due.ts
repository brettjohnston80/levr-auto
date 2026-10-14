import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getTestCustomerIds } from "./test-accounts";

export interface RefundDueSearch {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  customerEmail: string | null;
  customerName: string | null;
  resolvedAt: string | null;
  /** The $699 search-fee payment the guarantee refunds, or null when none is recorded. */
  paymentId: string | null;
  amountCents: number;
  remainingCents: number;
}

export interface GuaranteePayment {
  id: string;
  search_id: string;
  customer_id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  refunded_cents: number;
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The $699 search-fee payment a search's Day-30 guarantee refunds. Usually it's on the search
 * itself; after a switch the fee sits on the search it replaced (the replacement was paid by a
 * switch fee, or free), so this follows the switch chain back (old.superseded_by_id = this one)
 * until it finds one. At most 20 steps, so a bad chain can never loop.
 */
export async function findGuaranteePayment(admin: Admin, searchId: string): Promise<GuaranteePayment | null> {
  let current: string | null = searchId;
  for (let step = 0; current && step < 20; step++) {
    const { data: payment, error } = await admin
      .from("payments")
      .select("id, search_id, customer_id, stripe_payment_intent_id, amount_cents, refunded_cents")
      .eq("search_id", current)
      .eq("payment_type", "search_fee")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not load the payment: ${error.message}`);
    if (payment) return payment as GuaranteePayment;
    const { data: previous }: { data: { id: string } | null } = await admin
      .from("customer_searches")
      .select("id")
      .eq("superseded_by_id", current)
      .maybeSingle();
    current = previous?.id ?? null;
  }
  return null;
}

/**
 * Every customer_searches row whose Day-30 guarantee assessment came back 'refunded' and still
 * needs its refund: the worklist an agent works through on /internal/refunds-due (Issue refund,
 * or record one already issued in Stripe; Phase 1 Chunk 5).
 *
 * A row leaves the list once its $699 payment has a guarantee refund and nothing left to refund.
 * A row with money left (none refunded yet, or only part) stays, showing what's refundable.
 *
 * resolvedAt is guarantee_resolved_at, a dedicated column set once, only at the moment of
 * resolution — immune to drift from any later, unrelated update to the row.
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

  // Tester-program rows never reach this worklist. A seeded test search
  // that sits past Day 30 with no qualifying offer is resolved 'refunded'
  // by the Day-30 job exactly like a real one -- that is correct, and the
  // job is deliberately left alone -- but this queue is a list of real
  // money a human is about to refund through Stripe. A test row here is an
  // instruction to refund a customer who does not exist.
  const testCustomerIds = await getTestCustomerIds();
  const realSearches = searches.filter((s) => !testCustomerIds.has(s.customer_id));
  if (realSearches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(realSearches.map((s) => s.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("customers")
    .select("id, email, first_name, last_name")
    .in("id", customerIds);

  if (customersError) {
    throw new Error(`Failed to load customers for refunds-due queue: ${customersError.message}`);
  }

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const rows: RefundDueSearch[] = [];
  for (const search of realSearches) {
    const customer = customerById.get(search.customer_id);
    const payment = await findGuaranteePayment(admin, search.id);
    const remainingCents = payment ? payment.amount_cents - payment.refunded_cents : 0;
    if (payment && remainingCents === 0) {
      const { count } = await admin
        .from("refunds")
        .select("id", { count: "exact", head: true })
        .eq("payment_id", payment.id)
        .eq("reason", "guarantee");
      if ((count ?? 0) > 0) continue; // refunded for the guarantee: done
    }
    rows.push({
      id: search.id,
      make: search.make,
      model: search.model,
      trim: search.trim,
      customerEmail: customer?.email ?? null,
      customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || null,
      resolvedAt: search.guarantee_resolved_at,
      paymentId: payment?.id ?? null,
      amountCents: payment?.amount_cents ?? 0,
      remainingCents,
    });
  }
  return rows;
}
