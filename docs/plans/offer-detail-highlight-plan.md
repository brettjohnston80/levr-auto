# Plan: offer highlight/note + offer detail modal with confirm-before-accept

**Status: plan complete, awaiting Brett's approval. No code or migration has been written.**
Investigated 2026-09-25. Everything below comes from reading the source and a read-only production audit (the scratch audit route was deleted after use). Before building, re-check the counts, since data will have moved.

These are two features planned together because both change `OfferCard`:

- **Feature 1, highlight/note.** A customer can mark a *pending* offer "highlighted" (interested, not ready to commit) and optionally add a short note. More than one offer on a search can be highlighted at once. There is no email or SMS to the agent. Instead, highlights, notes **and declines** must be plainly visible in the agent's normal outreach view.
- **Feature 2, offer detail modal.** Selecting an offer opens an in-place modal (not a new route) with all photos, the dealership location, the distance from the customer, and every other detail we have. **Accept must go through this modal**: the customer confirms from inside it after seeing the details. Decline stays a direct action.

---

## 1. Findings: what exists today

### Offer data

`qualifying_offers` stores:
- `dealer_name`
- `dealer_contact` (agent-only, and deliberately hidden from customers)
- `offer_price_cents` and `msrp_cents` (the sticker-price *total* only, with no breakdown)
- `vehicle_trim` and `vehicle_exterior_color` (optional)
- status and dates
- `notes` (agent-internal)
- an optional `listing_id` pointing to one MarketCheck `listings` row

Related data: `offer_addons` (itemized fees plus removal state), `documents` (the offer-sheet PDF), and `deal_progress`.

**What's missing:**
- There is no dealer street address, VIN or stock number on an offer.
- No dealer or dealership table stores a street address either. `dealerships` and `dealer_aliases` hold only name, city and state.

### MarketCheck listings already hold what Feature 2 wants

`listings` has these columns: `dealer_city`, `dealer_state`, `dealer_zip`, `dealer_phone`, `dealer_website`, `vin`, `trim`, `year`, `color`, `price_cents`, `msrp_cents`.

