# Em dash inventory (Micah (MH)'s tester note), 2026-10-30

Status: **inventory only, nothing changed.** The sweep happens after the GX deploy, so the branch copy is included once (Brett, 2026-10-30). Every rewrite below is a proposal; customer-facing wording needs Brett's sign-off before it's built, and approved wording in `docs/business/site-language-inventory.md` gets updated in the same commit as the sweep.

**How this was built.** A script read every `.ts`/`.tsx` file under `src/` on `main` (`74278f0`), `offer-entry` (`9f66c95`, main merged in) and `gx` (`2229083`, offer-entry merged in) with the TypeScript parser and listed every string, template and JSX text containing "—". Code comments are not included (they aren't shown to anyone). Published and approved articles were read from the database (read-only). The "Branch" column says where the line first exists: **main** (live), **offer-entry** or **gx** (not live yet). Line numbers are from `gx`, which contains everything.

**Counts.** 228 customer-facing hits (224 on main, 4 only on the branches), 48 strings in the article and social generator prompts (61 dashes), 16 lines in approved or published articles, and 93 agent-facing hits (Appendix A, listed for the record; the standing rule covers new agent copy).

**Patterns used in the proposals.**
- Two clauses → a period ("This link has expired. Request a new one.").
- A list or explanation that follows → a colon ("That's it: no hidden charges").
- A short aside or "so…" → a comma, or rephrased ("…every offer, so you never have to haggle").
- Paired dashes around an aside → parentheses or a rephrase.
- Page titles "X — LEVR Auto" → "X | LEVR Auto". Stripe line items "LEVR Auto — Vehicle Search" → "LEVR Auto: Vehicle Search".
- Separators between values ("Camry — LE", "{dealer} — {price}") → a space, a colon or " · ".
- "M:" in the Proposed column means the dash sits between JSX pieces or values, so the proposal describes the change rather than quoting one string.

## Decision needed: placeholder dashes

Some hits are a lone "—" shown where a value is missing (a table cell, an unknown drivetrain, a ZIP not on file). That's ordinary table typography rather than prose, but it's the same character. Options: (a) keep it in tables only; (b) replace each with a word ("Not set", "Not listed", "None") or leave the field out. **Recommendation: (b)** for anything a customer reads in a sentence or a label/value pair (Review your search, the pickup range on the map view), and (a) for comparison-table cells, where a word in every empty cell makes the table harder to scan. These are marked "See Placeholder dashes" below.

## 1. Homepage, header, footer, intake and the sign-up pop-up

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 46 | `app/layout.tsx:20` | main | LEVR Auto — Car buying, with the leverage on your side. | LEVR Auto \| Car buying, with the leverage on your side. |
| 47 | `app/layout.tsx:22` | main | Tell us the exact car you want. We reach out to dealers nationwide and negotiate every offer — so you never have to haggle. | Tell us the exact car you want. We reach out to dealers nationwide and negotiate every offer, so you never have to haggle. |
| 69 | `components/auth-gate-modal.tsx:188` | main | Your search is saved — confirm your account and come back to this page to finish. | Your search is saved. Confirm your account and come back to this page to finish. |
| 70 | `components/auth-gate-modal.tsx:204` | main | Your search is saved — just need an account to keep it under. | Your search is saved. You just need an account to keep it under. |
| 75 | `components/comparison-table.tsx:6` | main | You do — in person, on the phone, under pressure | You do: in person, on the phone, under pressure |
| 76 | `components/comparison-table.tsx:7` | main | We do — on your behalf, so you never have to | We do, on your behalf, so you never have to |
| 77 | `components/comparison-table.tsx:17` | main | Nothing — we never accept dealer compensation | Nothing. We never accept dealer compensation |
| 78 | `components/comparison-table.tsx:32` | main | Review real offers on your own time — no one standing over your shoulder | Review real offers on your own time, with no one standing over your shoulder |
| 83 | `components/email-capture.tsx:36` | main | Thanks — we&apos;ll be in touch. | Thanks! We&apos;ll be in touch. |
| 102 | `components/founder-story.tsx:16` | main | Car buying should be as exciting as the first test drive. But almost everyone I&apos;ve talked to — including myself — dreads the intense sales process: sitting across from a salesperson, feeling the clock tick, wondering if you&apos;re being steered toward the wrong deal, and having to make a big decision under pressure you didn&apos;t ask for. | Car buying should be as exciting as the first test drive. But almost everyone I&apos;ve talked to, myself included, dreads the intense sales process: sitting across from a salesperson, feeling the clock tick, wondering if you&apos;re being steered toward the wrong deal, and having to make a big decision under pressure you didn&apos;t ask for. |
| 103 | `components/founder-story.tsx:23` | main | That imbalance is the real problem. The dealer does this every day. You do it once every few years, if that. They hold the leverage — the information, the pressure, the home-field advantage — and you&apos;re left hoping you didn&apos;t overpay. | That imbalance is the real problem. The dealer does this every day. You do it once every few years, if that. They hold the leverage (the information, the pressure, the home-field advantage), and you&apos;re left hoping you didn&apos;t overpay. |
| 104 | `components/founder-story.tsx:28` | main | LEVR Auto exists to flip that. Tell us exactly what you want. We do the negotiating — the calls, the back-and-forth, the pressure — so you don&apos;t have to. You just review real offers on your own time and decide, with no one standing over your shoulder. | LEVR Auto exists to flip that. Tell us exactly what you want. We do the negotiating, from the calls to the back-and-forth and the pressure, so you don&apos;t have to. You just review real offers on your own time and decide, with no one standing over your shoulder. |
| 105 | `components/founder-story.tsx:35` | main | — Brett Johnston, Founder | Brett Johnston, Founder |
| 106 | `components/guarantee.tsx:29` | main | If we can&apos;t bring you at least one real offer below Total SRP — the full sticker price, including destination, before tax, title, and fees — within 30 days of your search going live, you get your $699 back. No questions asked. And you&apos;re never obligated to buy anything, even if we do find you a great deal. | If we can&apos;t bring you at least one real offer below Total SRP (the full sticker price, including destination, before tax, title, and fees) within 30 days of your search going live, you get your $699 back. No questions asked. And you&apos;re never obligated to buy anything, even if we do find you a great deal. |
| 107 | `components/hero.tsx:18` | main | Tell us the exact car you want. We reach out to dealers nationwide, and we negotiate every offer — so you never have to haggle. | Tell us the exact car you want. We reach out to dealers nationwide, and we negotiate every offer, so you never have to haggle. |
| 108 | `components/how-it-works.tsx:15` | main | As they come in — no waiting around, no sales calls to you. | As they come in, with no waiting around, no sales calls to you. |
| 109 | `components/how-it-works.tsx:19` | main | You pick the one you like — or none at all | You pick the one you like, or none at all |
| 110 | `components/intake-filter.tsx:537` | main | Make and model. You decide the car; we do the rest — trim, color, and options come right after checkout. | Make and model. You decide the car; we do the rest. Trim, color, and options come right after checkout. |
| 111 | `components/intake-filter.tsx:544` | main | — one vehicle, always | M: "Flat $699, one vehicle, always" (comma; the badge text before it is a separate node) |
| 112 | `components/intake-filter.tsx:557` | main | Not sure what you're looking for yet? Skip ahead — pay now and we'll help you decide together. | Not sure what you're looking for yet? Skip ahead: pay now and we'll help you decide together. |
| 113 | `components/intake-filter.tsx:644` | main | We search nationwide — this just helps us calibrate delivery estimates. | We search nationwide. This just helps us calibrate delivery estimates. |
| 149 | `components/pre-launch-banner.tsx:7` | main | — accounts and searches are saved for real, but payment and dealer outreach aren&apos;t live yet. | M: "…: accounts and searches are saved for real, but …" (colon after the bold lead-in) or a new sentence |
| 159 | `components/site-footer.tsx:34` | main | State availability rolling out — check back soon | State availability rolling out. Check back soon |
| 171 | `components/why-levr.tsx:10` | main | You know the cost upfront — no surprises. | You know the cost upfront. No surprises. |
| 172 | `components/why-levr.tsx:16` | main | We never accept compensation from dealers — our only revenue is the flat fee you pay us. | We never accept compensation from dealers. Our only revenue is the flat fee you pay us. |

## 2. FAQ

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 28 | `app/faq/page.tsx:5` | main | FAQ — LEVR Auto | FAQ \| LEVR Auto |
| 29 | `app/faq/page.tsx:20` | main | You tell us the exact new vehicle you want, and we reach out to dealers nationwide on your behalf — negotiating every offer. You review what we bring you and decide what to do next, no obligation either way. | You tell us the exact new vehicle you want, and we reach out to dealers nationwide on your behalf and negotiate every offer. You review what we bring you and decide what to do next, no obligation either way. |
| 30 | `app/faq/page.tsx:30` | main | Not yet. Right now LEVR Auto only searches and negotiates new vehicles — used and pre-owned inventory isn't part of the service today. | Not yet. Right now LEVR Auto only searches and negotiates new vehicles. Used and pre-owned inventory isn't part of the service today. |
| 31 | `app/faq/page.tsx:34` | main | A flat $699 fee, paid once you're ready to move forward. That's it — no hidden charges, no commission tacked onto your deal. | A flat $699 fee, paid once you're ready to move forward. That's it: no hidden charges, no commission tacked onto your deal. |
| 32 | `app/faq/page.tsx:38` | main | You do. Delivery, tax, title, and any dealer fees are part of the vehicle purchase and are paid directly by you, just like any car purchase. LEVR's only charge is our flat upfront service fee — we don't pay any fees ourselves anywhere in the process, and we don't take a commission or markup on your deal. | You do. Delivery, tax, title, and any dealer fees are part of the vehicle purchase and are paid directly by you, just like any car purchase. LEVR's only charge is our flat upfront service fee. We don't pay any fees ourselves anywhere in the process, and we don't take a commission or markup on your deal. |
| 33 | `app/faq/page.tsx:44` | main | Your total is the offer price, plus any add-ons you keep, plus delivery if you need it, plus your state's sales tax, title and registration, and the dealer's documentation fee. Doc fees vary by dealer and some states cap them — ask your agent for an out-the-door quote on any offer. | Your total is the offer price, plus any add-ons you keep, plus delivery if you need it, plus your state's sales tax, title and registration, and the dealer's documentation fee. Doc fees vary by dealer and some states cap them, so ask your agent for an out-the-door quote on any offer. |
| 34 | `app/faq/page.tsx:48` | main | Total Suggested Retail Price (Total SRP) is the full manufacturer-suggested price for your exact vehicle — the base price, plus any factory-installed options, plus the manufacturer's destination/delivery charge, all added together. This is the same "Total" figure printed on your vehicle's official window sticker, sometimes shown as a separate line from the base "Manufacturer's Suggested Retail Price." It doesn't include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own. Our guarantee always compares a dealer's offer against this full number — so you're never left guessing which figure on the sticker actually counts. | Total Suggested Retail Price (Total SRP) is the full manufacturer-suggested price for your exact vehicle: the base price, plus any factory-installed options, plus the manufacturer's destination/delivery charge, all added together. This is the same "Total" figure printed on your vehicle's official window sticker, sometimes shown as a separate line from the base "Manufacturer's Suggested Retail Price." It doesn't include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own. Our guarantee always compares a dealer's offer against this full number, so you're never left guessing which figure on the sticker actually counts. |
| 35 | `app/faq/page.tsx:52` | main | You get your full $699 back. Your 30-day guarantee window starts when your search goes live, and if it ends without a qualifying offer, we process your refund — no need to ask for it. | You get your full $699 back. Your 30-day guarantee window starts when your search goes live, and if it ends without a qualifying offer, we process your refund. No need to ask for it. |
| 36 | `app/faq/page.tsx:62` | main | Some tools can send messages to dealers for a few dollars a month — but sending a message isn't the same as getting you a result. LEVR Auto is done for you, start to finish: a real negotiation, real offers landing in your account, and a real person you can reach if something needs attention. And unlike a subscription, we put our fee on the line — if we can't bring you at least one real offer below Total SRP, you get your $699 back. | Some tools can send messages to dealers for a few dollars a month, but sending a message isn't the same as getting you a result. LEVR Auto is done for you, start to finish: a real negotiation, real offers landing in your account, and a real person you can reach if something needs attention. And unlike a subscription, we put our fee on the line: if we can't bring you at least one real offer below Total SRP, you get your $699 back. |
| 37 | `app/faq/page.tsx:66` | main | No. You can review every offer we bring you and decide not to move forward with any of them — the fee still covers the work we did on your behalf. | No. You can review every offer we bring you and decide not to move forward with any of them. The fee still covers the work we did on your behalf. |
| 38 | `app/faq/page.tsx:74` | main | No — that's the whole point. We handle the back-and-forth so you don't have to. | No, that's the whole point. We handle the back-and-forth so you don't have to. |
| 39 | `app/faq/page.tsx:82` | main | Not if you don't want to. The entire process — telling us what you want, reviewing offers, accepting a deal — can be completed online from start to finish. | Not if you don't want to. The entire process, from telling us what you want to reviewing offers and accepting a deal, can be completed online from start to finish. |
| 40 | `app/faq/page.tsx:87` | main | No — LEVR searches one make and model per engagement, for the flat $699 fee. You can rank more than one trim, color, and option when you finalize, at no extra cost — your agent works down your list. Once your search is live, offers are for those choices. Want a different vehicle instead? Your agent can switch your search (see below). | No. LEVR searches one make and model per engagement, for the flat $699 fee. You can rank more than one trim, color, and option when you finalize, at no extra cost, and your agent works down your list. Once your search is live, offers are for those choices. Want a different vehicle instead? Your agent can switch your search (see below). |
| 41 | `app/faq/page.tsx:100` | main | Yes — we reach out to dealers transparently on your behalf to request their best price on your exact vehicle. | Yes. We reach out to dealers transparently on your behalf to request their best price on your exact vehicle. |
| 42 | `app/faq/page.tsx:103` | main | How do you make money — are you paid by dealers? | How do you make money? Are you paid by dealers? |
| 43 | `app/faq/page.tsx:104` | main | No. We never accept compensation from dealers, ever. Our only revenue is the flat $699 fee you pay us — that's what lets us negotiate purely in your interest. | No. We never accept compensation from dealers, ever. Our only revenue is the flat $699 fee you pay us, and that's what lets us negotiate purely in your interest. |

## 3. Privacy and Terms

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 52 | `app/privacy/page.tsx:4` | main | Privacy Policy — LEVR Auto | Privacy Policy \| LEVR Auto |
| 53 | `app/privacy/page.tsx:26` | main | When you create an account, we collect your email address. Once you complete your account settings, we also collect your first and last name and phone number. We ask for your phone number because it&apos;s how we reach you — by email, text, or a phone call from your agent, depending on the contact preference you choose. | When you create an account, we collect your email address. Once you complete your account settings, we also collect your first and last name and phone number. We ask for your phone number because it&apos;s how we reach you: by email, text, or a phone call from your agent, depending on the contact preference you choose. |
| 54 | `app/privacy/page.tsx:47` | main | LEVR never processes or holds this deposit — it&apos;s paid directly from you to the dealer. | LEVR never processes or holds this deposit. It&apos;s paid directly from you to the dealer. |
| 55 | `app/privacy/page.tsx:66` | main | , to process your $699 search fee and any applicable extension or switch fees. LEVR does not store your card number — Stripe handles that directly. | , to process your $699 search fee and any applicable extension or switch fees. LEVR does not store your card number. Stripe handles that directly. |
| 56 | `app/privacy/page.tsx:71` | main | , to source real-time vehicle inventory and pricing. This is a one-way inventory lookup — only vehicle search criteria is sent, never any personal information about you. | , to source real-time vehicle inventory and pricing. This is a one-way inventory lookup: only vehicle search criteria is sent, never any personal information about you. |
| 57 | `app/privacy/page.tsx:81` | main | , to deliver transactional email — account confirmation, password reset, and search-related notices like renewal reminders. | , to deliver transactional email: account confirmation, password reset, and search-related notices like renewal reminders. |
| 58 | `app/privacy/page.tsx:90` | main | , but only once you&apos;ve accepted an offer — your contact information is not shared with a dealer before that point. | , but only once you&apos;ve accepted an offer. Your contact information is not shared with a dealer before that point. |
| 65 | `app/terms/page.tsx:4` | main | Terms of Service — LEVR Auto | Terms of Service \| LEVR Auto |

## 4. Sign-in, sign-up, password and unsubscribe pages

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 20 | `app/auth/callback/page.tsx:27` | main | `/login?error=${encodeURIComponent("Could not verify your email — try logging in.")}` | `/login?error=${encodeURIComponent("Could not verify your email. Try logging in.")}` |
| 21 | `app/auth/callback/page.tsx:34` | main | `/login?error=${encodeURIComponent("Could not verify your email — try logging in.")}` | `/login?error=${encodeURIComponent("Could not verify your email. Try logging in.")}` |
| 22 | `app/auth/confirm/page.tsx:55` | main | This link is invalid or has expired — request a new one. | This link is invalid or has expired. Request a new one. |
| 23 | `app/auth/confirm/page.tsx:73` | main | This link is invalid or has expired — request a new one. | This link is invalid or has expired. Request a new one. |
| 24 | `app/auth/reset-password/page.tsx:50` | main | This reset link is invalid or has expired — request a new one. | This reset link is invalid or has expired. Request a new one. |
| 25 | `app/auth/reset-password/page.tsx:60` | main | This reset link is invalid or has expired — request a new one. | This reset link is invalid or has expired. Request a new one. |
| 26 | `app/auth/reset-password/page.tsx:92` | main | Something went wrong — try requesting a new reset link. | Something went wrong. Try requesting a new reset link. |
| 27 | `app/auth/reset-password/page.tsx:96` | main | `/login?message=${encodeURIComponent("Password updated — log in with your new password.")}` | `/login?message=${encodeURIComponent("Password updated. Log in with your new password.")}` |
| 45 | `app/forgot-password/page.tsx:7` | main | Forgot Password — LEVR Auto | Forgot Password \| LEVR Auto |
| 48 | `app/login/page.tsx:7` | main | Log In — LEVR Auto | Log In \| LEVR Auto |
| 59 | `app/signup/page.tsx:6` | main | Sign Up — LEVR Auto | Sign Up \| LEVR Auto |
| 66 | `app/unsubscribe/page.tsx:6` | main | Unsubscribe — LEVR Auto | Unsubscribe \| LEVR Auto |

## 5. Matchmaker

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 49 | `app/matchmaker/page.tsx:6` | main | Vehicle Matchmaker — LEVR Auto | Vehicle Matchmaker \| LEVR Auto |
| 114 | `components/matchmaker.tsx:146` | main | Both years is the default — pick one to narrow it down. | Both years is the default. Pick one to narrow it down. |
| 115 | `components/matchmaker.tsx:160` | main | Drag both ends to set your range — or leave it wide open. | Drag both ends to set your range, or leave it wide open. |
| 116 | `components/matchmaker.tsx:166` | main | Drag to reorder — most important at the top. | Drag to reorder, most important at the top. |
| 117 | `components/matchmaker.tsx:680` | main | Placeholder visual — real artwork coming soon | Placeholder visual. Real artwork coming soon |
| 118 | `components/matchmaker.tsx:700` | main | Shape swaps with vehicle type, color with powertrain, size with passengers — building live as you answer. | Shape swaps with vehicle type, color with powertrain, size with passengers, building live as you answer. |
| 119 | `components/matchmaker.tsx:834` | main | Change anything below — the list updates live. | Change anything below and the list updates live. |
| 120 | `components/matchmaker.tsx:897` | main | Drag to reorder — most important at the top. | Drag to reorder, most important at the top. |
| 121 | `components/matchmaker.tsx:1312` | main | `{v.trim} — {v.drivetrain ?? "—"} — {formatPriceEstimate(v.trueStartingPriceCents)}` | M (3 hits on one line): "{trim} · {drivetrain} · {price}", leaving out the drivetrain part when it's unknown instead of showing "—" |
| 122 | `components/matchmaker.tsx:1312` | main | `{v.trim} — {v.drivetrain ?? "—"} — {formatPriceEstimate(v.trueStartingPriceCents)}` | M: same line as above |
| 123 | `components/matchmaker.tsx:1312` | main | `{v.trim} — {v.drivetrain ?? "—"} — {formatPriceEstimate(v.trueStartingPriceCents)}` | M: same line as above |
| 124 | `components/matchmaker.tsx:1830` | main | Real vehicle data — not live inventory | Real vehicle data, not live inventory |
| 125 | `components/matchmaker.tsx:1839` | main | Dismiss what doesn&apos;t fit, mark what you&apos;re interested in — this narrows the list live. | Dismiss what doesn&apos;t fit, mark what you&apos;re interested in. This narrows the list live. |
| 126 | `components/matchmaker.tsx:1851` | main | Each type is ranked separately — scores compare vehicles of the same type. | Each type is ranked separately. Scores compare vehicles of the same type. |
| 127 | `components/matchmaker.tsx:1934` | main | Try widening your price range or riders — adjust any answer alongside the list. | Try widening your price range or riders, or adjust any answer alongside the list. |
| 128 | `components/matchmaker.tsx:1945` | main | Get started and we&apos;ll build your real search — we&apos;ll carry over the vehicle you picked. | Get started and we&apos;ll build your real search, and we&apos;ll carry over the vehicle you picked. |
| 129 | `components/matchmaker.tsx:2421` | main | `{variant.trim} — {variant.drivetrain ?? "—"}` | M (2 hits): "{trim} · {drivetrain}", leaving out the drivetrain when unknown |
| 130 | `components/matchmaker.tsx:2421` | main | `{variant.trim} — {variant.drivetrain ?? "—"}` | M: same line as above |
| 131 | `components/matchmaker.tsx:2422` | main | ` — ${variant.fuelType ?? "—"}` | M: " · {fuel type}", left out when unknown |
| 132 | `components/matchmaker.tsx:2482` | main | `—` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 133 | `components/matchmaker.tsx:2765` | main | `—` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 134 | `components/matchmaker.tsx:3552` | main | Real vehicle data — not yet connected to live dealer inventory | Real vehicle data, not yet connected to live dealer inventory |
| 135 | `components/matchmaker.tsx:3571` | main | Skip the quiz — compare specific vehicles | Skip the quiz and compare specific vehicles |
| 169 | `components/vehicle-detail-modal.tsx:224` | main | `{vehicle.bodyStyle} · {vehicle.fuelType ?? "—"}` | M: "{body style} · {fuel type}", leaving out the fuel type when unknown |
| 170 | `components/vehicle-detail-modal.tsx:417` | main | Shown above is a general sample video, not a review of this specific vehicle — per-vehicle videos aren&apos;t sourced yet. Full spec sheets will show up here once Matchmaker connects to live dealer inventory. | Shown above is a general sample video, not a review of this specific vehicle. Per-vehicle videos aren&apos;t sourced yet. Full spec sheets will show up here once Matchmaker connects to live dealer inventory. |
| 189 | `lib/matchmaker-explain.ts:72` | main | `Ranked #${position} mainly for ${names} — ${priorityPhrase(picks.map((p) => p.position))}.` | `Ranked #${position} mainly for ${names}: ${priorityPhrase(picks.map((p) => p.position))}.` |

## 6. Review your search, payment and pickup range

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 50 | `app/payment/success/page.tsx:8` | main | Payment Received — LEVR Auto | Payment Received \| LEVR Auto |
| 51 | `app/payment/success/page.tsx:68` | main | If you completed checkout, this can take a moment to sync — check your | If you completed checkout, this can take a moment to sync. Check your |
| 153 | `components/review-and-pay.tsx:43` | main | Offers land in your account — accept one or pass. You're never obligated to buy. | Offers land in your account. Accept one or pass. You're never obligated to buy. |
| 154 | `components/review-and-pay.tsx:44` | main | A flat $699 — no commission, no markup. | A flat $699, with no commission, no markup. |
| 155 | `components/review-and-pay.tsx:53` | main | `Continue to payment — $${FLAT_PRICE}` | `Continue to payment: $${FLAT_PRICE}` |
| 156 | `components/review-and-pay.tsx:258` | main | `{ label: COPY.modelYear, value: search.modelYear != null ? String(search.modelYear) : "—" },` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 157 | `components/review-and-pay.tsx:259` | main | `{ label: COPY.zip, value: search.zip ?? "—" },` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 158 | `components/review-and-pay.tsx:260` | main | `{ label: COPY.pickup, value: travelValueLabel(search.pickupTravel) ?? "—" },` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 185 | `lib/inventory-block-copy.ts:24` | main | `We don't have any ${year} ${make} ${model} listings at the moment, so there's nothing for us to search yet. ${others} models are available — you can change your model year below, or choose a different vehicle. Changes are free until your search starts.` | `We don't have any ${year} ${make} ${model} listings at the moment, so there's nothing for us to search yet. ${others} models are available. You can change your model year below, or choose a different vehicle. Changes are free until your search starts.` |
| 186 | `lib/inventory-block-copy.ts:33` | main | Blocked — no inventory for the committed vehicle | Blocked: no inventory for the committed vehicle |
| 187 | `lib/inventory-radius.ts:15` | main | None found near you yet — we search dealers nationwide. | None found near you yet. We search dealers nationwide. |
| 188 | `lib/inventory-radius.ts:16` | main | `${count.toLocaleString()} found within ${INVENTORY_RADIUS_MILES} miles of you so far — and we search dealers nationwide.` | `${count.toLocaleString()} found within ${INVENTORY_RADIUS_MILES} miles of you so far, and we search dealers nationwide.` |
| 205 | `lib/payment-actions.ts:60` | main | LEVR Auto — Vehicle Search | LEVR Auto: Vehicle Search |
| 206 | `lib/pickup-travel.ts:25` | main | We look for deals at dealers everywhere. This is just how far you'd drive to pick one up — if the best deal is farther away, we'll get you a delivery estimate. | We look for deals at dealers everywhere. This is just how far you'd drive to pick one up. If the best deal is farther away, we'll get you a delivery estimate. |
| 207 | `lib/pickup-travel.ts:29` | main | Changing this doesn't start a new search — we're already looking everywhere. It decides which offers you'd pick up and which would be delivered. | Changing this doesn't start a new search. We're already looking everywhere. It decides which offers you'd pick up and which would be delivered. |
| 208 | `lib/pickup-travel.ts:37` | main | It depends — case by case | It depends, case by case |
| 209 | `lib/pickup-travel.ts:130` | main | `${roundMiles(distanceMiles)} miles away — farther than the ${travelMiles} miles you'd drive, so this one would be delivered. Delivery may cost extra.` | `${roundMiles(distanceMiles)} miles away, farther than the ${travelMiles} miles you'd drive, so this one would be delivered. Delivery may cost extra.` |
| 210 | `lib/pickup-travel.ts:165` | main | LEVR doesn't arrange delivery in-house yet — your agent will get a delivery estimate from the dealer, and you and the dealer will set up shipping directly. | LEVR doesn't arrange delivery in-house yet. Your agent will get a delivery estimate from the dealer, and you and the dealer will set up shipping directly. |

## 7. Finalize (trim, colour, interior, features, review) and trim comparison

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 44 | `app/finalize/[searchId]/page.tsx:10` | main | Finalize Your Search — LEVR Auto | Finalize Your Search \| LEVR Auto |
| 79 | `components/configurator-questions.tsx:118` | main | — also includes | M: "{package}. Also includes …" or "{package}, also includes …" (comma) |
| 80 | `components/configurator-questions.tsx:120` | main | `<> — {CONTENTS_NOT_LISTED.toLowerCase()}</>` | M: "{package}: {contents not listed}" (colon) |
| 81 | `components/configurator-questions.tsx:427` | main | — unavailable, not offered by your currently-ranked trim(s) | M: "(unavailable: not offered by your currently-ranked trim(s)" or a comma: ", unavailable, not offered by …" |
| 82 | `components/configurator-questions.tsx:428` | main | ` — available on ${conflict.offeringTrimLabel}` | `; available on ${conflict.offeringTrimLabel}` |
| 86 | `components/finalize-choice.tsx:120` | main | We&apos;ve got your request — an agent will reach out. | We&apos;ve got your request. An agent will reach out. |
| 87 | `components/finalize-choice.tsx:151` | main | Payment received — let&apos;s finalize your | Payment received. Let&apos;s finalize your |
| 88 | `components/finalize-choice.tsx:166` | main | — takes a few minutes. | M: "… Takes a few minutes." (new sentence) or "(takes a few minutes)" |
| 89 | `components/finalize-choice.tsx:180` | main | Talk it through with your assigned agent — we'll reach out to set it up. | Talk it through with your assigned agent. We'll reach out to set it up. |
| 90 | `components/finalize-choice.tsx:203` | main | Once you finalize — either way — you&apos;ll have 24 hours to change your mind before we start reaching out to dealers. | Whichever you choose, once you finalize you&apos;ll have 24 hours to change your mind before we start reaching out to dealers. |
| 91 | `components/finalize-self-service.tsx:701` | main | You made your decision today. We&apos;ll begin the search tomorrow. If you wake up wanting to change something, now&apos;s the time — you have 24 hours to edit this from your account. | You made your decision today. We&apos;ll begin the search tomorrow. If you wake up wanting to change something, now&apos;s the time: you have 24 hours to edit this from your account. |
| 92 | `components/finalize-self-service.tsx:743` | main | Cancel — keep my current choices | Cancel and keep my current choices |
| 93 | `components/finalize-self-service.tsx:783` | main | Rank them in the order you'd like us to search — we'll work down your list. Mark anything you'd exclude, and leave the rest alone. | Rank them in the order you'd like us to search, and we'll work down your list. Mark anything you'd exclude, and leave the rest alone. |
| 94 | `components/finalize-self-service.tsx:863` | main | We haven&apos;t synced live inventory for this one yet, so there&apos;s nothing to rank here. We&apos;ll search every trim — you can narrow it down later from your account. | We haven&apos;t synced live inventory for this one yet, so there&apos;s nothing to rank here. We&apos;ll search every trim, and you can narrow it down later from your account. |
| 95 | `components/finalize-self-service.tsx:994` | main | These aren't included by default. Some only come bundled as a package — pick one and you're getting everything included with it. Rank what you want, or flag what you don't. Skipping this is fine. | These aren't included by default. Some only come bundled as a package. Pick one and you're getting everything included with it. Rank what you want, or flag what you don't. Skipping this is fine. |
| 96 | `components/finalize-self-service.tsx:1026` | main | Pick as many as you&apos;re open to — more options means faster offers. | Pick as many as you&apos;re open to. More options means faster offers. |
| 97 | `components/finalize-self-service.tsx:1053` | main | Optional — leave blank if you&apos;re flexible. | Optional. Leave blank if you&apos;re flexible. |
| 98 | `components/finalize-self-service.tsx:1136` | main | No color or feature preferences — flexible. | No color or feature preferences. Flexible. |
| 99 | `components/finalize-self-service.tsx:1156` | main | , isn&apos;t offered on any of your ranked trims — | , isn&apos;t offered on any of your ranked trims. |
| 100 | `components/finalize-self-service.tsx:1165` | main | None of your ranked colors/interiors/features exist together on a single real car among your ranked trims. We&apos;ll search flexibly, but can&apos;t promise all of these together — you may want to revisit your rankings. | None of your ranked colors/interiors/features exist together on a single real car among your ranked trims. We&apos;ll search flexibly, but can&apos;t promise all of these together, so you may want to revisit your rankings. |
| 101 | `components/finalize-self-service.tsx:1211` | main | You'll have 24 hours after confirming to change any of this from your account — after that, we lock it in and start reaching out to dealers. | You'll have 24 hours after confirming to change any of this from your account. After that, we lock it in and start reaching out to dealers. |
| 151 | `components/ranking-question.tsx:145` | main | Everything's been excluded — use Undo below to bring something back. | Everything's been excluded. Use Undo below to bring something back. |
| 152 | `components/ranking-question.tsx:146` | main | Nothing ranked yet — tap an option below to start your list. | Nothing ranked yet. Tap an option below to start your list. |
| 162 | `components/trim-comparison-modal.tsx:369` | main | `return n > 0 ? plural(n, "color") : "—";` | M: placeholder (collapsed comparison summary). See "Placeholder dashes" below |
| 163 | `components/trim-comparison-modal.tsx:373` | main | `return n > 0 ? plural(n, "option") : "—";` | M: same as above |
| 164 | `components/trim-comparison-modal.tsx:392` | main | `return n > 0 ? plural(n, "spec") : "—";` | M: same as above |
| 165 | `components/trim-comparison-modal.tsx:398` | main | `return n > 0 ? `${n} obtainable` : "—";` | M: same as above |
| 166 | `components/trim-comparison-modal.tsx:424` | main | Ranking or excluding a trim here saves it immediately — the same as using the list below. | Ranking or excluding a trim here saves it immediately, the same as using the list below. |
| 167 | `components/trim-detail-modal.tsx:236` | main | &apos;s own configurator — no exact colour, interior, or feature options to show. It&apos;s still fully searchable, just without that extra detail. | &apos;s own configurator, so there are no exact colour, interior, or feature options to show. It&apos;s still fully searchable, just without that extra detail. |
| 168 | `components/trim-detail-modal.tsx:458` | main | &apos;s own configurator — no exact colour, interior, or feature options to show. It&apos;s still fully searchable, just without that extra detail. | &apos;s own configurator, so there are no exact colour, interior, or feature options to show. It&apos;s still fully searchable, just without that extra detail. |
| 174 | `lib/configurator-matching.ts:752` | main | `Previously ranked #${previousRank} — not offered on your currently-selected trims. Available on ${offeringNames.join(", ")}.` | `Previously ranked #${previousRank}. Not offered on your currently-selected trims. Available on ${offeringNames.join(", ")}.` |
| 175 | `lib/configurator-matching.ts:753` | main | `Previously ranked #${previousRank} — not offered on any trim currently available for this model.` | `Previously ranked #${previousRank}. Not offered on any trim currently available for this model.` |
| 176 | `lib/configurator-matching.ts:755` | main | `Not offered on any of your selected trims — available on ${offeringNames.join(", ")}. Add it to your ranking to select this.` | `Not offered on any of your selected trims. Available on ${offeringNames.join(", ")}. Add it to your ranking to select this.` |
| 177 | `lib/configurator-matching.ts:950` | main | `${c.trim} — ${colorLabel} / ${interiorLabel}${c.seating ? ` / ${c.seating}` : ""}` | `${c.trim}: ${colorLabel} / ${interiorLabel}${c.seating ? ` / ${c.seating}` : ""}` |
| 224 | `lib/trim-comparison.ts:44` | main | `export const DASH: ComparisonCell = { text: "—", tone: "none" };` | M: placeholder (comparison cells). See "Placeholder dashes" below |

## 8. Account, Your Car, search status, extend, switch and cancel

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 7 | `app/account/page.tsx:30` | main | Your Account — LEVR Auto | Your Account \| LEVR Auto |
| 8 | `app/account/page.tsx:63` | main | `Auto-renew is on — your card will be charged $100 in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} to keep this search active.` | `Auto-renew is on. Your card will be charged $100 in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} to keep this search active.` |
| 9 | `app/account/page.tsx:321` | main | `${search.make} ${search.model}${search.trim ? ` — ${search.trim}` : ""}` | `${search.make} ${search.model}${search.trim ? ` ${search.trim}` : ""}` |
| 10 | `app/account/page.tsx:370` | main | — an agent will reach out to finalize the details. | M: "…requested a call. An agent will reach out to finalize the details." (sentence break; see the line before it in account/page.tsx) |
| 11 | `app/account/page.tsx:453` | main | — view your deal → | M: "… View your deal →" (start a new sentence after the preceding text) |
| 12 | `app/account/vehicle/page.tsx:24` | main | Your Car — LEVR Auto | Your Car \| LEVR Auto |
| 13 | `app/account/vehicle/page.tsx:242` | main | `{details.trim ? <span className="text-zinc-400"> — {details.trim}</span> : null}` | M: {make} {model} {trim}, plain space, no dash |
| 14 | `app/account/vehicle/page.tsx:248` | main | Trim — search order | Trim (search order) |
| 15 | `app/account/vehicle/page.tsx:278` | main | No specific preferences on file — any trim, color, or option is fine. | No specific preferences on file. Any trim, color, or option is fine. |
| 62 | `app/switch/success/page.tsx:8` | main | Switch Confirmed — LEVR Auto | Switch Confirmed \| LEVR Auto |
| 63 | `app/switch/success/page.tsx:74` | main | Payment confirmed — finishing your switch | Payment confirmed. Finishing your switch |
| 64 | `app/switch/success/page.tsx:95` | main | If you completed checkout, this can take a moment to sync — check your | If you completed checkout, this can take a moment to sync. Check your |
| 67 | `components/account-faq-section.tsx:37` | main | Switching to a different make/model is handled by your LEVR agent, not self-service — it closes out your current search and starts a fresh 30-day guarantee window when the new search goes live (a $100 fee applies). | Switching to a different make/model is handled by your LEVR agent, not self-service. It closes out your current search and starts a fresh 30-day guarantee window when the new search goes live (a $100 fee applies). |
| 68 | `components/account-settings-form.tsx:23` | main | Add another way to reach you before turning this one off — we need at least one. | Add another way to reach you before turning this one off. We need at least one. |
| 71 | `components/auto-renew-toggle.tsx:38` | main | Automatic extensions are on — we&apos;ll charge $100 to keep this search going every 30 days. | Automatic extensions are on. We&apos;ll charge $100 to keep this search going every 30 days. |
| 72 | `components/cancellation-choice.tsx:62` | main | Request received. Our team&apos;s been notified and will reach out to discuss your requested change as soon as possible. We&apos;re actively working deals for you and every other LEVR customer right now, so thanks for your patience — you&apos;ll hear from us soon. | Request received. Our team&apos;s been notified and will reach out to discuss your requested change as soon as possible. We&apos;re actively working deals for you and every other LEVR customer right now, so thanks for your patience. You&apos;ll hear from us soon. |
| 73 | `components/cancellation-choice.tsx:74` | main | Before anything final, talk it through with an agent — request a call and we&apos;ll see what we can do for you, including whether a refund makes sense given your situation. | Before anything final, talk it through with an agent. Request a call and we&apos;ll see what we can do for you, including whether a refund makes sense given your situation. |
| 74 | `components/cancellation-choice.tsx:78` | main | Prefer to just cancel outright? That&apos;s available too — this ends your search for good, without refund. | Prefer to just cancel outright? That&apos;s available too. This ends your search for good, without refund. |
| 84 | `components/extend-search-button.tsx:51` | main | Also enable automatic extensions — we&apos;ll save this card and automatically charge $100 every 30 days if the search is about to pause, so it never stops on its own. You can turn this off anytime from your account page. | Also enable automatic extensions. We&apos;ll save this card and automatically charge $100 every 30 days if the search is about to pause, so it never stops on its own. You can turn this off anytime from your account page. |
| 85 | `components/extend-search-button.tsx:63` | main | Extend now — $100 | Extend now: $100 |
| 150 | `components/purchased-celebration.tsx:20` | main | This search is complete — your | M: "This search is complete. Your …" |
| 160 | `components/switch-choice.tsx:131` | main | Request received. Our team&apos;s been notified and will reach out to discuss your requested change as soon as possible. We&apos;re actively working deals for you and every other LEVR customer right now, so thanks for your patience — you&apos;ll hear from us soon. | Request received. Our team&apos;s been notified and will reach out to discuss your requested change as soon as possible. We&apos;re actively working deals for you and every other LEVR customer right now, so thanks for your patience. You&apos;ll hear from us soon. |
| 161 | `components/switch-choice.tsx:150` | main | Not carry over any offer already found on your current vehicle — the guarantee starts clean against your new pick | Not carry over any offer already found on your current vehicle. The guarantee starts clean against your new pick |
| 173 | `lib/account-settings-actions.ts:57` | main | Pick at least one way for us to reach you — email is the safest default. | Pick at least one way for us to reach you. Email is the safest default. |
| 181 | `lib/extension-actions.ts:56` | main | This search can't be extended right now — contact your agent. | This search can't be extended right now. Contact your agent. |
| 182 | `lib/extension-actions.ts:63` | main | `This search was paused more than ${RESUME_WINDOW_DAYS} days ago and can no longer be resumed automatically — contact your agent.` | `This search was paused more than ${RESUME_WINDOW_DAYS} days ago and can no longer be resumed automatically. Contact your agent.` |
| 183 | `lib/extension-actions.ts:119` | main | LEVR Auto — Search Extension | LEVR Auto: Search Extension |
| 184 | `lib/guarantee-timeline.ts:47` | main | `Guarantee delivered ${formatLongDate(date)} — you received an offer below Total SRP.` | `Guarantee delivered ${formatLongDate(date)}: you received an offer below Total SRP.` |
| 211 | `lib/progress-note.ts:49` | main | Your search is live — your agent is lining up dealer outreach. | Your search is live. Your agent is lining up dealer outreach. |
| 212 | `lib/progress-note.ts:50` | main | Your search is in progress — we'll post offers here as they come in. | Your search is in progress. We'll post offers here as they come in. |
| 213 | `lib/search-status-copy.ts:30` | main | Payment received — finalize trim, color, and options to start your search. | Payment received. Finalize trim, color, and options to start your search. |
| 214 | `lib/search-status-copy.ts:32` | main | Finalized — you're in the 24-hour window to change trim, color, or options before dealer outreach begins. | Finalized. You're in the 24-hour window to change trim, color, or options before dealer outreach begins. |
| 215 | `lib/search-status-copy.ts:33` | main | Actively searching — we'll show new offers here as they come in. | Actively searching. We'll show new offers here as they come in. |
| 216 | `lib/search-status-copy.ts:44` | main | This search is complete — you purchased your vehicle. | This search is complete. You purchased your vehicle. |
| 217 | `lib/search-status-copy.ts:50` | main | Not paid yet — this search starts once you complete payment. | Not paid yet. This search starts once you complete payment. |
| 218 | `lib/search-status-copy.ts:75` | main | `Your search is paused. You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to resume it by extending — after that, you'll need to start a new search.` | `Your search is paused. You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to resume it by extending. After that, you'll need to start a new search.` |
| 219 | `lib/search-status-copy.ts:81` | main | We're finding the right vehicle for you — your agent will reach out soon to talk through what you're looking for. | We're finding the right vehicle for you. Your agent will reach out soon to talk through what you're looking for. |
| 220 | `lib/switch-self-service-actions.ts:196` | main | This switch is no longer free — the $100 switch fee applies. | This switch is no longer free. The $100 switch fee applies. |
| 221 | `lib/switch-self-service-actions.ts:291` | main | This switch is actually free — go back and confirm the free switch instead. | This switch is actually free. Go back and confirm the free switch instead. |
| 222 | `lib/switch-self-service-actions.ts:312` | main | LEVR Auto — Switch Fee | LEVR Auto: Switch Fee |

## 9. Your Deal, offers and messages

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 0 | `app/account/deal/page.tsx:46` | main | Your Deal — LEVR Auto | Your Deal \| LEVR Auto |
| 1 | `app/account/deal/page.tsx:272` | main | `{deal.trim ? <span className="text-zinc-400"> — {deal.trim}</span> : null}` | M: {make} {model} {trim}, plain space, no dash (e.g. "Toyota Camry LE") |
| 2 | `app/account/deal/page.tsx:329` | main | received — lowest | received, lowest |
| 3 | `app/account/messages/[offerId]/page.tsx:14` | main | Messages — LEVR Auto | Messages \| LEVR Auto |
| 4 | `app/account/messages/[offerId]/page.tsx:72` | main | No messages yet. Ask your agent anything about this offer — they&apos;ll reply here. | No messages yet. Ask your agent anything about this offer and they&apos;ll reply here. |
| 5 | `app/account/messages/general/page.tsx:13` | main | Messages — LEVR Auto | Messages \| LEVR Auto |
| 6 | `app/account/messages/page.tsx:11` | main | Messages — LEVR Auto | Messages \| LEVR Auto |
| 136 | `components/offer-card.tsx:30` | main | Removal requested — waiting on the dealer | Removal requested, waiting on the dealer |
| 137 | `components/offer-card.tsx:125` | main | — Total Suggested Retail Price: | M: "… · Total Suggested Retail Price: $X" or start a new line for it |
| 138 | `components/offer-card.tsx:164` | main | — status: | M: "… · Status: …" |
| 139 | `components/offer-card.tsx:202` | main | `{addon.description} — {formatCents(addon.amountCents)}` | M: "{add-on}: {amount}" (colon) |
| 140 | `components/offer-card.tsx:223` | main | Congratulations — next steps | Congratulations! Next steps |
| 141 | `components/offer-card.tsx:233` | main | A deposit is paid directly to the dealer to reserve the car — we'll show it here once the dealer confirms they've received it. | A deposit is paid directly to the dealer to reserve the car. We'll show it here once the dealer confirms they've received it. |
| 142 | `components/offer-detail-modal.tsx:52` | main | No messages yet. Ask your agent anything about this offer — they'll reply here. | No messages yet. Ask your agent anything about this offer and they'll reply here. |
| 143 | `components/offer-detail-modal.tsx:223` | main | — Total Suggested Retail Price: | M: "… · Total Suggested Retail Price: $X" |
| 144 | `components/offer-detail-modal.tsx:343` | main | `{addon.description} — {formatCents(addon.amountCents)}` | M: "{add-on}: {amount}" (colon) |
| 145 | `components/offer-detail-modal.tsx:550` | main | Stock photo of this color — not the dealer&apos;s actual car | Stock photo of this color, not the dealer&apos;s actual car |
| 146 | `components/offer-map-view.tsx:90` | main | `<span className="text-sm font-semibold text-white">{travelValueLabel(shown) ?? "—"}</span>` | M: placeholder for a missing value. See "Placeholder dashes" below |
| 147 | `components/offer-map.tsx:307` | main | `{p.dealerName} — {formatCents(p.priceCents)}` | M: "{dealer}: {price}" (map pin label) |
| 197 | `lib/offer-comparison-rows.ts:57` | offer-entry | New to LEVR — no rating yet | New to LEVR, no rating yet |
| 198 | `lib/offer-comparison-rows.ts:64` | offer-entry | `const DASH = "—";` | M: placeholder (comparison cells). See "Placeholder dashes" below |
| 199 | `lib/offer-customer-copy.ts:7` | offer-entry | Out-the-door quote requested — you can accept once it arrives. | Out-the-door quote requested. You can accept once it arrives. |
| 200 | `lib/offer-customer-copy.ts:13` | offer-entry | New to LEVR — no rating yet | New to LEVR, no rating yet |
| 201 | `lib/offer-message-actions.ts:284` | main | The customer changed this since the page loaded — refresh to see the latest. | The customer changed this since the page loaded. Refresh to see the latest. |
| 202 | `lib/offer-messages-shared.ts:60` | main | No messages yet. Ask your agent anything about your search — they'll reply here. | No messages yet. Ask your agent anything about your search and they'll reply here. |
| 203 | `lib/offer-price-copy.ts:5` | main | This is the dealer's price for the car, negotiated by your agent. It doesn't include sales tax, title and registration, the dealer's documentation fee, or any add-ons listed below — those depend on your state and the dealer. | This is the dealer's price for the car, negotiated by your agent. It doesn't include sales tax, title and registration, the dealer's documentation fee, or any add-ons listed below. Those depend on your state and the dealer. |
| 223 | `lib/tester-sample-offers.ts:37` | main | Sample offer (outside tester round) — not a real dealer quote. | Sample offer (outside tester round), not a real dealer quote. |

## 10. Emails and e-sign

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 178 | `lib/day60-extension.ts:130` | main | `<p>Your LEVR Auto search for a ${search.make} ${search.model} has auto-renew turned on — ` | `<p>Your LEVR Auto search for a ${search.make} ${search.model} has auto-renew turned on, so ` |
| 179 | `lib/day60-extension.ts:139` | main | — we will be unable to continue searching for new offers unless you extend. Extending is easy: | M: "Your LEVR Auto search for a {make} {model} will stop on {date}. We will be unable to continue searching for new offers unless you extend." (approved Day-60 reminder email; wording change needs your OK) |
| 180 | `lib/day60-extension.ts:462` | main | Your paused search will end soon — extend now | Your paused search will end soon. Extend now |
| 190 | `lib/notification-digest.ts:174` | main | `${o.dealer_name} — ${vehicle}` | `${o.dealer_name}: ${vehicle}` |
| 191 | `lib/notifications.ts:107` | main | `<p>Good news — ${d.dealerName} sent over a new offer: ${formatPriceCents(d.offerPriceCents)}. Log into your account to review the details and decide what's next.</p>` | `<p>Good news! ${d.dealerName} sent over a new offer: ${formatPriceCents(d.offerPriceCents)}. Log into your account to review the details and decide what's next.</p>` |
| 192 | `lib/notifications.ts:119` | main | `<p>You accepted the offer from ${d.dealerName} — nice! Your agent will be in touch to help close things out.</p>` | `<p>You accepted the offer from ${d.dealerName}. Nice! Your agent will be in touch to help close things out.</p>` |
| 193 | `lib/notifications.ts:120` | main | `<p>Got it — you declined the offer from ${d.dealerName}. We'll keep searching for a better fit.</p>` | `<p>Got it. You declined the offer from ${d.dealerName}. We'll keep searching for a better fit.</p>` |
| 194 | `lib/notifications.ts:129` | main | `<p>${d.dealerName} just reconfirmed your vehicle is still available — you're on track.</p>` | `<p>${d.dealerName} just reconfirmed your vehicle is still available, so you're on track.</p>` |
| 195 | `lib/notifications.ts:137` | main | `<p>Your purchase from ${d.dealerName} is confirmed. Congratulations — we hope you love it.</p>` | `<p>Your purchase from ${d.dealerName} is confirmed. Congratulations! We hope you love it.</p>` |
| 196 | `lib/notifications.ts:168` | main | `<p>You received an offer below Total SRP within 30 days of your search going live — your guarantee is met. We'll keep working your search through ${through}.</p>` | `<p>You received an offer below Total SRP within 30 days of your search going live, so your guarantee is met. We'll keep working your search through ${through}.</p>` |
| 204 | `lib/pandadoc/client.ts:58` | main | `LEVR Auto Service Agreement — ${input.email}` | `LEVR Auto Service Agreement (${input.email})` |
| 225 | `lib/unpaid-reminders.ts:94` | main | `You started a LEVR Auto search for a ${vehicle} but haven't paid yet. Your choices are saved — pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.` | `You started a LEVR Auto search for a ${vehicle} but haven't paid yet. Your choices are saved. Pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.` |
| 226 | `lib/unpaid-reminders.ts:95` | main | `You started your LEVR Auto search but haven't paid yet. Your choices are saved — pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.` | `You started your LEVR Auto search but haven't paid yet. Your choices are saved. Pick up where you left off and pay the flat $${FLAT_PRICE} fee to start your search.` |
| 227 | `lib/unpaid-reminders.ts:98` | main | `${decided ? `Your ${vehicle} search` : "Your LEVR Auto search"} is still saved. Once you pay the flat $${FLAT_PRICE} fee, your LEVR agent starts negotiating with dealers nationwide — and if we don't bring you at least one real offer below Total SRP within 30 days of your search going live, you get your $${FLAT_PRICE} back.` | `${decided ? `Your ${vehicle} search` : "Your LEVR Auto search"} is still saved. Once you pay the flat $${FLAT_PRICE} fee, your LEVR agent starts negotiating with dealers nationwide. If we don't bring you at least one real offer below Total SRP within 30 days of your search going live, you get your $${FLAT_PRICE} back.` |

## 11. Post-deal survey

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 60 | `app/survey/[surveyId]/page.tsx:8` | main | How was your experience? — LEVR Auto | How was your experience? \| LEVR Auto |
| 61 | `app/survey/[surveyId]/page.tsx:66` | main | Thanks — we already have your feedback on this one, and responses can&apos;t be edited after submitting. | Thanks! We already have your feedback on this one, and responses can&apos;t be edited after submitting. |
| 148 | `components/post-deal-survey-form.tsx:129` | main | Internal only — never shared with the dealership. | Internal only. Never shared with the dealership. |

## 12. Articles pages

| # | File:line | Branch | Current | Proposed |
|---|---|---|---|---|
| 16 | `app/articles/[slug]/page.tsx:59` | main | `${article.title} — LEVR Auto` | `${article.title} \| LEVR Auto` |
| 17 | `app/articles/page.tsx:6` | main | Articles — LEVR Auto | Articles \| LEVR Auto |
| 18 | `app/articles/page.tsx:27` | main | Straight answers on car buying, pricing, and negotiation — no dealer spin. | Straight answers on car buying, pricing, and negotiation, with no dealer spin. |
| 19 | `app/articles/page.tsx:32` | main | Nothing published yet — check back soon. | Nothing published yet. Check back soon. |

## 14. Article and social generator prompts

The prompts in `src/lib/article-generation.ts` and `src/lib/social-generation.ts` use em dashes throughout (mostly "X — short and punchy", "Facebook — conversational"), and models copy the style of their prompt. Proposal, in two parts (both change approved prompts, so both need Brett's sign-off):
1. **Add one rule to every generation and caption prompt:** "Never use em dashes (—). Use a period, comma or colon instead."
2. **Rewrite the dashes inside the prompts** the same way as the copy above. Platform labels become colons ("X: short and punchy…", "Facebook: conversational…"); the rest become periods or commas. The P rows below are mechanical first passes, to be smoothed when the prompts are edited.

| # | File:line | Branch | Context | Proposed |
|---|---|---|---|---|
| P0 | `lib/article-generation.ts:24` | gx | …d in the customer's dashboard for them to accept or decline — no obligation. LEVR's guarantee: if LEVR doesn't… | …d in the customer's dashboard for them to accept or decline. No obligation. LEVR's guarantee: if LEVR doesn't… |
| P1 | `lib/article-generation.ts:24` | gx | …s about LEVR exactly as given if you reference the business — do not search the web for information about LEVR… | …s about LEVR exactly as given if you reference the business. Do not search the web for information about LEVR… |
| P2 | `lib/article-generation.ts:24` | gx | …uto's other published articles, provided below as reference — no hype or sales pitch. Explain how the topic ac… | …uto's other published articles, provided below as reference. No hype or sales pitch. Explain how the topic ac… |
| P3 | `lib/article-generation.ts:24` | gx | …or two sentences tying back to LEVR where it fits naturally — don't force it into the rest of the article. For… | …or two sentences tying back to LEVR where it fits naturally. Don't force it into the rest of the article. For… |
| P4 | `lib/article-generation.ts:24` | gx | …t include the title as a heading (it's rendered separately) — start directly with the opening paragraph. Use "… | …t include the title as a heading (it's rendered separately). Start directly with the opening paragraph. Use "… |
| P5 | `lib/article-generation.ts:24` | gx | …s and bold text except where they genuinely aid readability — the reference articles below use almost none. Ai… | …s and bold text except where they genuinely aid readability. The reference articles below use almost none. Ai… |
| P6 | `lib/article-generation.ts:51` | main | …step. Remove only that kind of leading commentary — do not rewrite, shorten, rephrase, or… | …step. Remove only that kind of leading commentary. Do not rewrite, shorten, rephrase, or… |
| P7 | `lib/article-generation.ts:101` | main | …conventions: X — short and punchy, well under 280 characters incl… | …conventions: X: short and punchy, well under 280 characters incl… |
| P8 | `lib/article-generation.ts:102` | main | …at most. Facebook — conversational, 1–3 short sentences, can pose a … | …at most. Facebook: conversational, 1–3 short sentences, can pose a … |
| P9 | `lib/article-generation.ts:103` | main | …Instagram — similar to Facebook but can lean more casual, 2–… | …Instagram: similar to Facebook but can lean more casual, 2–… |
| P10 | `lib/article-generation.ts:104` | main | …LinkedIn — more professional, can be a bit longer, frame ar… | …LinkedIn: more professional, can be a bit longer, frame ar… |
| P11 | `lib/article-generation.ts:105` | main | …should sound like generic marketing copy — write like a real person sharing something… | …should sound like generic marketing copy. Write like a real person sharing something… |
| P12 | `lib/article-generation.ts:111` | gx | …$699 is refunded — never as automatic, and never as covering Tesla,… | …$699 is refunded. Never as automatic, and never as covering Tesla,… |
| P13 | `lib/social-generation.ts:29` | main | …kind of leading commentary — do not rewrite, shorten, rephrase, or otherwise … | …kind of leading commentary. Do not rewrite, shorten, rephrase, or otherwise … |
| P14 | `lib/social-generation.ts:139` | main | …del, and model year) that's genuinely interesting this week —… | …del, and model year) that's genuinely interesting this week,… |
| P15 | `lib/social-generation.ts:143` | main | …entences) covering the vehicle and the real facts you found — this is raw… | …entences) covering the vehicle and the real facts you found. This is raw… |
| P16 | `lib/social-generation.ts:152` | main | … specs) only in what's given to you in the research summary — never invent… | … specs) only in what's given to you in the research summary. Never invent… |
| P17 | `lib/social-generation.ts:153` | main | …ber that isn't there. Match LEVR Auto's plain, direct voice — no hype-filled… | …ber that isn't there. Match LEVR Auto's plain, direct voice. No hype-filled… |
| P18 | `lib/social-generation.ts:154` | main | …marketing language. Platform conventions: X — short and punchy, well under 280 characters, 0–2… | …marketing language. Platform conventions: X: short and punchy, well under 280 characters, 0–2… |
| P19 | `lib/social-generation.ts:155` | main | …hashtags. Facebook — conversational, 1–3 short sentences. Instagram —… | …hashtags. Facebook: conversational, 1–3 short sentences. Instagram —… |
| P20 | `lib/social-generation.ts:155` | main | …. Facebook — conversational, 1–3 short sentences. Instagram — similar to Facebook but… | …. Facebook — conversational, 1–3 short sentences. Instagram: similar to Facebook but… |
| P21 | `lib/social-generation.ts:156` | main | …more casual, 2–4 relevant hashtags. LinkedIn — more professional, can be a bit longer. None… | …more casual, 2–4 relevant hashtags. LinkedIn: more professional, can be a bit longer. None… |
| P22 | `lib/social-generation.ts:170` | main | …media captions for LEVR Auto's "Ask-Around Tuesday" feature — a genuine… | …media captions for LEVR Auto's "Ask-Around Tuesday" feature. A genuine… |
| P23 | `lib/social-generation.ts:175` | main | …genuinely curious, and easy to answer in one line — not a survey, not a sales pitch. Match LEVR… | …genuinely curious, and easy to answer in one line. Not a survey, not a sales pitch. Match LEVR… |
| P24 | `lib/social-generation.ts:176` | main | …Auto's plain, direct voice. Platform conventions: X — short and punchy, well under 280… | …Auto's plain, direct voice. Platform conventions: X: short and punchy, well under 280… |
| P25 | `lib/social-generation.ts:177` | main | …characters. Facebook — conversational, inviting. Instagram — casual, 1–… | …characters. Facebook: conversational, inviting. Instagram — casual, 1–… |
| P26 | `lib/social-generation.ts:177` | main | …characters. Facebook — conversational, inviting. Instagram — casual, 1–3 relevant hashtags.… | …characters. Facebook — conversational, inviting. Instagram: casual, 1–3 relevant hashtags.… |
| P27 | `lib/social-generation.ts:178` | main | …LinkedIn — can lean slightly more toward a professional/ind… | …LinkedIn: can lean slightly more toward a professional/ind… |
| P28 | `lib/social-generation.ts:194` | main | …e real comment text, and the vehicle make/model they bought — use only what's… | …e real comment text, and the vehicle make/model they bought. Use only what's… |
| P29 | `lib/social-generation.ts:198` | main | …ht framing around it. Match LEVR Auto's plain, direct voice — let the real… | …ht framing around it. Match LEVR Auto's plain, direct voice. Let the real… |
| P30 | `lib/social-generation.ts:199` | main | …arry the weight, don't oversell it. Platform conventions: X — short and punchy,… | …arry the weight, don't oversell it. Platform conventions: X: short and punchy,… |
| P31 | `lib/social-generation.ts:200` | main | …well under 280 characters. Facebook — conversational, can include a bit more of the qu… | …well under 280 characters. Facebook: conversational, can include a bit more of the qu… |
| P32 | `lib/social-generation.ts:201` | main | …Instagram — similar tone, 2–3 relevant hashtags. LinkedIn — … | …Instagram: similar tone, 2–3 relevant hashtags. LinkedIn — … |
| P33 | `lib/social-generation.ts:201` | main | …Instagram — similar tone, 2–3 relevant hashtags. LinkedIn — slightly more professional framing.… | …Instagram — similar tone, 2–3 relevant hashtags. LinkedIn: slightly more professional framing.… |
| P34 | `lib/social-generation.ts:315` | main | …arch tool to find a real, accurate historical fact or story — a… | …arch tool to find a real, accurate historical fact or story, a… |
| P35 | `lib/social-generation.ts:318` | main | …— this is raw material for a social caption, not t… | …. This is raw material for a social caption, not t… |
| P36 | `lib/social-generation.ts:325` | main | …etails) only in what's given to you in the research summary — never invent or add a… | …etails) only in what's given to you in the research summary. Never invent or add a… |
| P37 | `lib/social-generation.ts:326` | main | …ail that isn't there. Match LEVR Auto's plain, direct voice — genuinely interesting, not a dry… | …ail that isn't there. Match LEVR Auto's plain, direct voice, genuinely interesting, not a dry… |
| P38 | `lib/social-generation.ts:327` | main | …trivia recitation. Platform conventions: X — short and punchy, well under 280 characters, can… | …trivia recitation. Platform conventions: X: short and punchy, well under 280 characters, can… |
| P39 | `lib/social-generation.ts:328` | main | …a #tbt-style hashtag. Facebook — conversational, a bit more storytelling room. In… | …a #tbt-style hashtag. Facebook: conversational, a bit more storytelling room. In… |
| P40 | `lib/social-generation.ts:328` | main | …k — conversational, a bit more storytelling room. Instagram —… | …k — conversational, a bit more storytelling room. Instagram:… |
| P41 | `lib/social-generation.ts:329` | main | …similar tone, 2–4 relevant hashtags. LinkedIn — can frame around the industry/business angle of… | …similar tone, 2–4 relevant hashtags. LinkedIn: can frame around the industry/business angle of… |
| P42 | `lib/social-generation.ts:348` | main | …MSRP, and the real discount amount below MSRP — use only these facts, never invent additional… | …MSRP, and the real discount amount below MSRP. Use only these facts, never invent additional… |
| P43 | `lib/social-generation.ts:352` | main | …Auto's plain, direct voice — no hype, let the real number speak for itself. P… | …Auto's plain, direct voice. No hype, let the real number speak for itself. P… |
| P44 | `lib/social-generation.ts:353` | main | …X — short and punchy, well under 280 characters. Fac… | …X: short and punchy, well under 280 characters. Fac… |
| P45 | `lib/social-generation.ts:353` | main | …X — short and punchy, well under 280 characters. Facebook — conversational, can restate the… | …X — short and punchy, well under 280 characters. Facebook: conversational, can restate the… |
| P46 | `lib/social-generation.ts:354` | main | …discount clearly. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — … | …discount clearly. Instagram: similar tone, 2–4 relevant hashtags. LinkedIn — … |
| P47 | `lib/social-generation.ts:354` | main | …. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around… | …. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn: can frame around… |
| P48 | `lib/social-generation.ts:472` | main | …real, current automotive industry news — new model announcements, pricing changes, indust… | …real, current automotive industry news, new model announcements, pricing changes, indust… |
| P49 | `lib/social-generation.ts:475` | main | … sentences) covering the story and the real facts you found — this is raw material for a… | … sentences) covering the story and the real facts you found. This is raw material for a… |
| P50 | `lib/social-generation.ts:483` | main | …ic fact only in what's given to you in the research summary — never invent or… | …ic fact only in what's given to you in the research summary. Never invent or… |
| P51 | `lib/social-generation.ts:484` | main | …ch LEVR Auto's plain, direct voice. Platform conventions: X —… | …ch LEVR Auto's plain, direct voice. Platform conventions: X:… |
| P52 | `lib/social-generation.ts:485` | main | …, well under 280 characters, news-headline energy. Facebook — conversational, a… | …, well under 280 characters, news-headline energy. Facebook: conversational, a… |
| P53 | `lib/social-generation.ts:486` | main | …bit more context. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — … | …bit more context. Instagram: similar tone, 2–4 relevant hashtags. LinkedIn — … |
| P54 | `lib/social-generation.ts:486` | main | …. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around… | …. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn: can frame around… |
| P55 | `lib/social-generation.ts:502` | main | …al media captions for LEVR Auto's "Sunday Question" feature — a light, personal… | …al media captions for LEVR Auto's "Sunday Question" feature. A light, personal… |
| P56 | `lib/social-generation.ts:507` | main | …o answer in one line. Match LEVR Auto's plain, direct voice — friendly,… | …o answer in one line. Match LEVR Auto's plain, direct voice, friendly,… |
| P57 | `lib/social-generation.ts:508` | main | …to mention LEVR's service directly. Platform conventions: X — short and… | …to mention LEVR's service directly. Platform conventions: X: short and… |
| P58 | `lib/social-generation.ts:509` | main | …punchy, well under 280 characters. Facebook — warm, conversational. Instagram — casual, 1–3… | …punchy, well under 280 characters. Facebook: warm, conversational. Instagram — casual, 1–3… |
| P59 | `lib/social-generation.ts:509` | main | … 280 characters. Facebook — warm, conversational. Instagram — casual, 1–3… | … 280 characters. Facebook — warm, conversational. Instagram: casual, 1–3… |
| P60 | `lib/social-generation.ts:510` | main | …relevant hashtags. LinkedIn — tone doesn't matter much since it won't actually… | …relevant hashtags. LinkedIn: tone doesn't matter much since it won't actually… |

