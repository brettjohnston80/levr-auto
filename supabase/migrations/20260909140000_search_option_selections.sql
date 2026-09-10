-- Customer configurator answers, per search (step 6 of 9).
--
-- WHY A CHILD TABLE, NOT A COLUMN. customer_searches.required_options is
-- `text[] not null default '{}'`, which can carry an option's NAME and
-- nothing else. A package-only answer has to reach the agent with the
-- package's name, itemized contents and price, or the agent cannot search
-- real inventory correctly -- "customer wants a heated steering wheel"
-- is unactionable when that feature only exists inside a $375 Weather
-- Package alongside rain-sensing wipers. Widening required_options to
-- jsonb would break every existing reader (finalizeSelfService,
-- finalizeUndecidedSearch, updateFinalizedSearch, /account, both agent
-- forms), so this is purely additive: required_options keeps working
-- unchanged for the 34 makes with no configurator data, and this table
-- carries the richer answers for the two that have it. Same
-- child-table-per-parent shape as offer_addons.
--
-- DENORMALIZED ON PURPOSE -- no FK to configurator_options. An option row
-- belongs to a batch, and promoting a new batch would otherwise silently
-- change or dangle what a customer already answered. The answer is a
-- historical fact about that customer's search and must not move when the
-- dataset is re-imported, so name/package details are copied in at write
-- time. Same reasoning as offer_addons storing description/amount_cents
-- rather than pointing at a catalog row.

create table public.search_option_selections (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,

  -- Same vocabulary as configurator_options.category, deliberately the
  -- full set even though only exterior_color/interior/seating/feature can
  -- currently be produced by the customer-facing form -- keeps the two
  -- tables directly comparable and joinable, and means adding a question
  -- for wheels/roof/drivetrain later needs no schema change.
  category text not null check (category in (
    'exterior_color', 'interior', 'seating', 'wheels', 'roof', 'drivetrain', 'feature'
  )),

  -- Which ANSWER SHAPE this row records. The two shapes are genuinely
  -- different questions, not one question with a wider scale:
  --   'preference' -- colors and seating. The customer picks a value AND
  --                   says how strongly they want it (3-way priority).
  --   'feature'    -- the features checklist. A plain yes/no; no strength
  --                   is ever asked for.
  question_kind text not null check (question_kind in ('preference', 'feature')),

  -- The option the customer chose, copied from configurator_options.name:
  -- a colour/interior/seating value for 'preference', a feature name for
  -- 'feature'.
  selection text not null,

  -- NULL for 'feature' rows, and that is the point -- see the constraint
  -- below. A yes/no answer carries no strength, so none is recorded.
  -- Defaulting features to 'must_have' would invent intent the customer
  -- never expressed and could cause an agent to over-constrain a real
  -- search, rejecting otherwise-good inventory over a feature the
  -- customer merely ticked.
  priority text check (priority in ('must_have', 'like_to_have', 'open_to')),

  -- Package context, populated only where the selected option is
  -- obtainable solely inside a package. This is the whole reason the
  -- table exists.
  package_name text,
  package_price_cents integer,
  package_contents text[],

  -- True when the source price could not be parsed into a figure. Kept
  -- distinct from package_price_cents = 0 so the agent view can say
  -- "price not confirmed" instead of rendering an unknown as free.
  price_unknown boolean not null default false,

  created_at timestamptz not null default now(),

  -- Answer shape and priority travel together: a 3-way preference always
  -- has one, a yes/no feature never does. Enforced here rather than left
  -- to application code so a future writer cannot half-populate a row the
  -- agent view then has to guess about.
  constraint search_option_selections_priority_shape check (
    (question_kind = 'preference' and priority is not null)
    or (question_kind = 'feature' and priority is null)
  ),

  -- Package fields travel together too, mirroring
  -- configurator_options_package_shape: either there is a real package
  -- name, or there is no package data at all. Prevents a partially
  -- populated package reaching the agent.
  constraint search_option_selections_package_shape check (
    package_name is not null
    or (package_price_cents is null and package_contents is null)
  ),

  -- One answer per option per search. Prevents a search accumulating
  -- duplicate or contradictory rows for the same item -- e.g. the same
  -- colour recorded as both must_have and open_to after an edit. A
  -- re-answer is an upsert on this key, not a second row.
  --
  -- Deliberately NOT unique on (search_id, category): a customer may
  -- legitimately name several acceptable colours, or tick many features.
  -- The conflict this guards against is the same ITEM twice.
  unique (search_id, category, selection)
);

comment on table public.search_option_selections is
  'A customer''s configurator answers for one search, with package context '
  'copied in at write time so the agent can search real inventory. '
  'Additive alongside customer_searches.required_options, which stays in '
  'use for makes with no configurator data.';

comment on column public.search_option_selections.priority is
  'must_have/like_to_have/open_to for colour and seating questions; NULL '
  'for features, which are asked as a plain yes/no and carry no strength.';

-- Every read is "all answers for this search", for the agent view and for
-- rendering the customer's own saved answers back to them.
create index search_option_selections_search_idx
  on public.search_option_selections (search_id);

-- ---------------------------------------------------------------------------
-- RLS -- service role only, zero policies. This follows the precedent the
-- finalize flow already sets rather than assuming: finalize-actions.ts
-- checks ownership on the RLS-subject user client
-- (getOwnedAwaitingFinalizationSearch reads customer_searches filtered to
-- customer_id = user.id) and then performs the actual WRITE through
-- createAdminClient(). The customer never writes customer_searches
-- directly, so its child table needs no customer-facing policy either.
-- Agents likewise reach this through server-side code gated by
-- getAuthorizedAgent(), never a direct client query.
-- ---------------------------------------------------------------------------
alter table public.search_option_selections enable row level security;
-- No policies.
