"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/lib/auth-actions";
import { getMyUnreadThreadCount } from "@/lib/offer-message-actions";
import { UNREAD_CHANGED_EVENT } from "@/components/unread-count-refresh";
import { useSignedIn } from "@/lib/use-signed-in";
import { SubmitButton } from "@/components/submit-button";

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
  placement,
  className,
  onNavigate,
}: {
  /** "header": the header bar itself -- the initials button (every width)
   *  when signed in, the Log In link (desktop only) when signed out.
   *  "mobileMenu": inside the hamburger's overlay -- Log In when signed out,
   *  nothing when signed in (the account menu lives on the initials button,
   *  keeping the site menu and the account menu separate; Brett 2026-10-10). */
  placement: "header" | "mobileMenu";
  className: string;
  /** Called when the customer picks a menu item (Account settings or Log
   *  out) -- MobileNavMenu passes its own `close` here so choosing either
   *  one also collapses the full-screen mobile overlay it's nested inside,
   *  the same way every other link in that overlay already closes it on
   *  click. Desktop doesn't need this (there's nothing else to collapse),
   *  so SiteHeader simply omits it. */
  onNavigate?: () => void;
}) {
  const [name, setName] = useState<{ first: string | null; last: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Shared with the header's "Get Started" buttons (useSignedIn) -- see
  // that hook's own comment for why this can't just live on SiteHeader.
  const signedIn = useSignedIn();
  // Unread offer-message threads (2026-09-25). There are no email/SMS alerts
  // for messages, so this badge is how a customer learns an agent replied.
  // Re-fetched on every route change -- reading a thread navigates, so the
  // count drops as soon as they've looked.
  const pathname = usePathname();
  const [unreadThreads, setUnreadThreads] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    const recount = () =>
      getMyUnreadThreadCount().then((count) => {
        if (active) setUnreadThreads(count);
      });
    recount();
    // Reading a thread fires this (thread page, offer detail view), since
    // the route-change recount above can run before the read is saved.
    window.addEventListener(UNREAD_CHANGED_EVENT, recount);
    return () => {
      active = false;
      window.removeEventListener(UNREAD_CHANGED_EVENT, recount);
    };
  }, [signedIn, pathname]);

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
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (active)
        setName({
          first: (customer?.first_name as string | null) ?? null,
          last: (customer?.last_name as string | null) ?? null,
        });
    });

    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(e: PointerEvent) {
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
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
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
    return placement === "header" ? <span className="h-9 w-9" aria-hidden="true" /> : null;
  }

  if (signedIn && placement === "mobileMenu") return null;

  // Initials from the account-settings name; a person icon until we have
  // one (first and last name are collected after sign-up).
  const initials = [name?.first, name?.last]
    .map((n) => n?.trim().charAt(0).toUpperCase() ?? "")
    .join("");
  const displayName = [name?.first, name?.last].filter(Boolean).join(" ");

  if (!signedIn) {
    // onNavigate closes the mobile menu's full-screen overlay. Without it,
    // tapping Log In there navigated underneath an overlay that stayed
    // open, so the tap looked like it did nothing (Brett's iPhone
    // walkthrough, 2026-10-10).
    return (
      <Link href="/login" onClick={onNavigate} className={className}>
        Log In
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Account menu${displayName ? ` for ${displayName}` : ""}${unreadThreads > 0 ? ", new messages" : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
      >
        {initials ? (
          <span aria-hidden="true">{initials}</span>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5 text-zinc-300">
            <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 1 1 14 0H3Z" />
          </svg>
        )}
        {unreadThreads > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950"
            aria-hidden="true"
          />
        )}
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
          href="/account/vehicle"
          role="menuitem"
          onClick={handleSelect}
          className="block px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Your Car
        </Link>
        <Link
          href="/account/deal"
          role="menuitem"
          onClick={handleSelect}
          className="block px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Your Deal
        </Link>
        <Link
          href="/account/messages"
          role="menuitem"
          onClick={handleSelect}
          className="flex items-center justify-between px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Messages
          {unreadThreads > 0 && (
            <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-zinc-950">
              {unreadThreads}
            </span>
          )}
        </Link>
        <Link
          href="/account"
          role="menuitem"
          onClick={handleSelect}
          className="block px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Account settings
        </Link>
        <form action={logout}>
          <SubmitButton
            role="menuitem"
            onClick={handleSelect}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            pendingLabel="Logging out…"
          >
            Log out
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
