"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Handles the redirect from a Supabase email link (signup confirmation,
 * or anything else pointed here). This project's Auth email templates use
 * the implicit flow, not PKCE — the tokens come back as access_token/
 * refresh_token in the URL hash fragment, which is client-only and never
 * reaches the server, so this can't be a server route exchanging a ?code=
 * param (that was the bug: it silently found no code and bounced to
 * /login). The session has to be established here, client-side.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/account";
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace(`/login?error=${encodeURIComponent("Could not verify your email — try logging in.")}`);
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        router.replace(`/login?error=${encodeURIComponent("Could not verify your email — try logging in.")}`);
      } else {
        router.replace(next);
      }
    });
  }, [router]);

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-sm px-6 text-center text-sm text-zinc-400">Verifying your email…</div>
    </section>
  );
}
