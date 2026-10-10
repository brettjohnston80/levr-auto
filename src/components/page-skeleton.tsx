/**
 * Instant placeholder for the signed-in pages while their data loads
 * (2026-10-10). Shown the moment a link is tapped (Next renders a route's
 * loading.tsx immediately and can prefetch it), so a tap never looks like it
 * did nothing. Purely visual: no text to approve.
 */
export function PageSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <section className="bg-zinc-950 py-24" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-2xl animate-pulse px-6">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="mt-6 h-8 w-2/3 rounded bg-white/10" />
        <div className="mt-3 h-4 w-1/2 rounded bg-white/[0.06]" />
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="mt-6 h-32 rounded-2xl border border-white/10 bg-white/[0.03]" />
        ))}
      </div>
    </section>
  );
}
