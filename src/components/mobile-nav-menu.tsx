"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/matchmaker", label: "Matchmaker" },
  { href: "/faq", label: "FAQ" },
  { href: "/login", label: "Log In" },
];

// Below-sm fallback for the nav links/Log In that site-header.tsx hides at
// the sm breakpoint (site-header.tsx has no other mobile entry point to
// them). Matches AuthGateModal's existing overlay convention (fixed
// inset-0 z-[100], bg-black/70 backdrop-blur-sm, bg-zinc-950 panel) rather
// than introducing a new visual pattern -- styled as a right-side panel
// instead of centered.
export function MobileNavMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center text-zinc-300 transition-colors hover:text-white sm:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm sm:hidden"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col border-l border-white/10 bg-zinc-950 px-6 py-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Menu</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center text-zinc-300 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="mt-8 flex flex-col gap-6 text-base font-medium text-zinc-300">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={close} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-8" onClick={close}>
              <GetStartedButton className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
                Get Started
              </GetStartedButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
