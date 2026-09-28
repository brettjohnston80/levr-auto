# Guarantee timeline, automatic progress notes, general thread and notification rules — plan (2026-09-27)

Status: **APPROVED 2026-09-27 — building.** Admin pause decided (removed), all seven progress notes approved. Email only; text is a separate later project.

## Brett's decisions (2026-09-27)

1. **Cancelled searches: fixed first, on its own.** Commit `2b01ab2`: the Day-30 check skips cancelled searches, both when selecting and as a write-time guard. Production had 0 cancelled searches, so nothing was ever mis-marked.
2. **Admin pause: removed.** Both admin buttons are gone (Pause *and* Resume). Nothing relies on Resume: Day-60-paused searches resume through the customer's paid extension or the agent extension bypass, which both move the deadline, whereas admin Resume left the deadline in the past so the next nightly run re-paused or auto-renew-charged the search. `admin_action_log` (empty in production) and the `admin_pause_search`/`admin_resume_search` DB functions are kept for history.
   - **Future item:** customer-requested search holds, with guarantee and Day-60 clock extensions. Not built.
3. **Progress notes:** softer wording that doesn't claim actions the system can't confirm. All seven revised lines below are **approved**.
4. **Approved as recommended:**
   - the guarantee timeline sits below the status timeline;
   - the frequency setting is removed;
   - email first, with text as a separate later project;
   - all other copy as written.
Migration draft: `supabase/migrations/20260928120000_general_thread_and_daily_update.sql` (not run).

## Findings: how the guarantee works today (read from code, not docs)

**The clock**
- The guarantee clock starts at `customer_searches.solidified_at`, set by the hourly job 24h after finalizing — not at payment.

**What delivers it** (`evaluateOfferGuaranteeContribution`, `guarantee.ts`)
- An offer "counts" when it is **below Total SRP and has been delivered**, meaning it appeared on the customer's dashboard.
- Sold-before-response rule:
  - If the car later sells, the offer still counts **unless** the customer responded within 24h of delivery. In that case it stops counting and LEVR keeps searching.
  - So "delivered" can in rare cases flip back until Day 30.

**Day 30** (`guarantee-assessment.ts`, daily cron)
- Every search with `guarantee_status = 'pending'` and `solidified_at` at least 30 days ago is resolved once.
- `met` if any offer counts, else `refunded`.
- `guarantee_resolved_at` is stamped.
- `refunded` only puts the search on the `/internal/refunds-due` worklist. The refund itself is manual, in Stripe.
- **Nothing is stored before Day 30.** A search with a qualifying offer on Day 5 still reads `pending` until the Day-30 job runs.

**Day 60** (`day60-extension.ts`)
- This is the *search* deadline, not the guarantee: `search_deadline_at`, or `solidified_at + 60 days` when unset. Each paid extension adds 30 days.
- Reminder 7 days before.
- At the deadline the search pauses. Auto-renew charges $100 instead, if the customer turned it on.
- After pausing: a 30-day window to resume by paying, then an expired state.
- Free searching continues through Day 60 whether the guarantee was met or refunded.

**⚠ Two real gaps found (not fixed; flagged for a decision):**
1. **A cancelled search can land on the refunds worklist.** The Day-30 job has no status filter by design, so switched searches still resolve. A search cancelled before Day 30 with no qualifying offer is therefore marked `refunded` and appears on `/internal/refunds-due`, which filters only on `guarantee_status`. But self-service cancellation is policy **no-refund**. An agent working that list could refund money the policy says not to. Suggested fix: the Day-30 job skips `cancelled` searches, or marks them with a distinct outcome.
2. **An admin pause doesn't stop the guarantee clock.** ~~Decide whether admin-paused days should extend the guarantee.~~ Resolved by removing the admin pause (see decision 2); holds with clock extensions are a future item.

## 1. Guarantee timeline

**Data:** no new columns; everything is derived at read time.
- "Delivered" = the earliest `delivered_at` among offers that currently count, the same rule the Day-30 job uses. Before Day 30 this is provisional, but it only flips in the rare sold-after-quick-response case.
- `guarantee_status` / `guarantee_resolved_at` lock it in at Day 30.
- The Day-60 date comes from the existing `effectiveDeadline()`.

**Placement:** a compact second timeline directly **below** the existing status timeline on Your Deal. It uses the same visual component, `SearchStatusTimeline`, with three markers: **Search started → Day 30 → Day 60**. It's filled up to today, with one status line underneath. It's separate from the status timeline because it answers a different question ("what's LEVR promising me?"), and folding it in would make the status timeline stop being about the car.

