import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-sm font-bold text-zinc-950">
            L
          </span>
          LEVR Auto
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-300 sm:flex">
          <Link href="/#how-it-works" className="transition-colors hover:text-white">
            How It Works
          </Link>
          <Link href="/#get-started" className="transition-colors hover:text-white">
            Build Your Search
          </Link>
          <Link href="/faq" className="transition-colors hover:text-white">
            FAQ
          </Link>
        </nav>
        <GetStartedButton className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
          Get Started
        </GetStartedButton>
      </div>
    </header>
  );
}
