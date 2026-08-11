import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getRefundsDueQueue } from "@/lib/refunds-due";

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
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-2xl font-semibold text-white">Refunds Due</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Guarantee not met by Day 30 — process each refund manually in Stripe. Read-only; nothing
          here marks a refund as processed.
        </p>

        {queue.length === 0 ? (
          <p className="mt-10 text-zinc-400">No refunds currently due.</p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Search</th>
                  <th className="px-4 py-3 font-medium">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queue.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="text-white">{row.customerName ?? "—"}</div>
                      <div className="text-zinc-500">{row.customerEmail ?? "unknown"}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.make} {row.model}
                      {row.trim ? ` — ${row.trim}` : ""}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(row.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
