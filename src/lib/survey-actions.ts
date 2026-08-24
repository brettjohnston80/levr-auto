"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SubmitSurveyInput {
  surveyId: string;
  dealershipAvailabilityRating: number;
  dealershipResponsivenessRating: number;
  dealershipTransparencyRating: number;
  dealershipFinancePressureRating: number;
  dealershipProfessionalismRating: number;
  agentRecommend: boolean;
  agentComment: string;
  levrOverallRating: number;
  levrOverallComment: string;
}

export type SubmitSurveyResult = { ok: true } | { ok: false; error: string };

function isValidStar(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * Locks on submit -- the .is("submitted_at", null) write guard is the real
 * enforcement (re-checked here, not just the earlier read), same
 * idempotency idiom used throughout this codebase (respondToOffer,
 * markOfferVehicleSold, etc.) so a double-submit or race can't overwrite an
 * already-recorded response.
 */
export async function submitPostDealSurvey(input: SubmitSurveyInput): Promise<SubmitSurveyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const admin = createAdminClient();
  const { data: survey, error: surveyError } = await admin
    .from("post_deal_surveys")
    .select("id, customer_search_id, submitted_at")
    .eq("id", input.surveyId)
    .maybeSingle();

  if (surveyError || !survey) {
    return { ok: false, error: "Survey not found." };
  }
  if (survey.submitted_at) {
    return { ok: false, error: "This survey has already been submitted." };
  }

  const { data: search } = await admin
    .from("customer_searches")
    .select("customer_id")
    .eq("id", survey.customer_search_id)
    .maybeSingle();

  if (!search || search.customer_id !== user.id) {
    return { ok: false, error: "Not authorized." };
  }

  const ratings = [
    input.dealershipAvailabilityRating,
    input.dealershipResponsivenessRating,
    input.dealershipTransparencyRating,
    input.dealershipFinancePressureRating,
    input.dealershipProfessionalismRating,
    input.levrOverallRating,
  ];
  if (!ratings.every(isValidStar)) {
    return { ok: false, error: "All ratings are required." };
  }
  if (typeof input.agentRecommend !== "boolean") {
    return { ok: false, error: "Please answer the agent recommendation question." };
  }

  const { data: updated, error: updateError } = await admin
    .from("post_deal_surveys")
    .update({
      dealership_availability_rating: input.dealershipAvailabilityRating,
      dealership_responsiveness_rating: input.dealershipResponsivenessRating,
      dealership_transparency_rating: input.dealershipTransparencyRating,
      dealership_finance_pressure_rating: input.dealershipFinancePressureRating,
      dealership_professionalism_rating: input.dealershipProfessionalismRating,
      agent_recommend: input.agentRecommend,
      agent_comment: input.agentComment.trim() || null,
      levr_overall_rating: input.levrOverallRating,
      levr_overall_comment: input.levrOverallComment.trim() || null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", input.surveyId)
    .is("submitted_at", null)
    .select("id");

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "This survey has already been submitted." };
  }

  return { ok: true };
}
