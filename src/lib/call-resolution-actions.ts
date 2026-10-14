"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { MANUAL_OUTCOMES, markCallResolved, type CallType } from "./call-resolution";

export type ResolveCallResult = { ok: true } | { ok: false; error: string };

async function resolve(callType: CallType, searchId: string, outcome: string, note: string): Promise<ResolveCallResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) return { ok: false, error: "Couldn't resolve this request: Not authorized." };
  if (!MANUAL_OUTCOMES[callType].some((o) => o.code === outcome)) {
    return { ok: false, error: "Couldn't resolve this request: choose an outcome." };
  }
  const trimmed = String(note ?? "").trim().slice(0, 2000);
  try {
    const done = await markCallResolved({ searchId: String(searchId ?? ""), callType, outcome, agentId: agent.id, note: trimmed || null });
    if (!done) return { ok: false, error: "Couldn't resolve this request: it's already been resolved." };
  } catch (e) {
    return { ok: false, error: `Couldn't resolve this request: ${e instanceof Error ? e.message : String(e)}` };
  }
  revalidatePath("/internal/outreach");
  return { ok: true };
}

/** Any agent: resolve a switch call request with a manual outcome. */
export async function resolveSwitchCall(searchId: string, outcome: string, note: string): Promise<ResolveCallResult> {
  return resolve("switch", searchId, outcome, note);
}

/** Any agent: resolve a cancellation call request with a manual outcome. */
export async function resolveCancellationCall(searchId: string, outcome: string, note: string): Promise<ResolveCallResult> {
  return resolve("cancellation", searchId, outcome, note);
}
