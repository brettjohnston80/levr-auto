-- OE-2: offer submissions, dealer links and link attempts (offer-entry plan 3.3).
-- APPLIED by Brett in the SQL Editor, 2026-10-27. Don't run it again.
-- Results: before check 9/9 as expected; after check all as expected (service_role grants
-- S,I,U on dealer_offer_requests, S,I,U,D on offer_submissions, S,I,D on dealer_link_attempts;
-- anon and authenticated none; claim function service_role only; RLS on, 0 policies; both
-- foreign keys as written; 4 indexes; 0 existing offers touched); rolled-back test 21/21 pass.
-- Brett approved the three changes from the plan's draft listed below.
--
-- ADDITIONS ONLY. Three new tables, one function, one foreign key on the OE-1 column
-- qualifying_offers.offer_submission_id (every existing offer has it null). Nothing in today's
-- live code on main reads or writes any of it, so the live site is unaffected.
--
-- send_offer_submission is NOT here: it moves to OE-2b with Chunk 3, built from the live
-- log_agent_activity text.
--
-- Changes from the plan's draft (3.3), for Brett's review:
--   1. offer_submissions.sent_qualifying_offer_id is ON DELETE CASCADE. Offers are never deleted
--      in normal use, but test resets and cleanups delete offers before searches
--      (seed-test-state, scratch cleanups); with NO ACTION a sent submission would block that.
--      Deleting a sent submission on its own is still blocked (qualifying_offers keeps NO ACTION).
--   2. dealer_offer_requests.listing_id and dealer_alias_id are ON DELETE SET NULL, like
--      dealer_contacts.listing_id, so a listings or alias cleanup can't be blocked by a link.
--   3. "revoke all" rather than the five named privileges (also removes REFERENCES and TRIGGER),
--      and service_role is revoked first too, so it ends with exactly the listed grants.
--
-- Grants (Supabase's 2026-10-30 change): explicit, no anon, no authenticated. The public dealer
-- page runs on the server with the service role; the dealer's browser never touches these tables.
begin;

create table public.dealer_offer_requests (
  id uuid primary key default gen_random_uuid(),
  customer_search_id uuid not null references public.customer_searches (id) on delete cascade,
  created_by_agent_id uuid not null references public.agents (id),
  token_hash text not null unique,                 -- HMAC-SHA256; the raw token is never stored
  request_dealer_name text not null check (char_length(request_dealer_name) <= 200),
  request_dealer_email text check (char_length(request_dealer_email) <= 320),
  dealer_alias_id uuid references public.dealer_aliases (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
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
  submitted_payload jsonb,                              -- dealer's submission exactly as sent; never edited
  working_payload jsonb not null default '{}'::jsonb,   -- the agent's checked copy
  created_by_agent_id uuid references public.agents (id),
  submitted_at timestamptz,
  reviewed_by_agent_id uuid references public.agents (id),
  sent_qualifying_offer_id uuid unique references public.qualifying_offers (id) on delete cascade,
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
revoke all on public.dealer_offer_requests, public.offer_submissions, public.dealer_link_attempts
  from anon, authenticated;
-- Until 2026-10-30 Supabase still gives service_role every privilege on a new table; revoking
-- first makes service_role hold exactly the grants below, before or after that date.
revoke all on public.dealer_offer_requests, public.offer_submissions, public.dealer_link_attempts
  from service_role;
grant select, insert, update on public.dealer_offer_requests to service_role;          -- create, open, use, cancel
grant select, insert, update, delete on public.offer_submissions to service_role;      -- delete: 30-day cleanup of discarded ones
grant select, insert, delete on public.dealer_link_attempts to service_role;           -- delete: old-attempt cleanup

-- Claims a link exactly once: sets used_at and creates the awaiting-review submission in one
-- statement pair. Returns the submission id, or raises 'link_unusable' (used, cancelled,
-- expired or unknown; the page tells these apart before calling).
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

revoke execute on function public.claim_dealer_offer_request(text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_dealer_offer_request(text, jsonb) to service_role;

commit;
