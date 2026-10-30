import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { guaranteeColumns } from "./guarantee-exceptions";

/**
 * Sets a not-yet-live search's guarantee state from its current brand (GX-2), for the paths where
 * the brand lands in a row another function created (a switch). Idempotent: safe to call again on
 * a retry. Live searches are never touched (the trigger refuses it anyway). Returns false on a
 * database error, so the caller can report it; it never throws.
 */
export async function applyGuaranteeState(admin: ReturnType<typeof createAdminClient>, searchId: string): Promise<boolean> {
  const { data: row, error: readError } = await admin
    .from("customer_searches")
    .select("make, solidified_at, guarantee_status, guarantee_exception_make")
    .eq("id", searchId)
    .maybeSingle();
  if (readError || !row) {
    console.error("[guarantee-state] read failed", searchId, readError?.message);
    return false;
  }
  if (row.solidified_at) return true;
  const cols = guaranteeColumns(row.make as string | null);
  if (cols.guarantee_status === row.guarantee_status && cols.guarantee_exception_make === row.guarantee_exception_make) return true;
  const { error } = await admin.from("customer_searches").update(cols).eq("id", searchId).is("solidified_at", null);
  if (error) {
    console.error("[guarantee-state] update failed", searchId, error.message);
    return false;
  }
  return true;
}
