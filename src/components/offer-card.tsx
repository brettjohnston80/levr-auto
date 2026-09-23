import { OfferResponseButtons } from "@/components/offer-response-buttons";
import { OfferPhoto } from "@/components/offer-photo";
import { AddonRemovalButton } from "@/components/addon-removal-button";
import { FinancingCaptureForm } from "@/components/financing-capture-form";
import { DeliveryPreferenceForm } from "@/components/delivery-preference-form";
import { ServiceAgreementSigning } from "@/components/service-agreement-signing";
import { computeOfferSavings } from "@/lib/offer-comparison";
import { formatCents, formatDate } from "@/lib/dashboard-format";
import type { DashboardOffer } from "@/lib/customer-dashboard";

const ADDON_REMOVAL_STATUS_COPY: Record<string, string> = {
  pending: "Removal requested — waiting on the dealer",
  dealer_accepted: "Dealer agreed to remove this",
  dealer_declined: "Dealer declined to remove this",
  dealer_countered: "Dealer countered",
};

const ADDON_REREQUESTABLE_STATUSES = ["none", "dealer_declined", "dealer_countered"];

// Extracted out of /account/deal's offers list (2026-09-23) so the same
// markup can also render a purchased search's single accepted-offer card --
// two copies of this would be exactly the kind of thing that drifts (a
// future fix to one card shape not making it to the other).
export function OfferCard({
  offer,
  make,
  model,
  isBestValue,
}: {
  offer: DashboardOffer;
  make: string | null;
  model: string | null;
  isBestValue: boolean;
}) {
  const savings = computeOfferSavings(offer);

  return (
    <li className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex gap-4">
        <OfferPhoto
          photoUrl={offer.photoUrl}
          alt={
            offer.vehicleExteriorColor
              ? `${make ?? ""} ${model ?? ""} in ${offer.vehicleExteriorColor}`.trim()
              : `${make ?? ""} ${model ?? ""}`.trim()
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-white">{offer.dealerName}</span>
            <div className="flex flex-wrap gap-2">
              {isBestValue && (
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950">
                  Best value
                </span>
              )}
              {offer.isBelowMsrp && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                  Below Total SRP
                </span>
              )}
            </div>
          </div>
          {offer.vehicleTrim && <p className="mt-0.5 text-xs text-zinc-500">Trim: {offer.vehicleTrim}</p>}
          <p className="mt-2 text-sm text-zinc-400">
            Offer: <span className="text-white">{formatCents(offer.offerPriceCents)}</span> — Total
            Suggested Retail Price: {formatCents(offer.msrpCents)}
          </p>
          {savings && (
            <p className="mt-0.5 text-sm font-medium text-emerald-400">
              {formatCents(savings.belowMsrpCents)} below Total SRP ({savings.belowMsrpPercent}% off)
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Delivered {formatDate(offer.deliveredAt)} — status: {offer.status.replace(/_/g, " ")}
            {offer.customerRespondedAt && ` on ${formatDate(offer.customerRespondedAt)}`}
          </p>
          {offer.offerSheetUrl && (
            <a
              href={offer.offerSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-emerald-400 underline hover:text-emerald-300"
            >
              View offer sheet (PDF)
            </a>
          )}
          {offer.status === "pending" && <OfferResponseButtons offerId={offer.id} />}
        </div>
      </div>

      {offer.addons.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase">Add-ons</p>
          <ul className="mt-2 space-y-2">
            {offer.addons.map((addon) => (
              <li key={addon.id} className="text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-zinc-300">
                    {addon.description} — {formatCents(addon.amountCents)}
                  </span>
                  {ADDON_REREQUESTABLE_STATUSES.includes(addon.removalStatus) ? (
                    <AddonRemovalButton addonId={addon.id} />
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {ADDON_REMOVAL_STATUS_COPY[addon.removalStatus] ?? addon.removalStatus}
                    </span>
                  )}
                </div>
                {addon.dealerResponse && (
                  <p className="mt-1 text-xs text-zinc-500">&ldquo;{addon.dealerResponse}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {offer.status === "customer_accepted" && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-xs font-semibold text-emerald-400 uppercase">Congratulations — next steps</p>

          <p className="mt-2 text-xs text-zinc-400">
            {offer.dealProgress?.availabilityReconfirmedAt
              ? `Dealer confirmed availability on ${formatDate(offer.dealProgress.availabilityReconfirmedAt)}.`
              : "Waiting on the dealer to reconfirm the vehicle is still available."}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {offer.dealProgress?.depositConfirmedAt
              ? `Deposit confirmed: ${formatCents(offer.dealProgress.depositAmountCents ?? 0)} on ${formatDate(offer.dealProgress.depositConfirmedAt)}.`
              : "A refundable deposit is paid directly to the dealer to reserve the car — we'll show it here once the dealer confirms they've received it."}
          </p>

          <FinancingCaptureForm offerId={offer.id} existing={offer.dealProgress} />

          <DeliveryPreferenceForm offerId={offer.id} existing={offer.dealProgress} />

          <ServiceAgreementSigning offerId={offer.id} initiallySigned={!!offer.serviceAgreementSignedAt} />
        </div>
      )}
    </li>
  );
}
