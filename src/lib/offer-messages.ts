import "server-only";

import type { createAdminClient } from "./supabase/admin";
import { agentFirstName, threadIsOpen, type OfferMessage } from "./offer-messages-shared";

type AdminClient = ReturnType<typeof createAdminClient>;

// Offer message threads (2026-09-25). Read paths only -- writes live in
// offer-message-actions.ts. Every caller has already established who the
// viewer is (customer ownership or agent auth) before calling in here.

/**
 * Every message on the given offers, oldest first, keyed by offer id.
 * Paginated: across an agent's whole queue this can pass PostgREST's silent
 * 1,000-row cap, and a truncated thread would read as a complete one.
 */
export async function loadMessagesForOffers(
  admin: AdminClient,
  offerIds: string[],
  viewer: "customer" | "agent",
): Promise<Map<string, OfferMessage[]>> {
  const byOffer = new Map<string, OfferMessage[]>();
  if (offerIds.length === 0) return byOffer;

  const rows: {
    id: string;
    qualifying_offer_id: string;
    author_type: "customer" | "agent";
    author_agent_id: string | null;
    body: string;
    created_at: string;
  }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("offer_messages")
      .select("id, qualifying_offer_id, author_type, author_agent_id, body, created_at")
      .in("qualifying_offer_id", offerIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load messages: ${error.message}`);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE) break;
  }

  const agentIds = [...new Set(rows.map((r) => r.author_agent_id).filter((id): id is string => !!id))];
  const agentNameById = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await admin.from("agents").select("id, name").in("id", agentIds);
    for (const a of agents ?? []) agentNameById.set(a.id as string, (a.name as string) ?? "");
  }

  for (const r of rows) {
    const agentName = r.author_agent_id ? agentNameById.get(r.author_agent_id) : undefined;
    const authorLabel =
      r.author_type === "customer"
        ? viewer === "customer"
          ? "You"
          : "Customer"
        : viewer === "customer"
          ? agentFirstName(agentName)
          : agentName || "Agent (removed)";
    const list = byOffer.get(r.qualifying_offer_id) ?? [];
    list.push({ id: r.id, authorType: r.author_type, authorLabel, body: r.body, createdAt: r.created_at });
    byOffer.set(r.qualifying_offer_id, list);
  }
  return byOffer;
}

/** Customer has an unread agent message on this offer. */
export function hasUnreadForCustomer(lastAgentMessageAt: string | null, readAt: string | null): boolean {
  if (!lastAgentMessageAt) return false;
  return !readAt || new Date(lastAgentMessageAt) > new Date(readAt);
}

export interface CustomerThreadSummary {
  offerId: string;
  searchId: string;
  dealerName: string;
  make: string | null;
  model: string | null;
  offerPriceCents: number;
  lastMessageAt: string;
  lastMessage: OfferMessage | null;
  unread: boolean;
  open: boolean;
}

async function loadCustomerOffers(admin: AdminClient, customerId: string) {
  const { data: searches, error: searchError } = await admin
    .from("customer_searches")
    .select("id, make, model, search_status")
    .eq("customer_id", customerId);
  if (searchError) throw new Error(`Failed to load searches: ${searchError.message}`);
  const searchById = new Map((searches ?? []).map((s) => [s.id as string, s]));
  if (searchById.size === 0) return { searchById, offers: [] };

  const { data: offers, error: offerError } = await admin
    .from("qualifying_offers")
    .select(
      "id, customer_search_id, dealer_name, offer_price_cents, status, last_message_at, last_agent_message_at, customer_messages_read_at"
    )
    .in("customer_search_id", [...searchById.keys()]);
  if (offerError) throw new Error(`Failed to load offers: ${offerError.message}`);
  return { searchById, offers: offers ?? [] };
}

/** The Messages list: every thread with at least one message, newest first. */
export async function getCustomerThreads(admin: AdminClient, customerId: string): Promise<CustomerThreadSummary[]> {
  const { searchById, offers } = await loadCustomerOffers(admin, customerId);
  const withMessages = offers.filter((o) => o.last_message_at);
  const messages = await loadMessagesForOffers(
    admin,
    withMessages.map((o) => o.id as string),
    "customer",
  );

  return withMessages
    .map((o) => {
      const search = searchById.get(o.customer_search_id as string)!;
      const thread = messages.get(o.id as string) ?? [];
      return {
        offerId: o.id as string,
        searchId: o.customer_search_id as string,
        dealerName: o.dealer_name as string,
        make: (search.make as string | null) ?? null,
        model: (search.model as string | null) ?? null,
        offerPriceCents: o.offer_price_cents as number,
        lastMessageAt: o.last_message_at as string,
        lastMessage: thread[thread.length - 1] ?? null,
        unread: hasUnreadForCustomer(o.last_agent_message_at, o.customer_messages_read_at),
        open: threadIsOpen(o.status as string, search.search_status as string),
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

/** Count of the customer's threads with an unread agent message (header badge). */
export async function getCustomerUnreadThreadCount(admin: AdminClient, customerId: string): Promise<number> {
  const { offers } = await loadCustomerOffers(admin, customerId);
  return offers.filter((o) => hasUnreadForCustomer(o.last_agent_message_at, o.customer_messages_read_at)).length;
}

export interface CustomerThread {
  offerId: string;
  searchId: string;
  searchStatus: string;
  offerStatus: string;
  dealerName: string;
  make: string | null;
  model: string | null;
  offerPriceCents: number;
  open: boolean;
  messages: OfferMessage[];
}

/** One thread, or null if the offer doesn't exist or isn't this customer's. */
export async function getCustomerThread(
  admin: AdminClient,
  customerId: string,
  offerId: string,
): Promise<CustomerThread | null> {
  const { data: offer } = await admin
    .from("qualifying_offers")
    .select("id, customer_search_id, dealer_name, offer_price_cents, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;
  const { data: search } = await admin
    .from("customer_searches")
    .select("id, customer_id, make, model, search_status")
    .eq("id", offer.customer_search_id)
    .maybeSingle();
  if (!search || search.customer_id !== customerId) return null;

  const messages = await loadMessagesForOffers(admin, [offerId], "customer");
  return {
    offerId,
    searchId: search.id as string,
    searchStatus: search.search_status as string,
    offerStatus: offer.status as string,
    dealerName: offer.dealer_name as string,
    make: (search.make as string | null) ?? null,
    model: (search.model as string | null) ?? null,
    offerPriceCents: offer.offer_price_cents as number,
    open: threadIsOpen(offer.status as string, search.search_status as string),
    messages: messages.get(offerId) ?? [],
  };
}
