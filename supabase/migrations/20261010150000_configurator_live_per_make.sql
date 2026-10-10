-- One live configurator batch PER MAKE (Brett, 2026-10-10).
--
-- Until now at most one configurator batch could be live in total
-- (configurator_batches_one_live_idx), so promoting the new Chevrolet or
-- Ford batch would have taken the Toyota/Honda batch off the site. Each make
-- now points at its own live batch, so makes are promoted independently.
--
-- configurator_live_makes is the source of truth: one row per make, its
-- primary key guaranteeing at most one live batch per make. The app reads it
-- (src/lib/configurator-live.ts). configurator_batches.is_live is kept, now
-- meaning "this batch is live for at least one make", and is maintained only
-- by the functions below.
--
-- The current live batch (Toyota/Honda) is carried over for every make it
-- contains, so nothing customers see changes when this runs.

begin;

create table public.configurator_live_makes (
  make text primary key,
  batch_id uuid not null references public.configurator_batches (id) on delete restrict,
  promoted_at timestamptz not null default now()
);

comment on table public.configurator_live_makes is
  'Which configurator batch is live for each make. Changed only via '
  'promote_configurator_batch_make / unpromote_configurator_make.';

alter table public.configurator_live_makes enable row level security;
-- No policies: service role only, like every configurator table.

-- Carry over the current live batch for every make it holds.
insert into public.configurator_live_makes (make, batch_id, promoted_at)
select distinct t.make, b.id, coalesce(b.promoted_at, now())
from public.configurator_batches b
join public.configurator_trims t on t.batch_id = b.id
where b.is_live;

-- Several batches can now be live at once (one per make).
drop index public.configurator_batches_one_live_idx;

-- The old whole-batch promote would demote every other batch, i.e. take
-- other makes off the site. Removed so it can't be called by mistake.
drop function public.promote_configurator_batch(uuid);

-- Promote one make from one batch. Replaces that make's previous live
-- batch, if any; other makes are untouched.
create function public.promote_configurator_batch_make(p_batch_id uuid, p_make text)
returns public.configurator_live_makes
language plpgsql
as $$
declare
  v_old uuid;
  v_row public.configurator_live_makes;
begin
  perform 1 from public.configurator_batches where id = p_batch_id for update;
  if not found then
    raise exception 'configurator_batches row % not found', p_batch_id;
  end if;

  if not exists (
    select 1 from public.configurator_trims
    where batch_id = p_batch_id and make = p_make
  ) then
    raise exception 'batch % has no trims for make %', p_batch_id, p_make;
  end if;

  select batch_id into v_old
  from public.configurator_live_makes
  where make = p_make
  for update;

  insert into public.configurator_live_makes (make, batch_id, promoted_at)
  values (p_make, p_batch_id, now())
  on conflict (make) do update
    set batch_id = excluded.batch_id,
        promoted_at = excluded.promoted_at
  returning * into v_row;

  update public.configurator_batches
  set is_live = true,
      promoted_at = now()
  where id = p_batch_id;

  -- The replaced batch stays live only if it still serves another make.
  if v_old is not null and v_old <> p_batch_id then
    update public.configurator_batches b
    set is_live = exists (
      select 1 from public.configurator_live_makes m where m.batch_id = b.id
    )
    where b.id = v_old;
  end if;

  return v_row;
end;
$$;

-- Take one make off the site (rollback). Its customers fall back to the
-- generic flow; other makes are untouched.
create function public.unpromote_configurator_make(p_make text)
returns void
language plpgsql
as $$
declare
  v_old uuid;
begin
  delete from public.configurator_live_makes
  where make = p_make
  returning batch_id into v_old;

  if v_old is null then
    raise exception 'make % is not live', p_make;
  end if;

  update public.configurator_batches b
  set is_live = exists (
    select 1 from public.configurator_live_makes m where m.batch_id = b.id
  )
  where b.id = v_old;
end;
$$;

commit;
