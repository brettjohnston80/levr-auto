# Sign-up to payment fix: plan (approved 2026-09-30, not built)

Status: **APPROVED by Brett 2026-09-30. Top priority, to build right after the production journey test finishes.** All wording below is approved as written. The migration is approved; Brett runs it before the build deploys. Build only after the journey test (see CLAUDE.md's in-flight section).

## Problem (found in the journey test)
- Sign-up in the intake pop-up doesn't sign the customer in (email confirmation is required). Intake is kept only in that browser's localStorage (`levr_pending_intake`, 1 hour), and resumes only when that browser opens the homepage. The confirmation link lands on `/account`, which never resumes it. A customer who confirms on another device, or doesn't go back to the homepage, loses their intake and has no path to payment.
- Every intake save inserts another unpaid `customer_searches` row, so duplicates pile up.
- `finalizeSelfService` and `requestFinalizationCall` check only `search_status`, not `paid_at`. The `/finalize` page blocks unpaid visitors, but the actions don't.

## Decisions (Brett, 2026-09-30)
1. Sign-up before payment stays. Save the unpaid search on the server at sign-up so it's never lost.
2. Payment is required before anything that commits to a car: finalizing (trim/color/options) and requesting a call.
3. The unpaid search lives in the Your Car tab (`/account/vehicle`) as a "Review and pay" view. Intake choices are saved and editable before payment and persist across leaving and logging out, with "Continue to payment — $699". No starting over. Make and model lock at payment, as today.
4. Unpaid reminder emails at 24h and 72h after the unpaid search was saved, at most two, stopping on payment, with one-click unsubscribe. Confirmed, non-test addresses only. Only unpaid searches created after the feature deploys (no backlog on launch day).
5. Unpaid searches stay out of the nightly sync, agent queues and guarantee jobs, and don't count as real customers. **Rule: a real customer = a customer with a paid search (`paid_at` set).**
6. Guarantee clock unchanged: Day 30 and Day 60 count from when the search goes live (`solidified_at`). No code change. The website wording is updated to say so (below).
7. The general message thread stays open before payment, labelled "unpaid" in the agent's view.

## Build plan
1. **One shared save helper**, holding `saveIntakeSearch`'s checks: make/model/year offered in the live data, ZIP, pickup range, and Matchmaker context only when passed explicitly. It **reuses the customer's latest unpaid search** instead of inserting another. Used by the normal intake, the sign-up action and undecided intake.
2. **`signupInline`** takes the intake details and creates the unpaid search right after the account is created. It clears the browser stash.
3. **Undecided intake:** same treatment. Remove its automatic redirect to Stripe; every payment needs a click.
4. **Your Car (`/account/vehicle`)** shows the unpaid search as "Review and pay" (wording below). Every route into it ends there: sign-up confirmation, intake while signed in (instead of the homepage "Proceed to Payment" screen), the `/account` card, and the reminder emails. The pay button uses the existing `createCheckoutSession`.
5. **Server-side `paid_at` checks** on `finalizeSelfService`, `requestFinalizationCall` and every other finalize-stage action.
6. **`/account`:** a card at the top for an unpaid search, and the unpaid line in the searches list.
7. **Admin and agents:** `/internal/admin` gets an "Unpaid (checkout not completed)" filter, with unpaid rows hidden from "All" by default. Agent customer lookups tag unpaid searches "unpaid". General-thread activity items from unpaid customers are tagged "unpaid".
8. **Reminder job** (hourly):
   - candidates: unpaid search, no paid search on the customer, email confirmed, not a test address, not unsubscribed, and search created after the deploy cutoff;
   - payment is re-checked immediately before each send;
   - each send is stamped only after it succeeds;
   - **sends nothing while `REMINDER_MAILING_ADDRESS` is unset** (logs and moves on).
   - Unsubscribe links are signed with `UNSUBSCRIBE_SECRET` (set in Vercel Production). A `List-Unsubscribe` header is included. Unsubscribing stops only these reminders.
9. **CLAUDE.md:** the real-customer rule, the new flow, and one unpaid search per customer.

Already excluded, no change needed: nightly and weekly sync, sync at payment, every agent queue (each needs payment or a later status), Day-30, Day-60, resume reminders, post-deal survey, social posts, refunds-due, daily update and highlights.

Verify on disposable accounts:
- sign up in one browser, confirm in another, then pay from Your Car;
- the same-browser path, with no duplicate;
- a second intake that reuses the unpaid row;
- undecided intake;
- a direct finalize or call-request action on an unpaid search is refused;
- the reminder job (scoped, test inbox only, clearly marked test address);
- no job or queue picks up an unpaid search.

## Migration (approved; write to `supabase/migrations/` at build time)
```sql
begin;

alter table public.customer_searches
  add column unpaid_reminder_1_sent_at timestamptz,
  add column unpaid_reminder_2_sent_at timestamptz;

comment on column public.customer_searches.unpaid_reminder_1_sent_at is
  'When the first "finish your search" reminder (24h after the unpaid search was saved) was sent. Null = not sent.';
comment on column public.customer_searches.unpaid_reminder_2_sent_at is
  'When the second reminder (72h) was sent. Null = not sent. No more than two are ever sent.';

alter table public.customers
  add column unpaid_reminders_unsubscribed_at timestamptz;

comment on column public.customers.unpaid_reminders_unsubscribed_at is
  'Set when the customer unsubscribes from unpaid-search reminders. Never cleared automatically.';

create index customer_searches_unpaid_created_idx
  on public.customer_searches (created_at)
  where paid_at is null;

commit;
```
There's no unique index for one unpaid search per customer: two customers already have more than one unpaid row (checked 2026-09-30). The app enforces it by reusing the latest unpaid row.

## Approved wording (2026-09-30)

**Your Car: "Review and pay"**
- Heading: "Review your search"
- Under heading: "Check your choices, then pay to start. You can change any of these until you pay."
- Row labels: "Vehicle", "Model year", "ZIP code", "Pickup range", each with "Change"
- Inventory lines: reuse the existing approved lines unchanged:
  - nationwide: "{N} {make} {model} listings nationwide (all trims)" / "No {make} {model} listings currently tracked nationwide";
  - nearby: the intake badge's line and its honest-zero version.
- "What's included":
  - "Your LEVR agent negotiates with dealers nationwide for this vehicle."
  - "Offers land in your account — accept one or pass. You're never obligated to buy."
  - "A flat $699 — no commission, no markup."
  - "At least one real offer below Total SRP within 30 days of your search going live, or your $699 back."
- Next: "After you pay, you'll choose trim, color, and options, with 24 hours to change them. Your search goes live when that window closes."
- Lock note: "Your make and model lock once you pay."
- Button: "Continue to payment — $699"
- Undecided: vehicle row "To be chosen with your agent"; next line "After you pay, your agent will reach out to help you choose the vehicle."

**`/account` card**
- Heading: "Finish starting your search"
- Body: "Your {year} {make} {model} search is saved. Review it and pay the flat $699 fee to start."
- Undecided body: "Your search is saved. Review it and pay the flat $699 fee to start."
- Link: "Review and pay"

**Unpaid line in the searches list:** "Not paid yet — this search starts once you complete payment." plus a "Review and pay" link. It replaces "Checkout wasn't completed — this search hasn't been paid for, so it hasn't started." and its homepage link.

**Pop-up after sign-up:** "We've saved your search. After you confirm your email, you can review it and pay from your account."

**Agent and admin labels:** "unpaid" tag; admin filter "Unpaid (checkout not completed)".

**Reminder 1 (24h)**
- Subject: "Your {make} {model} search is saved"
- Body: "You started a LEVR Auto search for a {year} {make} {model} but haven't paid yet. Your choices are saved — pick up where you left off and pay the flat $699 fee to start your search."
- Button: "Finish your search"

**Reminder 2 (72h)**
- Subject: "Still want help buying your {make} {model}?"
- Body: "Your {year} {make} {model} search is still saved. Once you pay the flat $699 fee, your LEVR agent starts negotiating with dealers nationwide — and if we don't bring you at least one real offer below Total SRP within 30 days of your search going live, you get your $699 back."
- Button: "Finish your search"
- Undecided versions: "your LEVR Auto search" instead of the vehicle.

**Reminder footer:** "You're getting this because you started a search at levrauto.com. [Unsubscribe from these reminders]", then "LEVR Holdings LLC · {REMINDER_MAILING_ADDRESS}". **A real postal address is required before sending** (CAN-SPAM); no test or made-up address.

**Unsubscribe page**
- Heading: "You're unsubscribed"
- Body: "We won't send you any more reminders about finishing your search. You'll still get emails about your account and any deal in progress."
- Invalid link: "This unsubscribe link isn't valid. Email support@levrauto.com and we'll take care of it."

## Guarantee start-point wording (approved 2026-09-30; build with this fix)
| Where | New wording |
|---|---|
| `guarantee.tsx` paragraph | "…before tax, title, and fees — within 30 days of your search going live, you get your $699 back." |
| `guarantee.tsx` Day 0 | Title "Your search goes live"; body "Once your vehicle details are locked in, we get to work." (Day 30 and Day 60 unchanged) |
| FAQ "What if you can't get me a deal below Total SRP?" | "You get your full $699 back. Your 30-day guarantee window starts when your search goes live, and if it ends without a qualifying offer, we process your refund — no need to ask for it." (removes the wrong "automatically") |
| FAQ "How long…" | "…below Total SRP within 30 days of your search going live. If you need more time…" |
| FAQ switching | "…which restarts your 30-day guarantee window once your new search goes live." |
| `account-faq-section.tsx` | "…starts a fresh 30-day guarantee window when the new search goes live…" |
| `switch-choice.tsx` (paid and free) | "Restart your 30-day and 60-day guarantee clocks when your new search goes live" (removes the wrong "from today") |
| Guarantee-met email (`notifications.ts`) | "…below Total SRP within 30 days of your search going live — your guarantee is met…" |
| Refund email (`notifications.ts`) | "…within 30 days of your search going live, so we're refunding…" |
| Guarantee timeline refunded line (`guarantee-timeline.ts`) | Same change as the refund email |
| Article generator prompts (LEVR facts + captions rule) | "…within 30 days of the search going live…" |
| Comparison table, MSRP article | Unchanged (no time stated) |
| Markups article | Already changed 2026-09-30 |
