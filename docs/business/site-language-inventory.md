# Site language inventory

A running list of every piece of **approved** wording, grouped by page, flow or email: what it says, where it appears, and when Brett approved it. It feeds the final full review (`docs/plans/build-completion-roadmap.md`).

**How to keep it current:** when a chunk's wording is signed off, add it here in the same commit that records the approval. Copy the text exactly as it ships (from the code), not from a draft. `{curly}` parts are filled in at run time.

**Scope today:** backfilled with everything approved in agent dashboard Phase 1 (approved 2026-10-11 to 2026-10-14; on the branch `agent-dashboard-phase1-code`, not deployed yet). Customer-facing wording approved before Phase 1 is recorded in CLAUDE.md and the plans in `docs/plans/`; it gets gathered here as part of the final review. Phase 1 changed no customer-facing wording (code plan section 3.7).

---

## 1. Agent sign-in (`/agent`) — approved 2026-10-12 (Chunk 1b review)
Where: `src/app/agent/page.tsx`, `src/components/agent-signin-form.tsx`, `src/lib/agent-signin.ts`.

| Item | Text |
|---|---|
| Browser tab title | `LEVR Auto agent sign-in` |
| Page heading | `Agent sign-in` |
| Fields | `Work email` · `Password` |
| Button / busy | `Sign in` · `Signing in…` |
| Link | `Forgot your password?` |
| Two-factor step heading | `Enter your authenticator code` |
| Two-factor field | `6-digit code` |
| Two-factor help line | `Lost access to your authenticator? Contact your lead.` |
| Generic error (any wrong email, password or code; unknown or deactivated agent; a customer account) | `That didn't work. Check your details and try again.` |
| Too many attempts | `Too many sign-in attempts. Wait 15 minutes and try again.` |

## 2. Agent header (every `/internal` page) — approved 2026-10-13 (Chunk 1d)
Where: `src/components/agent-header.tsx`.

| Item | Text |
|---|---|
| Brand | `LEVR Auto · Agent` |
| Who is signed in | `{agent name} (LEVRID {n})` |
| Button / busy | `Sign out` · `Signing out…` |

## 3. Invite, set password, two-factor, password reset — approved 2026-10-13 (Chunk 1c review); link lifetime "1 hour" confirmed 2026-10-13
Where: `src/app/agent/accept|set-password|enroll|forgot-password`, `src/components/agent-setup-forms.tsx`, `agent-enroll-setup.tsx`, `agent-key-box.tsx`, `src/lib/agent-setup-copy.ts`, `src/lib/agent-invite.ts`. "1 hour" comes from `SETUP_LINK_LIFETIME_SECONDS`, which must equal Supabase's Email OTP Expiration.

| Item | Text |
|---|---|
| Invite email subject | `You've been invited to the LEVR Auto agent dashboard` |
| Invite email body | `{inviter name} added you as a LEVR Auto agent. Set your password and turn on two-factor sign-in to get started. This link works once and expires in 1 hour: {link}` |
| Accept page (invite) | heading `Welcome to the LEVR Auto agent dashboard`; text `Continue to set your password and turn on two-factor sign-in.` |
| Accept page button / busy | `Continue` · `Checking…` |
| Accept page (reset) | heading `Reset your password`; text `Continue to set a new password.` |
| Expired or used link | `This link has expired or has already been used.` + (invite) `Ask your lead to send a new invite.` or (reset) link `Request a new reset link` |
| Set-password page | heading `Set your password`; fields `New password` · `Confirm password`; rule text `Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character (like ! or #).`; button `Continue` (busy `Saving…`) |
| Passwords differ | `Passwords don't match.` |
| Enroll page | heading `Turn on two-factor sign-in`; text `Scan this code with an authenticator app (such as Google Authenticator, 1Password or Authy), then enter the 6-digit code it shows.` |
| Can't scan | `Can't scan? Enter this key instead:` + the key (grouped in fours) + button `Copy key` |
| Enroll button / busy | `Turn on` · `Turning on…` |
| Forgot-password page | heading `Reset your password`; field `Work email`; button `Send reset link`; link `Back to sign-in` |
| Reset requested (always the same, never says if the address is an agent) | `If that's an agent's work email, we've sent a link to reset the password. Check your inbox.` |
| Reset email subject | `Reset your LEVR Auto agent password` |
| Reset email body | `Use this link to set a new password for the LEVR Auto agent dashboard. It works once and expires in 1 hour. You'll still need your authenticator code to sign in. If you didn't ask for this, you can ignore this email: {link}` |

