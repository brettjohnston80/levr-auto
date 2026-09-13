import "server-only";
import { cache } from "react";
import { createAdminClient } from "./supabase/admin";

// Identification for the external tester program (2026-09-12).
//
// Ten real accounts exercise real flows against real production data, so
// every surface that acts on "a customer" has to be able to tell them apart
// from the real thing. This module is the single definition of that test --
// nothing else in the codebase should hard-code the suffix or re-derive the
// id set.
//
// WHY A DOMAIN CONVENTION AND NOT AN `is_test` COLUMN. Both options require
// editing exactly the same surfaces (nightly sync, eight agent queues, the
// admin table, the email chokepoint, social generation, refunds-due), so a
// migration buys no structural advantage -- the real work is the filtering,
// not the flag. A column that nothing reads is false comfort, which this
// project has already flagged once. The suffix, by contrast, is set the
// moment an account is created and cannot drift out of sync with itself.
//
// `.invalid` is an RFC 2606 reserved TLD that can never resolve, so these
// addresses are structurally incapable of receiving mail. That is a second
// line of defence behind the suppression in sendEmail(), not a substitute
// for it: suppression is what stops the attempt (and the bounce noise), the
// TLD is what guarantees the blast radius if suppression is ever missed.
export const TEST_EMAIL_SUFFIX = "@levrauto-test.invalid";

/**
 * Is this a tester-program address?
 *
 * Case-insensitive: email casing is not normalized anywhere in this
 * codebase, and a tester typing a capitalised address at signup must not
 * quietly become a "real" customer to every filter downstream.
 */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(TEST_EMAIL_SUFFIX);
}

/**
 * Every customer id belonging to the tester program.
 *
 * Reads `customers` rather than `auth.users` deliberately. `customers.email`
 * is denormalized and this codebase has a standing rule against using it as
 * an identity LOOKUP key (it carries no uniqueness constraint) -- but this
 * is a set membership filter, not a lookup, and `customers` is the table
 * every surface being filtered already joins through (customer_searches ->
 * customer_id -> customers). Matching on the same table those queries use
 * keeps the filter consistent with what it is filtering. The alternative,
 * paginating auth.users on every nightly cron run, costs O(all users) to
 * answer a question about ten of them.
 *
 * Wrapped in React's `cache()` so the eight agent queues rendering on one
 * page share a single query rather than issuing eight. Deliberately takes NO
 * arguments: `cache()` memoizes on argument identity, so accepting an admin
 * client would key on a fresh object each call and never hit.
 *
 * Returns an empty set on error rather than throwing. A failure here must
 * not take down the nightly sync or an agent queue -- the cost of failing
 * open is that test rows briefly appear where they should not, which is
 * visible and recoverable; the cost of failing closed is a broken page.
 */
export const getTestCustomerIds = cache(async (): Promise<Set<string>> => {
  const admin = createAdminClient();
  const ids = new Set<string>();

  // Paginated: PostgREST caps a plain select at 1,000 rows and truncates
  // silently. Ten accounts will never approach that, but a truncated
  // membership set fails in the worst direction -- silently treating a test
  // account as real -- so it is not worth relying on the count staying small.
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("customers")
      .select("id, email")
      .ilike("email", `%${TEST_EMAIL_SUFFIX}`)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[test-accounts] failed to load test customer ids", error.message);
      return ids;
    }
    for (const row of data ?? []) {
      // Re-checked in JS rather than trusting the pattern alone: `ilike`
      // treats _ and % as wildcards, and the suffix is fixed here, but the
      // authoritative definition of "is a test account" is isTestEmail().
      if (isTestEmail(row.email as string)) ids.add(row.id as string);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  return ids;
});
