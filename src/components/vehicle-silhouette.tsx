import type { VehicleType } from "@/lib/matchmaker-data";

// Extracted out of matchmaker.tsx (2026-09-02) so the same illustrative
// body-style silhouette can be reused from vehicle-detail-modal.tsx as a
// photo placeholder, without a circular import (matchmaker.tsx already
// imports VehicleDetailModal, so the silhouette couldn't live in
// matchmaker.tsx itself once a second file needed it too).

const BODY_PATHS: Record<VehicleType, string> = {
  Sedan: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L150 26 Q163 26 172 35 L192 58 L226 65 Q230 66 230 70 L230 78 Z",
  Truck: "M10 78 L10 68 Q10 64 14 64 L40 64 L40 34 Q40 26 50 26 L110 26 Q120 26 126 34 L140 64 L226 64 Q230 64 230 70 L230 78 Z",
  SUV: "M10 78 L10 66 Q10 58 18 55 L36 40 Q44 28 60 28 L182 28 Q198 28 206 40 L222 55 Q230 58 230 66 L230 78 Z",
  Hatchback: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L145 26 Q160 26 168 38 L178 58 L226 62 Q230 63 230 70 L230 78 Z",
  Coupe: "M10 78 L10 72 Q10 69 13 68 L60 62 L92 32 Q100 25 112 25 L150 25 Q160 25 166 33 L184 58 L226 66 Q230 67 230 72 L230 78 Z",
  Convertible: "M10 78 L10 72 Q10 69 13 68 L50 64 L70 50 Q76 45 84 45 L160 45 Q168 45 174 50 L196 64 L226 68 Q230 69 230 72 L230 78 Z",
  Minivan: "M10 78 L10 58 Q10 46 22 42 L38 30 Q48 24 62 24 L184 24 Q196 24 204 32 L220 46 Q230 50 230 62 L230 78 Z",
  "Cargo Van": "M14 78 L14 30 Q14 24 20 24 L222 24 Q228 24 228 30 L228 78 Z",
  // Same front-end language as Sedan/Hatchback (hood + rising windshield),
  // but the roofline stays flat much further back before a short, steep
  // liftgate drop at the rear -- the defining silhouette difference for a
  // wagon vs. a sedan (short trunk) or hatchback (shorter flat roof).
  Wagon: "M10 78 L10 70 Q10 66 14 65 L46 58 L70 34 Q78 26 92 26 L196 26 Q210 26 216 38 L224 58 L228 62 Q230 64 230 70 L230 78 Z",
};

function VehicleBody({ d, className, cargoSeam }: { d: string; className?: string; cargoSeam?: boolean }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="currentColor">
      <path d={d} />
      {cargoSeam && (
        <line x1="188" y1="28" x2="188" y2="78" stroke="black" strokeOpacity="0.35" strokeWidth="2" />
      )}
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

function DefaultSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 110" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6">
      <path d="M10 78 L10 68 Q10 60 18 56 L40 44 L64 30 Q74 24 86 24 L156 24 Q168 24 178 32 L204 50 L226 58 Q230 60 230 66 L230 78 Z" />
      <circle cx="62" cy="82" r="14" />
      <circle cx="178" cy="82" r="14" />
    </svg>
  );
}

export function SilhouetteIcon({ vehicleType, className }: { vehicleType: VehicleType | ""; className?: string }) {
  if (!vehicleType) return <DefaultSilhouette className={className} />;
  return (
    <VehicleBody
      d={BODY_PATHS[vehicleType]}
      className={className}
      cargoSeam={vehicleType === "Cargo Van"}
    />
  );
}
