import "server-only";
import { createAdminClient } from "./supabase/admin";

// A search that will never receive new offers or need further activity.
// Deliberately excludes guarantee_status resolving (met/refunded) -- a
// search stays active through Day 60 regardless of that outcome, and could
// easily still be mid-close (deposit/financing/e-sign) right after its
// guarantee resolves. 'switched' applies to the old, superseded row.
const TERMINAL_STATUSES = ["cancelled", "purchased", "switched"];

export interface OfferSheetCleanupSummary {
  deleted: string[];
  errors: { documentId: string; error: string }[];
}

/**
 * Deletes offer-sheet PDFs (documents.type = 'offer_sheet') whose owning
 * search has reached a terminal status -- the real Storage object is
 * deleted for real, but the documents row stays, storage_path nulled and
 * deleted_at set, same "keep the history, not the artifact" convention as
 * cancelled_at/purchased_at elsewhere. Fetches a small set and computes
 * eligibility in application code (search_status lives on a different
 * table, reached through qualifying_offers) rather than a single complex
 * query, matching the convention already used by getOverdueFollowUpQueue
 * and inventory-count.ts. Idempotent via the .is("deleted_at", null) guard
 * on both the read and the write, so a retried/overlapping run can't
 * double-process a row.
 */
export async function deleteStaleOfferSheets(): Promise<OfferSheetCleanupSummary> {
  const admin = createAdminClient();
  const summary: OfferSheetCleanupSummary = { deleted: [], errors: [] };

  const { data: docs, error: docsError } = await admin
    .from("documents")
    .select("id, storage_path, qualifying_offer_id")
    .eq("type", "offer_sheet")
    .not("storage_path", "is", null)
    .is("deleted_at", null);

  if (docsError) {
    throw new Error(`Failed to load offer-sheet documents: ${docsError.message}`);
  }
  if (!docs || docs.length === 0) {
    return summary;
  }

  const offerIds = [...new Set(docs.map((d) => d.qualifying_offer_id))];
  const { data: offers, error: offersError } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id")
    .in("id", offerIds);

  if (offersError) {
    throw new Error(`Failed to load qualifying_offers: ${offersError.message}`);
  }

  const searchIdByOfferId = new Map((offers ?? []).map((o) => [o.id, o.customer_search_id]));
  const searchIds = [...new Set((offers ?? []).map((o) => o.customer_search_id))];

  const { data: searches, error: searchesError } = await admin
    .from("customer_searches")
    .select("id")
    .in("id", searchIds)
    .in("search_status", TERMINAL_STATUSES);

  if (searchesError) {
    throw new Error(`Failed to load customer_searches: ${searchesError.message}`);
  }

  const eligibleSearchIds = new Set((searches ?? []).map((s) => s.id));

  for (const doc of docs) {
    const searchId = searchIdByOfferId.get(doc.qualifying_offer_id);
    if (!searchId || !eligibleSearchIds.has(searchId)) continue;

    const { error: removeError } = await admin.storage.from("documents").remove([doc.storage_path as string]);
    if (removeError) {
      summary.errors.push({ documentId: doc.id, error: removeError.message });
      continue;
    }

    const { error: updateError } = await admin
      .from("documents")
      .update({ storage_path: null, deleted_at: new Date().toISOString() })
      .eq("id", doc.id)
      .is("deleted_at", null);

    if (updateError) {
      summary.errors.push({ documentId: doc.id, error: updateError.message });
      continue;
    }

    summary.deleted.push(doc.id);
  }

  return summary;
}
