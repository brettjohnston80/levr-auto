import Image from "next/image";
import Link from "next/link";
import levrLogo from "../../public/levr-auto-logo-white.png";
import levrHoldingsLogo from "../../public/levr-holdings-logo-white.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-4 text-sm text-zinc-500 sm:flex-row sm:justify-between">
          <Image src={levrLogo} alt="LEVR Auto" className="h-6 w-auto" />
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
        <div className="mt-8 flex flex-col items-center justify-center gap-2 border-t border-white/5 pt-6 sm:flex-row sm:gap-2.5">
          <Image src={levrHoldingsLogo} alt="LEVR Holdings LLC" className="h-3 w-auto opacity-50" />
          <span className="text-xs text-zinc-600">LEVR Auto is a brand of LEVR Holdings LLC.</span>
        </div>
      </div>
    </footer>
  );
}
