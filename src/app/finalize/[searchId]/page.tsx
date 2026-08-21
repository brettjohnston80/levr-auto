import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTrimOptions } from "@/lib/finalize-trims";
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
  const { data: listingsForModel } = await admin
    .from("listings")
    .select("trim, price_cents")
    .eq("make", search.make)
    .eq("model", search.model)
    .not("trim", "is", null);

  const trimOptions = buildTrimOptions(listingsForModel ?? []);

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <FinalizeChoice
          searchId={search.id}
          make={search.make}
          model={search.model}
          callAlreadyRequested={!!search.call_requested_at}
          trimOptions={trimOptions}
        />
      </div>
    </section>
  );
}
