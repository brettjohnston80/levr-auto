import type { SearchTimelineBannerTone, SearchTimelineStage } from "@/lib/search-timeline";

// Dot/fill-bar mechanics generalized from guarantee.tsx's static 3-point
// timeline (Day 0/30/60) to an arbitrary stage count with a dynamic current
// position. Verified the formula against that component's known static
// case before trusting it here: 3 stages, current index 1 ("Day 30") ->
// dotInset 16.67%, trackSpan 66.66%, fillWidth 66.66% * (1/2) = 33.33%,
// matching guarantee.tsx's hardcoded "width: 33.33%" exactly.
function timelineGeometry(stageCount: number, currentStageIndex: number) {
  const dotInsetPercent = 100 / (stageCount * 2);
  const trackSpanPercent = 100 - dotInsetPercent * 2;
  const segments = stageCount - 1;
  const fillWidthPercent = segments > 0 ? trackSpanPercent * (currentStageIndex / segments) : 0;
  return { dotInsetPercent, fillWidthPercent };
}

// Paused reuses the same amber treatment already established for the
// reminder/extend banners elsewhere on this page (account/page.tsx). No
// equivalent convention exists yet for cancelled/switched -- both render
// with this page's other neutral-info banner (the ?message= banner at the
// top of AccountPage), rather than inventing a new color for either.
const BANNER_CLASSES: Record<SearchTimelineBannerTone, string> = {
  paused: "border-amber-500/20 bg-amber-500/5 text-amber-300",
  cancelled: "border-white/10 bg-white/[0.03] text-zinc-300",
  switched: "border-white/10 bg-white/[0.03] text-zinc-300",
};

export function SearchStatusTimeline({
  stages,
  currentStageIndex,
  banner,
}: {
  stages: SearchTimelineStage[];
  currentStageIndex: number;
  banner: { tone: SearchTimelineBannerTone; text: string } | null;
}) {
  const { dotInsetPercent, fillWidthPercent } = timelineGeometry(stages.length, currentStageIndex);

  return (
    <div className="mt-5">
      <div className="relative pt-1">
        <div
          className="absolute top-[9px] h-0.5 rounded-full bg-white/10"
          style={{ left: `${dotInsetPercent}%`, right: `${dotInsetPercent}%` }}
        />
        <div
          className="absolute top-[9px] h-0.5 rounded-full bg-emerald-500 transition-[width]"
          style={{ left: `${dotInsetPercent}%`, width: `${fillWidthPercent}%` }}
        />
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
        >
          {stages.map((stage, i) => {
            const reached = i <= currentStageIndex;
            return (
              <div key={stage.key} className="flex flex-col items-center">
                <span
                  className={`h-3.5 w-3.5 rounded-full ${reached ? "bg-emerald-500" : "bg-white/15"}`}
                />
                <span
                  className={`mt-2 text-center text-[11px] leading-tight font-medium ${
                    reached ? "text-zinc-200" : "text-zinc-500"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {banner && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${BANNER_CLASSES[banner.tone]}`}>
          {banner.text}
        </div>
      )}
    </div>
  );
}
