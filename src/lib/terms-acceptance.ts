import "server-only";
import { createAdminClient } from "./supabase/admin";
import { hasCurrentTerms, TERMS_VERSION } from "./guarantee-exception-rule";

/** W4 (approved 2026-10-25). */
export const TERMS_REQUIRED_ERROR = "Please agree to the Terms of Service to continue.";

/** Has this customer accepted the current terms? */
export async function customerHasCurrentTerms(customerId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("customers").select("terms_version").eq("id", customerId).maybeSingle();
  return hasCurrentTerms(data as { terms_version: string | null } | null);
}

/**
 * The one standard-terms acceptance (GX-2), checked on the server before any checkout: already
 * accepted (this version), or accepted now (the ticked box), which records the time and version.
 * Anything else is refused with W4.
 */
export async function ensureTermsAccepted(customerId: string, acceptedNow: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await customerHasCurrentTerms(customerId)) return { ok: true };
  if (!acceptedNow) return { ok: false, error: TERMS_REQUIRED_ERROR };
  const { error } = await createAdminClient()
    .from("customers")
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq("id", customerId);
  if (error) {
    console.error("[terms] acceptance not saved", customerId, error.message);
    return { ok: false, error: "We couldn't save your agreement. Please try again." }; // approved 2026-10-30
  }
  return { ok: true };
}
