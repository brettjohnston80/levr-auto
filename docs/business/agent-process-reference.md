# Agent process reference

How each agent workflow works, written for the people who use it. One section per workflow: what it's for, who can do it, the steps, and what the customer sees. It feeds the agent training and quick-reference materials (`docs/plans/build-completion-roadmap.md`).

**How to keep it current:** when a chunk is approved, add or update its workflows here in the same commit. Wording quoted here matches `docs/business/site-language-inventory.md`.

**Status:** backfilled with agent dashboard Phase 1 (approved 2026-10-11 to 2026-10-14). These workflows are built on the branch `agent-dashboard-phase1-code` and **go live at the Phase 1 deploy** (after the tester round). Until then the live site works the old way.

**Roles:** every agent has one role. **Agent** works customers' deals. **Lead** can also add agents, reset an agent's two-factor sign-in, reassign searches, approve articles and social posts, merge dealerships, undo a purchase, and see the admin table. **Admin** can do everything a lead can, plus add leads and admins and reset a lead's or admin's two-factor sign-in. Separately, being **in rotation** means new paid searches can be assigned to you; leads and admins are out of rotation unless set otherwise.

---

## 1. Signing in
- **For:** every agent, every time.
- **Steps:**
  1. Go to `levrauto.com/agent` (not the customer log-in page; customer accounts can't sign in there, and agent accounts can't use customer pages).
  2. Enter your work email (`@levrauto.com`) and password, then **Sign in**.
  3. Enter the 6-digit code from your authenticator app.
  4. You land on the outreach page (`/internal/outreach`).
- **Good to know:**
  - Any wrong detail gives the same message: "That didn't work. Check your details and try again." After 5 failed tries on your account (or 20 from one network) in 15 minutes, you're asked to wait 15 minutes.
  - After **8 hours with no activity** you're signed out on that browser and sign in again. Your other devices aren't affected.
  - The header shows your name and LEVRID, and **Sign out**.
- **Customer sees:** nothing.

## 2. Setting up your account (new agents)
- **For:** a new agent, once.
- **Steps:**
  1. Open the invite email ("You've been invited to the LEVR Auto agent dashboard") and click the link. It works once and lasts **1 hour**; if it has expired, ask your lead to send a new invite.
  2. Click **Continue**.
  3. Set a password (at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character).
  4. Turn on two-factor sign-in: scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy…), or use "Can't scan? Enter this key instead". Adding the same code to a second, backup device is a good idea. Enter the 6-digit code and **Turn on**.
- **Customer sees:** nothing.

## 3. Forgot your password
- **For:** any agent.
- **Steps:** on `/agent`, **Forgot your password?** → enter your work email → **Send reset link** → open the email ("Reset your LEVR Auto agent password", link lasts 1 hour) → set a new password. You still need your authenticator code to sign in.
- **Lost your authenticator** (new phone, deleted app): you can't fix that yourself. Contact your lead (see section 5).

## 4. Adding an agent
- **For:** leads (agents) and admins (agents, leads and admins).
- **Steps:**
  1. Open **Add an agent** (`/internal/agents`).
  2. Enter name, work email (`@levrauto.com`) and role; **Send invite**.
  3. You'll see "Invite sent to {email}. {name} is LEVRID {n}." The new agent follows section 2.
  4. If the email didn't send, use **Resend invite** on the confirmation.
- **Good to know:**
  - A LEVRID is used up the moment someone is added. If you mistyped the email, ask an admin to deactivate that agent and add them again.
  - New agents are in rotation by default; new leads and admins aren't.
  - The agents list shows each person's sign-in status: "Two-factor on", "Invite not finished", "No login yet".
- **Customer sees:** nothing.

## 5. Resetting someone's two-factor sign-in
- **For:** leads (for agents) and admins (for anyone). Never your own.
- **Steps:**
  1. **Confirm it's really them, by phone or video.**
  2. On **Add an agent**, find them in the list and click **Reset two-factor**, then **Reset**.
  3. They're signed out everywhere and get an email ("Your LEVR Auto two-factor sign-in was reset"). Next time they sign in they set up two-factor again.