## 4. Add-agent page and agents list (`/internal/agents`) — approved 2026-10-14 (Chunk 1g review)
Where: `src/app/internal/agents/page.tsx`, `src/components/add-agent-form.tsx`, `team-list.tsx`, `src/lib/agent-team-copy.ts`, `src/lib/agent-invite.ts`.

| Item | Text |
|---|---|
| Page title | `Add an agent` |
| Fields | `Name` · `Work email` · `Role` |
| Role options | `Agent` (leads and admins) · `Lead` and `Admin` (admins only) |
| Help line | `They'll get an email to set a password and turn on two-factor sign-in. The invite link works once and expires in 1 hour.` |
| Button / busy | `Send invite` · `Sending invite…` |
| Success | `Invite sent to {email}. {name} is LEVRID {n}.` (a test agent: `Invite sent to {email}. {name} is a test agent, so has no LEVRID.`) |
| Not a work email | `Use a @levrauto.com work email.` (outside production also allows test addresses: `Use a @levrauto.com work email (or a @levrauto-test.invalid test address).`) |
| Malformed email | `Enter a work email address.` |
| Role not allowed | `Only admins can add a lead or an admin.` · `Only leads and admins can add agents.` |
| Already exists | `An agent with that email already exists.` |
| Invite email failed | `{name} was added as LEVRID {n}, but the invite email didn't send: {message}.` + button `Resend invite` (busy `Sending…`) |
| Resent | `Invite sent again to {email}.` |
| List heading / columns | `Agents` · `Name`, `Work email`, `Role`, `LEVRID`, `Sign-in` |
| Sign-in status | `Two-factor on` · `Invite not finished` · `No login yet` · `Old login, not moved yet` |
| Badges | `TEST` (outside production only) · `you` |
| Reset button | `Reset two-factor` |
| Reset confirm | `Reset {name}'s two-factor sign-in? They'll be signed out everywhere and set it up again next time they sign in. Confirm it's really them by phone or video first.` · buttons `Reset` (busy `Resetting…`) · `Cancel` |
| Reset done | `{name}'s two-factor sign-in was reset. They've been signed out everywhere.` |

## 5. Two-factor reset (Chunk 1e) — approved 2026-10-14
Where: `src/lib/agent-two-factor-reset.ts`.

| Item | Text |
|---|---|
| Email to the agent, subject | `Your LEVR Auto two-factor sign-in was reset` |
| Email body | `{lead/admin name} reset your two-factor sign-in. The next time you sign in, you'll set it up again. If you didn't ask for this, contact {lead/admin name} right away.` |
| Refusals | `You can't reset your own two-factor sign-in.` · `Only leads and admins can reset an agent's two-factor sign-in.` · `Only admins can reset a lead's or an admin's two-factor sign-in.` · `That agent hasn't set up a login yet.` · `Agent not found.` · `Could not sign the agent out: {message}` |

## 6. Alert emails to leads or admins (Chunk 4) — approved 2026-10-14
Where: `src/lib/agent-alerts.ts`. `{link}` is `https://www.levrauto.com/internal/admin`.

| Alert | Subject | Body |
|---|---|---|
| Search assigned to a lead (nobody in rotation) | `Search assigned to {lead name}: nobody is in rotation` | `{customer}'s {year make model} search was paid and assigned to {lead name}, because no agent is in rotation. Put an agent back in rotation, or reassign the search if someone else should take it. Search: {link}` |
| No agent at all (to admins) | `A paid search has no agent` | `{customer}'s {year make model} search is paid but couldn't be assigned: no agent is in rotation and there is no active lead. Put someone in rotation or assign it yourself. Search: {link}` |
| Activity not recorded | `An agent action wasn't recorded in the activity log` | `{agent name}'s action "{action label}" went through, but its activity record couldn't be saved ({error}). Nothing needs undoing; this only affects the history.` |
| Assignment failed | `Automatic assignment failed for a paid search` | `Assigning {customer}'s {year make model} search failed: {error}. The hourly sweep will try again. Search: {link}` |
| Any other alert | `A LEVR Auto agent alert needs attention` | `An alert was raised ({error}). Search: {link}` |

