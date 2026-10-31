# Tester feedback: Terry (2026-10-17)

**Status (2026-10-30):**
| # | Item | Status |
|---|---|---|
| 1 | Pickup range: does changing it start a new search? | Wording approved and **live** (2026-10-17; inventory section 14) |
| 2 | Interior colour and included options on offers | **Built on `offer-entry`** (chunks 4 and 9; "Options you wanted: N of M", options section), not deployed |
| 3 | Going back to change options after offers arrive | Decided as "Ask my agent" messages in the Phase 3 work queue (roadmap); **not started** |
| 4 | Side-by-side offer comparison | **Built on `offer-entry`** (chunk 10), not deployed |
| 5 | Total purchase price (taxes and fees) | **Built on `offer-entry`** (out-the-door breakdown, accept gating on the dealer's quote), not deployed; LEVR tax estimates (OE-3) parked |

The original review follows. Its wording was drafts at the time; what was approved is in `docs/business/site-language-inventory.md`.

Read-only review. No code was changed. **Every wording below is a draft for Brett's sign-off.** Nothing ships until he approves it.

**About Terry:** recently retired engineer. He buys cars rarely and has never bought one new. He used a tester account, so his search started instantly with three sample offers.

**Screenshots:** `~/Downloads/levr-tester-feedback-terry-2026-10-17/`, taken on www.levrauto.com on 2026-10-17. Each `.png` has a `.txt` copy of the page text next to it.
- The account was disposable (`claude-verify-…@levrauto-test.invalid`) and walked the same path Terry did: a Toyota Camry 2026 search at ZIP 67235, paid, finalized with LE, one colour, one interior and the Cold Weather Package.
- Instant start added the three sample offers.
- Everything was deleted afterwards and every count came back 0. Brett's activity count was 2 before and 2 after.
- No MarketCheck calls were made: the search was inserted directly, so no payment webhook or sync ran.

| File | What it shows |
|---|---|
| `00-signup` | Sign-up |
| `01-home` | Homepage and intake |
| `02-faq` | FAQ |
| `03-your-car-unpaid` | "Review your search", before payment |
| `04-account-unpaid` | /account, before payment |
| `05` to `08` | /finalize: choice, trim step, review, done |
| `09-your-deal-list` | Your Deal, list view |
| `10-offer-detail` | Offer detail view |
| `11-your-deal-map` | Your Deal, map and slider |
| `12-your-car-live` | Your Car once the search is live |
| `13-account-live` | /account once live |
| `14-your-deal-mobile` | Your Deal at 390 px |

---

## 1. "When I change the search radius, does it do a new search?" (pickup range)

### What the code does

**The pickup range never limits which dealers or listings are considered, anywhere.** Checked:
- **Agent "Matching dealers"** (`src/lib/outreach-queue.ts:362`): exact make and model only, "no zip/radius filtering". The range only marks dealers as within range and lists those first (`:772-781`: "nothing is hidden").
- **MarketCheck sync** (`src/lib/marketcheck.ts:57-63`): searches by make, model, `car_type=new` and `country=US`. No ZIP and no radius.
- **Inventory block and the intake count:** display only.
- **The one partial exception:** tester sample offers. They're generated once, at finalize, using the range in effect then. One dealer is placed within the range and one beyond 1.25× it (`tester-sample-offers.ts:120-145`).

**What changing the range does** (`setSearchPickupTravel`, `src/lib/handoff-actions.ts:142-161`):
- It saves the new value. That's the only write.
- Everything else is worked out from the current value each time a page loads:
  - the "farther than you said you'd drive" flag on offers;
  - whether pickup or delivery is pre-selected;
  - whether an offer needs a delivery estimate, which feeds the "Best total price" sort, the Best value badge and "+ delivery (estimate pending)";
  - the circle on the map.
- No new search, no new offers and no MarketCheck call.

**Does the agent find out?** Only passively. The agent's search card shows "Pickup range: …" (`internal/outreach/page.tsx:923-926`). There's no notification, email, activity row or queue entry when it changes. Any offer that is now out of range requires a delivery estimate before it can be logged (`outreach-actions.ts:125-139`).

**Why Terry saw nothing change:** his three sample offers were created once, at finalize. Widening the range only re-flags them. A real customer would see the same thing, because the agent's search was never limited in the first place. **This is a wording gap, not a missing feature.**

### Copy inventory (today)

| Where | Text today | Problem |
|---|---|---|
| Intake gauge, Review your search, Your Deal (`pickup-travel.ts:22`) | "How far would you drive to pick up your car?" | Fine |
| Intake gauge helper (`pickup-travel.ts:23`, `intake-filter.tsx:634`) | "We'll focus on dealers within that range, and flag any offer that's farther." | **Wrong.** It suggests we limit the search. |
| Your Deal prompt (`pickup-travel.ts:24`) | "This helps us focus on the right dealers and flag offers that are farther away." | Same problem |
| Intake ZIP helper (homepage) | "We search nationwide — this just helps us calibrate delivery estimates." | Good. It's the right idea, but it sits on the ZIP field. |
| Options (`pickup-travel.ts:29-33`) | "Up to N miles" / "I'd rather have it delivered" / "I'd drive any distance" / "It depends — case by case" | Fine |
| Summary line (`pickup-travel.ts:88-91`, "Change" button) | "Pickup range: up to N miles" (and the other variants) | Fine |
| Out-of-range line (`pickup-travel.ts:121`) | "N miles away — farther than the M miles you said you'd drive. Delivery may cost extra." | OK, but doesn't say delivery is the normal route |
| Map (`src/lib/map/pins.ts:39-55`) | "Your area", "Your pickup range: N miles", slider "Pickup range" / "Save" / "Cancel" | Doesn't say what moving the slider changes |
| Offer detail (`offer-detail-modal.tsx:222`) | "About N miles from you." | Fine |
| Intake and Review counts (`intake-filter.tsx:242,649`, `review-and-pay.tsx:266-267`) | "N vehicles within 100 miles" / "No nearby matches yet — we can search nationwide for you." | The 100 is a fixed constant (`INVENTORY_RADIUS_MILES`), not the gauge value. "No nearby matches yet" can read as "you'll get nothing". |
| Nationwide framing (`why-levr.tsx:4`, `how-it-works.tsx:9`, FAQ `:18`) | "Not just the dealers near you…", "We search nationwide" | Good, but it never connects to the pickup range |
| Sign-up, the inline sign-up pop-up, /account, emails | Nothing | n/a |

### Proposed wording (drafts for sign-off)

1. **Gauge helper** (intake, Review your search, Your Deal; replaces both helper lines):
   > "We look for deals at dealers everywhere. This is just how far you'd drive to pick one up — if the best deal is farther away, we'll get you a delivery estimate."
2. **Your Deal, next to the slider or summary line** (new):
   > "Changing this doesn't start a new search — we're already looking everywhere. It decides which offers you'd pick up and which would be delivered."
3. **Map caption under the slider** (new):
   > "Offers inside the circle are ones you'd pick up. For anything outside it, we'll get a delivery estimate."
4. **Out-of-range line:**
   > "N miles away — farther than the M miles you'd drive, so this one would be delivered. Delivery may cost extra."
5. **Intake count line:**
   > "N for sale within 100 miles of you right now — and we search nationwide."

   The no-match variant:
   > "None for sale near you right now — we search dealers nationwide."
6. **New FAQ entry:**
   > **"Does my pickup range limit where you search?"** "No. Your agent looks for deals at dealers anywhere in the country. Your pickup range just tells us how far you'd drive to collect the car. For a deal farther away, we get a delivery estimate from the dealer so you can compare the full cost."

**Optional behaviour change (not wording):** when a customer changes their range while the search is live, add a line to the agent's activity log or daily view. **Recommendation:** not now. The agent card already shows the current value. Revisit with the work queue (Phase 3) and its attention flags.

---

## 2. "I could see exterior colour, but not interior colour or what options are included"

### What an offer shows today (`10-offer-detail`, `09-your-deal-list`)

- **Card** (`offer-card.tsx`): photo, dealer name, badges, "Trim: LE", "Offer: $X — Total Suggested Retail Price: $Y", the savings line, the delivery estimate line, status, the out-of-range warning, the offer-sheet PDF, add-ons. **Colour appears only in the photo**, never as text.
- **Detail view** (`offer-detail-modal.tsx`): the same price lines, the dealership address and "About N miles from you", and a **Vehicle** section with Trim, Color, VIN and Stock #, plus "In transit" when it applies. Then add-ons, the PDF, Highlight, pickup or delivery, and messages.
- **In the test:** the customer had ranked a Black fabric interior and the **Cold Weather Package** (`12-your-car-live`). The offer shows only "Trim LE" and "Color Celestial Silver Metallic". **Nothing says whether this car has the package or which interior it has.**

### What data exists

| Source | What's there | Shown to the customer? |
|---|---|---|
| `qualifying_offers` (agent-entered) | `vehicle_trim`, `vehicle_exterior_color`, `vin`, `stock_number`, dealer address, delivery estimate, `notes` (agent only) | Trim, colour, VIN and stock #, yes |
| `qualifying_offers` | **No interior colour, options or packages, model year, or configurator trim id** | n/a |
| Log Offer form / AI parser | Form: trim, exterior colour, VIN, stock #, add-ons. The parser extracts only dealer, contact, price and add-ons. | n/a |
| Linked `listings.raw_data` (MarketCheck) | `interior_color`, and build or options text (varies by dealer), VIN, photos | **No.** Only photos, in-transit and location are read (`customer-dashboard.ts:353-357`). Most offers have no linked listing. |
| Customer's own answers (`search_option_selections`, `search_trim_preferences`) | Ranked colours, interiors and packages, with prices | Loaded on Your Car, not attached to offers |
| `configurator_options` for the trim | What the trim offers, what's standard, packages | Not linked to offers |

**Diagnosis:** a **missing feature**, made worse by a sample-offer limitation. Even real offers can't say "has the Cold Weather Package", because the agent has nowhere to record it. Sample offers also get no listing, VIN or add-ons.

### Options

- **(a) Record interior and included options on each offer.**
  - Add `vehicle_interior_color` and a per-offer "included packages/options" list. The agent ticks them from the customer's own ranked list, with a free-text "other".
  - The customer's card and detail view would show "Interior: Black fabric" and "Includes: Cold Weather Package ✓ / Moonroof ✗ (you asked for it)".
  - Needs a migration, Log Offer form changes, and wording sign-off.
- **(b) Show what we already have.**
  - Show the colour as text on the card.
  - Show interior colour from the linked listing when there is one.
  - Show the customer's own wanted items as a "You asked for:" reminder, labelled as their preferences, not as confirmed equipment.
  - No migration, but it only helps when a listing is linked, and it must never imply the car has an item.
- **(c) Both:** (b) now as a cheap stopgap, (a) in the offer-entry phase.

**Recommendation: (a), built in the offer-entry phase**, with one small piece of (b) now: colour as text on the card. Whether the car has what they asked for is the main thing a buyer checks. Only an agent can confirm it from the dealer's paperwork, and anything we infer from MarketCheck text is unreliable.

Sample offers should then carry the customer's top interior and say "Includes" for the packages they ranked, so testers see the real layout.

---

## 3. "After getting offers, I'd like to go back and select/deselect options to see what else I might consider"

### What the site does today

- **The sequence is: choose the exact car, then the agent searches for it.** Once finalized, offers are for those choices.
- **After finalizing, before the search goes live:**
  - a 24-hour "Make changes" window (`updateFinalizedSearch`), reachable from the done screen, Your Car and /account;
  - a free make/model/year correction until the search goes live (`updateSearchVehicle`).
- **Once live:**
  - /finalize redirects to /account.
  - Your Car shows the answers read-only (`12-your-car-live`).
  - The trim comparison exists only inside /finalize, and it isn't read-only: ranking there saves the choice.
  - A switch to a different make or model is free within the 5-day signup window, otherwise $100. It restarts the guarantee and drops existing offers.
  - **There's no self-service way to change trim or options on a live search**, and no read-only "explore" mode anywhere. Matchmaker is public but not tied to the search.
- **What Terry saw:** as a tester, instant start skipped the 24-hour window, and the done screen hid "Make changes". It said "Your search is live. This is a test account, so we've added three sample offers to Your Deal for you to try." (`08-finalize-done`). He never saw the "now's the time to change something" message a real customer gets.

### Copy inventory (where the sequence is explained)

- **Homepage, How it works** (`how-it-works.tsx:4-5`): "Tell us exactly what you want" / "Make, model, trim, color, options. You decide the car; we do the rest."
- **Intake** (homepage): "You'll fine-tune trim, color, and options right after checkout — before we start reaching out to dealers."
- **Guarantee** (`guarantee.tsx:5`): "Once your vehicle details are locked in, we get to work."
- **FAQ** (`faq/page.tsx:18`): "You tell us the exact new vehicle you want…"
- **FAQ** `:66`: "Within that make/model, you can still be flexible on trim, color, and options at no extra cost…"
  - **Ambiguous.** It means you can rank several trims, but it reads like "change them later for free".
- **Review your search** (`review-and-pay.tsx:23-24`): "Check your choices, then pay to start. You can change any of these until you pay."
- **Finalize choice and done screen:** "You made your decision today. We'll begin the search tomorrow. If you wake up wanting to change something, now's the time — you have 24 hours to edit this from your account."
- **Your Deal empty states** (`deal-empty-copy.ts`): "Your search starts soon … After that we start searching dealers, and your offers will show up here." and "We're on it — We have everything we need and we're searching dealers for your car now…"
- **Your Deal with offers:** nothing about the sequence.

### Proposed wording (drafts for sign-off)

1. **Before payment** (Review your search, under "What's included"; and the intake line):
   > "Here's how it works: after you pay, you'll choose your exact trim, color and options. Your agent then goes to dealers for that car, so every offer is for what you chose. Still deciding? Try the Matchmaker first."
2. **FAQ :66:**
   > "…You can rank more than one trim, color, and option when you finalize, at no extra cost — your agent works down your list. Once your search is live, offers are for those choices."
3. **Finalize review, above "Confirm & Start My Search":**
   > "Your agent will look for exactly this. You'll have 24 hours to change anything. After that, offers come in for these choices."

   The tester version:
   > "Your agent will look for exactly this. On a test account your search starts right away."
4. **Your Deal, a small line above the offer list:**
   > "These offers are for the car you chose. Want to try a different make or model? You can switch from your account."

   Optionally: "…or message your agent about other trims."

### Options (feature)

- **(a) Wording only** (above). Sets the expectation and costs nothing.
- **(b) Read-only "explore" view on a live search.**
  - Open the trim comparison and the option lists from Your Car in a no-save mode.
  - Add an "Ask my agent about this" button that sends the agent a message, so the active search isn't disrupted.
  - Medium effort. Needs a no-save mode for the comparison and wording.
- **(c) "Change my options" on a live search**, as an agent-mediated change request like the switch call, without the $100 fee for a same-model trim or option change.
  - A real policy decision: does it restart the guarantee, and what happens to existing offers?

**Recommendation: (a) now, (b) later.** (b) gives Terry the exploring he wants without touching the agent's search, and the "Ask my agent" message routes it into the work queue. (c) needs a policy decision from Brett first.

---

## 4. Side-by-side offer comparison

### Today

There's no offer comparison. Offers can be sorted ("Best discount", "Best total price", "Closest"), and one gets a "Best value" badge.

### Reuse of the trim comparison table

`trim-comparison-modal.tsx` / `trim-comparison.ts` splits into a reusable shell and trim-specific parts.

- **Reusable shell:**
  - fixed-layout table with a sticky label column (104 px on phones, 160 px otherwise, via `useIsNarrowViewport`);
  - columns at least 160 px, with headers that stack when narrow;
  - the `ComparisonCell` / `DASH` / `cellsDiffer` types;
  - collapsible sections.
- **Trim-specific:** the header controls (Rank / Exclude) and every row builder, which are keyed to configurator data.
- **An offer version would keep the shell** and add new row builders:
  - **Price:** Offer, Total SRP, Savings, Delivery estimate, Add-ons total, "Price + delivery".
  - **Vehicle:** Trim, Colour, Interior, Includes your options, VIN / in transit.
  - **Dealer:** Distance, Pickup or delivery, Status.
  - Header actions: View details, Accept.

**Effort:** moderate. Roughly a day for the table and row builders on the existing data, plus mobile checks. The rows Terry cares most about (interior, included options, fees) depend on items 2 and 5. Without them the table mostly repeats the cards.

### Options

- **(a) Build now with today's data**: price, SRP, savings, delivery, add-ons, distance, trim, colour.
- **(b) Build after item 2(a) and an add-ons/fees total exist**, so the table answers his question.
- **(c) Smaller step now:** an "Add-ons" total and a "Price + delivery" line on each card, then the full table later.

**Recommendation: (b), in the offer-entry phase**, reusing the trim table's shell. Doing (c) alongside it is cheap if Brett wants a quick improvement.

---

## 5. "Is the price just sticker? Does it include taxes and fees? … I'd want the total purchase price"

### What the price means today

- **Offer price** (`offer_price_cents`) is the dealer's negotiated price for the vehicle itself, **excluding add-ons**. That's from the parser's instructions; the form label is just "Offer price ($) *".
- **It doesn't include:** tax, title or registration, doc fee, or dealer add-ons. Add-ons are itemized separately and **never added into any total**.
- **Total SRP** (`msrp_cents`) is the window-sticker total: base price, factory options and destination, excluding tax, title, doc fee and dealer add-ons.
- **"Best total price"** adds a provided delivery estimate when the customer is taking delivery. That's the only "total".
- **No tax, registration, doc-fee or out-the-door calculation exists anywhere.** `zip_coordinates` has latitude and longitude only, no state or county. Offers do store the dealer's state.
- **Customer-facing explanation today:**
  - **FAQ, "Who pays for delivery, tax, and other fees?":** "You do. Delivery, tax, title, and any dealer fees are part of the vehicle purchase and are paid directly by you…"
  - **FAQ, Total SRP entry:** "…It doesn't include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own."
  - **Guarantee:** "…before tax, title, and fees…"
  - **Your Deal itself has no explanation.** The card says "Offer: $28,100 — Total Suggested Retail Price: $30,895", which a first-time buyer can easily read as "the sticker is $28,100, is that what I pay?"

**Inconsistency found:** the AI parser's add-ons description says "Itemized fees beyond the vehicle price itself (**doc fee, destination**, dealer add-ons, etc.)" (`offer-parsing-actions.ts:54`). Destination is already part of Total SRP. If a dealer lists destination separately, it would be pulled out of the price as an add-on, which makes the offer look cheaper against an SRP that includes it. **Worth fixing before real offers arrive** (prompt change, needs Brett's OK).

