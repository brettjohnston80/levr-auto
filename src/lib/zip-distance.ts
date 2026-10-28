import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { haversineMiles } from "./geo";

/** ZIP-centroid distance in miles, null when either ZIP is unknown. */
export async function zipDistanceMiles(
  admin: ReturnType<typeof createAdminClient>,
  zipA: string | null,
  zipB: string | null,
): Promise<number | null> {
  if (!zipA || !zipB) return null;
  const { data } = await admin.from("zip_coordinates").select("zip, latitude, longitude").in("zip", [zipA, zipB]);
  const a = data?.find((z) => z.zip === zipA);
  const b = data?.find((z) => z.zip === zipB);
  if (!a || !b) return null;
  return haversineMiles(a.latitude as number, a.longitude as number, b.latitude as number, b.longitude as number);
}
