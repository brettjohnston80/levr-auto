import "server-only";
import { createAdminClient } from "./supabase/admin";
import { sendEmail } from "./email";
import { getOrCreateDealerAlias } from "./dealer-aliases";

export const POST_DEAL_SURVEY_DELAY_DAYS = 2;

function customerDisplayName(customer: { first_name?: string | null; last_name?: string | null }): string | undefined {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined;
}

/**
 * LEVRating Phase B. Resolves a purchased qualifying_offer to a
 * dealer_aliases row id -- always resolvable, never null. If the offer has
 * a listing (the common case), resolves via the listing's own dealer
 * identity (including mc_dealer_id, so the existing auto-link mechanism
 * applies here too). If not (an off-lot offer, listing_id null --
 * qualifying_offers has no dealer_city/dealer_state at all), falls back to
 * the offer's bare dealer_name with no city/state, going through the same
 * null-safe identity-key matching as everything else in dealer_aliases.
 */
export async function resolveDealerAliasForOffer(offerId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: offer, error: offerError } = await admin
    .from("qualifying_offers")
    .select("dealer_name, listing_id")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) {
    throw new Error(`resolveDealerAliasForOffer: offer ${offerId} not found: ${offerError?.message}`);
  }

  if (offer.listing_id) {
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("dealer_name, dealer_city, dealer_state, mc_dealer_id")
      .eq("id", offer.listing_id)
      .maybeSingle();

    if (listingError) {
      throw new Error(`resolveDealerAliasForOffer: failed to load listing ${offer.listing_id}: ${listingError.message}`);
    }

    if (listing?.dealer_name) {
      return getOrCreateDealerAlias(listing.dealer_name, listing.dealer_city, listing.dealer_state, listing.mc_dealer_id);
    }
    // Listing exists but has no dealer_name (shouldn't normally happen --
    // fall through to the offer's own dealer_name below rather than fail.
  }

  return getOrCreateDealerAlias(offer.dealer_name, null, null, null);
}

export interface PostDealSurveySummary {
  sent: string[];
  errors: { searchId: string; error: string }[];
}

/**
 * Finds every purchased search at least POST_DEAL_SURVEY_DELAY_DAYS past
 * purchased_at with no existing post_deal_surveys row, and sends one.
 * Deliberately no search_status filter -- purchased_at alone is the
 * trigger, matching the Day-30 job's own precedent that a later status
 * change (e.g. a purchased-then-cancelled search) doesn't invalidate an
 * already-earned event; the purchase itself, and the dealership experience
 * being asked about, still happened regardless.
 *
 * The survey row is created BEFORE the email is sent, not after -- this is
 * what makes the row's existence a reliable "already sent" guard (the
 * unique constraint on customer_search_id enforces it) and what makes the
 * /account prompt card work even if the email send fails. Email failure is
 * logged, non-fatal -- same standard as every other secondary side effect
 * in this codebase.
 */
export async function sendPostDealSurveys(): Promise<PostDealSurveySummary> {
  const admin = createAdminClient();
  const summary: PostDealSurveySummary = { sent: [], errors: [] };

  const { data: candidates, error: candidatesError } = await admin
    .from("customer_searches")
    .select("id, make, model, customer_id, purchased_at, purchased_qualifying_offer_id")
    .not("purchased_at", "is", null)
    .not("purchased_qualifying_offer_id", "is", null);

  if (candidatesError) {
    throw new Error(`Failed to load candidates for post-deal survey: ${candidatesError.message}`);
  }
  if (!candidates || candidates.length === 0) return summary;

  const now = Date.now();
  const dueMs = POST_DEAL_SURVEY_DELAY_DAYS * 24 * 60 * 60 * 1000;
  const due = candidates.filter((c) => now - new Date(c.purchased_at as string).getTime() >= dueMs);
  if (due.length === 0) return summary;

  const { data: existingSurveys, error: existingError } = await admin
    .from("post_deal_surveys")
    .select("customer_search_id")
    .in(
      "customer_search_id",
      due.map((d) => d.id)
    );
  if (existingError) {
    throw new Error(`Failed to check existing post-deal surveys: ${existingError.message}`);
  }
  const alreadySent = new Set((existingSurveys ?? []).map((s) => s.customer_search_id));
  const toSend = due.filter((d) => !alreadySent.has(d.id));
  if (toSend.length === 0) return summary;

  const customerIds = [...new Set(toSend.map((s) => s.customer_id))];
  const { data: customers } = await admin.from("customers").select("id, email, first_name, last_name").in("id", customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  for (const search of toSend) {
    try {
      const dealerAliasId = await resolveDealerAliasForOffer(search.purchased_qualifying_offer_id as string);

      const { data: surveyRow, error: insertError } = await admin
        .from("post_deal_surveys")
        .insert({
          customer_search_id: search.id,
          qualifying_offer_id: search.purchased_qualifying_offer_id as string,
          dealer_alias_id: dealerAliasId,
        })
        .select("id")
        .single();

      if (insertError || !surveyRow) {
        // Unique-violation on customer_search_id means a concurrent run
        // already created it -- not a real error, just a race we lost.
        if (insertError?.code === "23505") continue;
        throw new Error(insertError?.message ?? "Insert returned no row");
      }

      const customer = customerById.get(search.customer_id);
      if (customer?.email) {
        const surveyUrl = `${siteUrl}/survey/${surveyRow.id}`;
        try {
          await sendEmail({
            to: customer.email,
            toName: customerDisplayName(customer),
            subject: "How was your experience?",
            html:
              `<p>Congratulations on your ${search.make} ${search.model}! Now that the dust has settled, ` +
              `we'd love to hear how the dealership handled closing the deal.</p>` +
              `<p><a href="${surveyUrl}">Take the 2-minute survey</a></p>`,
          });
        } catch (emailErr) {
          console.error(`Post-deal survey email failed for search ${search.id}:`, emailErr);
        }
      }

      summary.sent.push(search.id);
    } catch (err) {
      summary.errors.push({ searchId: search.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}
