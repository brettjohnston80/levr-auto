import "server-only";
import type { createAdminClient } from "./supabase/admin";

/**
 * The configurator batch live for one make (2026-10-10). Each make is
 * promoted on its own (configurator_live_makes, migration
 * 20261010150000), so promoting Chevrolet or Ford never takes Toyota or
 * Honda off the site.
 *
 * Until that migration runs, configurator_live_makes doesn't exist and
 * this falls back to the old single is_live batch, so deploying the code
 * first changes nothing.
 */
export async function liveConfiguratorBatchId(
  admin: ReturnType<typeof createAdminClient>,
  make: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("configurator_live_makes")
    .select("batch_id")
    .ilike("make", make)
    .maybeSingle();
  if (!error) return (data?.batch_id as string | undefined) ?? null;

  const { data: batch } = await admin
    .from("configurator_batches")
    .select("id")
    .eq("is_live", true)
    .maybeSingle();
  return (batch?.id as string | undefined) ?? null;
}
