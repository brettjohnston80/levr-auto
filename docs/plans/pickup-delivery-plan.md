# Pickup travel range, per-offer pickup/delivery, out-of-range flag, offer sorting — plan (2026-09-26)

Status: **APPROVED 2026-09-26, being built.** Decisions recorded below.
Migration draft: `supabase/migrations/20260926130000_pickup_travel_and_handoff.sql` (not run; runs after the offer-messages migration).

## Brett's decisions (2026-09-26)

1. Pickup distances are **25 / 50 / 100 / 250 / 500 miles**, plus "I'd rather have it delivered" and "It depends — case by case". The migration allows 500.
2. Approved: a non-dismissible prompt on Your Deal for existing active searches with no travel answer.
3. Default sort: **Best discount**.
4. Approved: in-range dealers sort first in the agent's dealer list.
5. All section 9 copy is approved as written, including the delivery explanation. The intake options gain "Up to 500 miles" in the same style.

## Future item (NOT in scope now)

- **LEVR arranging delivery for customers in-house:** coordinating and quoting transport ourselves, rather than the customer and dealer setting up shipping directly. Today "Estimate delivery for me" only means the agent gets a delivery estimate from the dealer. The in-house version would need a transporter relationship (see `TRANSPORTER_REFERRAL_ENABLED` and the transporter research in the roadmap doc), pricing and a changed delivery explanation.

## Findings

- **Intake** (`intake-filter.tsx` → `saveIntakeSearch`) collects make, model, model year and zip.
  - A signed-out customer's answers are stashed in `levr_pending_intake` (1-hour TTL) and auto-resumed after sign-in.
  - That resume path is the sensitive one CLAUDE.md warns about.
- **Undecided path.** The "not sure yet" button (`saveUndecidedIntakeSearch`) is deliberately one click with zero fields. The agent fills everything in later, in `finalizeUndecidedSearch`.
- **Switching.** `switch_customer_search` copies only zip, not other search-level answers, onto the new row.
- **The existing pickup/delivery question.** It lives in `deal_progress.delivery_method` (`pickup` / `delivery`).
  - It's asked only after accepting, via `DeliveryPreferenceForm` in "Congratulations — next steps".
  - Agents see a one-line summary in the closing panel.
- **Distance.** It's already computed for the customer's offer detail view: ZIP-centroid miles from the search zip to the offer's `dealer_zip`, via `getDealDetails`.
  - Agents see no distance anywhere today.
  - Many offers have no `dealer_zip` (anything logged before 2026-09-25 without a linked listing), so their distance is unknown.
- **Offer order on Your Deal.** Offers are sorted newest-received first. "Best value" marks the biggest dollar savings below sticker.

## 1. Schema (migration draft)

**`customer_searches`:**
- `pickup_travel_choice`: `distance` | `prefer_delivery` | `case_by_case` | null.
- `pickup_travel_miles`: 25 | 50 | 100 | 250 | 500 | null.
- `pickup_travel_set_at`: when the answer was given.
- A shape check keeps the two consistent. Miles is set only when the choice is `distance`.
- Nullable, because existing rows and undecided searches have no answer. "Required" is enforced in the app (see below).

**`qualifying_offers`:**
- `handoff_method`: `pickup` | `delivery` | null.
- `handoff_method_set_at`: when it was chosen.
- This becomes the **one** source of truth for pickup vs. delivery.

**Carry-over:**
- Existing `deal_progress.delivery_method` values are copied onto their offers.
- That column stays until the deploy, then a follow-up migration re-copies and drops it. This is the same two-step pattern as the customer note.

**Switch:**
- `switch_customer_search` is redefined in place, with the same signature, so the travel answer carries over to the new row like zip does.
- The body is otherwise the current definition verbatim.

## 2. Intake changes

- **New required question** on the normal intake form, after zip: "How far would you drive to pick up your car?"
  - Seven single-select tiles: five distances, "I'd rather have it delivered", "It depends — case by case".
  - No default is selected, because a default would be an answer the customer never gave.
  - Continue stays disabled until one is picked, matching how zip validity already gates it.
