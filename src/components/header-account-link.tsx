"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/lib/auth-actions";
import { useSignedIn } from "@/lib/use-signed-in";

// Header auth indicator. Reported by a tester: the header said "Log In"
// even while they were signed in.
//
// The cause was not a stale session check -- there was NO check. SiteHeader
// is a plain server component rendering a hardcoded /login link, and has
// been since it was written.
//
// WHY THIS IS A CLIENT COMPONENT, AND NOT AN async SiteHeader. The obvious
// fix is to make SiteHeader async and call supabase.auth.getUser(). That
// reads cookies, which opts the component into dynamic rendering -- and
// SiteHeader lives in the ROOT LAYOUT, so every page inherits it. Thirteen
// routes are currently static, including /articles, /faq, /privacy, /terms
// and, most importantly, /matchmaker, whose static rendering is load-bearing
// and heavily documented: a promoted vehicle-dataset batch only reaches the
// live site via a rebuild, which is why the promote-then-deploy sequencing
// exists. Turning that dynamic as a side effect of a header tweak would
// silently rewrite an architectural decision and add a per-request auth
// round trip to every page on the site.
//
// Reading the session in the browser keeps all of that intact. The cost is
// a brief "Log In" state on first paint before the session resolves, which
// is the normal trade for statically-rendered pages and is why the label
// starts as null rather than "Log In" -- flashing "Log In" at an already
// signed-in user is the exact complaint being fixed, so nothing is rendered
// until we actually know.
//
// Account menu (2026-09-18) -- the name used to be a bare link straight to
// /account, with no sign-out path anywhere else in the UI. It's now the
// trigger for a small dropdown (Account settings / Log out), reusing the
// exact `logout` Server Action /account's own Log Out button already calls
// -- no new sign-out mechanism. This is the ONE implementation SiteHeader
// (desktop) and MobileNavMenu (mobile) both render directly, so the two
// surfaces cannot drift on behavior the way two hand-built copies could.
export function HeaderAccountLink({
  className,
  onNavigate,
}: {
  className: string;
  /** Called when the customer picks a menu item (Account settings or Log
   *  out) -- MobileNavMenu passes its own `close` here so choosing either
   *  one also collapses the full-screen mobile overlay it's nested inside,
   *  the same way every other link in that overlay already closes it on
   *  click. Desktop doesn't need this (there's nothing else to collapse),
   *  so SiteHeader simply omits it. */
  onNavigate?: () => void;
}) {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Shared with the header's "Get Started" buttons (useSignedIn) -- see
  // that hook's own comment for why this can't just live on SiteHeader.
  const signedIn = useSignedIn();

  useEffect(() => {
    // Nothing to fetch while signed out or still resolving -- and nothing
    // to clear either: the render below only ever reads `firstName` in the
    // `signedIn === true` branch, so a stale value sitting unused behind a
    // false/null state is harmless.
    if (!signedIn) return;

    const supabase = createClient();
    let active = true;

    // first_name is collected in account settings, not at signup, so a
    // signed-in customer may genuinely not have one yet -- fall back to
    // a neutral label rather than rendering an empty string.
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      const { data: customer } = await supabase
        .from("customers")
        .select("first_name")
        .eq("id", userId)
        .maybeSingle();
      if (active) setFirstName((customer?.first_name as string | null) ?? null);
    });

    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleSelect() {
    setMenuOpen(false);
    onNavigate?.();
  }

  // Unknown yet -- render nothing rather than guess wrong in either
  // direction.
  if (signedIn === null) {
    return <span className={className} aria-hidden="true" />;
  }

  if (!signedIn) {
    return (
      <Link href="/login" className={className}>
        Log In
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* `className` here is the EXACT prop passed in, untouched -- for
          desktop that's "hidden ... sm:block". Real bug caught in
          verification: an earlier version prepended "inline-flex" onto
          this same string to lay out the name + chevron, which put two
          conflicting `display` utilities (that one and `hidden`) on the
          same element -- Tailwind resolves that by each utility's
          position in the COMPILED stylesheet, not by order in the class
          list, and inline-flex happened to win, silently defeating
          `hidden sm:block` and showing this trigger on mobile too. The
          icon layout now lives on an inner span instead, so this button's
          own display is controlled by nothing but the caller's classes,
          exactly like the signed-out <Link> above it. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={className}
      >
        <span className="inline-flex items-center gap-1">
          {firstName ? firstName : "My Account"}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Always mounted, visibility toggled via `hidden` rather than a
          `menuOpen && (...)` conditional -- NOT a style preference.
          Log out submits a real <form action={logout}>, and closing the
          menu by unmounting this div (removing the form from the DOM in
          the same click) raced the browser's native form submission and
          killed it before the request ever went out, confirmed live: the
          menu visibly closed but the account stayed signed in. `hidden`
          hides it (and pulls it out of the accessibility tree / tab
          order) without ever removing the form node, so a submission
          already in flight from this exact click is never interrupted. */}
      <div
        role="menu"
        aria-label="Account menu"
        hidden={!menuOpen}
        className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 py-1 text-left shadow-lg shadow-black/40"
      >
        <Link
          href="/account"
          role="menuitem"
          onClick={handleSelect}
          className="block px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Account settings
        </Link>
        <form action={logout}>
          <button
            type="submit"
            role="menuitem"
            onClick={handleSelect}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
