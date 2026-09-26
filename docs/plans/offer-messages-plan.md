# Offer message threads — plan (2026-09-25)

Status: **APPROVED 2026-09-25, being built.** Decisions recorded below under "Brett's decisions on this plan".
Migration draft: `supabase/migrations/20260926120000_offer_messages.sql` (not run).

## Decisions already made (Brett)

- One thread per offer; customer and agent both post, unlimited.
- No email or SMS notifications.
- Thread shows in the offer's detail view, with a link to a separate Messages section.
- Messages section: all of a customer's offer threads, newest activity first.

## Brett's decisions on this plan (2026-09-25)

1. Fold each existing customer note into its thread as the first message and retire the note. The old columns stay until the new code is live; then a follow-up migration drops them.
2. **Declined-offer threads stay OPEN.** Withdrawn offers, and switched, cancelled or closed searches, stay frozen. The "closed because you declined this offer" line is removed.
3. Customers see the agent's first name: "{Agent first name} · LEVR agent" on the thread page and "{Agent first name}:" in the list.
4. The privacy line changes to: "Only you and the LEVR team can see these messages. We don't send email or text alerts for new messages, so check back here or in Messages for replies."
5. All other draft copy in section 8 is approved as written.

## Findings

- `customer_note` exists on exactly **1 of 13** offers in production: a pending offer on the review account's Civic Sport search (`f90b0dc7…`), from Brett's own testing.
- Header account dropdown (`header-account-link.tsx`): Your Car, Your Deal, Account settings, Log out. It's a client component; the first name is fetched client-side.
- Agent-side "unread" already exists: `customer_activity_at` vs `agent_reviewed_at`, surfaced in "Customer activity on offers" (`getCustomerOfferActivityQueue`), which only covers `searching` and `paused` searches.
- Offer statuses: `pending`, `customer_accepted`, `customer_declined`, `withdrawn`. Search statuses that end a deal: `purchased` (still shown on Your Deal), and `switched` / `cancelled` / `closed` (hidden from Your Deal).

## 1. Schema

See the migration draft. Summary:

- **`offer_messages`:** `id`, `qualifying_offer_id` (cascade), `author_type` (`customer` | `agent`), `author_customer_id` / `author_agent_id` (set null on delete), `body` (1–1,000 characters after trim), `created_at`.
  - A check constraint ties the author columns to the author type.
  - RLS on, no policies, service-role only, same as every table here.
  - **Messages are immutable** (no edit or delete). Recommended: it's an honest record, and there is no "edited" UI to design.
- **Thread state on `qualifying_offers`:** `last_message_at` (sorting), `last_agent_message_at`, `customer_messages_read_at`.
  - Customer unread = `last_agent_message_at > customer_messages_read_at` (or read is null). No scan of messages needed for badges.
- **Agent unread needs no new columns.** A customer message bumps `customer_activity_at`, exactly like a note edit does today.

## 2. customer_note → first message (recommended)

- **Recommended: fold the note into the thread and retire the note.**
  - Keeping two places for "what the customer told the agent" would mean two UIs and two agent displays.
  - A thread is a strict superset of a single note.
- **How existing notes carry over:**
  - The migration copies each note as a customer message, dated `customer_note_updated_at`. That's just 1 row today: your review account's note.
  - The copy is idempotent.
- **Two-step removal, for deploy safety:**
  - The old production code still writes `customer_note` until this build deploys, so the columns stay for now.
  - A small follow-up migration, run after the deploy, re-runs the copy (catching any note written in between) and then drops `customer_note`, `customer_note_updated_at` and their check constraint.
- **Highlight is unchanged.** It stays a separate flag, not a message.

## 3. Unread indicators (no notifications)

**Customer side:**
- **Header menu:** a new "Messages" item with a count of threads that have unread agent messages. There's also a small dot on the account trigger button when the count is above 0.
  - Fetched with a server action when the menu mounts and on route change. The same entry and dot go in the mobile menu.
- **Offer card:** a "New message from your agent" badge replaces the note preview.
- **Messages list:** an unread dot per thread.
- **Marked read** (`customer_messages_read_at = now()`) when the customer opens a thread, either in Messages or in the detail view. It is never marked read just because the card was seen.

**Agent side:**
- Reuses "Customer activity on offers." A customer message bumps `customer_activity_at`, so the offer shows up there with the new message(s) since the last review and an inline reply box.
- **Replying counts as reviewing.** Sending a reply sets `agent_reviewed_at`, but only if `customer_activity_at` still equals the value the page loaded with (the same stale guard as Mark reviewed). If the customer wrote again meanwhile, the item stays.
- **`purchased` must be added to the section's search-status filter.** Accepted offers on purchased searches stay open for messages (see section 4), so without it a customer message after purchase would never surface.

**Honest gap:** with no alerts, a customer only sees a reply when they next visit. The detail view and Messages page say so plainly (see copy below), so nobody waits on an email that never comes. Agents can still call for anything time-sensitive.

## 4. When a thread is open or frozen