Fill-ins (approved 2026-10-14): a search with no vehicle chosen yet reads `{customer}'s undecided search`; a missing customer name falls back to the customer's email, then `A customer`; a missing agent name is `An agent`.

## 7. Refunds due (`/internal/refunds-due`, Chunk 5) — approved 2026-10-14
Where: `src/app/internal/refunds-due/page.tsx`, `src/components/refund-due-actions.tsx`, `src/lib/guarantee-refund-actions.ts`.

| Item | Text |
|---|---|
| Page subtitle | `Guarantee not met by Day 30. Issue each refund here, or record one that was already issued in Stripe.` |
| Columns | `Customer` · `Search` · `Resolved` · `Refundable` (phone: `Refundable` beside the amount) |
| Button | `Issue refund` |
| Confirm (the $699 only) | `Refund {amount} to {customer} for the Day-30 guarantee? This sends the money back through Stripe and can't be undone.` |
| Confirm (with switch fees) | `Refund {total} to {customer} for the Day-30 guarantee ({$699 search fee + $100 switch fee…})? This sends the money back through Stripe and can't be undone.` |
| Confirm buttons / busy | `Refund {amount}` · `Cancel` · `Refunding…` |
| Success (shown at the top, name first) | `{customer}: Refunded {amount}. Stripe refund {re_…}.` (with switch fees: `{customer}: Refunded {total} ({parts}). Stripe refunds {re_…}, {re_…}.`) |
| No longer due | `This search is no longer due a guarantee refund.` |
| Nothing left | `Nothing left to refund on this payment.` |
| No $699 payment | `No $699 payment is recorded for this search, so there's nothing to refund here.` |
| Stripe failed | `Stripe didn't complete the refund: {Stripe message}. Nothing was recorded, and no money moved.` |
| Part-way failure | `Refunded {amount} ({parts}). Then Stripe didn't complete the refund of the {amount} {search fee/switch fee}: {Stripe message}. Nothing more was recorded, and no more money moved.` |
| Recorded failed after Stripe | `The refund went through in Stripe ({re_…}) but couldn't be recorded here: {message}. Don't refund again. Record it with "Record a refund already issued in Stripe".` |
| Link | `Record a refund already issued in Stripe` |
| Field / button / busy | `Stripe refund ID (starts with re_)` · `Record refund` · `Recording…` · `Cancel` |
| Recorded | `{customer}: Recorded the {amount} refund {re_…}.` |
| Not found | `That refund ID wasn't found in Stripe.` |
| Not succeeded | `That refund hasn't gone through in Stripe yet (status: {status}).` |
| Other payment | `That refund belongs to a different payment, not this search's $699 fee.` (with switch fees: `…not this search's $699 fee or switch fee.`) |
| Already recorded | `That refund has already been recorded.` |
| Couldn't record | `Couldn't record the refund: {message}` |
| Preview build | `Refunds can't be issued or recorded from a preview build.` |
| Empty list | `No refunds currently due.` (unchanged) |

## 8. Cancellation form refund reason (Chunk 5) — approved 2026-10-14
Where: `src/components/agent-cancellation-resolution-form.tsx` (labels from `refund_reasons`).

| Item | Text |
|---|---|
| Label (per refund line) | `Reason` |
| Options | `Cancellation` (default) · `Day-30 guarantee` · `Goodwill` · `Duplicate charge` · `Other` |

## 9. Call-request resolution (`/internal/outreach`, Chunk 6) — approved 2026-10-14
Where: `src/components/resolve-call-request-form.tsx`, `src/lib/call-resolution-actions.ts`.

| Item | Text |
|---|---|
| Button | `Mark call resolved` |
| Picker | `Outcome` |
| Switch outcomes | `Didn't switch` · `Couldn't complete the call` · `Other` |
| Cancellation outcomes | `Didn't cancel` · `Couldn't complete the call` · `Other` |
| Note | `Note (optional)` |
| Buttons / busy | `Resolve` · `Resolving…` · `Cancel` |
| Errors | `Couldn't resolve this request: {message}`; specifically `Couldn't resolve this request: it's already been resolved.` and `Couldn't resolve this request: choose an outcome.` |

Stored outcome codes (neutral, approved 2026-10-11; customers can read their own searches): `switched`, `no_switch`, `call_not_completed`, `other` and `cancelled`, `not_cancelled`, `call_not_completed`, `other`.

