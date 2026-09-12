import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTrimOptions } from "@/lib/finalize-trims";
import { getConfiguratorQuestionsForTrims } from "@/lib/configurator-questions";
import { hasAnyQuestion, type ConfiguratorQuestions } from "@/lib/configurator-matching";
import { FinalizeChoice } from "@/components/finalize-choice";

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
    .select("id, make, model, search_status, call_requested_at, paid_at")
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

  // Real current inventory for this exact make/model, synced on-demand by
  // the Stripe webhook at payment time (see api/stripe/webhook/route.ts).
  // Empty here just means the sync hasn't landed yet or found nothing --
  // FinalizeSelfService degrades gracefully to a plain text trim field.
  //
  // Admin client required here, not the regular signed-in client above --
  // listings has RLS enabled with zero policies for any role (service-role
  // only, by design, per initial_schema.sql), so the RLS-subject client
  // always returned empty here regardless of real synced data. Matches the
  // same admin-client pattern already used for every other listings read
  // in this codebase (outreach-queue.ts's buildTrimOptions call, etc).
  const admin = createAdminClient();

  // Paginated, not a plain select. PostgREST caps a select at 1,000 rows
  // and truncates SILENTLY -- a popular make/model accumulates listings
  // across repeated syncs (Honda Civic already sits at 569 real rows), and
  // a capped read here would not error, it would quietly drop trim options
  // the customer could have chosen. An undecided search has no make/model
  // yet, so there is nothing to look up at all.
  //
  // powertrain rides along as a selected SCALAR rather than the whole
  // raw_data blob: the configurator gate needs build.powertrain_type to
  // tell a hybrid build from a gas one, and pulling the full MarketCheck
  // payload for hundreds of listings to read one string would be wasteful.
  const listingsForModel: {
    trim: string | null;
    price_cents: number | null;
    year: number | null;
    powertrain: string | null;
  }[] = [];
  if (search.make && search.model) {
    const PAGE_SIZE = 1000;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from("listings")
        .select("id, trim, price_cents, year, powertrain:raw_data->build->>powertrain_type")
        .eq("make", search.make)
        .eq("model", search.model)
        .not("trim", "is", null)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) break;
      listingsForModel.push(...((data ?? []) as unknown as typeof listingsForModel));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  const trimOptions = buildTrimOptions(listingsForModel);

  // Rich configurator questions, where this exact trim resolves to one
  // researched build. A miss -- no live batch, no configurator data for
  // this make, or an ambiguous trim -- yields nothing here and the flow
  // below is byte-for-byte today's behaviour. Inert until step 9 promotes
  // a batch.
  const gating = await getConfiguratorQuestionsForTrims(
    search.make,
    search.model,
    trimOptions,
    listingsForModel,
  );
  const configuratorQuestions: Record<string, ConfiguratorQuestions> = {};
  for (const [optionId, result] of gating) {
    if (result.questions && hasAnyQuestion(result.questions)) {
      configuratorQuestions[optionId] = result.questions;
    }
  }

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
        />
      </div>
    </section>
  );
}
