import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Agent logins only (Phase 1, Chunk 1d):
//   - signed out after 8 hours with no request (C13). The time of the last
//     request is kept in a cookie that only the server sets and reads;
//   - kept off customer pages, which an agent login has no business on (an
//     agent login has no customer record). Customer actions on those pages
//     go through here too, so they're refused the same way.
export const AGENT_IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;
// Test hook: a shorter limit for local verification only. Ignored in production builds.
function idleLimitMs(): number {
  const override = Number(process.env.AGENT_IDLE_LIMIT_MS_OVERRIDE);
  return process.env.NODE_ENV !== "production" && override > 0 ? override : AGENT_IDLE_LIMIT_MS;
}
export const AGENT_LAST_SEEN_COOKIE = "levr_agent_seen";
const CUSTOMER_AREAS = ["/account", "/finalize", "/survey", "/switch", "/payment"];

function inCustomerArea(pathname: string): boolean {
  return CUSTOMER_AREAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase auth session on every request. Required by
 * @supabase/ssr for Server Components to see an up-to-date session — without
 * this, expired tokens don't get refreshed and auth state can go stale.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove — refreshes the session if expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata?.account_type !== "agent") return supabaseResponse;

  // Carries the session cookies (refreshed or cleared) onto a redirect.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  const now = Date.now();
  // The later of: the last request (cookie) and the last sign-in. So the first
  // request after signing in counts as activity even if an old cookie is left over.
  const cookieSeen = Number(request.cookies.get(AGENT_LAST_SEEN_COOKIE)?.value ?? "");
  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  const lastSeen = Math.max(Number.isFinite(cookieSeen) ? cookieSeen : 0, Number.isFinite(signedInAt) ? signedInAt : 0);
  if (now - lastSeen > idleLimitMs()) {
    await supabase.auth.signOut();
    const res = redirectTo("/agent");
    res.cookies.delete(AGENT_LAST_SEEN_COOKIE);
    return res;
  }

  const res = inCustomerArea(request.nextUrl.pathname) ? redirectTo("/internal/outreach") : supabaseResponse;
  res.cookies.set(AGENT_LAST_SEEN_COOKIE, String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
