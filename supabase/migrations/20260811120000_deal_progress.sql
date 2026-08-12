-- Financing/document flow (Build order item 10), non-blocked pieces:
-- availability re-confirmation, deposit recording, financing capture.
--
-- deal_progress is 1:1 with an accepted qualifying_offers row. All the state
-- here is agent- or customer-entered *record-keeping* — deliberately not a
-- payment mechanism. LEVR never processes or holds the reservation deposit;
-- it goes directly from customer to dealer, and the agent just records that
-- the dealer confirmed receiving it (same pattern as vehicle_sold_at below).
create table public.deal_progress (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null unique references public.qualifying_offers (id) on delete cascade,

  -- Step 11: dealer re-confirms the specific unit is still available,
  -- learned by the agent, recorded manually — same pattern as
  -- qualifying_offers.vehicle_sold_at (a nullable timestamp is the boolean;
  -- no separate "confirmed" flag needed alongside it).
  availability_reconfirmed_at timestamptz,

  -- Step 10: a refundable deposit paid directly to the dealer to reserve
  -- the car. LEVR never touches this money — deposit_amount_cents is
  -- whatever the agent is told the dealer collected, not a LEVR-set fee.
  deposit_amount_cents integer,
  deposit_confirmed_at timestamptz,

  -- Step 12: financing is capture-only, never a credit pull (FCRA-regulated,
  -- needs a compliant vendor partnership later — see Core-Processes-v1.md).
  -- 'own' means proof is uploaded as a documents row instead of these
  -- preference fields being populated.
  financing_choice text check (financing_choice in ('own', 'help')),
  financing_income_range text,
  financing_down_payment_cents integer,
  financing_desired_term_months integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deal_progress is
  'Post-acceptance deal state for a qualifying_offers row: availability '
  're-confirmation, deposit record-keeping (never a LEVR-processed '
  'payment), and financing capture. 1:1 with the accepted offer.';

create trigger set_updated_at
  before update on public.deal_progress
  for each row execute function public.set_updated_at();

alter table public.deal_progress enable row level security;

create policy "Customers can view deal progress on their own offers"
  on public.deal_progress for select
  using (
    exists (
      select 1
      from public.qualifying_offers qo
      join public.customer_searches cs on cs.id = qo.customer_search_id
      where qo.id = deal_progress.qualifying_offer_id
        and cs.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
-- 1:many per offer. Only 'financing_proof' is populated by this pass —
-- 'service_agreement' (the e-signed LEVR document) is a later, PandaDoc-
-- dependent addition using this same table, not a schema change.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,

  type text not null check (type in ('financing_proof', 'service_agreement')),
  storage_path text,
  external_signature_id text,

  uploaded_at timestamptz,
  signed_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.documents is
  'One row per file/e-signed artifact tied to an accepted offer. '
  'financing_proof: uploaded to the documents Storage bucket, storage_path '
  'set, uploaded_at set. service_agreement (not built yet): PandaDoc '
  'envelope tracked via external_signature_id, signed_at set on completion.';

create index documents_qualifying_offer_id_idx on public.documents (qualifying_offer_id);

alter table public.documents enable row level security;

create policy "Customers can view documents on their own offers"
  on public.documents for select
  using (
    exists (
      select 1
      from public.qualifying_offers qo
      join public.customer_searches cs on cs.id = qo.customer_search_id
      where qo.id = documents.qualifying_offer_id
        and cs.customer_id = auth.uid()
    )
  );

-- Private bucket for uploaded documents (financing proof now, e-signed
-- copies later). No storage.objects policies — accessed only via the
-- service_role admin client server-side, same as agents/listings have no
-- table-level policies either. Never exposed to the browser directly.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
