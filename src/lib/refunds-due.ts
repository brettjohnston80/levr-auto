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
  /** Everything still refundable: the $699 plus any $100 paid-switch fees on the chain. */
  remainingCents: number;
  /** Each fee with money left, $699 first (for the confirm text). */
  parts: RefundPart[];
}

export interface RefundPart {
  kind: "search_fee" | "switch_fee";
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

export interface GuaranteePayments {
  /** The $699 search fee (on the original search of a switch chain), or null. */
  searchFee: GuaranteePayment | null;
  /** Every $100 paid-switch fee on the chain (each lands on the search the switch created). */
  switchFees: GuaranteePayment[];
}

const PAYMENT_COLUMNS = "id, search_id, customer_id, stripe_payment_intent_id, amount_cents, refunded_cents, payment_type";

/**
 * Every fee the Day-30 guarantee refunds for a search (decided by Brett 2026-10-14): the $699
 * search fee and any $100 paid-switch fees, following the switch chain back (old.superseded_by_id
 * = this one) to the original search. At most 20 steps, so a bad chain can never loop.
 */
export async function findGuaranteePayments(admin: Admin, searchId: string): Promise<GuaranteePayments> {
  const result: GuaranteePayments = { searchFee: null, switchFees: [] };
  let current: string | null = searchId;
  for (let step = 0; current && step < 20; step++) {
    const { data: payments, error } = await admin
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("search_id", current)
      .in("payment_type", ["search_fee", "switch_fee"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Could not load the payments: ${error.message}`);
    for (const p of (payments ?? []) as (GuaranteePayment & { payment_type: string })[]) {
      if (p.payment_type === "switch_fee") result.switchFees.push(p);
      else if (!result.searchFee) result.searchFee = p;
    }
    if (result.searchFee) break;
    const { data: previous }: { data: { id: string } | null } = await admin
      .from("customer_searches")
      .select("id")
      .eq("superseded_by_id", current)
      .maybeSingle();
    current = previous?.id ?? null;
  }
  result.switchFees.reverse(); // oldest switch first
  return result;
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
    const { searchFee: payment, switchFees } = await findGuaranteePayments(admin, search.id);
    const parts: RefundPart[] = [];
    if (payment && payment.amount_cents > payment.refunded_cents) parts.push({ kind: "search_fee", remainingCents: payment.amount_cents - payment.refunded_cents });
    if (payment) for (const f of switchFees) if (f.amount_cents > f.refunded_cents) parts.push({ kind: "switch_fee", remainingCents: f.amount_cents - f.refunded_cents });
    const remainingCents = parts.reduce((sum, x) => sum + x.remainingCents, 0);
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
      parts,
    });
  }
  return rows;
}