Draft social posts already generated (not approved or posted): 14 of 18 drafts contain em dashes. They're drafts in `/internal/social`, so nothing has gone out; regenerating after the prompt change, or editing at review, clears them.

## 15. Approved and published articles (database)

- `holiday-car-buying-deals`: approved, publishes 2026-11-01
- `how-dealer-markups-actually-work`: approved, publishes 2026-10-01
- `msrp-vs-invoice-price`: published, publishes 2026-09-01

The September and October articles are live; the November one goes live 2026-11-01 at 05:01 UTC unless edited first. Changing them is a database update (the September one was changed by migration before; the others can be edited on `/internal/articles` once approved articles are editable, follow-up 13, or by a reviewed SQL update).

| Article | Field:line | Current | Proposed |
|---|---|---|---|
| holiday-car-buying-deals | content:1 | …ng. There are real reasons dealers get more flexible late in the year — but that doesn't mean every holiday deal is actually a goo… | …late in the year. But that… |
| holiday-car-buying-deals | content:7 | …Manufacturers add to that pressure with incentives — cash rebates, special financing rates, or lease deals offe… | …incentives: cash rebates… |
| holiday-car-buying-deals | content:9 | …Put those two things together — older inventory dealers want gone, plus manufacturer incen… / …alers want gone, plus manufacturer incentives aimed at year-end goals — and you get a window where deals can genuinely be better t… | …together (older inventory dealers want gone, plus manufacturer incentives aimed at year-end goals), and you get… |
| holiday-car-buying-deals | content:15 | …price of the car barely moves. It's worth looking at the full picture — the price of the car itself, plus any separate incentive —… / …ll picture — the price of the car itself, plus any separate incentive — rather than assuming a big red "Holiday Sales Event" banne… | …the full picture (the price of the car itself, plus any separate incentive) rather than… |
| holiday-car-buying-deals | content:21 | …l year. But the holiday label itself isn't what gets you a good price — the actual condition of that specific car and that specifi… | …a good price. The actual condition… |
| holiday-car-buying-deals | caption_x:1 | …ing inventory and year-end manufacturer incentives line up around now — a hot trim that just landed on the lot isn't getting the s… | …around now. A hot trim… |
| holiday-car-buying-deals | caption_facebook:1 | …ay sales event" banners show up every November? There's a real reason — dealers want older model-year cars off the lot and manufac… | …a real reason: dealers… |
| holiday-car-buying-deals | caption_instagram:1 | …"Holiday savings event" isn't just a marketing phrase — there's a real reason dealers get more flexible late in th… | …marketing phrase. There's… |
| holiday-car-buying-deals | caption_linkedin:1 | …help hit year-end sales goals. But that pressure doesn't apply evenly — a popular trim that just arrived isn't in the same positio… | …apply evenly. A popular trim… |
| how-dealer-markups-actually-work | title:1 | …How Dealer Markups Actually Work — And How to Avoid Them… | …Work, and How… |
| msrp-vs-invoice-price | content:1 | …s" articles all treat these as the key to a good deal. They're useful — but not in the way most people think.… | …They're useful, but not… |
| msrp-vs-invoice-price | content:5 | …MSRP stands for Manufacturer's Suggested Retail Price — the sticker price the automaker recommends, printed right … / …ed on every new car). It's not just a suggestion pulled from thin air — it reflects the specific trim, options, and packages on th… | …Retail Price: the sticker… / …thin air. It reflects… |
| msrp-vs-invoice-price | content:7 | …ey are. That makes it a real, honest baseline you can compare against — which is exactly why it's the number worth anchoring to.… | …compare against, whi… |
| msrp-vs-invoice-price | content:9 | …l-time supply, demand, and how motivated a given dealer is to move it — which is exactly the kind of thing that's hard to know fro… | …to move it, which is exactly… |
| msrp-vs-invoice-price | content:13 | …pposed to represent what the dealer paid the manufacturer for the car — and for years, "buy at invoice" was treated as the ultimat… | …for the car, and for years… |
| msrp-vs-invoice-price | content:17 | …ole process that's public, consistent, and impossible to quietly move — which makes it the right foundation for a real promise. If… / …back, no chasing a number that was never the real floor to begin with — just a fixed, honest baseline, and real work to beat it.… | …quietly move, which makes… / …to begin with. Just a fixed… |

