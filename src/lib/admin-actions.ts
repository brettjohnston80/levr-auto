"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";

export interface AdminSearchRow {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  make: string | null;
  model: string | null;
  searchStatus: string;
  assignedAgentName: string | null;
  paidAt: string | null;
  searchDeadlineAt: string | null;
  pausedAt: string | null;
}

/**
 * Every customer_searches row, unfiltered -- the /internal/admin table's
 * data source. No pagination per spec; flag if real row counts make that
 * wrong.
 *
 * Customer identity is resolved through auth.users, not customers.email --
 * customers.email is denormalized/non-unique (see CLAUDE.md's "Key
 * learnings & principles"). Unlike agent-bypass-lookup.ts (which resolves
 * a handful of already-picked candidates one at a time via
 * getUserById), this table can show every row in the system, so identity
 * is batch-resolved with one paginated listUsers() call into an id->email
 * map instead of one admin API call per row. customers.first_name/
 * last_name is still the source for display name (auth.users has no name
 * field); customers.email is used only as a fallback if a user id
 * somehow isn't found in the auth.users listing.
 */
export async function getAdminSearches(): Promise<AdminSearchRow[]> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    throw new Error("Not authorized.");
  }

  const admin = createAdminClient();

  const { data: searches, error: searchesError } = await admin
    .from("customer_searches")
    .select("id, customer_id, make, model, search_status, paid_at, search_deadline_at, paused_at")
    .order("created_at", { ascending: false });

  if (searchesError) {
    throw new Error(`Failed to load admin searches: ${searchesError.message}`);
  }
  if (!searches || searches.length === 0) {
    return [];
  }

  const customerIds = [...new Set(searches.map((s) => s.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("customers")
    .select("id, email, first_name, last_name, assigned_agent_id")
    .in("id", customerIds);

  if (customersError) {
    throw new Error(`Failed to load customers for admin table: ${customersError.message}`);
  }

  const agentIds = [...new Set((customers ?? []).map((c) => c.assigned_agent_id).filter((id): id is string => id !== null))];
  const agentNameById = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents, error: agentsError } = await admin.from("agents").select("id, name").in("id", agentIds);
    if (agentsError) {
      throw new Error(`Failed to load agents for admin table: ${agentsError.message}`);
    }
    for (const a of agents ?? []) {
      agentNameById.set(a.id, a.name);
    }
  }

  // Batch-resolve real emails from auth.users -- perPage:1000 covers this
  // project's current scale in one call; the same pagination gotcha noted
  // elsewhere in this codebase (default listUsers() only returns page 1)
  // is why this is explicit rather than a bare call.
  const emailById = new Map<string, string>();
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    throw new Error(`Failed to load auth users for admin table: ${usersError.message}`);
  }
  for (const u of usersPage.users) {
    if (u.email) {
      emailById.set(u.id, u.email);
    }
  }

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  return searches.map((search) => {
    const customer = customerById.get(search.customer_id);
    const resolvedEmail = customer ? (emailById.get(customer.id) ?? customer.email) : null;
    const assignedAgentName = customer?.assigned_agent_id ? (agentNameById.get(customer.assigned_agent_id) ?? null) : null;

    return {
      id: search.id,
      customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null : null,
      customerEmail: resolvedEmail,
      make: search.make,
      model: search.model,
      searchStatus: search.search_status,
      assignedAgentName,
      paidAt: search.paid_at,
      searchDeadlineAt: search.search_deadline_at,
      pausedAt: search.paused_at,
    };
  });
}

interface AdminActionResult {
  ok: boolean;
  error?: string;
}

function validateNotes(notes: string): string | null {
  if (!notes || notes.trim() === "") {
    return "Notes are required.";
  }
  return null;
}

export async function pauseSearchByAdmin(searchId: string, notes: string): Promise<AdminActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const notesError = validateNotes(notes);
  if (notesError) {
    return { ok: false, error: notesError };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_pause_search", {
    p_search_id: searchId,
    p_agent_id: agent.id,
    p_notes: notes.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/admin");
  return { ok: true };
}

export async function resumeSearchByAdmin(searchId: string, notes: string): Promise<AdminActionResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const notesError = validateNotes(notes);
  if (notesError) {
    return { ok: false, error: notesError };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_resume_search", {
    p_search_id: searchId,
    p_agent_id: agent.id,
    p_notes: notes.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/internal/admin");
  return { ok: true };
}
