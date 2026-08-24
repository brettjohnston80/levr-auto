"use client";

// Standard 5-star control, anchored at 1/3/5 (2/4 are unlabeled
// intermediate clicks between their neighbors) -- confirmed with Brett
// rather than assumed.
interface StarRatingProps {
  value: number | null;
  onChange: (value: number) => void;
  anchors?: { 1: string; 3: string; 5: string };
}

export function StarRating({ value, onChange, anchors }: StarRatingProps) {
  return (
    <div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={value === n}
            className={`text-3xl leading-none transition-colors ${
              value !== null && n <= value ? "text-emerald-400" : "text-zinc-700 hover:text-zinc-500"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {anchors && (value === 1 || value === 3 || value === 5) && (
        <p className="mt-1 text-xs text-zinc-500">{anchors[value]}</p>
      )}
    </div>
  );
}
