"use client";

import { useState } from "react";
import { SilhouetteIcon } from "@/components/vehicle-silhouette";

// photoUrl is resolved server-side (customer-dashboard.ts) -- vehicleColorImageUrl
// needs filesystem access, which isn't available from a client component.
// This component only ever renders a URL it was handed, plus a broken-image
// guard (onError) so a stale/renamed file on disk degrades to the same
// honest placeholder as "we never had a photo", never a broken-image glyph
// -- same discipline already established for Thumb (ranking-question.tsx).
export function OfferPhoto({ photoUrl, alt }: { photoUrl: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (photoUrl && !broken) {
    return (
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-24 sm:w-32">
        {/* eslint-disable-next-line @next/next/no-img-element -- an arbitrary
            file dropped into public/ at deploy time, not a fixed set
            next/image can be configured against (same convention as Thumb,
            ranking-question.tsx). */}
        <img
          src={photoUrl}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] sm:h-24 sm:w-32">
      <span className="absolute top-1 left-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-400 uppercase">
        Photo coming soon
      </span>
      <SilhouetteIcon vehicleType="" className="h-9 w-20 text-zinc-500" />
    </div>
  );
}
