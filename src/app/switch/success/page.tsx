import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Switch Confirmed — LEVR Auto",
};

/**
 * Mirrors /payment/success's exact verification pattern -- retrieves the
 * Stripe session directly (not from the DB) to confirm paid + ownership +
 * that this really is a switch_fee session, never trusting the query
 * string alone. Unlike the original flow, the new customer_searches row
 * doesn't exist yet when this page first loads -- it's only created by
 * the webhook's switch_customer_search RPC call, which runs independently
 * of Stripe's redirect back to this page. So this checks whether the old
 * search has already been marked switched (superseded_by_id set); if so,
 * hands off to /finalize/[newId] exactly like the free-switch path does.
 * If the webhook hasn't landed yet, shows a plain "hang tight" message
 * with a link to /account rather than polling -- same honest, no-new-
 * machinery fallback /payment/success already uses for its own edge case.
 */
export default async function SwitchSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/account");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let oldSearchId: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid =
      session.payment_status === "paid" &&
      session.metadata?.type === "switch_fee" &&
      session.metadata?.customer_id === user.id;
    if (paid) {
      oldSearchId = session.metadata?.old_search_id ?? null;
    }
  } catch {
    oldSearchId = null;
  }

  if (oldSearchId) {
    const { data: oldSearch } = await supabase
      .from("customer_searches")
      .select("superseded_by_id")
      .eq("id", oldSearchId)
      .maybeSingle();

    if (oldSearch?.superseded_by_id) {
      redirect(`/finalize/${oldSearch.superseded_by_id}`);
    }

    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-md px-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Payment confirmed — finishing your switch
          </h1>
          <p className="mt-4 text-zinc-400">
            This usually takes just a moment. Check your{" "}
            <Link href="/account" className="text-emerald-400 hover:text-emerald-300">
              account
            </Link>{" "}
            shortly to finish setting up your new search.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-md px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          We couldn&apos;t confirm that payment
        </h1>
        <p className="mt-4 text-zinc-400">
          If you completed checkout, this can take a moment to sync — check your{" "}
          <Link href="/account" className="text-emerald-400 hover:text-emerald-300">
            account
          </Link>{" "}
          shortly, or contact us if this persists.
        </p>
      </div>
    </section>
  );
}
