# Email the customer when their agent sends a message — plan (2026-09-26)

Status: **APPROVED 2026-09-26 and built.** Decisions: send regardless of the daily-digest setting; use Option A by default and Option B for email-off customers; all copy approved as written. Migration `20260926140000_offer_message_email.sql` is applied.

## What exists today

- `sendEmail()` (`src/lib/email.ts`) is the single chokepoint for every business email. Its first line suppresses any `@levrauto-test.invalid` recipient (logged, not sent), so test accounts stay silent automatically.
- Customers already have notification preferences (`customers.notify_by_email`, `communication_frequency`), used by `logNotificationEvent` for offer/deal events.
- Unread state per thread: `qualifying_offers.last_agent_message_at` vs `customer_messages_read_at`.

## Proposal

**When it sends:** right after `sendAgentMessage` saves an agent message. It's non-blocking: a failed send is logged and never fails the message itself.

**Flood rule: at most one email per thread until the customer opens it.**
- New column `qualifying_offers.message_email_sent_at`.
- Send only if it's null, or if the customer has opened the thread since the last email (`customer_messages_read_at > message_email_sent_at`).
- So three agent replies in a row produce one email. Once the customer reads the thread, the next reply can email again.
- Stamped only after a successful send, so a failed send gets retried on the next reply.

**Respecting existing preferences:**
- Skip if `notify_by_email` is off. That customer explicitly turned email off, so the badge and Messages page are their channel.
- **Recommend ignoring `communication_frequency` (digest).** A "you have a message" nudge arriving tomorrow defeats its purpose, and the one-per-thread rule already keeps volume low. Flagged for your decision.

**Not routed through `notification_events`.** Reusing it would also flag agent callbacks and the text-only edge case for every agent message. That's wrong here, since the agent is the one writing.

**The email:**
- Plain, minimal HTML with no message content, no dealer name and no price.
- It links straight to the thread: `/account/messages/{offerId}`. A signed-out customer is sent to `/login?next=…` and lands back on the thread; that redirect already exists.
- Sent to the account's email via the same `customers.email` + display-name pattern the other senders use.

**Migration** (to be written at build time, not run):
```sql
alter table public.qualifying_offers add column message_email_sent_at timestamptz;
```

**Unread filter on /account/messages:** two tabs, "All" and "Unread ({N})", via `?filter=unread`. The Unread view lists only threads with an unread agent message. Opening one marks it read, so it drops off the Unread list the next time the page loads.

**Verification plan:**
- Use a disposable account on the test domain, so the send is suppressed. Confirm that the `[email suppressed — test account]` log line fires with the right subject, and that the one-per-thread rule holds across several replies before and after a read.
- The only real delivery test would be to your own address, and only if you ask for it.

## Customer-facing copy — ALL needs Brett's sign-off

**Email**
- Subject: "You have a new message from your LEVR agent"
- Body: "You have a new message from your LEVR agent." Then a button, "View message", linking to the thread.
- Footer: "We'll email you once per conversation until you've read it. You can turn off email notifications in your account settings."

**Replacement for the privacy line under the send box** (the approved line says no email alerts are sent, which would now be wrong). Two options:
- Option A: "Only you and the LEVR team can see these messages. When your agent replies, we'll email you a link — the message itself stays here."
- Option B, shown only when the customer has email notifications off: "Only you and the LEVR team can see these messages. Email notifications are off in your account settings, so check back here or in Messages for replies."
- Recommend both: A by default, B for email-off customers. The line then stays true for everyone.

**Messages page**
- Tabs: "All" · "Unread ({N})"
- Unread empty state: "No unread messages."

## Decisions needed

1. Should the email ignore the daily-digest setting (recommended), or wait for the digest?
2. Replacement line: A only, or A plus B?
3. Approve the email subject, body and footer as written?
