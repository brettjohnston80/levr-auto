import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { continueDestinationFor } from "@/lib/continue-destination";

export const dynamic = "force-dynamic";

// The email confirmation links land here (BAE #1, 2026-10-30) and go on to where the
// customer's search stands. Sign-in itself redirects there directly (see login()).
export default async function ContinuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  redirect(await continueDestinationFor(user.id));
}
