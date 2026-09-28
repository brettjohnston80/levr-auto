import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerGeneralThread } from "@/lib/offer-messages";
import { GENERAL_THREAD_COPY } from "@/lib/offer-messages-shared";
import { OfferMessageList } from "@/components/offer-message-list";
import { OfferMessageComposer } from "@/components/offer-message-composer";
import { UnreadCountRefresh } from "@/components/unread-count-refresh";

export const metadata: Metadata = {
  title: "Messages — LEVR Auto",
};

export const dynamic = "force-dynamic";

// The customer's general thread with their agent (2026-09-27): not about any
// one offer, so it's always open. A static segment, so it wins over the
// sibling [offerId] route.
export default async function GeneralThreadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/messages/general");

  const admin = createAdminClient();
  const thread = await getCustomerGeneralThread(admin, user.id);

  // Viewing marks it read, same as an offer thread. No row yet means nothing
  // has been sent, so there's nothing to mark.
  await admin
    .from("general_threads")
    .update({ customer_messages_read_at: new Date().toISOString() })
    .eq("customer_id", user.id);

  const { data: customerRow } = await admin.from("customers").select("notify_by_email").eq("id", user.id).maybeSingle();
  const emailAlerts = customerRow?.notify_by_email !== false;

  return (
    <section className="bg-zinc-950 py-24">
      <UnreadCountRefresh />
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/account/messages" className="text-sm text-zinc-400 hover:text-white">
          ← All messages
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{GENERAL_THREAD_COPY.title}</h1>

        <div className="mt-8">
          {thread.messages.length > 0 ? (
            <OfferMessageList messages={thread.messages} viewer="customer" />
          ) : (
            <p className="text-sm text-zinc-400">{GENERAL_THREAD_COPY.emptyState}</p>
          )}
        </div>

        <div className="mt-6">
          <OfferMessageComposer offerId={null} sender="customer" emailAlerts={emailAlerts} />
        </div>
      </div>
    </section>
  );
}
