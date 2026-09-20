import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinalizeChoice } from "@/components/finalize-choice";
import { getFinalizeChoiceData } from "@/lib/finalize-choice-data";

export const metadata: Metadata = {
  title: "Finalize Your Search — LEVR Auto",
};

export const dynamic = "force-dynamic";

export default async function FinalizePage({
  params,
}: {
  params: Promise<{ searchId: string }>;
}) {
  const { searchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: search } = await supabase
    .from("customer_searches")
    .select("id, make, model, model_year, search_status, call_requested_at, paid_at")
    .eq("id", searchId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!search) {
    notFound();
  }

  if (!search.paid_at) {
    // Payment hasn't landed yet (or this row belongs to someone else's
    // in-progress checkout) -- nothing to finalize.
    redirect("/");
  }

  if (search.search_status !== "awaiting_finalization") {
    // Already finalized (or further along) -- nothing left to do here.
    redirect("/account");
  }

  // Real current inventory, real configurator gating, real dataset
  // options -- all of it shared with /account/vehicle now (2026-09-18),
  // the new persistent home for this same choice. See that function's own
  // comment for why this moved out rather than staying inlined here.
  const { trimOptions, configuratorQuestions, makeModelOptions, modelYearOptions, inventoryBlock } =
    await getFinalizeChoiceData(search);

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <FinalizeChoice
          searchId={search.id}
          make={search.make}
          model={search.model}
          callAlreadyRequested={!!search.call_requested_at}
          trimOptions={trimOptions}
          configuratorQuestions={configuratorQuestions}
          makeModelOptions={makeModelOptions}
          modelYear={(search.model_year as number | null) ?? null}
          modelYearOptions={modelYearOptions}
          inventoryBlock={inventoryBlock}
        />
      </div>
    </section>
  );
}
