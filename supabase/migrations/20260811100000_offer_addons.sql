-- Add-on negotiation: itemized fees on a qualifying offer, with a single
-- active/most-recent removal-request round per add-on — not a full
-- negotiation history thread. See CLAUDE.md for the trade-off this
-- represents (adding a proper rounds table later is additive and doesn't
-- require reworking this, but any round that already happened and was
-- overwritten before that table existed can't be reconstructed).
create table public.offer_addons (
  id uuid primary key default gen_random_uuid(),
  qualifying_offer_id uuid not null references public.qualifying_offers (id) on delete cascade,

  description text not null,
  amount_cents integer not null,

  -- A customer can flag an add-on for removal; the request routes to the
  -- agent (never automated) to actually negotiate with the dealer.
  -- 'pending' -> customer asked, agent hasn't recorded an outcome yet.
  -- 'dealer_accepted' / 'dealer_declined' / 'dealer_countered' -> agent
  -- recorded what the dealer said. A customer can re-request (a new round)
  -- from 'dealer_declined' or 'dealer_countered', which overwrites
  -- dealer_response/the timestamps below — only the latest round is ever
  -- visible.
  removal_status text not null default 'none'
    check (removal_status in ('none', 'pending', 'dealer_accepted', 'dealer_declined', 'dealer_countered')),
  removal_requested_at timestamptz,
  dealer_response text,
  removal_resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_addons is
  'Itemized fees on a qualifying_offers row. removal_status tracks a single '
  'active/most-recent removal-request round per add-on, not a full '
  'negotiation history — see CLAUDE.md.';

create index offer_addons_qualifying_offer_id_idx
  on public.offer_addons (qualifying_offer_id);

create trigger set_updated_at
  before update on public.offer_addons
  for each row execute function public.set_updated_at();

alter table public.offer_addons enable row level security;

create policy "Customers can view add-ons on their own offers"
  on public.offer_addons for select
  using (
    exists (
      select 1
      from public.qualifying_offers qo
      join public.customer_searches cs on cs.id = qo.customer_search_id
      where qo.id = offer_addons.qualifying_offer_id
        and cs.customer_id = auth.uid()
    )
  );
