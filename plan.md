# Cancellation & Discretionary Refunds + Purchased State — Revised Plan

Status: **awaiting Brett's confirmation before any migration is written.** This supersedes the earlier verbal plan — the refund scope changed (multi-payment, per-payment partial refunds) and a new Part 4 (agent reactivation) was added mid-turn.

---

## Investigation: payment tracking gaps

**Extension payments:** `customer_searches.last_extension_session_id` is a single column, overwritten on every extension. It's also not type-consistent — the manual extend-now webhook stores a Checkout Session id (`cs_...`), while `attemptAutoRenewCharge` stores a PaymentIntent id (`pi_...`) directly, since auto-renew charges never go through Checkout at all. Only the most recent extension's reference survives; every earlier one on the same search is unrecoverably gone the moment the next one lands.

**Switch fees:** worse than "overwritten" — `handleSwitchFeePayment` never stores the session/payment-intent reference anywhere. It's read off the event, used to authorize the RPC call, and discarded. No column anywhere holds a switch-fee Stripe reference, ever.

**Important mitigating fact:** the paid $100 switch-fee checkout doesn't actually exist yet. Per CLAUDE.md, the self-service switch UI's "Continue to payment" button for the paid case is still a disabled placeholder — real Checkout Session creation for it was never built. So no customer has ever actually been charged a real switch fee; the gap above is purely forward-looking, not a backfill problem.

**Bigger point: there are zero real production `customer_searches` rows right now.** This is pre-launch — every row referenced anywhere in CLAUDE.md is scratch/test data created and deleted per verification pass. So **no backfill migration is needed at all** — every payment-writing code path just needs to start recording correctly from here forward.

---

## Proposed schema

### `payments` — one row per successful charge, of any type

```
id, customer_id, search_id (the row the charge funded — see note below),
payment_type ('search_fee' | 'switch_fee' | 'extension_fee'),
stripe_checkout_session_id (nullable — auto-renew charges have no Checkout Session),
stripe_payment_intent_id (not null — always obtainable, this is what refunds.create() needs),
amount_cents,
refunded_cents (default 0, check (refunded_cents >= 0 and refunded_cents <= amount_cents)),
created_at
```

For a switch fee, `search_id` points at the **new** row (mirroring how `paid_at` already lands on the new row, not the old one) — will be commented explicitly since it's not obvious. `customer_id` is denormalized directly onto the row (not just reachable via `search_id`) so the refund picker can list "everything this customer has ever paid" in one query without joining through every search.

### `refunds` — one row per actual Stripe refund issued

```
id, lifecycle_log_id (which cancellation decision authorized this), payment_id,
agent_id, amount_cents, stripe_refund_id, created_at
```

### `search_lifecycle_log` — renamed from the earlier `cancellation_log` proposal

Now covers reactivation too (Part 4), so "cancellation_log" would be misleading. One row per cancel/reactivate decision:

```
id, search_id, initiated_by ('customer' | 'agent'), agent_id (null for customer),
action ('cancelled' | 'reactivated'), reason_category (nullable — agent-initiated only),
notes, created_at
```

Refund amounts no longer live here — they're fully represented by however many `refunds` rows point at a given `lifecycle_log_id` (zero = no refund, one or more = however much, summed). This replaces the earlier `full_refund`/`partial_refund`/`no_refund` enum, which is redundant now that the agent picks specific payments and amounts directly.

### Hard enforcement of "never exceed what was paid"

Every refund is written through a single-purpose RPC, `record_refund`, that `FOR UPDATE`-locks the target `payments` row, checks `refunded_cents + amount <= amount_cents`, and raises an exception if not — same locking pattern already used by `switch_customer_search`/`grant_extension_bypass`, so two concurrent refund attempts against the same payment can't double-spend it. The table's own `CHECK` constraint is the belt-and-suspenders backstop under that.

### `customer_searches` new columns

`cancelled_at`, `cancellation_call_requested_at`, `purchased_at`, `reactivated_at` — all nullable timestamptz, same "most-recent-event pointer" convention as `paused_at`/`finalized_at` elsewhere on this table (the log tables are the real history).

