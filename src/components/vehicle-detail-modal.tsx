"use client";

import type { Answers, MockVehicle } from "@/lib/matchmaker-data";

// Only ever includes a bullet for something that actually matches the
// vehicle's real data against the user's specific answers -- no filler for
// answers that don't line up, per the UX review ask (#7).
function buildFitBullets(vehicle: MockVehicle, answers: Answers): string[] {
  const bullets: string[] = [];

  const typeMatches = answers.vehicleType !== "" && vehicle.bodyType === answers.vehicleType;
  if (typeMatches) {
    bullets.push(`Matches your ${answers.vehicleType} preference.`);
  }

  if (answers.powertrain && vehicle.powertrain === answers.powertrain) {
    bullets.push(`${answers.powertrain} powertrain, as you wanted.`);
  }

  if (answers.familySize && vehicle.seatsCategory === answers.familySize) {
    bullets.push(`Seating sized right for your group (${answers.familySize} riders).`);
  }

  if (
    answers.priceRange &&
    vehicle.priceValue >= answers.priceRange.min &&
    vehicle.priceValue <= answers.priceRange.max
  ) {
    bullets.push("Falls within your target price range.");
  }

  if (answers.useCase && typeMatches) {
    bullets.push(`A solid fit for "${answers.useCase}."`);
  }

  answers.priorities.slice(0, 3).forEach((label, index) => {
    const score = vehicle.priorityScores[label] ?? 0;
    if (score >= 4) {
      bullets.push(`Scores well on ${label}, your #${index + 1} priority.`);
    }
  });

  return bullets;
}

export function VehicleDetailModal({
  vehicle,
  answers,
  onClose,
}: {
  vehicle: MockVehicle;
  answers: Answers;
  onClose: () => void;
}) {
  const bullets = buildFitBullets(vehicle, answers);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <p className="pr-8 text-xs font-semibold tracking-wide text-emerald-400 uppercase">
          {vehicle.bodyType} · {vehicle.powertrain}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          {vehicle.make} {vehicle.model}
        </h2>
        <p className="mt-1 text-sm font-semibold text-emerald-400">{vehicle.priceEstimate}</p>

        <p className="mt-4 text-sm leading-relaxed text-zinc-300">{vehicle.rationale}</p>

        {bullets.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Why this fits you</h3>
            <ul className="mt-3 space-y-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
          Full spec sheets and trusted review videos will show up here once Matchmaker connects to
          real inventory data.
        </p>
      </div>
    </div>
  );
}