- **Server enforcement:** `saveIntakeSearch` requires and validates it.
- **The resume stash** (`levr_pending_intake`) gains the answer, since otherwise a customer who signs in mid-intake would lose it.
  - A stash written before this deploy (it has a 1-hour TTL) has no answer. Its resume is refused with the form restored and the error shown, never saved without one.
  - This follows the exact precedent set for model year. The prefill mechanism and its separate key are untouched.
- **Undecided path:** stays one click.
  - The agent's consultation form (`AgentUndecidedFinalizeForm` → `finalizeUndecidedSearch`) gets the same question, required.
  - The search can't start without it, because it's asked on the call.
- **Seed route** (`seed-test-state`): seeded searches get a default (`case_by_case`), so tester accounts don't all show the "add it" prompt. An optional parameter overrides it.

## 3. Existing searches (no answer on file)

- **Nothing is backfilled or guessed.** Null means no out-of-range flag, anywhere.
- **Recommended: prompt them once, in place.**
  - On Your Deal, a searching or paused search with no answer shows a compact card with the same seven options above the offers.
  - Answering it saves immediately and the card collapses into the summary line.
  - It isn't dismissible, because it's one tap, and without it the out-of-range flag can't work for that customer.
  - Nothing is emailed, per the no-notifications stance.
- **The answer can be changed anytime** on Your Deal: "Pickup range: up to 100 miles · Change".
  - A change is search-level, not tied to an offer.
  - It doesn't bump offer activity, but agents see the current value on the search card.

## 4. Per-offer pickup vs. delivery (customer UI)

- **Where the question lives:** in the offer detail view, on any open offer (pending or accepted), under "Tell your agent". Label: "How would you get this car?"
  - Two options: "I'd pick it up" / "Estimate delivery for me".
  - Saves on tap, and can be changed anytime while the thread is open.
- **Each change counts as customer activity.** It bumps `customer_activity_at`, so it appears in "Customer activity on offers" as "Would pick it up" or "Wants a delivery estimate".
- **Accept must confirm it.** The accept footer shows the same two options, pre-filled:
  1. If the offer already has an answer, use it.
  2. Otherwise, from the intake answer:
     - Customer gave a distance, and the offer is within it or its distance is unknown → pickup.
     - Customer gave a distance, and the offer is beyond it → delivery.
     - "I'd rather have it delivered" → delivery.
     - "It depends" or no answer → nothing pre-selected.
  3. "Accept this offer" stays disabled until one is selected.
  4. `respondToOffer` requires it on accept and writes it in the same update, so an accept can never land without it.

## 5. Reconciling with the existing DeliveryPreferenceForm

**Recommendation: one question, one column.**

- `qualifying_offers.handoff_method` is the only storage.
  - `deal_progress.delivery_method` is retired (copied over, then dropped).
  - `submitDeliveryPreference` is removed.
- **"Congratulations — next steps" panel:**
  - The form is replaced with a read-only line: "Getting your car: You'll pick it up" / "…We're getting you a delivery estimate", plus a "Change" link that opens the detail view.
  - Because accept now requires the answer, an accepted offer always has one, and the panel never asks again.
- **The panel's existing explanation is kept, reworded** (needs sign-off, see below). The old version said "you and the dealer will coordinate a shipping company directly"; that is still true, and "estimate delivery for me" must not over-promise.
- **Agent closing panel:** reads `handoff_method` instead. The same two states display, so no new agent copy is needed.

## 6. Out-of-range flag

- **Rule:** flag only when all four hold:
  - the travel choice is `distance`;
  - the offer's distance is known;
  - the handoff isn't already `delivery`;
  - the distance is greater than `pickup_travel_miles`.
- **Suppression:**
  - No flag for "prefer delivery", "case by case", no answer, or unknown distance, per your rules.
  - Also no flag once the customer has chosen delivery on that offer. The point of the warning is already addressed, so repeating it would be noise.
- **Customer display:** on the offer card and in the detail view, an amber line: "{N} miles away — farther than the {R} miles you said you'd drive. Delivery may cost extra."
- **Agent display:**
  - Each offer line gets "{N} mi from customer", or nothing when unknown.
  - It turns amber with "beyond customer's {R}-mile range" when flagged.
  - Activity items carry the same flag.