**States:**
| State | When | Marker fill | Line |
|---|---|---|---|
| Active | pending, nothing counts yet | up to today | Countdown of days left to Day 30 |
| Delivered | a counting offer exists (pending or met) | Day 30 marked done | Date it was delivered, then the search deadline |
| Refunded | `refunded` | Day 30 marked, neutral colour | Refund line, then "still searching through…" |
| Paused (after Day 60) | `paused` | full | The resolved line only. The existing pause banner already explains the resume window. |
| Purchased | `purchased` | hidden | One line: when the guarantee was delivered. It never shows for a purchased search without a counting offer. |
| Cancelled / switched / not yet started | — | hidden | — |

## 2. Automatic progress notes (no counts)

- **Derived** from data that already exists. No stored stage, and no dealer counts: outreach isn't logged anywhere today, so there's no "dealers contacted" data even if we wanted it.
- **Placement:** shown as one line under the status timeline. It replaces the current approved "Actively searching — we'll show new offers here as they come in." for searching searches.
- **Paused, cancelled and switched searches** keep their existing banners.

| Stage | Derived from | Note |
|---|---|---|
| Just started | searching, solidified < 3 days ago, no offers | Search is live |
| In progress | searching, ≥ 3 days, no offers | Search in progress |
| Offers in | at least 1 pending offer, none accepted | Offers to review |
| Accepted | an offer accepted, availability not confirmed | Agent confirming availability |
| Availability confirmed | availability confirmed, deposit not | Next step: deposit |
| Deposit confirmed | deposit confirmed, not purchased | Agent finalizing |
| Still searching after a refund | guarantee refunded, still searching | Continuing through the deadline |

## 3. General thread and notification rules

### General thread
- **Schema:** general messages are `offer_messages` rows with no offer (`qualifying_offer_id` NULL). Every message now carries `customer_id`, filled by a trigger so the live code keeps working through the deploy. New `general_threads` table holds per-customer unread and daily-update state.
- **Always open.** It isn't tied to an offer or search status, so there's nothing to freeze on.
- **Customer:**
  - `/account/messages` pins a "Your LEVR agent" row above the offer threads, even before any message exists. Its thread page is `/account/messages/general`.
  - Your Deal's "No offers yet" state links to it.
  - The header unread count includes it.
- **Agent:** the "Customer activity on offers" section also lists general-thread messages, with the same inline reply and stale-page guard. Each active search card gets a "General messages" expander.

### Notifications: two kinds
**Highlights: sent right away** to each enabled channel:
- New offer received (`offer_logged`, exists)
- Accepted offer released by an agent (`offer_withdrawn`, **new**; today the customer is told nothing)
- Dealer confirmed availability (`deal_progress_update`, exists)
- Deposit confirmed (`deal_progress_update`, exists)
- Purchase confirmed (`search_purchased`, exists)
- Guarantee resolved at Day 30 (`guarantee_resolved`, **new**; matters most when refunded)

Unchanged and separate (always-on account emails, not part of this system): Day-60 deadline reminder, auto-renew confirmation, resume-window reminder, post-deal survey.

**Daily update: one email a day**, at the existing 13:00 UTC digest run, and only if there's something to include:
- **Unread messages:** "{N} conversation(s) with new messages from your agent", plus links. Each thread is listed once per new agent reply (`daily_update_included_at`), not every day until read. No message content.
- **Routine activity:** the customer's own accept/decline receipts (`offer_response_recorded`).
- **This replaces the email-on-first-agent-reply behaviour** (`message-email.ts`), which is removed. `message_email_sent_at` gets dropped in a later post-deploy cleanup.

**Existing settings:**
- `communication_frequency` (real-time / daily digest / both) becomes obsolete: highlights are always immediate and routine is always daily. **Recommend removing it from Account Settings**, and dropping the column later.
  - **Behaviour change to flag:** a customer who chose "daily digest" will now get highlights immediately. Today that's only test accounts and Brett's own account.
  - Alternative if wanted: a single "Send highlights immediately" toggle that, when off, folds highlights into the daily update.
- The email / text / agent-callback checkboxes stay as the channel choice, including the at-least-one rule. Agent callback still creates an agent task for highlights, unchanged.

### Texting: scoped separately
**Providers (US, 2026 list prices):**
| | Per message | Carrier fees (pass-through) | Number | 10DLC registration |
|---|---|---|---|---|
| **Telnyx** | $0.004 | $0.003–$0.005 | ~$1/mo | $4 brand (one-time) + $15 campaign vetting + $1.50–$10/mo campaign fee |
| **Twilio** | $0.0083 | $0.0035–$0.005 | $1.15/mo | same registry fees, plus Twilio's own onboarding |

