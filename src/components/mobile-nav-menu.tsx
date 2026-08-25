"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/matchmaker", label: "Matchmaker" },
  { href: "/faq", label: "FAQ" },
  { href: "/articles", label: "Articles" },
  { href: "/login", label: "Log In" },
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

// Below-sm fallback for the nav links/Log In that site-header.tsx hides at
// the sm breakpoint. Full-screen overlay, portaled to document.body --
// rendering it as a header descendant caused a real transparency bug on
// real devices: <header> is sticky + z-50, which establishes a stacking
// context that traps a position:fixed descendant's paint order instead of
// letting it truly escape to the document root, compositing oddly against
// the header's own semi-transparent/blurred background. Portaling out of
// <header> entirely avoids that class of bug outright.
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

  function toggle() {
    setOpen((v) => !v);
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center text-zinc-300 transition-colors hover:text-white sm:hidden"
      >
        <MenuIcon />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 px-6 py-4 sm:hidden"
          >
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center text-zinc-300 transition-colors hover:text-white"
              >
                <MenuIcon />
              </button>
            </div>

            <nav className="mt-12 flex flex-col gap-8 text-lg font-medium text-zinc-300">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={close} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pb-4" onClick={close}>
              <GetStartedButton className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
                Get Started
              </GetStartedButton>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