`listings.raw_data` is MarketCheck's full stored response. In all 25 listings sampled it includes:
- the dealer's `street`, `city`, `state`, `zip`, `latitude`, `longitude`, `phone`, `website` and `seller_email`;
- `media.photo_links` and `media.photo_links_cached`: **real photos of that exact VIN**, between 1 and 58 per listing, median 10;
- `stock_no`, `vdp_url` (the dealer's listing page), `in_transit`, `exterior_color`, `interior_color` and `build`.

None of this costs an extra API call; it's already in the database. Production had 1,761 listings, all with `dealer_zip`.

### The catch: no offer is linked to a listing

**0 of 13 offers have `listing_id` set.** `LogOfferForm` has a "pre-fill from a known listing" dropdown, but it has never been used. So none of the listing data reaches a typical offer today.

### Distance

- `customer_searches.zip` is present on 12 of 12 searches (the column is nullable).
- The no-cost approach: look up both zips in the `zip_coordinates` table (Census zip centroids) and calculate the distance with Haversine, the same way `countNearbyInventory` in `inventory-count.ts` already does.
- `haversineMiles` is private to that file, and it's a server-action file, so it needs to move into a plain shared module.
- It's approximate, so display it as "about N miles." Show nothing if either zip is missing or not found.

### "All photos": what a typical offer can realistically show

**Linked to a listing:** the dealer's real photos of that exact VIN.

**Everything else:** at most **one stock configurator photo** of the exterior color, and only for Toyota Camry or Honda Civic, and only when the agent entered a color. Otherwise, the silhouette placeholder.

- The stock photo shows the *color*, not the dealer's car, so it must be labeled that way.
- Interior photos exist for Camry and Civic, but offers don't record an interior color, so none can be chosen.
- Wheel and feature photos can't be matched to a specific offer.

**Risks with listing photos:**
- They're dealer images served from MarketCheck's CDN (cloudfront). Their terms of use haven't been reviewed, which is the same class of risk as the configurator screenshots.
- They can disappear once the car sells.
- The sampled URLs contain a `375x280` segment, so they may be thumbnails. Larger sizes haven't been verified.
- `photo_links_cached` may be more stable than `photo_links`. That's also unverified.

### A typical offer today would show

- Dealer name, price, sticker price and savings, plus trim and color if entered.
- Add-ons, the offer-sheet PDF, and status and dates.
- One stock color photo, or the placeholder.
- **No address, no distance, no VIN.**

The rich version needs the agent to link a listing, or type the details in.

### Other details

- **Always available:** add-ons, the offer-sheet PDF, the below-sticker flag and savings.
- **Linked listing only:** VIN, stock number, in-transit flag, dealer listing link, dealer phone and email.
- **Nowhere:** a sticker-price breakdown. Only the total exists.

### Agent visibility gap (today)

- `/internal/outreach` loads only `search_status = 'searching'` searches. `getOutreachQueue` is the only agent query that loads offers at all.
- Offers render as gray raw-status lines, e.g. `Dealer — $X (below MSRP) — customer_declined`, with no date and no color. They sit at the bottom of each search card, *below* the dealer list, which can run dozens of lines.
- **Offers on paused searches appear in no agent tool**, yet customers can still respond to them from `/account/deal`.
- So declines are technically shown but easy to miss, and invisible on paused searches. Highlights and notes would inherit the same gap.

---

## 2. Design recommendations

### Highlight and note
- **Store highlight as `customer_highlighted_at timestamptz`, not a boolean.** That's the codebase convention (`vehicle_sold_at`, `deposit_confirmed_at`: a nullable timestamp *is* the boolean), and it gives the agent a "when."
- **Independent:** a highlight without a note (a quick "interested"), or a note without a highlight (a question on an offer they're lukewarm about).
- **Editable while the offer is pending:** toggle the highlight, edit or clear the note. **Frozen but kept** once the offer is accepted, declined or withdrawn. Never auto-cleared, so the agent keeps the context.
- The server actions guard the write with `.eq("status", "pending")`.
- Highlighting stays allowed while another offer on the search is accepted, since the offer is still pending.

### Placement
- **Card:** a "View details" button, the highlight toggle, and a one-line preview of the note.
- **Modal:** the highlight toggle and the full note editor.

### Accept-confirm flow
- Accept on the card opens the detail modal. The real accept button ("Accept this offer") lives in the modal footer.
- Opening the modal through "View details" also shows that footer button, since the customer is already looking at the details.
- **Decline stays direct**, on both the card and the modal.
- The one-accepted-offer rule (`fa339be`) carries over: while another offer is accepted, the modal shows no Accept, just the existing note. The server guard stays.
- Use an explicit "View details" button rather than making the whole card clickable, because a clickable card would contain other buttons.
- The modal is portaled to `document.body`, like `VehicleDetailModal`. That's needed because of `drive-transition-provider`'s `will-change-transform` wrapper. It closes on Escape and becomes a full-screen sheet on mobile.

### Agent surfacing
- **A new top-of-page section, "Customer activity on offers (N)":**
  - Lists every *unreviewed* highlight, note change or decline across **searching and paused** searches, newest first.
  - Each line shows the customer, vehicle, dealer, price, what happened, when, and the note text.
  - Each has **"Mark reviewed"**, reusing the existing `resolveNotificationCallback` / "Mark handled" pattern.
  - "Unreviewed" means `customer_activity_at > coalesce(agent_reviewed_at, -infinity)`. PostgREST can't compare two columns, so fetch rows with `customer_activity_at` set and filter in application code, paginated.
  - Items stay until reviewed, so nothing ages out. Any later customer change makes the item reappear.
- **In each active search card:**
  - Move "Offers logged" **above** the dealer list.
  - Replace raw status strings with readable, color-coded labels: "Declined by customer {date}," "★ Highlighted {date}," and the note shown as a quote.
- Accepts are not added to the activity section; they already get the prominent closing panel. Easy to add if wanted.

### Data capture
- Address, VIN and stock number are **copied onto the offer when it's logged** (pre-filled from a linked listing, or typed by the agent). That's the same convention as `vehicle_trim`, `vehicle_exterior_color` and `msrp_cents`.
- **Photos are read live from the linked listing's `raw_data`**, selecting only `raw_data->media` and `raw_data->dealer`, never the whole payload. They are not copied onto the offer.

---

## 3. Migration draft (not written as a migration file, not run)

```sql
alter table public.qualifying_offers
  add column customer_highlighted_at timestamptz,
  add column customer_note text,
  add column customer_note_updated_at timestamptz,
  add column customer_activity_at timestamptz,   -- bumped by any highlight/note change or a decline
  add column agent_reviewed_at timestamptz,      -- "Mark reviewed"; unreviewed = activity newer than this
  add column dealer_street text,
  add column dealer_city text,
  add column dealer_state text,
  add column dealer_zip text,
  add column vin text,
  add column stock_number text;

alter table public.qualifying_offers
  add constraint qualifying_offers_customer_note_length
    check (customer_note is null or char_length(customer_note) <= 500),
  add constraint qualifying_offers_dealer_zip_format
    check (dealer_zip is null or dealer_zip ~ '^[0-9]{5}$');
```

Per the usual workflow: Claude writes the migration file, Brett reviews and runs it in the Supabase SQL Editor.

---

## 4. Build plan (once approved)

1. **Migration**, as above.
2. **Data capture (`LogOfferForm` and `logQualifyingOffer`):**
   - Picking a listing pre-fills street, city, state, zip, VIN and stock number, in addition to the fields it already fills.
   - For offers with no listing, the agent can type these in; all are optional.
   - Make the listing picker more prominent, since it's the only route to real photos.
3. **Server:**
   - New `setOfferHighlight(offerId, on)` and `setOfferNote(offerId, note)`: owner-only, pending-only (guarded write), trimmed; an empty note clears it. They bump `customer_activity_at`.
   - `respondToOffer` bumps `customer_activity_at` on decline.
   - `getDealDetails` adds listing photos, address, distance, VIN, stock number and in-transit. Compute these only there, not in `getCustomerDashboard`, which doesn't need them.
   - Move `haversineMiles` into a shared module.
   - Add a switch for listing photos (like `VEHICLE_COLOR_IMAGES_ENABLED`), gated at the data layer.
   - New agent query for the activity section, covering searching and paused searches, plus a `markOfferActivityReviewed` action.
4. **Customer UI:**
   - Card: "View details," the highlight toggle and the note preview.
   - Modal: photo gallery with a label on every photo; dealership address and distance; price, sticker price and savings; add-ons; vehicle details (trim, color, VIN and stock number when known, in-transit badge); offer-sheet PDF; highlight and note editor; footer with Accept (confirm) and Decline.
5. **Agent UI:** the "Customer activity on offers" section with Mark reviewed, offers moved above dealers, readable status labels, and highlight and note shown on each offer line.
6. **Verification:** on a disposable scratch account and a scratch agent, then screenshots for Brett.

---

## 5. Open business decisions (Brett)

1. **Show dealer phone, email and listing link to customers?** Recommended: **no.** That matches the existing deliberate hiding of `dealer_contact` from customers, and avoids customers bypassing LEVR.
2. **Show the dealer's street address?** Recommended: **yes.** Name and city are already shown, and the customer needs it for pickup.
3. **Listing-photos switch: start off until MarketCheck's photo terms are reviewed, or on?** For comparison, the configurator color photos were turned on 2026-09-14 before their review.
4. **Move the agent card's offer list above the dealer list?**

---

## 6. Draft customer-facing copy: none of it approved

- Highlight button: **"Highlight"** / **"Highlighted"** (★)
- Highlight helper text: *"Interested but not ready to accept? Highlight it so your agent knows."*
- Note: **"Add a note for your agent"** / **"Edit note"** / **"Remove note"**, with a "N/500" counter
- Note placeholder: *"e.g. Would they do $31,000? Is the sunroof included?"*
- Note privacy line: *"Only your LEVR agent sees this note."*
- Frozen note on a responded-to offer: *"Your note: …"*
- Card button: **"View details"**
- Modal photo captions: *"From the dealer's listing"* / *"Stock photo of this color — not the dealer's actual car"*
- Distance: *"About N miles from you."*
- In-transit badge: *"In transit to the dealer"*
- Accept footer: **"Accept this offer"** with **"Go back"**, plus the explanation:
  *"Accepting tells your agent this is the car you want. They'll confirm it's still available and help you place a refundable deposit with the dealer. You can accept one offer per search."*
  Brett needs to confirm this matches the real process before it's built.

Agent-facing labels ("Customer activity on offers," "Mark reviewed," "Declined by customer {date}," "★ Highlighted {date}") don't need sign-off, but are listed here for visibility.
