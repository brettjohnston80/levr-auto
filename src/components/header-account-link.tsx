"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
export function HeaderAccountLink({ className }: { className: string }) {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Re-checked on every navigation, and that is NOT belt-and-braces -- it
  // is load-bearing. Logging out goes through a SERVER ACTION that clears
  // the auth cookie and redirects; the browser client never calls
  // signOut(), so onAuthStateChange below never fires for it. Next then
  // navigates client-side without remounting the root layout, so a
  // mount-only effect would keep showing the signed-out user's name until
  // a hard reload. Observed exactly that before adding this (2026-09-13).
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const resolve = async (userId: string | undefined) => {
      if (!userId) {
        if (active) {
          setSignedIn(false);
          setFirstName(null);
        }
        return;
      }
      if (active) setSignedIn(true);
      // first_name is collected in account settings, not at signup, so a
      // signed-in customer may genuinely not have one yet -- fall back to
      // a neutral label rather than rendering an empty string.
      const { data } = await supabase
        .from("customers")
        .select("first_name")
        .eq("id", userId)
        .maybeSingle();
      if (active) setFirstName((data?.first_name as string | null) ?? null);
    };

    supabase.auth.getUser().then(({ data }) => resolve(data.user?.id));

    // Keeps the header honest after a login or logout that happens without
    // a full page load.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

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
    <Link href="/account" className={className}>
      {firstName ? firstName : "My Account"}
    </Link>
  );
}