At our scale (tens to hundreds of texts a month), either costs a few dollars a month plus registration. Telnyx is about half Twilio's per-message price, and Twilio has more docs and tooling.

**Consent (TCPA and carrier rules):**
- These are informational account texts (offer updates), not marketing.
- Collect an explicit, **unticked** opt-in. It should state:
  - the kind of messages;
  - that frequency varies;
  - "Msg & data rates may apply";
  - "Reply STOP to opt out, HELP for help";
  - a link to terms and privacy.
- Store the consent timestamp, phone number and the exact wording version.
- 10DLC campaign registration requires describing this opt-in flow.
- Some states' "mini-TCPA" laws add quiet hours, so send the daily text roughly between 9am and 8pm in the recipient's time.

**Opt-out:**
- STOP / UNSUBSCRIBE / CANCEL / END / QUIT (and similar) must stop texts immediately. Providers can auto-handle these keywords, but we should record `sms_opted_out_at` from their webhook, and show "Texts are off (you replied STOP)" in settings.
- HELP returns a short support message.
- Penalties start at $500 per unwanted message.

**Recommendation: ship email first; add text as its own project.** Text needs 10DLC registration (days to weeks of carrier review), consent capture and copy, a provider webhook, quiet-hours scheduling, and probably an attorney glance at the consent wording. None of the email work depends on it. Until then, text-only customers keep today's behaviour: the agent is flagged that the customer has no deliverable channel.

## Customer-facing copy — ALL needs Brett's sign-off

**Guarantee timeline**
- Heading: "Your guarantee"
- Markers: "Search started" · "Day 30" · "Day 60"
- Active: "{N} days left for us to bring you an offer below Total SRP." (and "1 day left…")
- Delivered: "Guarantee delivered {date} — you received an offer below Total SRP." then "Your search continues through {date}."
- Refunded: "We didn't find an offer below Total SRP within 30 days, so your $699 is being refunded. We'll keep searching through {date}."
- Paused: the resolved line above ("Guarantee delivered {date}…" or "Your $699 refund was approved on {date}."). It's "approved", not "refunded", because the date is when the Day-30 check ran; the Stripe refund itself is processed by hand afterwards.
- Purchased: "Guarantee delivered {date}."

**Progress notes: REVISED 2026-09-27, APPROVED.** Softer wording: lines claim only what the data shows, never unlogged outreach.
- Just started (live under 3 days, no offers): "Your search is live — your agent is lining up dealer outreach."
- In progress (3+ days, no offers): "Your search is in progress — we'll post offers here as they come in."
- Offers in: "You have offers to review below."
- Accepted, availability not yet confirmed: "You accepted an offer. Next, your agent will confirm it's still available."
- Availability confirmed: "The dealer confirmed it's still available. Next step: the deposit."
- Deposit confirmed: "Deposit confirmed. Your agent will help you finish the purchase."
- After a refund, still searching: "Your search continues through {date}."

**General thread**
- Messages list row: "Your LEVR agent" · preview empty state: "Questions about your search? Message your agent."
- Thread page heading: "Your LEVR agent"; empty state: "No messages yet. Ask your agent anything about your search — they'll reply here."
- Your Deal (no offers): "Message your agent"

**Privacy line under the send box** (replaces the approved "When your agent replies, we'll email you a link…"):
- Email on: "Only you and the LEVR team can see these messages. New replies from your agent are included in your daily update email."
- Email off: unchanged ("…Email notifications are off in your account settings, so check back here or in Messages for replies.")

**Highlight emails** (subject / body; each body ends with a link to the relevant page)
- New offer: existing approved copy, unchanged.
- Offer released: "An update on your accepted offer" / "Your accepted offer from {dealer} was released, so you can choose another offer. Your agent will be in touch about what happened."
- Availability / deposit / purchase: existing approved copy, unchanged.
- Guarantee met: "Your LEVR guarantee was delivered" / "You received an offer below Total SRP within 30 days — your guarantee is met. We'll keep working your search through {date}."
- Guarantee refunded: "Your $699 is being refunded" / "We didn't find an offer below Total SRP within 30 days, so we're refunding your $699. We'll keep searching through {date} at no cost."

**Daily update email**
- Subject: "Your LEVR daily update"
- Messages section: "You have new messages from your agent in {N} conversation(s)." (plus one link per conversation)
- Activity section heading: "Other updates"
- Footer: "You're getting this because daily updates are on for your account. Change this in account settings."

**Account Settings** (the frequency chooser is removed)
- Replacement helper under the channels: "We send important updates right away, and everything else in one daily update."

## Decisions needed

None open. All resolved 2026-09-27 (see "Brett's decisions" at the top).
