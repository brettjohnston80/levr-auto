"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-only sign-in check, shared by HeaderAccountLink and the header's
 * "Get Started" buttons (2026-09-18) -- both need the same answer to the
 * same question ("is anyone signed in right now"), and must never drift on
 * it independently. Extracted out of HeaderAccountLink rather than lifting
 * state into SiteHeader itself, which stays a plain synchronous SERVER
 * component on purpose -- see that component's own comment on why an
 * async SiteHeader would make every page dynamic, most importantly
 * /matchmaker.
 *
 * Returns `null` while unknown (session not yet resolved), matching the
 * account link's own "render nothing rather than guess wrong" convention --
 * a caller hiding something while signed-in-status is unknown, or showing
 * something that then has to disappear a moment later, are both worse than
 * the brief blank state this already-accepted tradeoff produces.
 */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Re-checked on every navigation -- same load-bearing reason as
  // HeaderAccountLink: logging out goes through a Server Action, so
  // onAuthStateChange alone never fires for it, and Next navigates
  // client-side without remounting the root layout.
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const resolve = (userId: string | undefined) => {
      if (active) setSignedIn(!!userId);
    };

    supabase.auth.getUser().then(({ data }) => resolve(data.user?.id));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  return signedIn;
}