- **Computation:** one shared helper, `isBeyondPickupRange(...)`, so the customer and agent sides can't disagree.
  - The agent queue gains ZIP-centroid distance per offer. It reuses `haversineMiles` and the same `zip_coordinates` lookup.

## 7. Agent UI (`/internal/outreach`)

- **Search card header:** "Pickup range: up to 100 miles" / "Prefers delivery" / "Case by case" / "Not answered yet".
- **Matching dealers** (to shape who gets contacted):
  - Each dealer shows its distance from the customer, from the listing's `dealer_zip`.
  - When the customer gave a distance, dealers inside the range sort first and are marked "within range". Otherwise the current order (listing count) is kept.
  - Nothing is hidden, because a great deal just outside the range may still be worth a call.
- **Offers logged:** distance plus the out-of-range flag (above), and the chosen handoff method on every offer, not just accepted ones.
- **Undecided consultation form:** the required travel question.

## 8. Sorting offers on Your Deal

- **Options:** Best price (lowest offer price), Best discount (largest dollar amount below Total SRP, matching the "Best value" badge), Closest (unknown distances last, then best discount).
- **Recommended default: Best discount.** The offer carrying the "Best value" badge then lands on top, so the badge and the order never disagree. Lowest price alone would favor cheaper trims that aren't really better deals.
- **Status still wins over the sort:**
  - an accepted offer is pinned first;
  - declined and released offers sink to the bottom;
  - the sort orders the open offers in between.
- **Persistence:** recommend **not** saving the choice per customer. It lives in the URL (`?sort=`), so refresh and the back button keep it. A search has a handful of offers, and a stored preference would add a column and settings logic for little gain.
- **Purchased searches:** these show only the purchased offer card, so there's no sort control there.

## 9. Customer-facing copy — APPROVED 2026-09-26

**Intake**
- Question: "How far would you drive to pick up your car?"
- Helper: "We'll focus on dealers within that range, and flag any offer that's farther."
- Options: "Up to 25 miles" · "Up to 50 miles" · "Up to 100 miles" · "Up to 250 miles" · "Up to 500 miles" · "I'd rather have it delivered" · "It depends — case by case"
- Error (a resumed pre-sign-in answer is missing): "Please choose how far you'd drive to pick up your car."

**Your Deal: prompt for searches with no answer**
- Heading: "How far would you drive to pick up your car?"
- Body: "This helps us focus on the right dealers and flag offers that are farther away." (same seven options)

**Your Deal: summary line**
- "Pickup range: up to {R} miles" / "Pickup range: you'd rather have it delivered" / "Pickup range: case by case", with "Change"

**Your Deal: sort control**
- Label: "Sort by"
- Options: "Best discount" · "Best price" · "Closest"

**Offer detail view (open offers)**
- Question: "How would you get this car?"
- Options: "I'd pick it up" · "Estimate delivery for me"
- Helper: "You can change this anytime before you buy."

**Accept confirmation (footer)**
- "Confirm how you'd get this car:" (same two options)
- Disabled-button hint: "Choose pickup or delivery to accept."

**Out-of-range flag (card and detail view)**
- "{N} miles away — farther than the {R} miles you said you'd drive. Delivery may cost extra."

**"Congratulations — next steps" (replaces DeliveryPreferenceForm)**
- "Getting your car: You'll pick it up." / "Getting your car: We're getting you a delivery estimate." plus "Change"
- Delivery explanation (reworded): "LEVR doesn't arrange delivery in-house yet — your agent will get a delivery estimate from the dealer, and you and the dealer will set up shipping directly."

**Errors**
- "Choose pickup or delivery before accepting."
- "You can only change this on an offer that's still open."

**Retired** (removed with the old form): "How will you get your vehicle?", "I'll pick it up in person", "I'd like it delivered", "Please choose an option.", and the old delivery explanation.

## 10. Open questions for Brett — all answered 2026-09-26 (see "Brett's decisions" at the top)

1. **Distance steps:** 25 / 50 / 100 / 250 as proposed, or add 500?
2. **Existing searches:** is a non-dismissible prompt on Your Deal right?
3. **Default sort:** Best discount, or Best price?
4. **Agent dealer list:** should in-range dealers sort first (recommended), or should the order stay by listing count and just show distance?