- **Customer sees:** nothing.

## 6. How searches get assigned to you
- **For:** information; nothing to do.
- **How it works:**
  - When a customer pays, their search is assigned automatically within seconds: to the agent who already has the customer's other search, otherwise to whoever in rotation was assigned least recently.
  - If nobody is in rotation, it goes to a lead and leads get an email ("Search assigned to {lead}: nobody is in rotation"). If there's no lead either, it stays unassigned and admins get an email ("A paid search has no agent").
  - If anything stops the automatic assignment, an hourly check at :15 past the hour picks it up, and leads get "Automatic assignment failed for a paid search". That alert closes itself once the search has an agent.
  - When a customer switches vehicles, the new search stays with the same agent.
  - Test accounts are never assigned.
- **Reassigning** a search to someone else: leads and admins (a screen for it comes with the Phase 3 dashboard).
- **Customer sees:** nothing about assignment itself.

## 7. Call requests (finalization, switch, cancellation)
- **For:** the assigned agent.
- **How you hear about it:** an email "{customer} requested a {finalization / switch / cancellation} call — {vehicle}", starting "This search is assigned to you." It has the customer's name, email and phone, and a link to the request on the outreach page. If the search has no agent yet, the email goes to leads (or admins) instead.
- **Steps for a switch or cancellation call:**
  1. Call the customer.
  2. If they switch or cancel, do it from the card ("Switch this customer to a different make/model", or the cancellation form). The request closes itself.
  3. Otherwise click **Mark call resolved**, pick the outcome ("Didn't switch" / "Didn't cancel", "Couldn't complete the call", or "Other"), add a note if useful, and **Resolve**. The card leaves the list.
- **Good to know:**
  - If the customer switches or cancels on their own while the request is open, it closes itself (outcome switched or cancelled, no agent named).
  - A customer can ask for another call after a request is resolved; it arrives as a new request and a new email.
- **Customer sees:** they asked for the call on their account page; once it's resolved they can ask again.

## 8. Cancelling a search with refunds
- **For:** any agent, usually during a cancellation call.
- **Steps:**
  1. On the cancellation call card (or by looking the customer up), choose the cancellation **Reason** and add notes.
  2. For each payment you're refunding, enter the amount and pick its refund **Reason** (Cancellation by default; or Day-30 guarantee, Goodwill, Duplicate charge, Other).
  3. **Cancel search & resolve.** Each refund goes back through Stripe and is recorded with your name.
- **Customer sees:** the search cancelled on their account; Stripe sends its own refund receipt.

## 9. Day-30 guarantee refunds
- **For:** any agent.
- **What it's for:** a search that got no offer below Total Suggested Retail Price by Day 30 is due its fee back. These appear on **Refunds due** (`/internal/refunds-due`) with the amount refundable: the $699 plus any $100 paid-switch fees.
- **Steps:**
  1. Click **Issue refund**, check the confirmation ("Refund {amount} to {customer} for the Day-30 guarantee? … can't be undone."), then **Refund {amount}**.
  2. You'll see "{customer}: Refunded {amount}. Stripe refund re_…", and the row leaves the list.
- **If a refund was already made directly in Stripe:** click **Record a refund already issued in Stripe**, paste the refund ID (starts with `re_`), **Record refund**. It's checked against Stripe first: it must belong to this search's fee, have gone through, and not be recorded already.
- **If you see "The refund went through in Stripe (re_…) but couldn't be recorded here":** don't refund again. Use **Record a refund already issued in Stripe** with that ID.
- **Good to know:** clicking twice can't refund twice. A partly refunded search stays on the list showing what's left.
- **Customer sees:** the money back on their card; Stripe sends its own receipt.

