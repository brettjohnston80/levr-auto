import Image from "next/image";
import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
import levrLogo from "../../public/levr-auto-logo-white.png";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image src={levrLogo} alt="LEVR Auto" priority className="h-8 w-auto sm:h-9" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-300 sm:flex">
          <Link href="/#how-it-works" className="transition-colors hover:text-white">
            How It Works
          </Link>
          <Link href="/matchmaker" className="transition-colors hover:text-white">
            Matchmaker
          </Link>
          <Link href="/faq" className="transition-colors hover:text-white">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-4 sm:gap-6">
          <MobileNavMenu />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-zinc-300 transition-colors hover:text-white sm:block"
          >
            Log In
          </Link>
          <GetStartedButton className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
            Get Started
          </GetStartedButton>
        </div>
      </div>
    </header>
  );
}