## Appendix A. Agent-facing hits (for the record)

Not part of Micah (MH)'s note. The new standing rule covers new agent copy; these can go in the same sweep if Brett wants.

| File:line | Branch | Current |
|---|---|---|
| `app/internal/admin/page.tsx:7` | main | Admin — LEVR Auto Internal |
| `app/internal/agents/page.tsx:9` | offer-entry | Add an agent — LEVR Auto Internal |
| `app/internal/articles/page.tsx:7` | main | Articles — LEVR Auto Internal |
| `app/internal/articles/page.tsx:24` | main | Drafts generated by the auto-draft cron, awaiting review. Nothing here ever goes live on its own — approving is the only way an article publishes. |
| `app/internal/dealerships/page.tsx:8` | main | Dealerships — LEVR Auto Internal |
| `app/internal/outreach/[searchId]/offer/page.tsx:30` | offer-entry | `Log an offer for ${ctx.customerFirstName?.trim() \|\| "the customer"} — ${vehicle}` |
| `app/internal/outreach/page.tsx:58` | main | Outreach Queue — LEVR Auto Internal |
| `app/internal/outreach/page.tsx:161` | main | `{" — "}` |
| `app/internal/outreach/page.tsx:168` | main | — includes |
| `app/internal/outreach/page.tsx:198` | main | (top trim) — available on |
| `app/internal/outreach/page.tsx:277` | main | Trim — search in this order |
| `app/internal/outreach/page.tsx:314` | main | Real combinations — search in this order |
| `app/internal/outreach/page.tsx:421` | main | These customers paid without picking a make/model yet — nothing else can happen for them until this call takes place. |
| `app/internal/outreach/page.tsx:545` | main | `{item.dealerName} — ${(item.offerPriceCents / 100).toLocaleString()}` |
| `app/internal/outreach/page.tsx:562` | main | mi from customer — beyond customer&apos;s |
| `app/internal/outreach/page.tsx:638` | main | `No ${search.block.committedYear} listings synced — inventory exists for ${search.block.otherYears.join(" and ")}` |
| `app/internal/outreach/page.tsx:655` | main | Case-by-case only — waives the $100 extension fee without Stripe, works on any search regardless of status. Logged, never referenced in customer-facing text. |
| `app/internal/outreach/page.tsx:666` | main | Look up a customer to cancel a search and issue a refund (full, partial, or none) against any of their payments — not just for calls already in the queue below. |
| `app/internal/outreach/page.tsx:804` | main | ` — ${item.make} ${item.model}` |
| `app/internal/outreach/page.tsx:821` | main | This customer has only &ldquo;text message&rdquo; enabled for account notifications — there&apos;s no SMS provider yet, so nothing actually reached them. Not a callback request; worth a proactive chec |
| `app/internal/outreach/page.tsx:834` | main | ` — ${item.make} ${item.model}` |
| `app/internal/outreach/page.tsx:924` | main | `— {search.make} {search.model} for {search.customerEmail ?? "unknown customer"}` |
| `app/internal/outreach/page.tsx:955` | main | ` — ${search.trim}` |
| `app/internal/outreach/page.tsx:995` | main | `{offer.dealerName} — ${(offer.offerPriceCents / 100).toLocaleString()}` |
| `app/internal/outreach/page.tsx:996` | main | `{offer.isBelowMsrp ? " (below MSRP)" : " (at/above MSRP)"} —{" "}` |
| `app/internal/outreach/page.tsx:1002` | main | ` — beyond customer's ${search.pickupTravel.miles}-mile range` |
| `app/internal/outreach/page.tsx:1025` | main | ` — ${offer.withdrawalReason}` |
| `app/internal/outreach/page.tsx:1048` | main | `{addon.description} — ${(addon.amountCents / 100).toLocaleString()}` |
| `app/internal/outreach/page.tsx:1089` | main | Accepted — closing this deal |
| `app/internal/outreach/page.tsx:1121` | main | `{" — "}` |
| `app/internal/outreach/page.tsx:1135` | main | Wants financing help — income |
| `app/internal/outreach/page.tsx:1192` | main | `{dealer.name} — {dealer.phone ?? "no phone"} — {dealer.city ?? "?"}, {dealer.state ?? "?"} (` |
| `app/internal/outreach/page.tsx:1192` | main | `{dealer.name} — {dealer.phone ?? "no phone"} — {dealer.city ?? "?"}, {dealer.state ?? "?"} (` |
| `app/internal/refunds-due/page.tsx:7` | main | Refunds Due — LEVR Auto Internal |
| `app/internal/refunds-due/page.tsx:13` | main | `if (!iso) return "—";` |
| `app/internal/refunds-due/page.tsx:40` | offer-entry | `${row.make} ${row.model}${row.trim ? ` — ${row.trim}` : ""}` |
| `app/internal/social/page.tsx:8` | main | Social — LEVR Auto Internal |
| `app/internal/social/page.tsx:25` | main | One weekly batch across 7 daily themes, generated automatically and awaiting review below. Nothing posts on its own — approving here only marks content ready; actually posting it (or marking it posted |
| `app/internal/social/page.tsx:43` | main | Approved content whose scheduled time has arrived — copy the text (and grab the image) into each platform by hand, then mark it posted here. |
| `components/admin-searches-table.tsx:31` | main | `if (!iso) return "—";` |
| `components/admin-searches-table.tsx:101` | main | `<div className="text-white">{row.customerName ?? "—"}</div>` |
| `components/admin-searches-table.tsx:119` | main | `<td className="px-4 py-3 text-zinc-400">{row.assignedAgentName ?? "—"}</td>` |
| `components/agent-bypass-lookup.tsx:105` | main | — 30 more days, logged. |
| `components/agent-bypass-lookup.tsx:181` | main | `Searches for {selectedCustomer.fullName ?? "(no name on file)"} — {selectedCustomer.email}` |
| `components/agent-bypass-lookup.tsx:194` | main | `{search.make} {search.model} — {agentSearchStatusLabel(search)}` |
| `components/agent-bypass-lookup.tsx:224` | main | `{candidate.fullName ?? "(no name on file)"} — {candidate.email}` |
| `components/agent-cancellation-lookup.tsx:92` | main | `Searches for {selectedCustomer.fullName ?? "(no name on file)"} — {selectedCustomer.email}` |
| `components/agent-cancellation-lookup.tsx:108` | main | `{search.make} {search.model} — {agentSearchStatusLabel(search)}` |
| `components/agent-cancellation-lookup.tsx:138` | main | `{candidate.fullName ?? "(no name on file)"} — {candidate.email}` |
| `components/agent-cancellation-resolution-form.tsx:140` | main | `{PAYMENT_TYPE_LABEL[payment.paymentType] ?? payment.paymentType} — {payment.searchMake}{" "}` |
| `components/agent-cancellation-resolution-form.tsx:141` | main | `{payment.searchModel} — {formatCents(payment.amountCents)} charged,{" "}` |
| `components/agent-delivery-estimate.tsx:39` | main | `Delivery estimate requested${requestedBy === "customer" ? " by the customer" : " from the dealer"} — waiting on the figure` |
| `components/agent-finalize-search-form.tsx:78` | main | Finalized — the customer&apos;s 24h edit window is now open. |
| `components/agent-finalize-search-form.tsx:103` | main | This search has no committed model year yet — confirm it with the customer before finalizing. |
| `components/agent-finalize-search-form.tsx:114` | main | No preference — any trim |
| `components/agent-offer-thread.tsx:49` | main | Thread closed (offer released or search ended) — read only. |
| `components/agent-revert-purchased-lookup.tsx:96` | main | reverted to searching — logged. |
| `components/agent-revert-purchased-lookup.tsx:154` | main | `Searches for {selectedCustomer.fullName ?? "(no name on file)"} — {selectedCustomer.email}` |
| `components/agent-revert-purchased-lookup.tsx:170` | main | `{search.make} {search.model} — {agentSearchStatusLabel(search)}` |
| `components/agent-revert-purchased-lookup.tsx:200` | main | `{candidate.fullName ?? "(no name on file)"} — {candidate.email}` |
| `components/agent-undecided-finalize-form.tsx:97` | main | Finalized — |
| `components/dealership-search-picker.tsx:72` | main | `<span className="text-zinc-500"> — {[d.city, d.state].filter(Boolean).join(", ")}</span>` |
| `components/log-offer-form.tsx:288` | main | Only pre-fills the fields below — review and edit before saving. Total SRP is never parsed; enter it yourself. |
| `components/log-offer-form.tsx:305` | main | — none — |
| `components/log-offer-form.tsx:308` | main | `{l.year} {l.trim ?? ""} {l.color ?? ""} — {l.dealerName ?? "unknown dealer"} —{" "}` |
| `components/log-offer-form.tsx:308` | main | `{l.year} {l.trim ?? ""} {l.color ?? ""} — {l.dealerName ?? "unknown dealer"} —{" "}` |
| `components/log-offer-form.tsx:396` | main | Trim/color feed the customer&apos;s offer card (a real photo when we have one for this make/model/color, otherwise a placeholder) — leave blank if not confirmed with the dealer yet. |
| `components/log-offer-form.tsx:402` | main | Dealer address, VIN &amp; stock # (optional — shown to the customer in the offer detail, with distance from their ZIP) |
| `components/offer-entry-form.tsx:370` | offer-entry | Paste the dealer&apos;s email or call notes, or attach their quote. AI fills in what it can — check anything marked. |
| `components/offer-entry-form.tsx:406` | offer-entry | Not listed — enter VIN by hand |
| `components/offer-entry-form.tsx:425` | offer-entry | `<td className="px-2 py-1.5 text-zinc-200">{l.dealerName ?? "—"}{!allTrims ? "" : l.trim ? <span className="block text-zinc-500">{l.trim}</span> : null}</td>` |
| `components/offer-entry-form.tsx:426` | offer-entry | `<td className="px-2 py-1.5 text-zinc-300">{l.miles != null ? Math.round(l.miles) : "—"}</td>` |
| `components/offer-entry-form.tsx:427` | offer-entry | `<td className="px-2 py-1.5 text-zinc-300">{l.color ?? "—"}{mark(l.color, exteriorPicks)}</td>` |
| `components/offer-entry-form.tsx:428` | offer-entry | `<td className="px-2 py-1.5 text-zinc-300">{l.interiorColor ?? "—"}{mark(l.interiorColor, interiorPicks)}</td>` |
| `components/offer-entry-form.tsx:429` | offer-entry | `<td className="px-2 py-1.5 text-zinc-300">{l.stockNumber ?? "—"}</td>` |
| `components/offer-entry-form.tsx:431` | offer-entry | `<td className="px-2 py-1.5 text-zinc-200">{l.priceCents != null ? money(l.priceCents) : "—"}</td>` |
| `components/posting-worklist.tsx:61` | main | — due |
| `components/refresh-inventory-button.tsx:51` | main | `Refreshed — ${res.upserted} listings updated.` |
| `components/refund-due-actions.tsx:129` | offer-entry | `<div className="break-words text-white">{row.customerName ?? "—"}</div>` |
| `components/refund-due-actions.tsx:136` | offer-entry | `{row.paymentId ? amount : "—"}` |
| `components/social-post-review-form.tsx:126` | main | No LinkedIn slot — this theme falls on a weekend. |
| `components/team-list.tsx:127` | offer-entry | `<span className="hidden text-zinc-300 sm:block">{m.levrid ?? "—"}</span>` |
| `components/withdraw-accepted-offer-button.tsx:44` | main | This moves the offer to &ldquo;withdrawn&rdquo; so the customer can accept a different offer on this search. It can&apos;t be undone — if the deal comes back, log it as a new offer. |
| `components/withdraw-reason-fields.tsx:31` | offer-entry | `<option value="">—</option>` |
| `lib/agent-call-notifications.ts:86` | main | `${who} requested a ${copy.subjectNoun} — ${vehicle}` |
| `lib/article-reminders.ts:93` | main | It won't publish on its own — review and approve as soon as you can: |
| `lib/listing-picker.ts:62` | offer-entry | `export const vinLast8 = (vin: string \| null) => (vin ? `…${vin.slice(-8)}` : "—");` |
| `lib/outreach-actions.ts:406` | main | This search isn't active right now — can't mark it purchased. |
| `lib/outreach-actions.ts:552` | main | This search is marked purchased — revert the purchase first, then release the offer. |
| `lib/outreach-actions.ts:632` | main | The customer changed this since the page loaded — refresh to see the latest. |
| `lib/outreach-actions.ts:1195` | main | Nothing was saved — this search already has a vehicle, isn't paid for, or no longer exists. Refresh the queue. |
| `lib/outreach-queue.ts:259` | main | `${trimLabel} — ${colorLabel} / ${interiorLabel}${c.seating ? ` / ${c.seating}` : ""}` |
| `lib/sticker-check.ts:97` | main | `You entered ${dollars(typedCents)}, but the linked listing's sticker is ${dollars(listingMsrpCents)}. Check the window sticker's total — it should match the listing.` |

## Appendix B. Not counted

Server log lines (`console.*`, 3 hits), code comments, and docs. The language inventory and plans use em dashes in their own headings and notes; those are internal documents, not copy.
