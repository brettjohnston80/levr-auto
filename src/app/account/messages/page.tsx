import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerThreads } from "@/lib/offer-messages";
import { formatCents, formatDate } from "@/lib/dashboard-format";

export const metadata: Metadata = {
  title: "Messages — LEVR Auto",
};

export const dynamic = "force-dynamic";

// Every offer thread the customer has, across all their searches (frozen
// ones included -- they stay readable), newest activity first. Threads are
// started from an offer's detail view, so there is no "new message" button.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const unreadOnly = filter === "unread";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/messages");

  const allThreads = await getCustomerThreads(createAdminClient(), user.id);
  const unreadCount = allThreads.filter((t) => t.unread).length;
  // "Unread" filter (2026-09-26). Opening a thread marks it read, so it drops
  // off this list the next time the page loads.
  const threads = unreadOnly ? allThreads.filter((t) => t.unread) : allThreads;

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/account" className="text-sm text-zinc-400 hover:text-white">
          ← Back to your account
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">Messages</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your conversations with your LEVR agent, one per offer. Newest first.
        </p>

        {allThreads.length > 0 && (
          <nav aria-label="Filter messages" className="mt-5 flex gap-2 text-sm">
            {[
              { href: "/account/messages", label: "All", active: !unreadOnly },
              { href: "/account/messages?filter=unread", label: `Unread (${unreadCount})`, active: unreadOnly },
            ].map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`rounded-full px-3 py-1 ${
                  tab.active ? "bg-white/10 font-semibold text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}

        {unreadOnly && threads.length === 0 && allThreads.length > 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No unread messages.</p>
        ) : threads.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">
            No messages yet. You can message your agent from any offer on{" "}
            <Link href="/account/deal" className="text-emerald-400 underline hover:text-emerald-300">
              Your Deal
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {threads.map((t) => (
              <li key={t.offerId}>
                <Link
                  href={`/account/messages/${t.offerId}`}
                  className={`block rounded-2xl border p-4 transition-colors hover:border-white/25 ${
                    t.unread ? "border-emerald-400/40 bg-emerald-400/[0.04]" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      {t.unread && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Unread" role="img" />
                      )}
                      {t.dealerName}
                      {!t.open && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs font-normal text-zinc-400">
                          Closed
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-zinc-500">{formatDate(t.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {[t.make, t.model].filter(Boolean).join(" ")} · {formatCents(t.offerPriceCents)}
                  </p>
                  {t.lastMessage && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-300">
                      <span className="text-zinc-400">{t.lastMessage.authorLabel}:</span> {t.lastMessage.body}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