A frozen thread is always still readable. Only sending is blocked. A single shared helper, `threadIsOpen(offerStatus, searchStatus)`, is used by the server action (authoritative) and the UI.

| Offer status | Search status | Thread |
|---|---|---|
| pending | searching / paused | **Open** |
| customer_accepted | searching / paused | **Open** (closing coordination: availability, deposit, paperwork) |
| customer_accepted | purchased | **Open** (delivery and paperwork questions continue after purchase) |
| customer_declined | searching / paused / purchased | **Open** (decision 2) |
| withdrawn (agent released it) | any | Frozen |
| any | switched / cancelled / closed | Frozen |

- `vehicle_sold_at` alone doesn't freeze anything; the agent may need to explain the sale in the thread.
- Declined stays open per decision 2, so an agent can ask "why did you pass?" and a customer can reconsider in conversation.

## 5. Where it lives

**Customer:**
- **`/account/messages`:** a list of threads that have at least one message, across all the customer's searches (including purchased and frozen ones), newest `last_message_at` first.
  - Each row: dealer, make/model, offer price, last message preview with author, time, unread dot, and a "Closed" tag if frozen.
- **`/account/messages/[offerId]`:** the full thread, with a composer if open and a "View offer details" link to `/account/deal?searchId=…&offer=…`.
  - This needs a small addition: an `offer` query param that auto-opens that offer's detail view.
- **Header menu:** "Messages" goes between Your Deal and Account settings.
- **Offer detail view:**
  - A "Messages" section replaces the note editor. It shows the last 3 messages, a composer, and "View all N messages →" into Messages.
  - Highlight stays under "Tell your agent."
- **Starting a thread:** threads start from an offer, where the first message creates the thread. The Messages page doesn't have a "new message" button.

**Agent (`/internal/outreach`):**
- **Activity section:** shows unreplied customer messages with inline reply (above).
- **Active-search cards:**
  - Each logged offer gets "Messages (N)", which expands to the full thread with a reply box.
  - Agents can also start a thread, for example "Dealer confirmed it's still on the lot."
- **Agent identity:** agent messages store `author_agent_id`. Customers see the agent's first name from `agents.name`, and agents see which agent wrote each message.
- **Paused searches have no card on this page,** so an agent can only reply to their threads from the activity section, not start one. That's acceptable for now; flagged.

## 6. A general thread not tied to an offer — flagged, NOT built

Customers with no offers yet can't message anyone. That includes:
- undecided buyers waiting on a consultation;
- anyone early in a search.

Today they have support@levrauto.com and the call-request buttons. A per-search or per-customer general thread would need its own table shape (or a nullable offer id plus a search id) and its own placement.

**Recommendation: leave it out now,** and revisit once real customers show whether offer threads cover most questions.

## 7. Other recommendations

- 1,000-character limit per message (the note was 500), enforced by server action and a DB check. Line breaks are preserved when displayed. Plain text only, no links rendered as HTML.
- No realtime or polling. A thread refreshes on page load and after sending, same as everything else here.
- Build order: migration (you run it) → server actions plus `threadIsOpen` → detail view and card → Messages pages and header → agent views → verify on a disposable customer plus scratch agent → you review on the review account → follow-up drop migration after deploy.

## 8. Customer-facing copy — APPROVED 2026-09-25 (with decision 4's revision)

**Offer detail view**
- Section heading: "Messages"
- Empty state: "No messages yet. Ask your agent anything about this offer — they'll reply here."
- Composer placeholder: "e.g. Would they do $31,000? Is the sunroof included?" (kept from the note)
- Button: "Send"
- Under the composer (**revised, decision 4**): "Only you and the LEVR team can see these messages. We don't send email or text alerts for new messages, so check back here or in Messages for replies."
- Link: "View all {N} messages →"
- Frozen: "This conversation is closed because this offer was released." / "This conversation is closed because this search has ended." (The declined line is removed, per decision 2.)

**Offer card**
- Link (replaces "Add a note for your agent"): "Message your agent"
- When messages exist: "Messages ({N})"
- Unread badge: "New message from your agent"

**Header menu**
- Item: "Messages", with a count badge when there are unread threads

**Messages list (`/account/messages`)**
- Page title: "Messages"
- Intro: "Your conversations with your LEVR agent, one per offer. Newest first."
- Empty state: "No messages yet. You can message your agent from any offer on Your Deal."
- Preview author labels: "You:" / "{Agent first name}:"
- Closed tag: "Closed"
- Browser tab title: "Messages — LEVR Auto"

**Thread page**
- Back link: "← All messages"
- Link: "View offer details"
- Author labels: "You" / "{Agent first name} · LEVR agent"

**Errors**
- "Write a message before sending."
- "Messages can be up to 1,000 characters."
- "This conversation is closed, so new messages can't be sent."
- Existing and already approved: "Not signed in." / "Not authorized." / "That offer no longer exists."

**Retired copy** (removed with the note editor): "Add a note for your agent", "Only your LEVR agent sees this note.", "Edit note", "Remove note", "Your note:", "You can only add a note to an offer you haven't responded to yet.", "Notes can be up to 500 characters."
