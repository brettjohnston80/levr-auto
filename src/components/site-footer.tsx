import Image from "next/image";
import Link from "next/link";
import levrLogo from "../../public/levr-auto-logo-white.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-sm text-zinc-500 sm:flex-row sm:justify-between">
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
    </footer>
  );
}
