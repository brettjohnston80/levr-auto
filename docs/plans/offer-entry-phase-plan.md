# Offer entry phase: plan (drafted 2026-10-18)

**Updated 2026-10-18 with Brett's answers (section 8).** Planning only. Nothing here is built, no migration has been run, and no branch exists for it. The SQL is draft text for review. **Every piece of wording in section 6 needs Brett's sign-off before it ships.**

Inputs:
- Brett's decisions 1–10 (2026-10-18) and the offer-entry items in `docs/plans/build-completion-roadmap.md`: price structure, out-the-door rule, sticker integrity, withdrawn offers kept as is.
- Terry's feedback: `docs/research/tester-feedback-terry-2026-10-17.md`.
- The Phase 1 plans: `agent-dashboard-phase1-plan.md` (scope table line 402: the warnings were "data only", with the warnings and confirm click left for later) and `agent-dashboard-review-2026-10-10.md` §3.
- A read of the code on `main` (`ec69a67` onward) and on `agent-dashboard-phase1-code` (`1d95e28`).

---

## 1. Where to build it: on the Phase 1 branch, after Phase 1 deploys

**Recommendation:** build this phase on a branch cut from `agent-dashboard-phase1-code` once `main` has been merged into it, and deploy it only after Phase 1 is live.

Why:
- **The same four files.** Phase 1 rewrote exactly the files this phase rewrites: `src/lib/outreach-actions.ts`, `src/components/log-offer-form.tsx`, `src/lib/outreach-queue.ts` and `src/app/internal/outreach/page.tsx`.
  - On the branch, `logQualifyingOffer` writes `logged_by_agent_id` and `dealer_alias_id` and logs `offer_logged` activity.
  - `main` has since changed all four files (6 commits: body split, credits, dealer-installed, parser destination, Terry wording, sticker integrity).
  - Building on `main` would mean redoing Phase 1's attribution and activity logging, then resolving the same conflicts twice.
- **Agent sign-in.** This phase needs Phase 1's agent sign-in: separate agent accounts, two-factor checked on every page and action, and role gates via `getAuthorizedAgent({ minRole })`. The new agent actions (review dealer submissions, send offers, create dealer links) should use those gates from day one.
- **Safety rails.** The dealer link and its emails need Phase 1's rails: `runtime-env.ts` refuses side effects on previews, and `sendEmail` suppresses every `.invalid` address and holds agent email outside production.
- **Merge risk.** The Chunk 8 rehearsal merge (2026-10-15) had no conflicts. Main's commits from 2026-10-16/17 now overlap all four files, so the first step is a fresh merge of `main` into the Phase 1 branch, re-running Chunk 8's test pass. That is worth doing before the tester round ends anyway, so the Phase 1 deploy isn't held up by it.

**Alternative:** wait for the Phase 1 deploy and branch from `main` then. This is cleaner, but nothing can start until the tester round ends. I'd only choose it if the tester round ends within days.

