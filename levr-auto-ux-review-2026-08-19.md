# LEVR Auto — Site Review Findings (Brett, 2026-08-19)

Backlog from a full walkthrough of the live site. Each item is grounded against the actual code where I could check, so this can be handed straight to Claude Code as a starting point next session. Organized by area, not by the order raised.

**Status as of 2026-08-19: 10 of 11 resolved.** Only #3 still open (scoped, not yet built).

---

## Navigation & entry points

**1. ~~No "Log In" link on the main site — only "Get Started."~~ DONE (2026-08-19).** Added to the header nav, pointing at /login.

**2. ~~"Build Your Search" and "Get Started" go to the same place — redundant.~~ DONE (2026-08-19).** Removed the redundant "Build Your Search" nav link from `site-header.tsx`.

**3. Get Started requires make, model, and zip before you can continue — no path for "I don't know yet."**

Confirmed: `intake-filter.tsx`'s Continue button is disabled until a valid make, model, and zip are all filled in ("Select a make and model and enter a valid zip code to continue"). There's no way to pay the $699 and start an account without already knowing the exact vehicle.

→ **Fix:** add an "I'm not sure yet" path that still lets someone create an account and pay, without requiring make/model upfront. Likely routes them toward the Matchmaker first, or defers make/model to a follow-up step. Real design question: does the $699 charge still require a make/model to exist eventually (dealer outreach needs one), or does this become a genuinely different intake shape? Needs a real design pass, not just relaxing a validation rule.

---

## Signup, notifications & account

**4. ~~Notification preferences are collected during signup, not after — and it's single-select, not multi.~~ DONE (2026-08-19).** Moved entirely to a new account-settings section on /account; channel is now three independent checkboxes (genuinely multi-select), not one-of-three. Signup no longer collects channel or frequency at all.

**5. ~~No account settings / notification settings after logging in.~~ DONE (2026-08-19).** New AccountSettingsForm section on /account: name (split into required First/Last Name, decided 2026-08-19), phone (unconditionally required, decided 2026-08-19), notification channels, and frequency.

**6. ~~No payment was taken when you signed up.~~ RE-VERIFIED, NOT A BUG (2026-08-19).** Traced to a real fix already made 2026-08-14: `getStatusCopy()` in `account/page.tsx` branches on `paidAt` before falling back to the status table, so an abandoned checkout correctly shows "Checkout wasn't completed — this search hasn't been paid for, so it hasn't started." with no live Finalize link. Re-verified against a real unpaid test row on 2026-08-19 — still correct, no regression. Brett's original experience was very likely this correct message, not a bug.

---

## Matchmaker

Worth knowing up front: **the Matchmaker is explicitly labeled a prototype today** — both screens carry visible "Prototype — mock data" / "Mock results — not live inventory" banners. It runs on a hardcoded list of about 8 sample vehicles, not real MarketCheck inventory, and "Start My Search" only shows a placeholder message ("this will kick off your real search once the intake filter connects") rather than actually starting anything. So a few of these aren't bugs exactly — they're the gap between a working prototype and the real thing.

**7. ~~"I want more info" does nothing.~~ DONE (2026-08-19).** New VehicleDetailModal shows per-vehicle "why this fits you" bullets computed from real answer/vehicle-data comparison, honest about no real specs/videos until Matchmaker uses real inventory.

**8. ~~The free-text "anything else we should know?" field should be removed.~~ DONE (2026-08-19).** Step, type, state, and results-screen rendering all removed from `matchmaker.tsx`.

**9. ~~Results should show as a ranked top-to-bottom list, not a grid.~~ DONE (2026-08-19).** Results screen changed from a grid to a vertical top-to-bottom stack; sort order unchanged. `VehicleCard` reworked for a list-row layout.

**10. ~~Need an edit option that keeps your answers and re-sorts, without starting over — ideally live, split-screen.~~ DONE (2026-08-19).** Persistent split-screen: all six answers live-editable in a side panel, results re-sort instantly on any change. Required expanding the scoring logic to actually weight all six fields (previously only vehicleType/powertrain affected sort) and enriching the mock dataset with real numeric price, seating category, and per-vehicle priority scores.

---

## FAQ

**11. ~~"Do I have to talk to anyone on the phone?" shouldn't offer/hyperlink a callback request.~~ DONE (2026-08-19).** Callback mention and `<CallbackRequestButton />` removed from that FAQ answer; the now-fully-unused `CallbackRequestButton` component was deleted.

---

## Suggested order, once picking up remaining items

- **Needs a design decision before building:** #3 ("I don't know yet" path)