**Diagnosis:** mostly a wording gap. A real out-the-door estimate is a missing feature.

**Decided (Brett, 2026-10-17):** out-the-door pricing is part of every offer. It's requested with every offer and required before acceptance, with the dealer's itemized breakdown recorded by the agent and no LEVR-computed tax. The plan is in `docs/plans/build-completion-roadmap.md` (offer-entry phase).

### Options

- **(a) Explain the number** (wording only). A line under the price on the card and detail view:
  > "This is the dealer's price for the car, negotiated by your agent. It doesn't include sales tax, title and registration, the dealer's documentation fee, or any add-ons listed below — those depend on your state and the dealer."

  Plus a short FAQ answer:
  > **"What will I actually pay?"** "Your total is the offer price, plus any add-ons you keep, plus delivery if you need it, plus your state's sales tax, title and registration, and the dealer's documentation fee. Doc fees vary by dealer and some states cap them — ask your agent for an out-the-door quote on any offer."
- **(b) Agent-entered out-the-door quote.**
  - The agent asks the dealer for an itemized out-the-door figure: doc fee, tax, title and registration.
  - The Log Offer form records doc fee and the out-the-door total as their own fields.
  - The customer sees "Out-the-door from the dealer: $X" with the breakdown.
  - Accurate, because it's the dealer's own numbers, and it's what car-buying advice tells people to ask for.
  - Needs a migration, form fields and wording.
