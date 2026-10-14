import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getRefundsDueQueue } from "@/lib/refunds-due";
import { RefundsDueList } from "@/components/refund-due-actions";

export const metadata: Metadata = {
  title: "Refunds Due — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function RefundsDuePage() {
  const agent = await requireAgent();
  const queue = await getRefundsDueQueue();

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Refunds Due</h1>
        <p className="mt-1 break-words text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Guarantee not met by Day 30. Issue each refund here, or record one that was already issued in Stripe.
        </p>
        <RefundsDueList
          initialRows={queue.map((row) => ({
            id: row.id,
            vehicle: `${row.make} ${row.model}${row.trim ? ` — ${row.trim}` : ""}`,
            customerName: row.customerName,
            customerEmail: row.customerEmail,
            resolvedLabel: formatDate(row.resolvedAt),
            paymentId: row.paymentId,
            remainingCents: row.remainingCents,
          }))}
        />
      </div>
    </section>
  );
}
