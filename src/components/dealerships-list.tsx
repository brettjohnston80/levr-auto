import type { ConfirmedDealership } from "@/lib/dealership-queue";
import { DealershipCard } from "@/components/dealership-card";

export function DealershipsList({ dealerships }: { dealerships: ConfirmedDealership[] }) {
  if (dealerships.length === 0) {
    return <p className="text-sm text-zinc-500">No confirmed dealerships yet.</p>;
  }

  return (
    <div className="space-y-4">
      {dealerships.map((d) => (
        <DealershipCard key={d.id} dealership={d} />
      ))}
    </div>
  );
}
