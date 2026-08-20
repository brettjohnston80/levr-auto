# LEVR Auto — Site Review Findings (Brett, 2026-08-19)

Backlog from a full walkthrough of the live site. Each item is grounded against the actual code where I could check, so this can be handed straight to Claude Code as a starting point next session. Organized by area, not by the order raised.

**Status as of 2026-08-19: 5 of 11 resolved.** #2, #6 (verified, no fix needed), #8, #9, #11 done. #1, #3, #4, #5, #7, #10 still open.

---

## Navigation & entry points

**1. No "Log In" link on the main site — only "Get Started."**

Confirmed: the header (`site-header.tsx`) has How It Works / Build Your Search / Matchmaker / FAQ plus a single "Get Started" button. There's no direct login entry point — the only way in is through the intake flow's auth-gate modal, which assumes you're starting a new search. A returning customer with an account has no obvious way to just log in.

→ **Fix:** add a "Log In" link to the header nav (and/or near the Get Started button), pointing at `/login`.

**2. ~~"Build Your Search" and "Get Started" go to the same place — redundant.~~ DONE (2026-08-19).** Removed the redundant "Build Your Search" nav link from `site-header.tsx`.

**3. Get Started requires make, model, and zip before you can continue — no path for "I don't know yet."**

Confirmed: `intake-filter.tsx`'s Continue button is disabled until a valid make, model, and zip are all filled in ("Select a make and model and enter a valid zip code to continue"). There's no way to pay the $699 and start an account without already knowing the exact vehicle.

→ **Fix:** add an "I'm not sure yet" path that still lets someone create an account and pay, without requiring make/model upfront. Likely routes them toward the Matchmaker first, or defers make/model to a follow-up step. Real design question: does the $699 charge still require a make/model to exist eventually (dealer outreach needs one), or does this become a genuinely different intake shape? Needs a real design pass, not just relaxing a validation rule.

---

## Signup, notifications & account

**4. Notification preferences are collected during signup, not after — and it's single-select, not multi.**

Confirmed: both `/signup` and the inline auth-gate modal collect `communication_channel` (text / email / agent callback) as part of account creation itself, and it's a single choice, not multiple. There's no account-settings page to move it to yet — that's why it's stuck in the signup form today.

→ **Fix:** two changes — (a) move this off the signup form into an account-settings page (see #5, which doesn't exist yet either), and (b) make channel a multi-select instead of one-of-three. Real design question worth deciding: does frequency (real-time vs. daily digest) apply per-channel, or as one overall setting?

**5. No account settings / notification settings after logging in.**

Confirmed: `/account` today only shows search cards, an FAQ section, and a Log Out button — no profile or notification-preferences editing anywhere. This is the same gap #4 depends on.

→ **Fix:** a real account-settings section on `/account` — update name/phone/notification prefs at minimum.

**6. ~~No payment was taken when you signed up.~~ RE-VERIFIED, NOT A BUG (2026-08-19).** Traced to a real fix already made 2026-08-14: `getStatusCopy()` in `account/page.tsx` branches on `paidAt` before falling back to the status table, so an abandoned checkout correctly shows "Checkout wasn't completed — this search hasn't been paid for, so it hasn't started." with no live Finalize link. Re-verified against a real unpaid test row on 2026-08-19 — still correct, no regression. Brett's original experience was very likely this correct message, not a bug.

---

## Matchmaker

Worth knowing up front: **the Matchmaker is explicitly labeled a prototype today** — both screens carry visible "Prototype — mock data" / "Mock results — not live inventory" banners. It runs on a hardcoded list of about 8 sample vehicles, not real MarketCheck inventory, and "Start My Search" only shows a placeholder message ("this will kick off your real search once the intake filter connects") rather than actually starting anything. So a few of these aren't bugs exactly — they're the gap between a working prototype and the real thing.

**7. "I want more info" does nothing.**

Confirmed: that button doesn't open any info — it's actually just the "flag" toggle relabeled ("Want more info" ↔ "Flagged for more info"), which only reorders the card to the top. There's no real detail view behind it yet.

→ **Fix (once this moves past prototype):** decide what "more info" should actually show — full spec sheet, review-video links, a "why this fits you" writeup (the original Matchmaker concept doc calls for this) — and build a real panel or page for it.

**8. ~~The free-text "anything else we should know?" field should be removed.~~ DONE (2026-08-19).** Step, type, state, and results-screen rendering all removed from `matchmaker.tsx`.

**9. ~~Results should show as a ranked top-to-bottom list, not a grid.~~ DONE (2026-08-19).** Results screen changed from a grid to a vertical top-to-bottom stack; sort order unchanged. `VehicleCard` reworked for a list-row layout.

**10. Need an edit option that keeps your answers and re-sorts, without starting over — ideally live, split-screen.**

Confirmed: today there's only "Start Over," which wipes everything back to the first question. No way to jump back into an already-answered questionnaire and adjust one thing.

This is the biggest lift of the Matchmaker items — real UI/state work, not a tweak: a persistent split view (results on one side, your answers/priorities on the other) where changing an answer re-sorts the list live, without losing your other selections. Worth treating as its own small design pass, since it changes the whole page's structure (right now it's step-by-step in a single column, then a fully separate results screen).

---

## FAQ

**11. ~~"Do I have to talk to anyone on the phone?" shouldn't offer/hyperlink a callback request.~~ DONE (2026-08-19).** Callback mention and `<CallbackRequestButton />` removed from that FAQ answer; the now-fully-unused `CallbackRequestButton` component was deleted.

---

## Suggested order, once picking up remaining items

- **Small-to-medium builds:** #1 (login link), #4/#5 (account settings + multi-select notifications — these two go together)
- **Needs a design decision before building:** #3 ("I don't know yet" path), #10 (live split-screen edit), #7 (what "more info" actually shows)
