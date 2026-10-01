import type { Metadata } from "next";
import { verifyUnpaidReminderUnsubscribeToken } from "@/lib/unsubscribe-token";
import { unsubscribeFromUnpaidReminders } from "@/lib/unpaid-reminders";

export const metadata: Metadata = {
  title: "Unsubscribe — LEVR Auto",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Unsubscribe from the unpaid-search reminders (approved copy, 2026-09-30).
// One click: opening the signed link unsubscribes, no sign-in and no
// confirm button. It stops only these reminders.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const customerId = verifyUnpaidReminderUnsubscribeToken(token);
  const ok = customerId ? await unsubscribeFromUnpaidReminders(customerId) : false;

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-xl px-6 text-center">
        {ok ? (
          <>
            <h1 className="text-2xl font-semibold text-white">You&apos;re unsubscribed</h1>
            <p className="mt-3 text-sm text-zinc-400">
              We won&apos;t send you any more reminders about finishing your search. You&apos;ll still get
              emails about your account and any deal in progress.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            This unsubscribe link isn&apos;t valid. Email{" "}
            <a href="mailto:support@levrauto.com" className="text-emerald-400 underline hover:text-emerald-300">
              support@levrauto.com
            </a>{" "}
            and we&apos;ll take care of it.
          </p>
        )}
      </div>
    </section>
  );
}
