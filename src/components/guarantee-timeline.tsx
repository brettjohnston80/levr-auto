import { SearchStatusTimeline } from "@/components/search-status-timeline";
import { GUARANTEE_TIMELINE_HEADING, type GuaranteeTimelineInfo } from "@/lib/guarantee-timeline";

// "Your guarantee" on Your Deal (2026-09-27): a second, compact timeline
// directly below the status timeline, reusing its visual component. It's
// separate because it answers a different question ("what's LEVR promising
// me?") than the status timeline ("where is my car?").
export function GuaranteeTimeline({ info }: { info: GuaranteeTimelineInfo }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 pt-3 pb-4">
      <h2 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{GUARANTEE_TIMELINE_HEADING}</h2>
      {info.bar && (
        <SearchStatusTimeline
          stages={info.bar.markers.map((m) => ({ key: m.label, label: m.label }))}
          currentStageIndex={0}
          banner={null}
          fillFraction={info.bar.fill}
          stageStates={info.bar.markers.map((m) => m.state)}
        />
      )}
      {info.lines.length > 0 && (
        <div className={`${info.bar ? "mt-4" : "mt-2"} space-y-1 text-sm text-zinc-300`}>
          {info.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