### Instrumentation retrofit — the real cost of this design

Four existing charge-writing paths need to start inserting into `payments`:

1. Webhook's `search_payment` branch (original $699).
2. Webhook's `switch_fee` branch — also needs a small change to actually capture `switch_customer_search`'s return value (currently discarded) to know the new row's id.
3. Webhook's `extension_fee` branch.
4. `attemptAutoRenewCharge` in `day60-extension.ts`.

Worth flagging directly: this is broader than "add some tables" — it touches every existing Stripe-success code path in the app. Necessary to satisfy the "never exceed what was paid" requirement, not scope creep.

---

## Part 4 — Reactivation (new)

**Target status, branched, not always `'searching'`:** if `finalized_at` is already set (cancelled from `pending_refinement`, `searching`, or `paused` — already went through finalization), reactivate straight to `'searching'`. If `finalized_at` is null (cancelled while still `awaiting_finalization` — paid but trim/color/options never chosen), reactivate to `'awaiting_finalization'` instead. Reasoning: forcing an unfinalized search straight to `'searching'` is exactly the bug `grant_extension_bypass`'s status gate was added to prevent — same failure mode, same guard applied here.

**Clock reset, both anchored by one column:** Day-30 and Day-60 both key off `solidified_at` (`effectiveDeadline()` = `search_deadline_at ?? solidified_at + 60 days`), so "restart fresh" only requires `solidified_at = now()` and clearing `search_deadline_at` back to null — it recomputes fresh automatically. Also clears `paused_at`.

**Proposing, not assuming:** also reset `guarantee_status` back to `'pending'` and clear `guarantee_resolved_at`, since a fresh 30/60-day cycle shouldn't carry a stale `met`/`refunded` verdict from before the cancellation. **Flag if you want the old guarantee outcome left untouched instead.**

**RPC:** `reactivate_search(p_search_id, p_agent_id, p_notes)` — `FOR UPDATE`, guards `search_status = 'cancelled'`, does the branch above, sets `reactivated_at = now()`, inserts a `search_lifecycle_log` row (`action = 'reactivated'`), atomic with the status flip.

**Lookup UI reuses `searchCustomers`/`getCustomerSearchesForBypass` verbatim** — no new lookup built. Once a cancelled search is picked, the reactivation screen queries `search_lifecycle_log` (+ any joined `refunds`) for that search and shows the agent exactly what happened on cancellation — who cancelled it, why, and what (if anything) was refunded — before they can submit.

---

## Everything else, unchanged from the previous round

- Video links: skipped entirely, no placeholder — confirmed.
- Both copy blocks (cancellation warning, purchased congratulations) locked as sent, no further changes.
- Part 3 (purchased state) is untouched by any of the above — still a simple agent status flip, no payments/refunds involvement.
- `closed` stays unused/unrepurposed — new, self-documenting `cancelled`/`purchased` values instead.

---

## Final RPC surface

- `cancel_search(p_search_id, p_initiated_by, p_agent_id, p_reason_category, p_notes)` — used by both Part 1 and Part 2 (mirrors how `switch_customer_search` already serves both a plain and an agent-flavored caller via optional trailing params).
- `record_refund(p_payment_id, p_lifecycle_log_id, p_agent_id, p_amount_cents, p_stripe_refund_id)` — called 0+ times per agent-mediated cancellation, once per payment being refunded, each time *after* the real Stripe refund for that specific payment already succeeded.
- `reactivate_search(p_search_id, p_agent_id, p_notes)`.

**One acceptable, named risk:** if an agent refunds against multiple payments in one sitting and a later Stripe call in that sequence fails, the earlier refunds and the cancellation itself are already committed. Same category of partial-failure risk already accepted elsewhere in this project (e.g. the auto-renew charge/email split) — surfaced to the agent as an error, not silently retried.

---

## Open questions needing your confirmation

1. Proceed with this schema as described?
2. `search_lifecycle_log` rename — OK, or keep calling it `cancellation_log`?
3. Reactivation resetting `guarantee_status`/`guarantee_resolved_at` back to pending/null — yes, or leave the old guarantee outcome untouched?
