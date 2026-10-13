/** The plain internal card every /agent screen uses (restyled with the Phase 3 shell). */
export function AgentCard({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-100 px-4 pt-16 sm:pt-24">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">LEVR Auto · Agent</p>
        <h1 className="mt-1 mb-6 text-xl font-semibold text-zinc-900">{heading}</h1>
        {children}
      </div>
    </div>
  );
}
