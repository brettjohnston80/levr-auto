"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Confirm-as-new: creates the dealerships row and links the alias to it in
 * one atomic RPC call (confirm_dealer_alias_as_new), which row-locks the
 * alias and raises if it's already confirmed -- see the migration for the
 * full guard.
 */
export async function confirmAliasAsNewDealership(
  aliasId: string,
  name: string,
  city: string,
  state: string
): Promise<ActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  if (name.trim() === "") {
    return { ok: false, error: "Dealership name is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_dealer_alias_as_new", {
    p_alias_id: aliasId,
    p_name: name.trim(),
    p_city: city.trim(),
    p_state: state.trim(),
    p_agent_id: agent.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/dealerships");
  return { ok: true };
}

/**
 * Merge-into-existing: a single-row guarded update, not a multi-table
 * write, so no RPC needed -- the .is("dealership_id", null) guard is the
 * same idempotency shape as respondToOffer/markOfferVehicleSold elsewhere
 * in this codebase (a double-click or race can't re-link an already-
 * confirmed alias to a second dealership).
 */
export async function mergeAliasIntoDealership(aliasId: string, dealershipId: string): Promise<ActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dealer_aliases")
    .update({
      dealership_id: dealershipId,
      confirmed_at: new Date().toISOString(),
      confirmed_by_agent_id: agent.id,
      confirmed_via: "agent",
    })
    .eq("id", aliasId)
    .is("dealership_id", null)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "This alias has already been confirmed." };
  }

  revalidatePath("/internal/dealerships");
  return { ok: true };
}

interface AddSalespersonResult extends ActionResult {
  id?: string;
}

export async function addSalesperson(
  dealershipId: string,
  name: string,
  phone: string,
  email: string
): Promise<AddSalespersonResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  if (name.trim() === "") {
    return { ok: false, error: "Name is required." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dealership_salespeople")
    .insert({
      dealership_id: dealershipId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      added_by_agent_id: agent.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/dealerships");
  return { ok: true, id: data.id };
}

export async function updateSalesperson(
  salespersonId: string,
  name: string,
  phone: string,
  email: string
): Promise<ActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  if (name.trim() === "") {
    return { ok: false, error: "Name is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("dealership_salespeople")
    .update({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
    .eq("id", salespersonId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/dealerships");
  return { ok: true };
}

export async function removeSalesperson(salespersonId: string): Promise<ActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("dealership_salespeople").delete().eq("id", salespersonId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/dealerships");
  return { ok: true };
}
