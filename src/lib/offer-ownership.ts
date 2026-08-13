import "server-only";
import type { createAdminClient } from "./supabase/admin";

// Shared by every customer-facing action gated on "the caller owns this
// accepted offer" (financing capture, service-agreement signing, ...).
// Deliberately not in a "use server" actions file: those only support
// exporting async Server Actions, and while this helper happens to be
// async, keeping ownership checks in a plain module avoids any ambiguity
// about a shared internal helper being treated as a bindable action.
export async function verifyOwnedAcceptedOffer(
  admin: ReturnType<typeof createAdminClient>,
  offerId: string,
  userId: string
) {
  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id, status")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false as const, error: "That offer no longer exists." };
  }
  if (offer.status !== "customer_accepted") {
    return { ok: false as const, error: "This offer hasn't been accepted yet." };
  }

  const { data: search, error: searchError } = await admin
    .from("customer_searches")
    .select("customer_id")
    .eq("id", offer.customer_search_id)
    .maybeSingle();

  if (searchError || !search || search.customer_id !== userId) {
    return { ok: false as const, error: "Not authorized." };
  }

  return { ok: true as const };
}
