import { notFound } from "next/navigation";
import { requireAgent } from "@/lib/agent-auth";
import { getOfferEntryContext } from "@/lib/offer-entry-context";
import { OfferEntryForm } from "@/components/offer-entry-form";

export const dynamic = "force-dynamic";

// Log an offer (offer entry, Chunk 4): every agent (C16), any search status (an inactive
// search is a warning at Send, not a refusal here).
export default async function LogOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ searchId: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  await requireAgent();
  const { searchId } = await params;
  const { submission } = await searchParams;
  const ctx = await getOfferEntryContext(searchId, submission ?? null);
  if (!ctx) notFound();
  const { search } = ctx;
  const vehicle = [ctx.modelYear, search.make, search.model].filter(Boolean).join(" ");

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <OfferEntryForm
          searchId={searchId}
          title={`Log an offer for ${ctx.customerFirstName?.trim() || "the customer"} — ${vehicle}`}
          customerFirstName={ctx.customerFirstName}
          makeModel={`${search.make} ${search.model}`}
          listings={search.listings}
          modelYear={ctx.modelYear ?? null}
          guaranteeExceptionMake={search.guaranteeExceptionMake}
          stickerRanges={search.stickerRanges}
          selections={search.selections}
          trimPreferences={search.trimPreferences}
          searchTrim={search.trim}
          otherOffers={ctx.otherOffers}
          drafts={ctx.drafts}
          manufacturerFee={ctx.manufacturerFee}
          initial={ctx.draft ? { submissionId: ctx.draft.id, payload: ctx.draft.payload } : null}
        />
      </div>
    </main>
  );
}
