import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-sm text-zinc-500 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 font-semibold text-zinc-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-zinc-950">
            L
          </span>
          LEVR Auto
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/terms" className="transition-colors hover:text-zinc-300">
            Terms of Service
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-zinc-300">
            Privacy Policy
          </Link>
          <span className="text-zinc-600">State availability rolling out — check back soon</span>
        </div>
      </div>
    </footer>
  );
}
