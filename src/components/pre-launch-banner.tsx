export function PreLaunchBanner() {
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-2.5 text-center text-xs font-medium text-amber-400 sm:text-sm">
      <span className="font-semibold tracking-wide uppercase">Pre-Launch</span>
      <span className="text-amber-400/80">
        {" "}
        — accounts and searches are saved for real, but payment and dealer outreach aren&apos;t
        live yet.
      </span>
    </div>
  );
}