## 10. Call-request email to agents (Chunk 6) — approved 2026-10-11 (C5)
Where: `src/lib/agent-call-notifications.ts`.

| Item | Text |
|---|---|
| Subject | `{customer name or email} requested a {finalization / switch / cancellation} call — {year make model}` |
| First line (to the assigned agent only) | `This search is assigned to you.` |
| Body | `{customer} asked for a call to {finalize the trim, color, and options on their / switch away from their current / talk through cancelling their} {year make model} search.` then the contact lines `Name:` / `Email:` / `Phone:` (only those on file), then the link `Open this request on /internal/outreach` |

When it goes to leads or admins instead (no agent assigned, or a test account), the first line is left out.

## 11. Activity log labels
Where: `agent_activity_types` (shown on the Phase 3 activity screens).

| Code | Label | Approved |
|---|---|---|
| `call_request_resolved_by_customer` | `Call request closed: the customer switched or cancelled` | 2026-10-14 |

## 12. Your Deal with no offers (customer, `/account/deal`) — approved 2026-10-16 (tester feedback)
Where: `src/app/account/deal/page.tsx`, `src/lib/deal-empty-copy.ts`. Live on `main` (not part of Phase 1). Which state shows: the customer's newest search still in play, then their saved unpaid search, then "cancelled" if their latest paid search was cancelled, otherwise "No deal yet".

| State | Heading | Text | Button |
|---|---|---|---|
| Saved, not paid | `Complete payment to start your search` | `Your search is saved. Once you pay, we'll start finding offers.` | `Review your search` (Your Car, that search) |
| Paid, not finalized | `Finish your search to start getting deals` | `We need a few more details about the car you want before we can start finding offers.` | `Finish in Your Car` (Your Car, that search) |
| Same, finalization call requested | `Finish your search to start getting deals` | `Your agent will call you to go over the details. You can also finish it yourself in Your Car.` | `Finish in Your Car` |
| Paid, vehicle not chosen yet | `Let's pick your car` | `We're finding the right vehicle for you — your agent will reach out soon to talk through what you're looking for.` (existing approved line) | none |
| Finalized, 24-hour change window | `Your search starts soon` | `You can still make changes in Your Car until {date, time in the customer's time zone}. After that we start searching dealers, and your offers will show up here.` | `Make changes in Your Car` |
| Live (searching), no offers | `We're on it` (at the top, in place of the progress line; the lower "No offers yet" heading is hidden) | `We have everything we need and we're searching dealers for your car now. We'll let you know as soon as your first offer comes in.` | none |
| Latest search cancelled | `This search was cancelled` | `To search again, start a new $699 search from the homepage.` | `Get Started` |
| No searches | `No deal yet` (unchanged) | `Once your search gets underway, this is where you'll come back to see your offers.` (unchanged) | `Get Started` |

A paused search with no offers is unchanged: the paused banner plus "No offers yet".

## 13. Dealer-installed options (customer and agent) — approved 2026-10-17
Where: `src/lib/option-display.ts` (`DEALER_INSTALLED_TAG`, `displayOptionName`, `displayPackageContents`), `src/components/dealer-installed-tag.tsx`, `src/components/log-offer-form.tsx`. Live on `main` (`fbea226`), GMC, Buick and Cadillac batches swapped 2026-10-18 01:12 UTC. Plan: `docs/plans/dealer-installed-options-2026-10-16.md`.

| Text | Where it appears | Audience |
|---|---|---|
| `Dealer-installed` (a small tag next to the price or name) | Configurator questions (features, wheels, roof), Review, Your Car, trim details (Highlights and All details), the trim comparison table, the agent's build-preferences card on `/internal/outreach`, and matching add-on lines in Log Offer | customers and agents |
| `Dealer-installed items the customer wants (removable, negotiable): {items}` | Log Offer form, above the itemized add-on lines (only when the customer ranked a dealer-installed item) | agents |

**Display-name rule (approved 2026-10-17):** GM's "LPO" code is dropped from displayed option names in all three forms, `LPO, …`, `LPO …` and `…, LPO` (e.g. "LPO, Wheel locks, set of 4" shows as "Wheel locks, set of 4"), and bare "LPO" items are dropped from package contents. Stored names and saved answers keep GM's text as received. "LPO" in the middle of GM's own wording (e.g. Cadillac's "transit steel wheels for LPO 20" wheels") is left as written.