**Order:**
1. Merge `main` into the Phase 1 branch and re-run its tests (Brett's go).
2. Deploy Phase 1 after the tester round.
3. Build offer entry on its own branch from the merged Phase 1 code. Migrations can be applied ahead of time, since they only add things.
4. Deploy offer entry.
5. Stripe live mode.

---

## 2. Current state (what exists today)

### 2.1 Tables

**`qualifying_offers`** (initial schema plus 12 later migrations):
- **Price:** `offer_price_cents` and `msrp_cents`, both not null. `msrp_cents` is the sticker snapshot, commented as "Total Monroney: base + factory options + destination, excluding tax/title/doc/dealer add-ons".
  - `is_below_msrp` is a generated column, `offer_price_cents < msrp_cents`. **It is the whole guarantee price test.**
- **Status:** `status` is one of pending, customer_accepted, customer_declined or withdrawn. A unique index allows only one `customer_accepted` offer per search.
- **Vehicle:** `vehicle_trim`, `vehicle_exterior_color`, `vin`, `stock_number`, `listing_id` (nullable FK), and the dealer address fields (`dealer_street`/`city`/`state`/`zip`).
- **Delivery estimate:** `delivery_estimate_*`, in three states with a check that keeps them consistent.
- **Handoff:** `handoff_method` (pickup/delivery).
- **Attribution:** `logged_by_agent_id` and `dealer_alias_id` (Step 8). `main` never writes them; the Phase 1 branch does.
- **Withdrawal:** `withdrawn_*`.
- **Messages:** `last_*message*` timestamps.
- **Missing:** no interior colour, options, out-the-door fields, good-until date, draft state, source, or note to the customer.
- **Notes:** `notes` is agent-only by convention.
- **Indexes:** partial indexes on `(customer_search_id, vin)` and `(customer_search_id, dealer_alias_id)` already exist "for later duplicate checks" (Step 8).

**`offer_addons`**:
- Columns: `description`, `amount_cents` (> 0 since `20261017130000`), and a removal negotiation (removal_status, dealer_response, timestamps).
- No "customer didn't ask for it" marker, no install type, and no way to record an explicit "none".

**`documents`**:
- `type` is one of financing_proof, service_agreement or offer_sheet. Files go in the private `documents` bucket at path `${offerId}/${uuid}-${name}`.
- Signed URLs last 15 minutes. A cron soft-deletes offer sheets at the end of a search.
- There is no window-sticker type.

**`dealerships` / `dealer_aliases`:** LEVRating Phase A. Agents confirm aliases into dealerships. There is no rating column anywhere.

**`post_deal_surveys`:** five 1–5 dealership ratings per completed deal, linked by `dealer_alias_id`. Nothing aggregates or displays them.

**Location:**
- `listings.raw_data` holds `interior_color` for 5,002 of 6,000 sampled listings (83%) and `exterior_color` for 98%. **It has no options list**, so options on the car must come from the window sticker.
- `zip_coordinates` has only zip, latitude and longitude, with **no state**. The customer's only location is `customer_searches.zip`.

### 2.2 Agent Log Offer today (`/internal/outreach`, `log-offer-form.tsx`)

- One collapsed form per active search, inside a long card. The card sections, in order: thread, colours/ZIP/range, build preferences, offers logged, matching dealers, Log Offer, switch.
- **Fields, in order:**
  1. AI parse (text or PDF).
  2. Listing picker. It lists inventory for the make and model, **in no order, not filtered to trim, with no distance**, and fills in the dealer and price.
  3. Dealer name, dealer contact.
  4. Offer price, with the parser's destination note.
  5. "Total SRP (window sticker total, no dealer addendum)", with the three approved sticker warnings.
  6. Trim, exterior colour.
  7. Address, VIN, stock number.
  8. Add-on lines, with the dealer-installed tag match.
  9. Delivery estimate (required when the dealer is beyond the range).
  10. Notes.
  11. Offer sheet PDF.
- **Save is final:**
  - It inserts the offer, sends the customer an immediate "new offer" email (`offer_logged` is a highlight event), then inserts the add-ons and uploads the PDF as separate writes. If an add-on or the PDF fails, the offer is already live and the customer has already been emailed (review §3.2).
  - There's no draft, no confirm step and no preview.
  - It only checks that the search exists, not that it's still `searching`. There's no duplicate check and no above-sticker check (review §3.3).
- **Parser** (`offer-parsing-actions.ts`): extracts the dealer name, contact, price, destination and add-ons. **It has no confidence information** and never reads the sticker (by design).

### 2.3 Customer side today

- **Your Deal** (`/account/deal`):
  - Sort pills: Best discount (default), Best total price, Closest.
  - A List/Map toggle.
  - Offer cards, an offer detail modal, and a "Best value" badge (largest Total SRP − (price + provided delivery estimate), at least 2 offers).
- **Card shows:** dealer, badges, "Trim · Color", "Offer: $X — Total Suggested Retail Price: $Y", savings line, the price-excludes line, delivery line, status.
- **Detail shows:** photo, Price, Dealership (address, about N miles), Vehicle (trim, colour, VIN, stock), Add-ons (read-only), the offer sheet, Highlight, handoff, messages, and the accept footer.
- **Accept** (`respondToOffer`):
  - Requires a pickup or delivery choice, and only one accepted offer per search.
  - The agent then confirms availability and deposit (`deal_progress`). `markSearchPurchased` requires both.
  - Accept copy: "Accepting tells your agent this is the car you want. They'll confirm it's still available and help you place a deposit with the dealer. You can accept one offer per search."
- **Data loading:** goes through the admin client, scoped by customer id. It sets `delivered_at` on first view.

### 2.4 Conflicts with the decisions (please read)

1. **Decision 3 vs today's code — resolved (Brett, 2026-10-18).** The guarantee check stays price below the car's own sticker. **The guarantee is tied to make, model and trim only.** The agent confirms the trim matches on each offer (`trim_match_confirmed`). Options, colour, add-ons, taxes, fees and delivery never affect it. Core Processes and the business plan are updated (`e8c35f7`), flagged for attorney review.
2. **"Required options" — resolved:** there are none for the guarantee. Options show to the customer as information only ("Options you wanted: N of N").
3. **Out-the-door estimates — resolved:** an offer whose figures are "Our estimate" can't be accepted. Acceptance needs the dealer's quote.
4. **LEVRating — resolved:** customers see it. The business plan is updated (`e8c35f7`).
5. **Customer-readable agent columns — fixed separately on `main`**, not in this phase (Appendix A, applied 2026-10-24). Nothing on the customer side reads `qualifying_offers` through the customer's own database role, so the whole table can be closed to `anon` and `authenticated`. The column-level grant that was drafted in OE-1 is dropped.
6. **Uploads over 4.5 MB fail today.** The offer-sheet PDF goes through a server action, and Vercel caps request bodies at 4.5 MB. A phone photo of a window sticker is often 3–8 MB. Section 3.6 moves uploads to direct-to-storage signed uploads.

---

## 3. Data model (draft SQL, not run)

> **⚠ These migrations will almost certainly run after 2026-10-30**, when Supabase stops giving new `public` tables, views and sequences any automatic grants, not even to `service_role`. So the explicit grants below are **required, not optional**. Without them every server read and write of a new table fails with `42501`. Each draft:
> - keeps its revokes, so it behaves the same before or after that date;
> - grants `service_role` exactly what the server needs;
> - grants nothing to `anon` or `authenticated`;
> - ships a grant check with the expected result.
>
> Rules: CLAUDE.md, "Explicit grants on every new database object".

### 3.1 Design choices

- **Drafts and dealer submissions don't live in `qualifying_offers`.**
  - Every existing reader treats a `qualifying_offers` row as real: the guarantee job, the customer loader (which also stamps `delivered_at`), notifications, the social selectors, refunds, the agent queue and sample offers.
  - A draft row there would count toward the guarantee the moment a customer loaded Your Deal. That's the same trap avoided when the AI parser was first built (2026-08-18).
  - So drafts and dealer submissions go in a new **`offer_submissions`** table, and "Send to customer" creates the real offer in one database transaction (`send_offer_submission`). That also fixes the "add-on failed after the offer went live" gap.
- **Dealer accounts later reuse the same path.** An `offer_submissions` row has a `source` ('agent', 'dealer_link', later 'dealer_account'), an immutable `submitted_payload` (exactly what the dealer sent) and a `working_payload` (the agent's checked copy). A future signed-in dealer creates the same row; only `source` and who submitted it differ.
- **Normalized tables** for what customers see and the guarantee reads (the sent offer):
  - new columns on `qualifying_offers`;
  - `offer_fees` (doc fee, sales tax, title and registration, other fees);
  - `offer_vehicle_options` (what's on the car);
  - `offer_addons` gains two columns.
- **Every new table gets the two locks:** RLS with no policies, and privileges revoked from `anon` and `authenticated`. All reads go through the service role. Function execute is revoked from public, anon and authenticated.
- **The guarantee code doesn't change.** `is_below_msrp` stays the guarantee price test. Out-the-door, fee and add-on columns are never inputs to it.

### 3.2 Migration OE-1: offer columns, fees, options, window sticker, rating

```sql
-- OE-1 (draft). Additions only.
begin;

-- Sent-offer data the customer sees.
alter table public.qualifying_offers
  add column offer_source text not null default 'agent'
    check (offer_source in ('agent', 'dealer_link', 'dealer_account')),
  add column offer_submission_id uuid,                       -- FK added in OE-2
  add column sent_by_agent_id uuid references public.agents (id),
  add column sent_to_customer_at timestamptz,
  add column vehicle_interior_color text check (char_length(vehicle_interior_color) <= 200),
  add column vehicle_model_year smallint,
  add column good_until date,
  add column note_to_customer text check (char_length(note_to_customer) <= 1000),
  -- Out-the-door: null until recorded (customer sees "Out-the-door quote requested").
  add column otd_source text check (otd_source in ('estimate', 'dealer_quote')),
  add column otd_total_cents integer check (otd_total_cents > 0),
  add column otd_recorded_at timestamptz,
  add column otd_recorded_by_agent_id uuid references public.agents (id),
  add column otd_requested_at timestamptz,
  add column addons_none_confirmed boolean not null default false,
  add column other_fees_none_confirmed boolean not null default false,
  -- Warnings the agent confirmed past (above sticker, duplicate, inactive search).
  add column warnings_confirmed text[] not null default '{}',
  add column warnings_confirmed_by_agent_id uuid references public.agents (id),
  -- The agent confirms the car's trim matches the customer's (the guarantee is make, model
  -- and trim only; Brett 2026-10-18). Informational: the Day-30 check is unchanged.
  add column trim_match_confirmed boolean,
  -- Out-of-state buyers: tax paid at registration, not to the dealer (Q4).
  add column tax_paid_at_registration boolean not null default false,
  add constraint qualifying_offers_otd_shape check (
    (otd_source is null and otd_total_cents is null and otd_recorded_at is null)
    or (otd_source is not null and otd_total_cents is not null and otd_recorded_at is not null)
  ),
  add constraint qualifying_offers_warnings_known check (
    warnings_confirmed <@ array['above_sticker', 'duplicate_vin', 'duplicate_dealer', 'inactive_search']::text[]
  );

-- Doc fee, sales tax, title & registration, other fees. Add-ons stay in offer_addons.
create table public.offer_fees (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,
  fee_kind text not null check (fee_kind in ('doc_fee', 'sales_tax', 'title_registration', 'other')),
  fee_label text check (char_length(fee_label) <= 200),      -- required for 'other'
  fee_amount_cents integer not null check (fee_amount_cents >= 0),
  -- e.g. "Dealer doesn't collect tax; buyer pays at registration" (see Q7).
  fee_note text check (char_length(fee_note) <= 300),
  created_at timestamptz not null default now(),
  constraint offer_fees_other_needs_label check (fee_kind <> 'other' or fee_label is not null)
);
create unique index offer_fees_one_fixed_kind_idx
  on public.offer_fees (qualifying_offer_id, fee_kind) where fee_kind <> 'other';
create index offer_fees_offer_idx on public.offer_fees (qualifying_offer_id);

-- What's on this car: wanted options ticked on/not on, plus extras from the sticker.
create table public.offer_vehicle_options (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,
  vehicle_option_name text not null check (char_length(vehicle_option_name) <= 300),
  -- The customer's ranked selection this answers (null for a sticker extra).
  search_option_selection_id uuid references public.search_option_selections (id) on delete set null,
  customer_asked_for boolean not null,
  on_the_car boolean not null,
  sticker_price_cents integer check (sticker_price_cents >= 0),
  install_kind text check (install_kind in ('factory', 'dealer', 'port')),
  created_at timestamptz not null default now(),
  constraint offer_vehicle_options_extra_is_on_car check (customer_asked_for or on_the_car)
);
create index offer_vehicle_options_offer_idx on public.offer_vehicle_options (qualifying_offer_id);

-- Add-ons: which ones the customer didn't ask for, and whether the dealer says they can come off.
alter table public.offer_addons
  add column addon_customer_wanted boolean not null default false,
  add column addon_dealer_says_removable boolean;

-- Window sticker documents.
alter table public.documents drop constraint documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('financing_proof', 'service_agreement', 'offer_sheet', 'window_sticker'));

-- LEVRating home (calculation is a later project). Null = "New to LEVR — no rating yet".
alter table public.dealerships
  add column levrating numeric(2,1) check (levrating between 1.0 and 5.0),
  add column levrating_count integer not null default 0 check (levrating_count >= 0),
  add column levrating_updated_at timestamptz;

-- Two locks on the new tables.
alter table public.offer_fees enable row level security;
alter table public.offer_vehicle_options enable row level security;
revoke select, insert, update, delete, truncate on public.offer_fees, public.offer_vehicle_options from anon, authenticated;
-- Explicit grants (required after 2026-10-30): the server inserts these with an offer,
-- reads them for Your Deal and the agent page, and edits/removes fee lines when the
-- out-the-door breakdown is recorded later.
grant select, insert, update, delete on public.offer_fees, public.offer_vehicle_options to service_role;
-- Existing tables altered here (qualifying_offers, offer_addons, documents, dealerships,
-- agent_activity_types) keep their current grants; adding columns doesn't change them.

-- (The customer-read lock on qualifying_offers is a separate main migration: Appendix A.)

-- New activity types.
insert into public.agent_activity_types (code, label, category) values
  ('offer_draft_saved', 'Saved an offer draft', 'offer'),
  ('offer_sent', 'Sent an offer to the customer', 'offer'),
  ('offer_warning_confirmed', 'Confirmed an offer warning', 'offer'),
  ('offer_otd_recorded', 'Recorded an out-the-door breakdown', 'offer'),
  ('dealer_link_created', 'Asked a dealer to submit an offer', 'dealer'),
  ('dealer_link_revoked', 'Cancelled a dealer offer link', 'dealer'),
  ('dealer_submission_discarded', 'Discarded a dealer submission', 'offer');

commit;
```

Notes:
- `vehicle_option_name` and `fee_kind` follow the distinct-column-names rule, so nothing clashes with `name` or `kind` in joins.

### 3.3 Migration OE-2: submissions, dealer links, attempts, functions

```sql
-- OE-2 (draft).
begin;

create table public.dealer_offer_requests (
  id uuid primary key default gen_random_uuid(),
  customer_search_id uuid not null references public.customer_searches (id) on delete cascade,
  created_by_agent_id uuid not null references public.agents (id),
  token_hash text not null unique,                 -- HMAC-SHA256; the raw token is never stored
  request_dealer_name text not null check (char_length(request_dealer_name) <= 200),
  request_dealer_email text check (char_length(request_dealer_email) <= 320),
  dealer_alias_id uuid references public.dealer_aliases (id),
  listing_id uuid references public.listings (id),
  delivery_channel text not null check (delivery_channel in ('email', 'copied_link')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_by_agent_id uuid references public.agents (id),
  constraint dealer_offer_requests_7_days check (expires_at <= created_at + interval '7 days'),
  constraint dealer_offer_requests_revoke_shape check ((revoked_at is null) = (revoked_by_agent_id is null))
);
create index dealer_offer_requests_search_idx on public.dealer_offer_requests (customer_search_id);

create table public.offer_submissions (
  id uuid primary key default gen_random_uuid(),
  customer_search_id uuid not null references public.customer_searches (id) on delete cascade,
  submission_source text not null check (submission_source in ('agent', 'dealer_link', 'dealer_account')),
  dealer_offer_request_id uuid unique references public.dealer_offer_requests (id),
  submission_status text not null default 'draft'
    check (submission_status in ('draft', 'awaiting_review', 'sent', 'discarded')),
  payload_version smallint not null default 1,
  submitted_payload jsonb,       -- dealer's submission exactly as sent; never edited
  working_payload jsonb not null default '{}'::jsonb,   -- the agent's checked copy
  created_by_agent_id uuid references public.agents (id),
  submitted_at timestamptz,
  reviewed_by_agent_id uuid references public.agents (id),
  sent_qualifying_offer_id uuid unique references public.qualifying_offers (id),
  sent_at timestamptz,
  discarded_at timestamptz,
  discard_reason text check (char_length(discard_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_submissions_dealer_has_payload check (submission_source = 'agent' or submitted_payload is not null),
  constraint offer_submissions_sent_shape check ((submission_status = 'sent') = (sent_qualifying_offer_id is not null))
);
create index offer_submissions_review_idx on public.offer_submissions (submitted_at)
  where submission_status = 'awaiting_review';
create index offer_submissions_search_idx on public.offer_submissions (customer_search_id);
create trigger set_updated_at before update on public.offer_submissions
  for each row execute function public.set_updated_at();

alter table public.qualifying_offers
  add constraint qualifying_offers_submission_fk
  foreign key (offer_submission_id) references public.offer_submissions (id);

create table public.dealer_link_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_ip_hash text not null,
  attempt_outcome text not null check (attempt_outcome in ('bad_token', 'expired', 'used', 'opened', 'submitted', 'rejected')),
  created_at timestamptz not null default now()
);
create index dealer_link_attempts_ip_idx on public.dealer_link_attempts (attempt_ip_hash, created_at desc);

alter table public.dealer_offer_requests enable row level security;
alter table public.offer_submissions enable row level security;
alter table public.dealer_link_attempts enable row level security;
revoke select, insert, update, delete, truncate
  on public.dealer_offer_requests, public.offer_submissions, public.dealer_link_attempts
  from anon, authenticated;
-- Explicit grants (required after 2026-10-30). The public dealer page runs server-side with
-- the service role, so the dealer's browser never touches these tables.
grant select, insert, update on public.dealer_offer_requests to service_role;          -- create, open, use, cancel
grant select, insert, update, delete on public.offer_submissions to service_role;      -- delete: 30-day cleanup of discarded ones
grant select, insert, delete on public.dealer_link_attempts to service_role;           -- delete: old-attempt cleanup

-- Claims a link exactly once: sets used_at and creates the awaiting-review submission
-- in one statement. Returns the submission id, or raises 'link_unusable'.
create function public.claim_dealer_offer_request(p_token_hash text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.dealer_offer_requests; v_id uuid;
begin
  update public.dealer_offer_requests
     set used_at = now()
   where token_hash = p_token_hash and used_at is null and revoked_at is null and expires_at > now()
   returning * into v_req;
  if not found then raise exception 'link_unusable'; end if;
  insert into public.offer_submissions
    (customer_search_id, submission_source, dealer_offer_request_id, submission_status,
     submitted_payload, working_payload, submitted_at)
  values (v_req.customer_search_id, 'dealer_link', v_req.id, 'awaiting_review', p_payload, p_payload, now())
  returning id into v_id;
  return v_id;
end $$;

-- send_offer_submission(p_submission_id, p_agent_id, p_offer jsonb): one transaction that
--   1. locks the submission (must be 'draft' or 'awaiting_review'),
--   2. checks the search is 'searching' unless 'inactive_search' is in the confirmed warnings,
--   3. inserts qualifying_offers + offer_addons + offer_fees + offer_vehicle_options,
--   4. marks the submission 'sent',
--   5. logs offer_sent via log_agent_activity.
-- The notification email and the PDF/sticker document row are written by the app after
-- commit, so a failed email never undoes an offer and a half-written offer never emails.
-- (Full body drafted at build time from the live log_agent_activity text, per the
-- "replaced function built from its live migration text" rule.) It gets the same pair as
-- claim_dealer_offer_request below: revoke execute from public, anon, authenticated, and
-- grant execute to service_role.

revoke execute on function public.claim_dealer_offer_request(text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_dealer_offer_request(text, jsonb) to service_role;

commit;
```

### 3.4 Migration OE-3: customer state for tax estimates

```sql
-- OE-3 (draft). State per ZIP, from the free Census ZCTA-to-county relationship file
-- (2020 ZCTA5 to county, includes state FIPS). Imported by Brett from a committed CSV,
-- the same way zip_coordinates was loaded.
begin;
-- Existing table: keeps its current grants (anon/authenticated public read by policy).
alter table public.zip_coordinates add column state_code char(2)
  check (state_code ~ '^[A-Z]{2}$');

create table public.vehicle_tax_rates (
  state_code char(2) primary key check (state_code ~ '^[A-Z]{2}$'),
  rate_percent numeric(5,3) not null check (rate_percent >= 0 and rate_percent < 20),
  rate_basis text not null check (char_length(rate_basis) <= 300),
  cap_cents integer check (cap_cents > 0),
  typical_title_registration_cents integer check (typical_title_registration_cents >= 0),
  source_url text not null,
  checked_on date not null,
  created_at timestamptz not null default now()
);
alter table public.vehicle_tax_rates enable row level security;
revoke select, insert, update, delete, truncate on public.vehicle_tax_rates from anon, authenticated;
-- Explicit grant (required after 2026-10-30): the server only reads it; Brett imports the
-- rows through the SQL Editor or Table Editor as postgres.
grant select on public.vehicle_tax_rates to service_role;
commit;
```

### 3.5 Checks and rolled-back tests (pattern for each migration)

- **Privilege checks** use `has_table_privilege` and `has_function_privilege` across `('anon'), ('authenticated'), ('service_role')`, so nothing actually selects and one denial can't abort the others. There's one result column per privilege, with distinct aliases (`can_select`, `can_insert`, …).
- **Grant check for each migration** (the CLAUDE.md template), with these expected results:

  | Object | anon | authenticated | service_role |
  |---|---|---|---|
  | `offer_fees`, `offer_vehicle_options` (OE-1) | all false | all false | select, insert, update, delete true; truncate false |
  | `dealer_offer_requests` (OE-2) | all false | all false | select, insert, update true; delete, truncate false |
  | `offer_submissions` (OE-2) | all false | all false | select, insert, update, delete true; truncate false |
  | `dealer_link_attempts` (OE-2) | all false | all false | select, insert, delete true; update, truncate false |
  | `claim_dealer_offer_request(text, jsonb)`, `send_offer_submission(…)` (OE-2), via `has_function_privilege(…, 'EXECUTE')` | false | false | true |
  | `vehicle_tax_rates` (OE-3) | all false | all false | select true; the rest false |
  | Existing tables OE-1 alters (`qualifying_offers`, `offer_addons`, `documents`, `dealerships`) | unchanged by OE-1 | unchanged | select, insert, update, delete true, as before |

  - Expected: false for every new table and function, for both roles.
- **Rolled-back rule test** (the Step 16 style): a temp table of numbered cases, each case in its own `begin … exception when others then … end` sub-block, then `set constraints all immediate`, then a pass/fail select, then `rollback`. Cases:
  1. An out-the-door shape with only the source set is refused.
  2. An unknown warning code is refused.
  3. A fixed fee kind can't appear twice.
  4. An 'other' fee with no label is refused.
  5. An extra option that's off the car is refused.
  6. A link with a 10-day expiry is refused.
  7. `claim_dealer_offer_request` works once, then raises `link_unusable`.
  8. An expired link raises `link_unusable`.
  9. A revoked link raises `link_unusable`.
  10. A sent submission without an offer id is refused.
  11. `is_below_msrp` is unchanged by adding fees and add-ons (an offer at $28,100 vs $30,895 with $5,000 of fees is still `true`).
- **Parse check:** each migration is parse-checked offline (libpg-query) before Brett runs it, one step at a time, and committed after his results, as in Phase 1.

### 3.6 Files and uploads

- **Direct-to-storage uploads (decided):** the window sticker (agent or dealer) and the existing offer-sheet PDF. The window sticker is optional but encouraged for agent-entered offers, and required on dealer links.
  - The server checks the link or the agent, then creates a Supabase **signed upload URL** for one exact path: `offer-submissions/<submission-or-request id>/<uuid>.<ext>` in the private `documents` bucket.
  - The browser uploads straight to storage, so the 4.5 MB Vercel limit doesn't apply.
  - On submit, the server checks the object exists, its size (≤ 15 MB), and its type by the file's first bytes, not its name: PDF, JPEG, PNG or HEIC. Anything else is deleted and refused.
  - Signed upload URLs expire after 10 minutes.
- **Viewing:** signed download URLs for agents and customers last 15 minutes, as today.
- **On send:** the file is copied into the offer's folder and a `documents` row (`window_sticker`) is written.
- **Cleanup:** the existing end-of-search cleanup cron is extended to window stickers and to discarded or expired submissions after 30 days.

### 3.7 What the work queue (next phase) will read

Recorded now so the queue needs no new columns:
- submissions with `awaiting_review` (and their `submitted_at` age);
- offers with no out-the-door figure (`otd_source is null`, plus `otd_requested_at` age);
- `good_until` approaching;
- dealer links sent but unused, and their `expires_at`;
- `warnings_confirmed` (for lead review);
- activity rows for every step.

---

## 4. Screens and behaviour

### 4.A Agent Log Offer redesign

A dedicated full-width page, not the inline form in the card: `/internal/outreach/[searchId]/offer` (and `?submission=<id>`). The search card gets a "Log an offer" button. Dense dark internal style, matching `/internal`.

**Header toggle:** "I'm entering it" / "From dealer link (N new)". N counts the search's `awaiting_review` submissions. The second tab lists them (dealer, submitted time); choosing one opens it in the same five steps, pre-filled from `working_payload`, with the dealer's original values shown in grey wherever the agent changes something.

**Step 1: Paste the quote.**
- Paste text, or attach a quote PDF and a window sticker (photo or PDF).
- The parser is extended:
  - It also reads the VIN, stock number, colours, sticker total, doc fee, tax, title and registration, other fees, good-until date, and sticker option lines with prices. Window sticker images go to Claude as image or document input.
  - Each extracted field also returns `confidence: high|low`, and the model is instructed to answer low whenever the value is inferred, partly legible or ambiguous.
- Low-confidence fields get an amber "Check this" marker in the later steps.
- The sticker total is still never accepted unconfirmed: a parsed sticker total pre-fills the field, but it's always marked "Check this" (it decides the guarantee).
- The parser still never writes anything.

**Step 2: Pick the car.**
- The listing picker shows synced listings for the search's make, model and model year, filtered to the customer's ranked trims (all trims, behind a toggle), sorted nearest first. Distance is customer ZIP to dealer ZIP centroid, as for dealers today.
- Each row: dealer, miles, exterior and interior with ✓ or "not your pick" against the customer's ranked colours, stock #, the last 8 of the VIN, and the listed price.
- Interior comes from `raw_data->>interior_color` (83% of listings have it).
- "Not listed — enter VIN by hand" gives VIN, stock #, exterior and interior fields.
- **No MarketCheck calls**: the picker reads what's already synced.

**Step 3: Options on this car.**
- **The customer's wanted options first:** ranked features and packages, then ranked colours and interior for reference. Each is ticked "On the car" or "Not on the car".
- **"Also on the sticker":** lines the parser found, or the agent adds, that the customer didn't ask for. Each is tagged "Not asked for", plus Dealer-installed or Port-installed where our data or the sticker says so, with its sticker price.
- A separate tick, "Trim matches what the customer chose" (`trim_match_confirmed`), is required before Send. Options never affect it.

**Step 4: Price.**
- **Three tiles:**
  - Sticker (Total SRP);
  - Negotiated (price, with the discount in $ and %);
  - Out-the-door (total, labelled "Our estimate" or "Dealer's quote", or "Not recorded yet").
- **Build-total note (information only):** when the sticker differs from the customer's configurator build total (base + destination from the dataset, plus their ranked options' prices), the page explains it from the step-3 ticks. For example: "Sticker is $1,330 higher than the customer's build — explained by 1 option the customer didn't ask for (Panoramic roof $1,330)." When the ticks don't explain the whole difference, it says so plainly.
- **Guarantee line**, driven by decision 3:
  - "Counts toward the guarantee: negotiated price is $2,795 below this car's sticker."
  - Or: "Doesn't count toward the guarantee: the price isn't below this car's sticker."
  - The trim condition: "…and the trim matches ({trim})". Options never appear in this line.
- **Inputs:**
  - sticker total (keeps the approved sticker warnings);
  - negotiated price;
  - doc fee;
  - title and registration;
  - sales tax, with an "Estimate it" button using section 4.D;
  - the out-the-door source (Our estimate / Dealer's quote);
  - add-on rows (name, amount, "Customer didn't ask for this" auto-ticked unless it matches a wanted dealer-installed item, "Dealer says it can be removed");
  - other fee rows;
  - an explicit "No add-ons" / "No other fees".
- **Live preview:** the customer's breakdown exactly as they'll see it, using the same component as the customer detail view.

**Step 5: Terms.**
- Good until (a date), dealer contact, and an optional note to the customer (shown on their offer).

**Warnings that need a confirm click** (decided earlier; shown at Send, each needs its own tick):
- **Above sticker:** the negotiated price is at or above the sticker.
- **Duplicate:** this VIN is already on an offer for this search, or this dealer already has an open offer here.
- **Inactive search:** the search isn't `searching`, i.e. it's purchased, cancelled, switched or paused.

The ticked codes are stored in `warnings_confirmed` and logged (`offer_warning_confirmed`).

**Actions:**
- **Save draft** writes `working_payload` only. Nothing reaches the customer.
- **Send to customer** runs `send_offer_submission`, then the existing new-offer notification. If no out-the-door figure is recorded, it sets `otd_requested_at` and the customer sees "Out-the-door quote requested".
- **Discard** (dealer submissions only) requires a reason.
- **Add the out-the-door breakdown later:** a "Record out-the-door" panel on the sent offer reuses the step-4 fee inputs and logs `offer_otd_recorded`. It refuses to change the negotiated price or sticker; that's a new offer.

**Sidebar:**
- What the customer wants (ranked trims, colours, interior, options).
- The other offers on this search (dealer, status, out-the-door or "requested").
- **"Ask a dealer to submit":** dealer name, optional email, optional listing.
  - Two buttons: "Email the link" (sends the dealer email in section 6) and "Copy link" (shows the URL once).
  - Existing links for this search are listed with their status (sent, opened, submitted, expired, cancelled) and a "Cancel link" action.

### 4.B Dealer submission page (`/dealer-offer/[token]`)

- **Look:** public, light, LEVR logo, no site header or footer, `noindex`, phone-first single column (two columns from `md`).
- **Token handling:**
  - The token is 32 random bytes, base64url, in the path.
  - The server stores only `HMAC-SHA256(DEALER_LINK_HASH_SECRET, "levr-dealer-link:" + token)`. That's a new server-only secret, in Production only, set by Brett, never in chat. Same approach as `AGENT_SIGNIN_HASH_SECRET`. If the secret is missing, links fail closed.
  - Expiry is 7 days from creation, or one submission, whichever comes first (enforced in the check constraint and in `claim_dealer_offer_request`).
  - An agent can cancel a link, and creating a new link for the same dealer and search cancels the old one.
- **What the dealer sees** (decision 8):
  - make, model, model year;
  - acceptable trims (the customer's ranked trims, in order);
  - acceptable exterior colours and interiors (ranked, with "any other is fine" when the customer left the rest alone; exclusions are listed as "not wanted");
  - options wanted;
  - the buyer's general area.
- **The buyer's area (decided):** "ZIP area 672xx, KS", plus "about N miles from you" when the link names a specific car.
- **The dealer never sees** the customer's name, email, phone, exact ZIP or the search id. The page's data loader selects only these fields from the search, through one function tested to return nothing else.
- **Form sections** (decision 5: every field required, nothing saved until submit):
  - **Dealership and contact:** dealership, salesperson, phone, email (for their copy).
  - **The car:**
    - VIN (17 characters, checksum checked), stock #, exterior, interior;
    - each wanted option: On the car / Not on the car;
    - other options on the sticker (name, price) or "None".
  - **Price:**
    - sticker total; selling price;
    - add-ons (name, amount, "Can be removed") or "No add-ons";
    - doc fee; sales tax; title and registration. Sales tax and title & registration each offer "We don't collect this (out-of-state buyer)", which is still a required choice (decided). The customer then sees their estimated tax as "Paid at registration";
    - other fees (name, amount) or "None";
    - the out-the-door total.
  - **Terms:** good until (at least today, no more than 60 days out), window sticker upload (photo or PDF), notes (optional; the only optional field).
- **Arithmetic:**
  - The page adds the lines up live and shows "Your lines add up to $X".
  - The dealer enters their out-the-door total. If it differs from the sum by more than $1, submit is refused with that message. It catches a forgotten line, which is the common failure.
  - The server recomputes and enforces the same check, plus: selling price > 0, sticker > 0, and amounts within sane bounds (no line over $250,000).
- **After submit:**
  - A confirmation page.
  - The dealer gets a copy email of exactly what they submitted.
  - The agent sees "From dealer link (1 new)", and the assigned agent gets an email (Phase 1's assigned-agent routing; leads if unassigned).
  - The customer sees nothing until an agent sends it (decision 6).
- **Expired / used / cancelled / unknown link:** a plain page saying the link can't be used and to contact the LEVR agent who sent it (`support@levrauto.com`). The page doesn't say which case applies, so it gives nothing away.
- **Rate limiting and abuse:**
  - `dealer_link_attempts`: IPs are hashed with the same secret; outcomes are recorded.
  - Over 30 bad-token page loads per IP per 15 minutes returns a 429-style page.
  - At most 10 submit attempts per link (counted on the request).
  - A hidden honeypot field; a minimum 5 seconds on the page before submit.
  - Server-side size limits on every text field.
  - A Vercel Firewall rate-limit rule on `/dealer-offer/*` is suggested as a second layer (dashboard setting, Brett).
  - Preview builds refuse to create links, send link emails, and accept submissions (`runtime-env`).

### 4.C Customer offer pages

**Offer card** (decision: card shows sticker, price and discount):
- Keep "Trim · Color" and add the interior.
- "Offer: $28,100 — Total Suggested Retail Price: $30,895" and the savings line stay.
- **New out-the-door line:**
  - "Out-the-door: $31,742 · Dealer's quote", or "… · Our estimate",
  - or "Out-the-door quote requested".
- **The card price line is shortened** to "Negotiated price for the car." once the out-the-door line exists (decided; wording for sign-off in 6.4). The offer detail keeps the full sentence.
- Good until: "Good until Oct 31".
- The LEVRating chip beside the dealer: "New to LEVR — no rating yet", or "LEVRating 4.6 (12)".

**Offer detail:**
- **"How the price adds up"** is a vertical step chart built in plain HTML/CSS, with no chart library:
  1. Window sticker $30,895
  2. Discount −$2,795 (9%)
  3. Car price $28,100
  4. Dealer add-ons +$149
  5. Doc fee +$399
  6. Sales tax +$1,850
  7. Title & registration +$244
  8. Out-the-door $30,742
- Bars are scaled to the sticker. Each row has its label and amount; the discount is in green.
- **Notes under it:**
  - "Taxes are our estimate for now — your dealer will confirm the exact amount." (estimate only)
  - "Don't want the nitrogen fill? The dealer says they'll remove it." (per removable add-on)
- **Plus:**
  - the Vehicle section with interior, the options on the car (wanted ✓/✗, also on the car), and the window sticker (view);
  - good until, and the note from the agent.

**Accept:**
- **Blocked until a dealer's out-the-door quote is recorded** (2026-10-17 rule). "Our estimate" figures don't unblock it (decided 2026-10-18).
  - The footer says "Out-the-door quote requested — you can accept once it arrives."
  - `respondToOffer` refuses on the server too.
  - The agent's `confirmDepositReceived` refuses on an offer without one.
- The accept block shows the breakdown and the out-the-door total above the existing accept explanation.

**Side-by-side comparison** (new, from Your Deal: "Compare offers", shown with 2+ open offers):
- **Columns:** each offer. The header has the dealer name, city, miles and LEVRating chip.
- **Rows:**
  - Exterior and interior (✓ or "not your pick");
  - Options you want (N of N); Also on the car;
  - Window sticker; Discount ($ and %); Car price;
  - Dealer add-ons (with "can be removed"); Doc fee; Sales tax; Title & registration;
  - Out-the-door; Figures from (Dealer's quote / Our estimate); Good until;
  - a "Choose this offer" button that opens that offer's accept view.
- **Badge** "Lowest out-the-door", only when at least two offers have one. Estimates and quotes both count, with the source row making the difference visible.
- **Reuse:** the trim comparison's layout (one label-column constant, 160px minimum columns via `calc()`, `min-width` on the table, sticky row headers, headers that stack under 240px) and `useIsNarrowViewport`, `ComparisonCell` and `cellsDiffer`. These move into a shared comparison shell. The trim-specific row builders don't carry over; offers get their own (`offer-comparison-rows.ts`).
- **Phone layout (proposed):** two offers at a time instead of a squeezed scroll.
  - Each row becomes a label line above two value cells.
  - Each column header has ‹ › to swap in another offer, with an offer count ("1 and 2 of 4").
  - "Lowest out-the-door" pins first.
  - From `sm` up, the full table with sticky labels.
  - The alternative is the trim table's horizontal scroll (1.5 columns visible), which Terry-type users find harder to read.

**Sorting and badges:**
- **"Best total price"** sorts by out-the-door, with offers missing it last; ties go to price + delivery as today.
- **"Lowest out-the-door" replaces "Best value"** (decided; wording for sign-off in 6.4). It only shows when at least two offers have a figure.
- **"Best discount"** stays: it's the guarantee-relevant view.

**Map:** the pin popup adds the out-the-door line. No other change.

**Delivery (decided):** when the customer takes delivery and a delivery estimate exists, the breakdown adds "Delivery estimate +$X" as its own out-the-door line, marked "from the dealer". It never counts toward the guarantee. If the dealer's quote already includes delivery, the agent records it as an 'other' fee instead.

### 4.D Sales tax estimates (no paid API)

- **State:** from the customer's ZIP, using the new `zip_coordinates.state_code`, imported from the free Census ZCTA-to-county relationship file.
  - This is exact for almost every ZIP. A ZIP that crosses a state line takes the state with most of its land area; there are very few.
- **Rate:** a committed `vehicle_tax_rates` table per state, researched in a Cowork pass with a source URL and check date per state:
  - the state's motor-vehicle sales or use tax rate;
  - its basis (on the price, or on price minus trade-in);
  - any cap (e.g. South Carolina's maximum);
  - the no-tax states (Alaska, Delaware, Montana, New Hampshire, Oregon).
- **Estimate** = rate × (negotiated price + taxable add-ons + doc fee where the state taxes it). Shown as "Our estimate", with the state and rate in the note.
- **Accurate enough:** the state rate in flat-rate states; the no-tax states; states with a single vehicle excise rate (e.g. North Carolina's highway use tax); caps we record.
- **Not accurate:**
  - local and county add-ons (up to about 5% more in some places);
  - trade-in credits; rebate taxability;
  - out-of-state purchases (tax usually goes to the buyer's state at registration);
  - doc fee taxability where it varies;
  - title and registration, which depend on vehicle value, weight and county.
- **Recommendation:**
  - Estimate sales tax only.
  - Title and registration (decided): a per-state "typical new-car amount" from the same Cowork pass, labelled as an estimate.
  - The wording always says it's an estimate and that the dealer will confirm.

---

### 4.E "Hard to beat sticker" watch list (agent-only; planned 2026-10-24, not built)

**What it is:** a short list of vehicles where getting a dealer below Total SRP is known to be hard (high demand, low supply, or makers that hold dealers to sticker). When a search matches, the agent sees a notice on the search card and in the Log Offer sidebar, so they plan the search accordingly. **It's never shown to customers and never affects the guarantee:** the Day-30 rule, the guarantee line and every customer page ignore it.

**Why this phase:** the notice belongs next to the offer-entry agent pages (Log Offer and its sidebar, 4.A). The work-queue phase can later show it on the per-search page as well.

**Data file `data/hard-to-beat-sticker.json`** (reviewed like `data/held-models.json`; a change reaches the site on the next deploy). Each entry has:
- `make` and `model`, exactly as in our dataset;
- optionally `trim`, `model_year` and `fuel_type`;
- a short `why`, and `source` with its date.

**Matching:** an entry matches a search when the make and model match and, if the entry names them:
- **trim:** the search's #1 ranked trim is that trim; if it's ranked lower, the notice says "if they end up with the {trim}"; with no trim chosen yet, the same;
- **year:** the committed year matches;
- **fuel type:** the ranked trim's powertrain matches.

**Notice (wording for sign-off):** "Hard to beat the sticker: {why} (checked {date})." In amber, the same style as the existing "price not confirmed" notes.

**Starting entries** (Brett's research `claude/no-guarantee-brand-research-2026-10`, as of 2026-10-24; checked against our dataset's names). The `why` column is the notice text; the date is the source date.

| Make | Model | Narrowed by | Why (source, date) | In our dataset? |
|---|---|---|---|---|
| Toyota | RAV4 | fuel type Hybrid or PHEV | +4–5% over sticker, markups $4k–$15.7k (Carscoops 2026-05-19; Consumer Reports 2026-10-14) | yes (every 2026 RAV4 in the dataset is Hybrid or PHEV) |
| Toyota | Corolla Cross | fuel type Hybrid | +4% (Consumer Reports 2026-10-14) | yes |
| Toyota | Sienna | | listed above MSRP on average (VINdow Sticker, Apr 2026) | yes |
| Toyota | GR86 | | +3% (Consumer Reports 2026-10-04) | yes |
| Toyota | GR Supra | | listed above MSRP on average (VINdow Sticker, Apr 2026) | yes |
| Lexus | GX | | +1.8% to +2.4% on all trims, 260 sales (TrueCar 2026-10-24) | yes |
| Honda | Prelude | | about +1% (TrueCar 2026-09-20) | yes |
| Honda | Civic | trim Type R | dealer markups (owner reports, Jan 2026; weak source) | yes |
| Chevrolet | Corvette | trims ZR1, ZR1X | markups of $100k+ (GM Authority, Dec 2025; stale) | yes |
| Cadillac | Celestiq | | (from the research list; no figure given) | **no**, kept so it matches once added |
| Ford | Mustang | trim GTD | (from the research list; no figure given) | **no**, kept so it matches once added |
| Ford | F-150 | trim Raptor R | $12k–$25k asks (forums, Dec 2025–Feb 2026; weak source) | yes |
| Ford | Maverick | fuel type Hybrid | about +7% (CarEdge, Apr 2026) | yes |
| Ram | 1500 | trim TRX | (from the research list; no figure given) | **no**, kept so it matches once added |
| Porsche | 911 | trim Turbo S | $10k–$70k markups (autoevolution 2026-05-29) | yes |
| Porsche | 911 | the GT models: GT3, GT3 RS, S/T, Spyder RS | allocation, $30k–$80k over (Automonitor 2026) | GT3 yes (as "GT3", "GT3 w/Touring Package", "GT3 S/C"); GT3 RS, S/T and Spyder RS not in the dataset yet |
| BMW | M2 | trim CS | +4.0% (TrueCar 2026-10-24) | yes |
| BMW | M3 | trim CS | allocation, markups up to $25k (BMWBlog 2026-05-31) | yes, as the 2027 "CS Handschalter" |
| Mercedes-Benz | G-Class | | +4.7% to +6.3% (TrueCar 2026-10-24) | yes |
| Kia | Telluride | model year 2027, trims LX, S, EX, X-Line EX | +0.1% to +0.6% (TrueCar 2026-10-24) | yes; our dataset spells the last one "EX X-Line", so the entry uses that spelling |

**Source strength:** the notice shows the source and date as given, so an agent can see when a source is weak or stale (Civic Type R, Corvette ZR1, Raptor R). Entries should be re-checked on the periodic review schedule (business plan, "Data & Policy Freshness").

**Verification:** a disposable agent and a test search for a listed vehicle (notice shown on the card and in Log Offer), one with a non-matching trim (no notice), and a customer view of the same search (no notice anywhere).

## 5. Build chunks (in order; each reviewed before the next)

| # | Chunk | Tests |
|---|---|---|
| 0 | Merge `main` into the Phase 1 branch; re-run Chunk 8's full test pass (no new features). Then Phase 1 deploys after the tester round. | Chunk 8 pass list; Phase 1 sign-in 48 actions × 3 sessions |
| 1 | Migrations OE-1, OE-2 (and OE-3 once the tax research exists). Brett runs each. | Privilege checks (anon + authenticated); rolled-back rule tests 1–11; column grants vs every customer read |
| 2 | Pure modules: `offer-pricing.ts` (discount, out-the-door sum, arithmetic check, guarantee eligibility unchanged), `offer-warnings.ts`, `tax-estimate.ts`, `vin-check.ts`. | Node unit tests: sums, rounding, $1 tolerance, the guarantee ignoring fees and add-ons, warnings, VIN checksum, capped and no-tax states |
| 3 | `send_offer_submission` and the agent draft/send actions (role gates, activity rows, notification after commit). | Rolled-back SQL test; disposable-agent run: draft never visible to the customer, send creates everything at once, the inactive-search refusal, Brett's activity count unchanged |
| 4 | Agent Log Offer page, steps 1–5 + sidebar + warnings + preview (no dealer links yet). | Disposable runs per warning; screenshots |
| 5 | Parser extension (more fields, confidence, window sticker image/PDF); direct-to-storage uploads. | Unit tests on normalization; 5 real sticker samples (Brett supplies or approves) parsed, with low-confidence marks checked by hand; file type/size refusals |
| 6 | Listing picker (trim filter, nearest first, interior from raw_data, last 8 of VIN). | Real synced Camry/Civic data; unit test for the sort |
| 7 | Dealer links: create, email, copy, cancel; `DEALER_LINK_HASH_SECRET`. | Token-hash unit tests; preview refusal; the email goes only to the dealer address |
| 8 | Dealer submission page + uploads + rate limits + copy email + review tab. | Expired/used/cancelled/bad token; double submit; arithmetic refusal; honeypot; data loader returns no customer identity (asserted on the rendered page text); desktop + phone screenshots |
| 9 | Customer card/detail: out-the-door line, step chart, options, good until, LEVRating chip, accept gating. | Accept refused without a quote (UI + server); the existing accept tests; desktop + phone screenshots |
| 10 | Offer comparison (desktop table + phone two-up); sorting and badge changes; map popup. | Unit tests for rows and badge; screenshots at 1280 and 390 |
| 11 | Sample offers for testers carry interior, options and an out-the-door breakdown ("Our estimate"), so testers can try everything. | Sample-offer run on a disposable tester-suffix account |
| 12 | Close-out: site-language inventory, agent process reference, system models, the Stripe live-mode checklist unblocked. | Doc review |

---

### 5.1 Chunk 0 status (2026-10-18 to 10-24)

- **Merge:** `main` (`e8c35f7`) merged into `agent-dashboard-phase1-code` in its worktree. It's **staged, not committed, not pushed**.
- **Four conflicts, all resolved by keeping both sides:**
  - `log-offer-form.tsx`: the branch's `aiParsed` plus main's destination note;
  - `outreach-actions.ts`: imports from both;
  - `outreach/page.tsx`: the branch's `hasRole` plus main's option-display and Dealer-installed imports;
  - `outreach-queue.ts`: the branch's paged reads plus main's `dealerInstalled` field, body-style columns and `bodySplitter`.
- **Clean:** `tsc`; `next build --webpack`; lint (the same 9 older errors as `main`); unit tests 132/132.
- **Checked by reading the code:** main's sticker ranges, destination refusal and Total SRP label survive alongside the branch's attribution (`logged_by_agent_id`) and activity logging.
- **End-to-end re-run, two attempts.** Most chunks passed:
  - c2 49/49, c3-A 22/22, c3 switch 11/11, c4-A 17/17, c4 auto-resolve 6/6;
  - c5-A 30/30, c6-A 24/24, c7 7/7, c8 jobs 23/23;
  - c2 forced 7/7, c3-B 9/9, c4-B 8/8, c4 simulate 6/6;
  - c1a accounts 21/21, c1g rotation 8/8, c16-1e 36/36.
- **Not clean:**
  - c7b listings and id-list: 1 failure each.
  - c6-B: 1 failure, and it ran for 6,178 s, which suggests the server hung.
  - c5-B and c7 paging: no result.
  - c1c invite: 20/21.
  - c1d actions: 56 of 144 refused cleanly, 1 problem.
  - c1d probe: 0/0 after 1,111 s.
  - Not run: several Chunk 1 scripts.
- **The test harness is gone.** It lived in the session scratchpad under `/private/tmp`, and macOS's automatic cleanup of old files there deleted every test script and log, first the 2026-10-12–15 ones, then the rest by 2026-10-24. The failures above can't be investigated from logs.
- **Proposal (needs Brett's go, since the scripts write to the database):** rebuild the Phase 1 end-to-end tests as committed files under `scripts/tests/phase1/` on the branch, so they survive. Then re-run before the merge is committed. The many slow runs point to the dev server stalling, which a fresh run can confirm or rule out.

## 6. Wording for sign-off (every new or changed line)

### 6.1 Agent (Log Offer page, sidebar, review)

| Where | Text |
|---|---|
| Search card button | Log an offer |
| Page title | Log an offer for {customer first name} — {year} {make} {model} |
| Toggle | I'm entering it / From dealer link ({N} new) |
| Step names | 1 Paste the quote · 2 Pick the car · 3 Options on this car · 4 Price · 5 Terms |
| Step 1 help | Paste the dealer's email or call notes, or attach their quote. Attach the window sticker if you have it. AI fills in what it can — check anything marked. |
| Low-confidence marker | Check this |
| Sticker marker (always, when parsed) | Check this against the window sticker |
| Attach buttons | Attach quote · Attach window sticker (photo or PDF) |
| Upload refusals | That file is too large (15 MB max). / Upload a PDF, JPEG, PNG or HEIC file. |
| Step 2 heading | Pick the car |
| Picker filter | Your customer's trims · All trims |
| Picker columns | Dealer · Miles · Exterior · Interior · Stock # · VIN (last 8) · Listed price |
| Match marks | ✓ (their pick) · not their pick |
| Fallback | Not listed — enter VIN by hand |
| Step 3 headings | What the customer wants · Also on the sticker |
| Tick labels | On the car · Not on the car |
| Extra tag | Not asked for |
| Add extra | + Add a sticker option |
| Step 4 tiles | Sticker · Negotiated · Out-the-door |
| Tile sublabels | {$X} below sticker ({N}%) · Dealer's quote · Our estimate · Not recorded yet |
| Build-total note | The sticker is {$X} {higher/lower} than the customer's build. Explained by {N} option(s) the customer didn't ask for: {list}. |
| Build-total note (unexplained) | The sticker is {$X} {higher/lower} than the customer's build, and the options on this car don't explain all of it. The guarantee still uses this car's sticker. |
| Guarantee line (counts) | Counts toward the guarantee: the negotiated price is {$X} below this car's sticker. |
| Guarantee line (doesn't) | Doesn't count toward the guarantee: the negotiated price isn't below this car's sticker. |
| Fee labels | Doc fee · Title & registration · Sales tax · Other fees |
| Estimate button | Estimate it |
| Estimate result | Estimated at {state}'s {rate}% vehicle tax rate. |
| Source choice | Out-the-door figures are: Our estimate · The dealer's quote |
| Add-on row ticks | Customer didn't ask for this · Dealer says it can be removed |
| None choices | No add-ons · No other fees |
| Preview heading | What the customer will see |
| Step 5 labels | Good until · Dealer contact · Note to the customer (optional) |
| Note help | Shown on the customer's offer. |
| Buttons | Save draft · Send to customer · Discard |
| Draft saved | Draft saved. The customer can't see it. |
| Sent | Sent to {customer first name}. |
| Out-the-door missing at send | No out-the-door figures yet. The customer will see "Out-the-door quote requested", and can't accept until you record the dealer's quote. |
| Warning: above sticker | The negotiated price ({$X}) isn't below the sticker ({$Y}). It won't count toward the guarantee. Send it anyway? |
| Warning: duplicate VIN | This VIN is already on an offer for this search ({dealer}, {date}). Send another offer for the same car? |
| Warning: duplicate dealer | {dealer} already has an open offer on this search. Send another one? |
| Warning: inactive search | This search is {purchased / cancelled / switched / paused}. Send an offer to it anyway? |
| Confirm tick | Yes, send it |
| Discard reason prompt | Why are you discarding this submission? |
| Record later panel | Record out-the-door |
| Record later refusal | The price and sticker can't change on a sent offer. Log a new offer instead. |
| Sidebar headings | What the customer wants · Other offers on this search · Ask a dealer to submit |
| Other offers row | {dealer} · {status} · Out-the-door {$X} / requested |
| Ask-a-dealer fields | Dealership · Dealer's email (optional) · Car (optional) |
| Ask-a-dealer buttons | Email the link · Copy link |
| Copy shown-once note | Copy it now — you won't be able to see this link again. It works once and expires in 7 days. |
| Link statuses | Sent · Opened · Submitted · Expired · Cancelled |
| Cancel link | Cancel link |
| Agent email: new submission (subject) | A dealer submitted an offer for {customer first name}'s {make} {model} |
| Agent email: body | {dealer} submitted an offer through a LEVR link. Review it before the customer sees it: {link}. |
| Activity labels | Saved an offer draft · Sent an offer to the customer · Confirmed an offer warning · Recorded an out-the-door breakdown · Asked a dealer to submit an offer · Cancelled a dealer offer link · Discarded a dealer submission |

### 6.2 Dealer (link email, page, copy email)

| Where | Text |
|---|---|
| Link email subject | LEVR Auto buyer request: {year} {make} {model} |
| Link email body | Hi {dealership}, I'm {agent first name} with LEVR Auto. I have a buyer ready for a {year} {make} {model} {trim}. If you have one, please send me your best price through this secure link — it takes a few minutes and works once: {link}. The link expires on {date}. Thanks, {agent first name}, LEVR Auto |
| Page title | Submit an offer for a LEVR Auto buyer |
| Intro | A LEVR Auto buyer is looking for this car. Fill in every section and submit once. A LEVR agent reviews your offer before the buyer sees it. |
| Buyer wants heading | What the buyer wants |
| Buyer wants lines | {year} {make} {model} · Trims, in order: {list} · Colors they'd take: {list} (or any other) · Not wanted: {list} · Interior: {list} · Options wanted: {list} · Buyer's area: ZIP area {xxx}xx, {ST} · About {N} miles from you |
| Section headings | Your dealership · The car · Price · Terms |
| Dealership fields | Dealership name · Your name · Phone · Email (we'll send you a copy) |
| Car fields | VIN · Stock number · Exterior color · Interior |
| Wanted option prompt | Is this on the car? Yes / No |
| Other sticker options | Other options on the window sticker · Option · Price · + Add another · None |
| Price fields | Window sticker total · Selling price · Add-ons · Can be removed · No add-ons · Doc fee · Sales tax · Title & registration · Other fees · None · Out-the-door total |
| Not-collected choice | We don't collect this (out-of-state buyer) |
| Live sum | Your lines add up to {$X}. |
| Sum mismatch | Your lines add up to {$X}, but you entered {$Y} as the out-the-door total. Check for a missing or extra line. |
| Terms fields | Offer good until · Window sticker (photo or PDF) · Notes for the LEVR agent (optional) |
| Required-field message | Please fill this in. |
| VIN message | Check the VIN — it should be 17 characters. |
| Submit button | Submit offer |
| Submitting | Submitting… |
| Thank-you page | Thanks — your offer is in. A LEVR agent will review it and may contact you with questions. We've emailed you a copy. |
| Unusable link page | This link can't be used. It may have expired or already been used. Contact the LEVR agent who sent it, or email support@levrauto.com. |
| Too many attempts | Too many attempts. Please try again in a few minutes. |
| Copy email subject | Your offer to LEVR Auto: {year} {make} {model} (VIN {last 8}) |
| Copy email body | Here's a copy of the offer you submitted on {date}: {full submitted lines}. A LEVR agent will review it before the buyer sees it. Questions? Reply to this email or contact support@levrauto.com. |

### 6.3 Customer (card, detail, accept, comparison, email)

| Where | Text |
|---|---|
| Card vehicle line | Trim: {trim} · Color: {exterior} · Interior: {interior} |
| Card out-the-door | Out-the-door: {$X} · Dealer's quote / Out-the-door: {$X} · Our estimate |
| Card requested | Out-the-door quote requested |
| Card good until | Good until {date} |
| LEVRating chip | LEVRating {n.n} ({count}) / New to LEVR — no rating yet |
| Detail chart heading | How the price adds up |
| Chart rows | Window sticker · Discount · Car price · Dealer add-ons · Doc fee · Sales tax · Title & registration · Other fees · Delivery estimate · Out-the-door |
| Estimate note | Taxes are our estimate for now — your dealer will confirm the exact amount. |
| Removable add-on note | Don't want the {add-on}? The dealer says they'll remove it. |
| Options section | Options on this car · What you asked for · Also on this car |
| Option marks | ✓ On the car · ✗ Not on this car |
| Sticker link | View the window sticker |
| Agent note heading | A note from your agent |
| Accept blocked | Out-the-door quote requested — you can accept once it arrives. |
| Accept block heading | Your out-the-door price |
| Compare button | Compare offers |
| Comparison title | Compare your offers |
| Comparison rows | Exterior · Interior · Options you want · Also on the car · Window sticker · Discount · Car price · Dealer add-ons · Doc fee · Sales tax · Title & registration · Out-the-door · Figures from · Good until |
| Match marks | ✓ · not your pick |
| Options count | {N} of {M} |
| Add-on removable note | can be removed |
| Figures from values | Dealer's quote · Our estimate · Requested |
| Badge | Lowest out-the-door |
| Button | Choose this offer |
| Phone pager | {a} and {b} of {N} |
| Sort label change | Best total price (now sorts by out-the-door) |
| New-offer email line (added) | Out-the-door: {$X} ({dealer's quote / our estimate}). / The dealer's out-the-door quote is on its way. |
| New email: out-the-door arrived (subject) | Your out-the-door price from {dealer} is in |
| New email: body | {dealer} sent their out-the-door price for your {make} {model}: {$X}. You can now accept this offer. Go to Your Deal. |
| FAQ "What will I actually pay?" | The redraft recorded in the roadmap (2026-10-17), for sign-off once built |

---

### 6.4 Added 2026-10-18 (Brett's answers), for sign-off

**Guarantee wording review.** I checked every customer-facing page, the FAQ, the emails, the guarantee section, the how-it-works steps, the switch screens, Your Deal and the e-sign service agreement template for anything tying the guarantee to options.
- The service agreement doesn't define the guarantee; it says "This acknowledgment does not affect the terms of the money-back guarantee described at signup."
- `/terms` is still the placeholder awaiting attorney review.
- **One passage could be read as tying the guarantee to the customer's own build:** the FAQ's Total SRP answer ("…for your exact vehicle — the base price, plus any factory-installed options…").
- Nothing else ties the guarantee to options.

| Where | Current text | Proposed text |
|---|---|---|
| FAQ "What do you mean by 'Total Suggested Retail Price'?" (`src/app/faq/page.tsx`) | Total Suggested Retail Price (Total SRP) is the full manufacturer-suggested price for your exact vehicle — the base price, plus any factory-installed options, plus the manufacturer's destination/delivery charge, all added together. This is the same "Total" figure printed on your vehicle's official window sticker, sometimes shown as a separate line from the base "Manufacturer's Suggested Retail Price." It doesn't include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own. Our guarantee always compares a dealer's offer against this full number — so you're never left guessing which figure on the sticker actually counts. | Total Suggested Retail Price (Total SRP) is the full manufacturer-suggested price printed on a car's official window sticker — its base price, plus the factory-installed options on that car, plus the manufacturer's destination/delivery charge, all added together. It's sometimes shown as a separate line from the base "Manufacturer's Suggested Retail Price," and it doesn't include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own. Our guarantee compares each offer's negotiated price with that car's own Total SRP, for a car that matches the make, model and trim you chose. Options, color, add-ons, taxes and fees don't affect it. |
| Offer card, under the price (`offer-price-copy.ts`, short) | Negotiated price for the car. Excludes tax, title, registration, doc fee and add-ons. | Negotiated price for the car. (once the out-the-door line is on the card) |
| Offer badge | Best value | Lowest out-the-door |
| Offer card / detail, options summary | *(none)* | Options you wanted: {N} of {M} |
| Detail chart and accept block, out-of-state tax | *(none)* | Sales tax · Paid at registration (our estimate) {$X} |
| Detail chart, title & registration estimate | *(none)* | Title & registration · Our estimate {$X} |
| Detail chart note, delivery | *(none)* | Delivery estimate from the dealer. It doesn't affect your guarantee. |
| Dealer page, buyer's area | *(was drafted as "near {state}, ZIP area {xxx}xx")* | ZIP area {xxx}xx, {ST} · About {N} miles from you (when the link names a car) |
| Agent Log Offer, required tick | *(none)* | Trim matches what the customer chose ({trim}) |
| Agent guarantee line (counts) | *(drafted in 6.1)* | Counts toward the guarantee: the trim matches and the negotiated price is {$X} below this car's sticker. |
| Agent guarantee line (doesn't count, price) | *(drafted in 6.1)* | Doesn't count toward the guarantee: the negotiated price isn't below this car's sticker. |
| Agent guarantee line (trim not confirmed) | *(none)* | Confirm the trim matches before sending. |
| Agent window sticker hint | *(none)* | Optional, but attach it if you can — it's how we check the sticker. |

## 7. Verification plan

- **Accounts:** only disposable accounts: `claude-verify-<ts>-<rand>@levrauto-test.invalid` customers and agents, and the persistent test admin for lead/admin actions.
  - Never Brett's account, `test-verification@levrauto.invalid`, `tester1`–`11`, `brett-deal-review` or the training agent.
- **Brett's activity count:** recorded before and after every run; any difference fails the run.
- **Dealer-link tests:**
  - send email only to a test-domain address (suppressed);
  - copy-link tests use the link directly;
  - expiry is tested by setting `expires_at` in the past on the test row.
- **Cleanup:** every run deletes what it made (submissions, offers, fees, options, links, attempts, documents, storage objects, activity rows) and confirms by count.
- **Screenshots** of every screen before Brett approves any UI:
  - the agent page at desktop width;
  - the dealer page and customer pages at desktop (1280) and phone (390);
  - stored under `~/Downloads/levr-offer-entry-<chunk>-<date>/`.
- **MarketCheck:** no calls. Everything uses synced listings.
- **Real window stickers:** the parser chunk needs 3–5 real window stickers (photos or PDFs). Brett supplies them, or approves public samples.

---

## 8. Risks, open questions, and suggested changes

### Risks
- **Tester round.** Existing sample offers have no out-the-door figure. If this deploys mid-round, testers can't accept. Deploy after the round, or backfill sample offers with an estimate (chunk 11).
- **Dealer link abuse.** It's a public form. Rate limits, a honeypot, single use, hashed tokens and agent review limit the damage; nothing a dealer submits reaches a customer unreviewed.
- **Wrong dealer data.** A dealer could type a sticker that includes their addendum. The approved sticker warnings and the window sticker upload cover it at review.
- **Tax estimates being wrong.** Mitigated by the "estimate" label and by requiring a dealer's quote to accept.
- **Merge size.** Chunk 0 must happen first. Waiting makes it worse.
- **Column-level grant.** Must be checked against every customer read before running OE-1.

### Answers (Brett, 2026-10-18)
1. **Guarantee check:** stays price below the car's own sticker. The agent confirms the trim matches on each offer (`trim_match_confirmed`).
2. **The guarantee is tied to make, model and trim only.** Options (wanted or not), colour, add-ons, taxes, fees and delivery never affect it. Options show to the customer as information ("Options you wanted: N of N").
   - Core Processes and the business plan are updated, with an attorney-review flag (`e8c35f7`).
   - Customer copy that could tie the guarantee to options is in 6.4.
3. **"Our estimate" figures can't be accepted.** Acceptance needs the dealer's quote.
4. **"We don't collect this (out-of-state buyer)"** is allowed and is still a required choice. The customer sees their estimated tax as "Paid at registration".
5. **Title and registration:** a per-state typical amount, labelled as an estimate.
6. **Delivery estimate:** its own out-the-door line when the customer takes delivery. It never counts toward the guarantee.
7. **Dealer's view of the buyer's area:** "ZIP area 672xx, KS", plus distance when the link names a specific car.
8. **"Lowest out-the-door" replaces "Best value"**, and the card price line is shortened. Both are in 6.4 for sign-off.
9. **Window sticker:** optional but encouraged for agent-entered offers; required on dealer links.
10. **Chunk 0:** go. Merge `main` into `agent-dashboard-phase1-code` and re-run all tests, without pushing or deploying. Status in section 5.1.
11. **LEVRating:** customers see it. The business plan is updated (`e8c35f7`).
12. **Large uploads:** direct-to-storage in this phase, including the existing offer-sheet PDF.
13. **Customer-readable agent notes:** fixed by a small standalone `main` migration (Appendix A, applied by Brett 2026-10-24), not part of this phase.

### Suggested changes to the decisions
- **Decision 7 (7-day links):** keep it. Also cancel a link automatically when the search stops being `searching`.
- **Decision 6 (review before the customer sees it):** keep it. Add the "submitted N hours ago" age to the review tab now, so the next phase's queue has it.
- **Decision 9 (LEVRating shown to customers):** the business plan is updated. The chip should only appear on confirmed dealerships. An unconfirmed alias shows "New to LEVR — no rating yet".

---

## Appendix A. Standalone fix on `main`: close the offers table to customers' own database role (APPLIED 2026-10-24)

**Applied by Brett in the Supabase SQL Editor, 2026-10-24 about 9:58 pm CDT (2026-10-25 02:58 UTC).** His before/after grant check: before, `anon` had SELECT, REFERENCES, TRIGGER and TRUNCATE and `authenticated` had full access on `qualifying_offers`; after, `anon_can_read = false`, `customer_can_read = false`, `server_can_read = true`, `server_can_write = true`. The policy "Customers can view offers on their own searches" is dropped. The SQL below is what ran; it's recorded as `supabase/migrations/20261025025800_offers_customer_read_lock.sql`. App check after it ran: see the verification note at the end of this appendix.

**Can it be fixed now, separately from this phase? Yes.**
- Every customer page and action that reads or writes `qualifying_offers` uses the server's service-role client. Nothing on the customer side goes through the customer's own role (`authenticated`), and the browser never queries it. So removing that role's access breaks nothing in the app.
- Today a signed-in customer could use the public anon key and their own session to read every column of their own offers, including agent-only `notes`, `withdrawal_reason`, `withdrawn_by_agent_id` and `logged_by_agent_id`. Row security already stops them seeing anyone else's offers.

**Every customer-side query that touches `qualifying_offers` (checked 2026-10-18 on `main`):**

| File | What it does | Client |
|---|---|---|
| `src/lib/customer-dashboard.ts` (`loadOffersBySearchId`, `getDealDetails`, guarantee read at :717) | Your Deal and `/account` offers, delivered_at stamp, guarantee timeline | service role (`createAdminClient`, :505/:664/:809) |
| `src/app/account/messages/[offerId]/page.tsx` | Offer message thread page | service role |
| `src/lib/offer-response-actions.ts` | Accept / decline | service role (after `auth.getUser`) |
| `src/lib/offer-highlight-actions.ts` | Highlight toggle | service role |
| `src/lib/offer-message-actions.ts` | Send a message, read state | service role |
| `src/lib/handoff-actions.ts` | Pickup / delivery choice, delivery-estimate request | service role |
| `src/lib/addon-actions.ts` | Request add-on removal | service role |
| `src/lib/offer-ownership.ts` | Ownership checks used by deal-progress and add-on actions | service role (passed in) |
| `src/lib/deal-progress-actions.ts` | Financing capture (via `offer-ownership.ts`) | service role |
| `src/app/survey/[surveyId]/page.tsx` | Post-deal survey (reads search and alias, not offers directly) | service role |

- The customer's own role reads only `customer_searches` (payment success, switch success, finalize, Your Car), and none of those selects embed offers.
- The browser client reads only `customers` (the header).

**Migration — `supabase/migrations/20261025025800_offers_customer_read_lock.sql` (applied by hand 2026-10-24):**

```sql
-- qualifying_offers: no access for anon or authenticated (the app reads it only through
-- the service role). Closes direct reads of agent-only columns (notes, withdrawal_reason,
-- withdrawn_by_agent_id, logged_by_agent_id) by a signed-in customer.
begin;
drop policy if exists "Customers can view offers on their own searches" on public.qualifying_offers;
revoke select, insert, update, delete, truncate, references, trigger
  on public.qualifying_offers from anon, authenticated;
-- Existing table, so service_role keeps its grants regardless of the 2026-10-30 change.
-- Stated explicitly anyway so the end state is the same whenever this runs (a no-op today).
grant select, insert, update, delete on public.qualifying_offers to service_role;
commit;
```

**Before/after check (read-only; one result column per privilege, distinct names):**

```sql
select r.role_name,
       has_table_privilege(r.role_name, 'public.qualifying_offers', 'SELECT') as can_select_offers,
       has_column_privilege(r.role_name, 'public.qualifying_offers', 'notes', 'SELECT') as can_read_notes,
       has_table_privilege(r.role_name, 'public.qualifying_offers', 'INSERT') as can_insert_offers,
       has_table_privilege(r.role_name, 'public.qualifying_offers', 'UPDATE') as can_update_offers,
       has_table_privilege(r.role_name, 'public.qualifying_offers', 'DELETE') as can_delete_offers
from (values ('anon'), ('authenticated'), ('service_role')) as r(role_name)
order by 1;

select count(*) as offer_policies_left
from pg_policies where schemaname = 'public' and tablename = 'qualifying_offers';
```

- **Expected before:** anon and authenticated both true in every column. The table-level privilege exists, which is the leak; row security is what currently filters rows. 1 policy.
- **Expected after:** anon and authenticated false in every column; service_role true in every column; 0 policies.
- No new table, view, sequence or function is created, so the 2026-10-30 change doesn't otherwise affect this draft.

**Rolled-back test** (each case in its own sub-block, so one refusal can't abort the others; nothing is kept):

```sql
begin;
create temp table offers_lock_check (n int, test text, expected_after text, result text) on commit drop;
do $$
declare v text;
begin
  begin execute 'set local role anon'; perform 1 from public.qualifying_offers limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into offers_lock_check values (1, 'anon reads offers', 'refused', v);

  begin execute 'set local role authenticated'; perform notes from public.qualifying_offers limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into offers_lock_check values (2, 'authenticated reads notes', 'refused', v);

  begin execute 'set local role authenticated'; perform offer_price_cents from public.qualifying_offers limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into offers_lock_check values (3, 'authenticated reads prices', 'refused', v);

  begin execute 'set local role authenticated'; update public.qualifying_offers set notes = notes where false; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into offers_lock_check values (4, 'authenticated updates offers', 'refused', v);

  begin execute 'set local role service_role'; perform notes from public.qualifying_offers limit 1; execute 'reset role'; v := 'allowed';
  exception when insufficient_privilege then v := 'refused'; end;
  insert into offers_lock_check values (5, 'service_role reads offers', 'allowed', v);
end $$;
select n, test, expected_after, result, (expected_after = result) as pass_after from offers_lock_check order by n;
rollback;
```

- Run before the migration: cases 1–4 show `allowed` (the leak), case 5 `allowed`.
- Run after: every row `pass_after = true`.
- After Brett runs it, I'd re-check Your Deal, an offer detail, accept/decline, highlight, a message and add-on removal on a disposable account, and confirm by count. That's a pure database change with no app code.

**Same pattern, other tables (not proposed now):** `offer_addons`, `deal_progress` and `documents` also have customer SELECT policies the app never uses. They hold no agent-only columns, but locking them the same way would make every offer table "service role only". Say if you want them in the same migration.