## 10. Alerts
- **For:** leads (and admins when there's no lead; some alerts go to admins only).
- **What arrives by email:** the assignment alerts described in section 6, plus "An agent action wasn't recorded in the activity log" (the action itself went through; only the history is affected).
- **What to do:** follow the email (put someone in rotation, reassign, or nothing for the activity-log one). An alerts screen comes with the Phase 3 dashboard.

---

## 11. Working a direct-sale search (Tesla, Rivian, Lucid, Polestar) — DRAFT for Brett's review (2026-10-24, not built)

**Status:** draft. Nothing here is built; the plan is `docs/plans/guarantee-exceptions-plan.md`.

**What's different:** these brands sell at prices the maker sets (Polestar through dealers acting as its agents at its set price), so there's no discount to negotiate, and **the money-back guarantee doesn't apply** to these searches. The customer was told before paying and ticked a box agreeing to it. Your job is to find the best real price on their exact car and take the ordering work off their hands.

**Who can do it:** every agent, like any search.

**Steps:**
1. **Read the search:** the customer's trims, colours, options and pickup range, as for any search. The search card shows "No guarantee: {Brand} (direct sale)".
2. **Find the cars that exist now:**
   - the maker's own in-stock inventory (often a lower price than ordering new, and available sooner);
   - demo and loaner cars, which can come with a discount and low miles: ask what's available near the customer and further away if they'll travel or take delivery;
   - for Polestar, the inventory at the dealers that act as its agents.
3. **Price a factory order** for the exact build as the comparison, with its current delivery estimate.
4. **Catch every current offer:**
   - manufacturer credits, financing and lease rates;
   - loyalty, conquest and referral programs;
   - delivery and destination charges, and any fees for a delivery date.

   Point the customer to EV incentive programs, but never promise they qualify: that's for them to confirm.
5. **Log each real option as an offer** (store, delivery center or agent dealer as the dealer; the real price; inventory, demo or order in the notes), so the customer can compare them on Your Deal like any offer.
6. **Handle the order** once they choose:
   - help them through the maker's order or reservation steps (they pay any deposit directly to the maker, never to LEVR);
   - track the delivery date;
   - keep them updated in messages.
7. **Timeline:** the search runs through Day 60 and can be extended for $100, as for any search. There's **no Day-30 check** and these searches never appear on Refunds due. If the customer asks about a refund, it's a cancellation conversation (section 8), not a guarantee refund.

**What the customer sees:** the same Your Deal page and offers, with a "No money-back guarantee on this search" box in place of the guarantee timeline.

## 12. Sending an offer (offer entry; built on the `offer-entry` branch, not live yet)
- **For:** every agent. On a search card, click **Log an offer** to open the Log Offer page: 1 paste the quote, 2 pick the car (exterior and interior show whether they're the customer's pick), 3 tick each option the customer wants as on the car or not, add anything else on the sticker, and tick that the trim matches, 4 enter the sticker, price, fees, add-ons and the dealer's out-the-door total, 5 good until, dealer contact and a note to the customer. The right-hand side shows what the customer will see as you type. Tesla's $250 order fee is filled in for you.
- **Steps:**
  1. **Save draft** as often as you like. A draft is never shown to the customer.
  2. **Send to customer** checks everything on the server first: the amounts, the VIN, the out-the-door total against the lines (within $1), good until (today to 60 days out), and whether a delivery estimate is needed.
  3. If a warning applies (price not below the sticker, the same VIN or the same dealer already on an offer, a search that isn't active), tick it to send anyway. Only the warnings that apply are saved with the offer.
  4. Confirm the trim matches what the customer chose; Send refuses without it.
  5. The offer, its add-ons, fees and options all appear at once, and the customer's new-offer email goes out after that.
- **Discard:** only a dealer's submission (from a dealer link), and you must say why. Your own drafts just stay as drafts.
- **What the customer sees:** nothing until you send. With no out-the-door figure yet, they see "Out-the-door quote requested".

## 13. Recording the dealer's out-the-door quote (offer entry; not live yet)
- **For:** every agent, on an offer sent without an out-the-door figure. The customer can't accept it until you record the dealer's quote.
- **Steps:** on the outreach page, under the offer, click **Record out-the-door**. Enter the doc fee, sales tax, title & registration and any other fees (or tick "No other fees"), then the dealer's out-the-door total. It must match the lines within $1. Click **Record out-the-door**.
- **What the customer sees:** an email, "Your out-the-door price from {dealer} is in", and the offer becomes acceptable.
- **Corrections:** a recorded quote can't be changed. Withdraw the offer and send a corrected one.

