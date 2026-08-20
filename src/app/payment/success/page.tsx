import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payment Received — LEVR Auto",
};

// No more static "Payment received" screen -- Stripe confirming payment
// means there's exactly one place to go next: finalize trim/color/options
// for the search that was just paid for (see /finalize/[searchId]). This
// page's only job now is to verify the session actually belongs to this
// user and hand off the searchId from Stripe's own metadata.
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let searchId: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid" && session.metadata?.customer_id === user.id;
    if (paid) {
      searchId = session.metadata?.customer_search_id ?? null;
    }
  } catch {
    searchId = null;
  }

  if (searchId) {
    const { data: search } = await supabase
      .from("customer_searches")
      .select("make, model")
      .eq("id", searchId)
      .maybeSingle();

    if (search && !search.make && !search.model) {
      redirect("/account");
    }

    redirect(`/finalize/${searchId}`);
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
