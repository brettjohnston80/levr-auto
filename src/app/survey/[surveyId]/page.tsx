import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostDealSurveyForm } from "@/components/post-deal-survey-form";

export const metadata: Metadata = {
  title: "How was your experience? — LEVR Auto",
};

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/survey/${surveyId}`)}`);
  }

  // post_deal_surveys has no RLS policies (service-role only, same
  // convention as every other table this session) -- ownership is checked
  // in application code against customer_searches.customer_id below, same
  // pattern as offer_addons -> qualifying_offers -> customer_searches
  // ownership checks elsewhere in this codebase.
  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("post_deal_surveys")
    .select("id, customer_search_id, dealer_alias_id, submitted_at")
    .eq("id", surveyId)
    .maybeSingle();

  if (!survey) {
    notFound();
  }

  const { data: search } = await admin
    .from("customer_searches")
    .select("customer_id, make, model, trim")
    .eq("id", survey.customer_search_id)
    .maybeSingle();

  if (!search || search.customer_id !== user.id) {
    notFound();
  }

  const { data: alias } = await admin
    .from("dealer_aliases")
    .select("dealer_name")
    .eq("id", survey.dealer_alias_id)
    .maybeSingle();

  const vehicleLabel = [search.make, search.model, search.trim].filter(Boolean).join(" ");
  const dealerName = alias?.dealer_name ?? "the dealership";

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        {survey.submitted_at ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <h1 className="text-2xl font-semibold text-white">Already submitted</h1>
            <p className="mt-3 text-sm text-zinc-400">
              Thanks — we already have your feedback on this one, and responses can&apos;t be edited after
              submitting.
            </p>
          </div>
        ) : (
          <PostDealSurveyForm surveyId={survey.id} vehicleLabel={vehicleLabel} dealerName={dealerName} />
        )}
      </div>
    </section>
  );
}
