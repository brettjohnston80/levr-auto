import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getOutreachQueue, type OutreachSearch } from "./outreach-queue";
import manufacturerFees from "../../data/manufacturer-fees.json";
import type { OfferPayload } from "./offer-submission";

/**
 * Everything the Log Offer page (offer entry, Chunk 4) needs for one search: the outreach
 * card's data (listings, sticker ranges, ranked choices, offers) for that search in any
 * status, plus the customer's first name, the open drafts and dealer submissions, the other
 * offers' out-the-door state, and a manufacturer fee to prefill (plan 4.A.1).
 */

export interface ManufacturerFee {
  make: string;
  fee: string;
  amount: number;
  refundable: boolean;
  source: string;
  since: string;
}

export interface OfferEntryDraft {
  id: string;
  source: "agent" | "dealer_link" | "dealer_account";
  status: "draft" | "awaiting_review";
  dealerName: string | null;
  updatedAt: string;
}

export interface OfferEntryOtherOffer {
  id: string;
  dealerName: string;
  status: string;
  otdTotalCents: number | null;
  otdRequested: boolean;
}

export interface OfferEntryContext {
  search: OutreachSearch;
  searchStatus: string;
  modelYear: number | null;
  customerFirstName: string | null;
  drafts: OfferEntryDraft[];
  otherOffers: OfferEntryOtherOffer[];
  manufacturerFee: ManufacturerFee | null;
  /** The draft being edited, when the page was opened with ?submission=. */
  draft: { id: string; payload: Partial<OfferPayload>; source: OfferEntryDraft["source"] } | null;
}

export function manufacturerFeeFor(make: string | null): ManufacturerFee | null {
  if (!make) return null;
  return (manufacturerFees as ManufacturerFee[]).find((f) => f.make.toLowerCase() === make.toLowerCase()) ?? null;
}

export async function getOfferEntryContext(searchId: string, submissionId: string | null): Promise<OfferEntryContext | null> {
  const [search] = await getOutreachQueue({ searchId });
  if (!search) return null;
  const admin = createAdminClient();

  const [{ data: row }, { data: customer }, { data: subs }, { data: offers }] = await Promise.all([
    admin.from("customer_searches").select("search_status, model_year").eq("id", searchId).single(),
    admin.from("customers").select("first_name").eq("id", search.customerId).maybeSingle(),
    admin
      .from("offer_submissions")
      .select("id, submission_source, submission_status, working_payload, updated_at")
      .eq("customer_search_id", searchId)
      .in("submission_status", ["draft", "awaiting_review"])
      .order("updated_at", { ascending: false }),
    admin
      .from("qualifying_offers")
      .select("id, dealer_name, status, otd_total_cents, otd_requested_at, created_at")
      .eq("customer_search_id", searchId)
      .order("created_at", { ascending: true }),
  ]);

  const drafts: OfferEntryDraft[] = (subs ?? []).map((s) => ({
    id: s.id as string,
    source: s.submission_source as OfferEntryDraft["source"],
    status: s.submission_status as OfferEntryDraft["status"],
    dealerName: ((s.working_payload as Partial<OfferPayload> | null)?.dealer_name ?? null) || null,
    updatedAt: s.updated_at as string,
  }));
  const chosen = submissionId ? (subs ?? []).find((s) => s.id === submissionId) : null;

  return {
    search,
    searchStatus: (row?.search_status as string) ?? "searching",
    modelYear: (row?.model_year as number | null) ?? null,
    customerFirstName: (customer?.first_name as string | null) ?? null,
    drafts,
    otherOffers: (offers ?? []).map((o) => ({
      id: o.id as string,
      dealerName: o.dealer_name as string,
      status: o.status as string,
      otdTotalCents: (o.otd_total_cents as number | null) ?? null,
      otdRequested: !!o.otd_requested_at && o.otd_total_cents == null,
    })),
    manufacturerFee: manufacturerFeeFor(search.make),
    draft: chosen
      ? {
          id: chosen.id as string,
          payload: (chosen.working_payload as Partial<OfferPayload>) ?? {},
          source: chosen.submission_source as OfferEntryDraft["source"],
        }
      : null,
  };
}
