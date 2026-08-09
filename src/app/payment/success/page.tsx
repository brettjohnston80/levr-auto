import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payment Received — LEVR Auto",
};

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

  let paid = false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    paid = session.payment_status === "paid" && session.metadata?.customer_id === user.id;
  } catch {
    paid = false;
  }

  if (!paid) {
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

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-md px-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          ✓
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">Payment received</h1>
        <p className="mt-4 text-zinc-400">
          Your search is officially underway. You have 24 hours to fine-tune trim, color, and
          options before it locks in — after that, we start reaching out to dealers.
        </p>
        <Link
          href="/account"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          View My Account
        </Link>
      </div>
    </section>
  );
}
