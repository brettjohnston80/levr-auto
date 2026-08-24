import Link from "next/link";

export function PostDealSurveyPrompt({ survey }: { survey: { id: string; submittedAt: string | null } }) {
  if (survey.submittedAt) {
    return <p className="mt-4 text-sm text-emerald-400">✓ Thanks for sharing your feedback.</p>;
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <p className="text-sm text-white">How was your experience?</p>
      <p className="mt-1 text-xs text-zinc-400">Takes about 2 minutes, and helps the next customer too.</p>
      <Link
        href={`/survey/${survey.id}`}
        className="mt-3 inline-block rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        Take the survey
      </Link>
    </div>
  );
}
