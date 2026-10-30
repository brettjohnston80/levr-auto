import "server-only";

// A page data loader for /internal/admin. Deliberately NOT "use server": only
// the server-rendered page calls it, so it must not be callable from a browser
// as a server action (Chunk 1d).
import { getAuthorizedAgent } from "./agent-auth";
import { createAdminClient } from "./supabase/admin";
import { isTestEmail } from "./test-accounts";
import { isProductionDeploy } from "./runtime-env";
import { chunks, fetchAllPages } from "./supabase/paged";

export interface AdminSearchRow {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  /** Tester-program row -- flagged in the table, never hidden. */
  isTest: boolean;
  make: string | null;
  model: string | null;
  searchStatus: string;
  assignedAgentName: string | null;
  paidAt: string | null;
  searchDeadlineAt: string | null;
  /** GX-4: pending | met | refunded | not_applicable. */
  guaranteeStatus: string;
  pausedAt: string | null;
}

/**
 * Every customer_searches row, unfiltered -- the /internal/admin table's
 * data source. Read in pages of 1,000 (PostgREST's silent limit), so the
 * table really shows every search (Phase 1 Chunk 7). The Assigned agent
 * column reads customer_searches.assigned_agent_id (Phase 1 Step 4);
 * customers.assigned_agent_id is unused.
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
  const agent = await getAuthorizedAgent({ minRole: "lead" });
  if (!agent) {
    throw new Error("Not authorized.");
  }

  const admin = createAdminClient();

  let searches;
  try {
    searches = await fetchAllPages((from, to) =>
      admin
        .from("customer_searches")
        .select("id, customer_id, make, model, search_status, paid_at, search_deadline_at, paused_at, assigned_agent_id, guarantee_status")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (e) {
    throw new Error(`Failed to load admin searches: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (searches.length === 0) {
    return [];
  }

  const customers: { id: string; email: string | null; first_name: string | null; last_name: string | null }[] = [];
  for (const ids of chunks([...new Set(searches.map((s) => s.customer_id))])) {
    const { data, error: customersError } = await admin.from("customers").select("id, email, first_name, last_name").in("id", ids);
    if (customersError) {
      throw new Error(`Failed to load customers for admin table: ${customersError.message}`);
    }
    customers.push(...(data ?? []));
  }

  const agentIds = [...new Set(searches.map((s) => s.assigned_agent_id).filter((id): id is string => id !== null))];
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

  // Real emails from auth.users, page by page until a short page (listUsers
  // returns one page per call; one call used to stop at the first 1,000
  // users). Test-only, never honoured in production:
  // AGENT_ADMIN_USERS_PAGE_SIZE makes the pages small, so a test can show
  // the paging works without creating 1,000 users.
  const forcedPageSize = isProductionDeploy() ? NaN : Number(process.env.AGENT_ADMIN_USERS_PAGE_SIZE);
  const perPage = Number.isInteger(forcedPageSize) && forcedPageSize > 0 ? forcedPageSize : 1000;
  const emailById = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage });
    if (usersError) {
      throw new Error(`Failed to load auth users for admin table: ${usersError.message}`);
    }
    for (const u of usersPage.users) {
      if (u.email) {
        emailById.set(u.id, u.email);
      }
    }
    if (usersPage.users.length < perPage) break;
  }

  const customerById = new Map(customers.map((c) => [c.id, c]));

  return searches.map((search) => {
    const customer = customerById.get(search.customer_id);
    const resolvedEmail = customer ? (emailById.get(customer.id) ?? customer.email) : null;
    const assignedAgentName = search.assigned_agent_id ? (agentNameById.get(search.assigned_agent_id) ?? null) : null;

    return {
      id: search.id,
      customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null : null,
      customerEmail: resolvedEmail,
      isTest: isTestEmail(resolvedEmail),
      make: search.make,
      model: search.model,
      searchStatus: search.search_status,
      assignedAgentName,
      paidAt: search.paid_at,
      searchDeadlineAt: search.search_deadline_at,
      guaranteeStatus: search.guarantee_status as string,
      pausedAt: search.paused_at,
    };
  });
}
