# LEVR Auto — Developer Brief v1

*For your friend, to read alongside the Core Processes doc and Website Copy doc. This one's about what to actually build; those two cover what it needs to say and do in detail.*

---

## 1. What This App Does

Customers pick a car (make/model, with trim/color flexibility), pay a fee, and LEVR Auto searches dealer inventory nationwide and negotiates on their behalf by email. Customers see offers land in a dashboard, can accept one, and get guided through financing, e-signed paperwork, and delivery — all without setting foot in a dealership if they don't want to. Money-back guarantee if no below-MSRP offer shows up within 30 days.

---

## 2. Tech Stack (already decided)

- **Next.js** — the app itself
- **Supabase** — Postgres database, auth, and file storage in one place
- **Vercel** — hosting/deploy
- **Claude Code** — primary build tool
- **MarketCheck API** — nationwide dealer inventory data
- **Stripe** — payments and refunds
- **Resend or SendGrid** — sending outbound dealer emails and customer notifications
- **Claude API** — parsing freeform dealer reply emails into structured offer data
- **DocuSign or PandaDoc API** — e-signing LEVR Auto's own documents

---

## 3. Pages / Screens

**Public**
- Landing page
- FAQ
- Terms of Service / Privacy Policy (placeholder pages until attorney-reviewed language exists)
- Sign-up / intake flow

**Customer (authenticated)**
- Dashboard — offers list, deal status, notifications
- Deal detail page — one search request's full offer history
- Change Request flow — switch make/model (grace period vs. $100 fee logic)
- Financing path — choose "bringing my own" (upload proof) vs. "want help" (preference form)
- Document center — LEVR Auto's own e-signed paperwork
- Delivery/pickup selection
- Account/profile settings

**Internal/Admin (just you, for now)**
- Deal queue — every active search request and its status
- Outreach tracker — which dealers have been contacted per deal, reply status
- Offer review — spot-check AI-parsed offers before they hit the customer's dashboard (at least early on, until you trust the parsing)
- Customer list
- Refund/guarantee flags

**Not in v1 — future builds**
- Dealer-side portal (Stage 3 subscription model)
- Transporter bidding marketplace
- Lender marketplace

---

## 4. Core Data Model (sketch)

- **Customer** — contact info, financing preference, uploaded documents
- **SearchRequest** — customer_id, tier (1/2/3 models, $500/$600/$700), make(s)/model(s) with trim-color inclusion/exclusion logic, budget, Day 30 date, Day 60 date, guarantee status, extension history
- **Offer** — search_request_id, dealer_id, vehicle spec/VIN, negotiated price, MSRP, qualifying (below-MSRP) flag, timestamp, raw reply text
- **Dealer** — name, contact/outreach info, brand, region
- **ChangeRequest** — search_request_id, old model, new model, fee charged (or grace-period waiver), timestamp
- **Document** — customer_id or search_request_id, type (proof of financing, LEVR service doc, trade-in disclosure), file, signed_at
- **Payment** — customer_id, amount, type (initial fee, extension, switch fee), Stripe reference, refund status
- **Notification** — customer_id, type, sent_at

---

## 5. Integrations Needed

| Purpose | Tool |
|---|---|
| Nationwide inventory search | MarketCheck API |
| Outbound dealer leads | Email (Resend/SendGrid), ADF/XML format |
| Reply parsing → structured offers | Claude API |
| Payments/refunds | Stripe |
| E-signing | DocuSign or PandaDoc API |
| Auth/DB/storage | Supabase |

---

## 6. Key Business Logic to Encode

*(Full detail lives in the Core Processes doc — this is just what needs to become actual code logic.)*

- Guarantee evaluated at Day 30; refund auto-triggers if no qualifying offer, payout within ~7 days; search continues free through Day 60 regardless of outcome; $100 buys renewable ~30-day extensions after that.
- Pricing: $500 (1 model) / $600 (2) / $700 (3, max).
- Switching costs $100 and resets both Day 30/Day 60 clocks — except a 5-day unadvertised grace period allowing one free switch.
- Financing: preference/document capture only — **no actual credit pull** (that's a regulated activity requiring a compliant vendor partnership later, not custom-built).
- Delivery: concierge referral only in v1, no fee yet.

---

## 7. Suggested Build Order

1. Auth + intake form + Stripe payment (tiered pricing)
2. MarketCheck integration + basic dealer matching
3. Outbound email engine (ADF/XML generation + sending) — this is the riskiest unknown, worth proving early with a small real-dealer test batch
4. Inbound reply parsing (Claude API) + offer dashboard
5. Change Request flow (switching logic)
6. Financing path + document upload + e-sign
7. Delivery/pickup selection
8. Admin/internal views (can be minimal at first — even a basic table view works early on)

*This ordering is my suggestion, not a fixed decision — feel free to adjust with your friend based on what's actually hardest to build first.*

---

## 8. Open Items Your Friend Will Probably Ask About

- Exact ADF/XML delivery mechanism per dealer (email vs. web-form-fill) — still an open technical spike, not yet tested against real dealers.
- Whether a Qualifying Offer that sells to someone else before the customer decides still counts toward the guarantee.
- Scaled/automated customer support — direction stated, not designed yet.
- Legal/licensing language for Section 2.9 of the contract — waiting on attorney input.
