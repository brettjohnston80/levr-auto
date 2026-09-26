import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerThread } from "@/lib/offer-messages";
import { frozenThreadCopy } from "@/lib/offer-messages-shared";
import { OfferMessageList } from "@/components/offer-message-list";
import { OfferMessageComposer } from "@/components/offer-message-composer";
import { formatCents } from "@/lib/dashboard-format";
import { UnreadCountRefresh } from "@/components/unread-count-refresh";

export const metadata: Metadata = {
  title: "Messages — LEVR Auto",
};

export const dynamic = "force-dynamic";

// Searches Your Deal no longer shows (same list as that page), so there's no
// offer detail to link back to.
const NO_DEAL_PAGE_STATUSES = ["switched", "cancelled", "closed"];

export default async function MessageThreadPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/account/messages/${offerId}`);

  const admin = createAdminClient();
  const thread = await getCustomerThread(admin, user.id, offerId);
  if (!thread) notFound();

  // Viewing the thread is what marks it read (same idea as delivered_at
  // being set when an offer is first loaded on the dashboard).
  await admin
    .from("qualifying_offers")
    .update({ customer_messages_read_at: new Date().toISOString() })
    .eq("id", offerId);

  const vehicle = [thread.make, thread.model].filter(Boolean).join(" ");

  return (
    <section className="bg-zinc-950 py-24">
      <UnreadCountRefresh />
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/account/messages" className="text-sm text-zinc-400 hover:text-white">
          ← All messages
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{thread.dealerName}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {vehicle} · {formatCents(thread.offerPriceCents)}
        </p>
        {!NO_DEAL_PAGE_STATUSES.includes(thread.searchStatus) && (
          <Link
            href={`/account/deal?searchId=${thread.searchId}&offer=${thread.offerId}`}
            className="mt-2 inline-block text-sm text-emerald-400 underline hover:text-emerald-300"
          >
            View offer details
          </Link>
        )}

        <div className="mt-8">
          {thread.messages.length > 0 ? (
            <OfferMessageList messages={thread.messages} viewer="customer" />
          ) : (
            thread.open && (
              <p className="text-sm text-zinc-400">
                No messages yet. Ask your agent anything about this offer — they&apos;ll reply here.
              </p>
            )
          )}
        </div>

        <div className="mt-6">
          {thread.open ? (
            <OfferMessageComposer offerId={thread.offerId} sender="customer" />
          ) : (
            <p className="text-sm text-zinc-500">{frozenThreadCopy(thread.offerStatus)}</p>
          )}
        </div>
      </div>
    </section>
  );
}