**Never tagged (approved 2026-10-17):** paint and interior colours, even when sold through a dealer-installed package.

## 14. Pickup range, "choose first, then we search", and what the offer price excludes (customer and agent) — approved 2026-10-17 (Terry's tester feedback)
Review: `docs/research/tester-feedback-terry-2026-10-17.md`. Branch `offer-parser-colour` until merged.

| Text | Where it appears | Audience |
|---|---|---|
| `We look for deals at dealers everywhere. This is just how far you'd drive to pick one up — if the best deal is farther away, we'll get you a delivery estimate.` | Under "How far would you drive to pick up your car?" on intake and on Your Deal (when unanswered) (`pickup-travel.ts`) | customers |
| `Changing this doesn't start a new search — we're already looking everywhere. It decides which offers you'd pick up and which would be delivered.` | Your Deal, under "Pickup range: … Change" (`pickup-range-control.tsx`) | customers |
| `Offers inside the circle are ones you'd pick up. For anything outside it, we'll get a delivery estimate.` | Your Deal map, under the pickup-range slider (`map/pins.ts`) | customers |
| `{N} miles away — farther than the {M} miles you'd drive, so this one would be delivered. Delivery may cost extra.` | Offer card and offer detail, dealer beyond the range (`outOfRangeCopy`) | customers |
| `{N} for sale within 100 miles of you right now — and we search nationwide.` / `None for sale near you right now — we search dealers nationwide.` | Intake count (badge and footer) and Review your search (`nearbyInventoryCopy`) | customers |
| `After checkout you'll choose your exact trim, color and options. Your agent then goes to dealers for that car, so every offer is for what you chose.` | Intake, under the model choice | customers |
| `Here's how it works: after you pay, you'll choose your exact trim, color and options. Your agent then goes to dealers for that car, so every offer is for what you chose. Still deciding? Try the Matchmaker first.` ("Matchmaker" links to /matchmaker) | Review your search, under "What's included" (decided searches only) | customers |
| `Your agent will look for exactly this. You'll have 24 hours to change anything. After that, offers come in for these choices.` | Finalize review, above "Confirm & Start My Search" (the "Make changes" edit keeps its earlier line) | customers |
| `Your agent will look for exactly this. On a test account your search starts right away.` | Same spot, tester accounts with instant start | testers |
| `These offers are for the car you chose. Want a different make or model instead? See how switching works.` ("See how switching works" links to `/faq#switching`) | Your Deal, above the offer list | customers |
| `Negotiated price for the car. Excludes tax, title, registration, doc fee and add-ons.` | Offer cards, under the price (`offer-price-copy.ts`) | customers |
| `This is the dealer's price for the car, negotiated by your agent. It doesn't include sales tax, title and registration, the dealer's documentation fee, or any add-ons listed below — those depend on your state and the dealer.` | Offer detail, Price section | customers |
| FAQ **Does my pickup range limit where you search?** `No. Your agent looks for deals at dealers anywhere in the country. Your pickup range just tells us how far you'd drive to collect the car. For a deal farther away, we get a delivery estimate from the dealer so you can compare the full cost.` | `/faq#pickup-range` | customers |
| FAQ **What will I actually pay?** `Your total is the offer price, plus any add-ons you keep, plus delivery if you need it, plus your state's sales tax, title and registration, and the dealer's documentation fee. Doc fees vary by dealer and some states cap them — ask your agent for an out-the-door quote on any offer.` | `/faq#total-cost` | customers |
| FAQ "Can I search for more than one car at a time?", middle sentences now: `You can rank more than one trim, color, and option when you finalize, at no extra cost — your agent works down your list. Once your search is live, offers are for those choices.` | `/faq` | customers |
| `Trim: {trim} · Color: {color}` | Offer cards | customers |
| `The dealer listed destination (${X}) separately, so it's been added to the offer price. Total SRP already includes destination.` / `The dealer listed destination (${X}) separately. Include it in the offer price: Total SRP already includes destination.` | Log Offer form, under Offer price, after AI parsing | agents |
| `Destination is already included in Total SRP. Add it to the offer price instead.` | Log Offer and "add a fee" refusal for a typed add-on naming destination (destination, freight, D&H, DPH, processing and handling) | agents |