- **(c) LEVR estimate.**
  - Work out an estimate from the customer's state or ZIP tax rate, typical registration and typical doc fee.
  - Needs a tax-rate source (state rate is easy; local rates vary and change) and a county lookup.
  - Must be clearly labelled an estimate, and carries a real risk of being wrong.
  - Also note: tax usually follows where the car is registered, not where it's bought, which a first-time buyer won't know.

**Recommendation:**
- **(a) now, as a wording fix.**
- **(b) in the offer-entry phase:** make "out-the-door quote requested / provided" part of logging an offer, like the delivery estimate, and use it in "Best total price" and the comparison table.
- **Skip (c) for now.** A wrong LEVR-computed tax figure is worse than a dealer's real one.
- The parser's destination wording should be fixed regardless.

---

## Overlaps with planned work

| Item | Offer-entry phase | Work queue / dashboard (Phase 3) |
|---|---|---|
| 1. Pickup range wording | — | An optional "customer changed pickup range" attention flag |
| 2. Interior and included options per offer | **Yes:** new Log Offer fields, AI parser extraction, sample offers updated | Agent card shows which asked-for items are confirmed |
| 3. Sequence wording / explore mode | — | "Ask my agent about this" messages land in the queue |
| 4. Offer comparison | **Yes:** depends on 2 and 5, sits alongside the existing follow-up "warn when the price is above the sticker" | — |
| 5. Out-the-door quote | **Yes:** a delivery-estimate-style "quote requested / provided" status per offer, parser destination fix | "Out-the-door quote to get" list, like "Delivery estimates to get" on `/internal/outreach` |

## Classification summary

| # | Type | Recommendation |
|---|---|---|
| 1 | Wording gap (two current lines overstate what we do). Sample offers made it more confusing. | Fix the wording (drafts above). No behaviour change now. |
| 2 | Missing feature. Sample offers show even less. | Add interior and included options to offers in the offer-entry phase. Colour as text on the card now. |
| 3 | Wording gap. The tester instant start hid the 24-hour window. | Sequence wording now; read-only explore and "Ask my agent" later. |
| 4 | Missing feature | Build in the offer-entry phase, reusing the trim table's shell, after 2 and 5. |
| 5 | Wording gap, plus a missing feature, plus a parser inconsistency | Explanation wording now; dealer out-the-door quote in the offer-entry phase; fix the parser's destination wording. |
