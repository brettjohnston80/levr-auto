import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase occasionally rejects a request with "JWT issued at future": a
 * clock-skew rejection on Supabase's side (its token's issued-at time is a
 * moment ahead of the database's clock). The request never ran, and the
 * same request a second later succeeds. It took down the 13:00 daily update
 * on 2026-09-28, 10-02, 10-03 and 10-05 and the hourly solidify job on
 * 10-01 (all at the up-front load, before any customer was processed).
 *
 * So the service-role client retries exactly that rejection, after 1s, 2s
 * and 4s. Safe for every method: a rejected request did nothing. Anything
 * else is returned untouched on the first try. Per-item failures inside a
 * job are still handled by each job's own errors list, so one customer
 * never stops a run.
 */
const CLOCK_SKEW_RETRY_DELAYS_MS = [1000, 2000, 4000];

export function isClockSkewRejection(status: number, body: string): boolean {
  return (status === 401 || status === 403) && /JWT issued at future/i.test(body);
}

export function fetchWithClockSkewRetry(
  baseFetch: typeof fetch = fetch,
  delays: number[] = CLOCK_SKEW_RETRY_DELAYS_MS,
): typeof fetch {
  return async (input, init) => {
    // A streamed body can't be sent twice; nothing here sends one, but
    // don't retry if something ever does.
    const replayable = !(init?.body instanceof ReadableStream);
    for (let attempt = 0; ; attempt++) {
      const res = await baseFetch(input, init);
      if (!replayable || attempt >= delays.length || (res.status !== 401 && res.status !== 403)) return res;
      const body = await res.clone().text();
      if (!isClockSkewRejection(res.status, body)) return res;
      console.warn(`[supabase] "JWT issued at future" (clock skew); retrying in ${delays[attempt]}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  };
}

/**
 * Service-role Supabase client — bypasses RLS entirely. For backend-only work:
 * MarketCheck sync jobs, dealer-reply parsing, admin views.
 *
 * The `server-only` import makes it a build error to ever import this into a
 * "use client" component. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithClockSkewRetry() },
    }
  );
}