Replaced: "We'll focus on dealers within that range, and flag any offer that's farther." (intake), "This helps us focus on the right dealers and flag offers that are farther away." (Your Deal), "…farther than the M miles you said you'd drive…", "N vehicles (match) within 100 miles", "No nearby matches yet — we can search nationwide for you.", "You'll fine-tune trim, color, and options right after checkout — before we start reaching out to dealers.", and the FAQ's "Within that make/model, you can still be flexible on trim, color, and options at no extra cost."

## 15. Sticker (Total SRP) on Log Offer (agent) — approved 2026-10-17
Where: `src/components/log-offer-form.tsx`, text and thresholds in `src/lib/sticker-check.ts`. The checks warn and never block saving.

| Text | Where it appears | Audience |
|---|---|---|
| `Total SRP (window sticker total, no dealer addendum) *` | Label of the sticker field (was "MSRP ($) *") | agents |
| `Total SRP is never parsed; enter it yourself.` | Under "Parse with AI" (was "MSRP is never parsed…") | agents |
| `You entered {typed}, but the linked listing's sticker is {listing}. Check the window sticker's total — it should match the listing.` | Under the field, when the sticker differs from the linked listing by more than $100 | agents |
| `You entered {typed}, which is below this trim's base price plus destination ({low}). Check the window sticker's total, which includes destination.` | Under the field, when more than $500 below base + destination for the typed trim | agents |
| `You entered {typed}, well above what this trim should cost with every factory option we know of ({low}–{high}). If the sticker includes a dealer addendum, enter only the manufacturer's total.` | Under the field, when above the range by more than the greater of $5,000 or 15% | agents |

## 16. Sending an offer: draft, send, discard (agent; offer entry Chunk 3) — approved 2026-10-27
Where: `src/lib/offer-entry-copy.ts` on the `offer-entry` branch (not deployed). The first three lines are from the offer-entry plan, section 6.1; the rest approved by Brett 2026-10-27.

| Text | Where it appears | Audience |
|---|---|---|
| `Draft saved. The customer can't see it.` | After Save draft | agents |
| `Sent to {customer first name}.` (`Sent to the customer.` when there's no first name) | After Send | agents |
| `No out-the-door figures yet. The customer will see "Out-the-door quote requested", and can't accept until you record the dealer's quote.` | After Send, when no out-the-door figure was recorded | agents |
| `Your agent account isn't active, so you can't send offers.` | Send refused: agent not active | agents |
| `This draft no longer exists. Reload the page.` | Send refused: submission not found | agents |
| `This offer has already been sent or discarded. Reload the page.` | Send or discard refused: already sent or discarded | agents |
| `This search isn't active. Tick the warning to send it anyway.` | Send refused: search not `searching` | agents |
| `Confirm the trim matches what the customer chose before sending.` | Send refused: trim not confirmed | agents |
| `The price isn't below the sticker, so this offer won't count toward the guarantee. Tick the warning to send it anyway.` | Send refused: price at or above the sticker, warning not ticked | agents |
| `List the add-ons, or tick "No add-ons".` | Send refused | agents |
| `List any other fees, or tick "No other fees".` | Send refused | agents |
| `Tick each warning to send this offer.` | Send refused: a warning isn't ticked | agents |
| `That VIN isn't valid. Check for a mistyped character.` | Send refused: VIN check | agents |
| `Check the amounts: the sticker and price must be above $0, add-ons above $0, and no line over $250,000.` | Send refused: amounts | agents |
| `The out-the-door total doesn't match the lines (within $1). Check for a missing or extra line.` | Send refused: out-the-door mismatch | agents |
| `Good until must be today or later, and no more than 60 days out.` | Send refused | agents |
| Log Offer's delivery-estimate line (section 6 of this file, 2026-10-10) | Send refused: delivery estimate standard | agents |
| `That search no longer exists.` | Send refused | agents |
| `Enter the dealer's name.` | Send refused | agents |
| `Say why you're discarding this submission.` | Discard refused: no reason | agents |
| `Only a dealer's submission can be discarded.` | Discard refused: an agent's own draft | agents |
| `The offer wasn't sent. Nothing reached the customer. Try again.` | Send failed unexpectedly | agents |
| `You're signed out. Sign in again to continue.` | Any of the three, signed out | agents |

