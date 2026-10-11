-- Agent dashboard Phase 1, Step 6b: activity-log links are checked at commit, not mid-statement.
-- Plan: docs/plans/agent-dashboard-phase1-plan.md (section 10, Step 6b).
--
-- Why: one delete can reach an agent_activity_log row by more than one route, for example
--   customer_searches -> agent_activity_log.search_id           (on delete set null)
--   customer_searches -> dealer_contacts -> .dealer_contact_id  (cascade, then set null)
--   customer_searches -> qualifying_offers -> .qualifying_offer_id (cascade, then set null)
--   customers -> agent_activity_log.customer_id and customers -> customer_searches -> ...
-- When the activity row was INSERTED IN THE SAME TRANSACTION, Postgres re-checks every foreign
-- key on that row during the first set-null update (ri_triggers.c: "our UPDATE will invalidate
-- the INSERT so that the INSERT RI trigger will not do anything"), and the check of a link
-- whose target is being deleted in the same statement fails (23503). Step 6's rolled-back
-- test D hit exactly this. Rows logged in an earlier transaction were not affected.
--
-- Fix:
--   1. The six link foreign keys become DEFERRABLE INITIALLY DEFERRED: checked at commit, by
--      which time the set-null actions have run and superseded row versions are skipped.
--      The set-null delete actions themselves are unchanged and still run immediately.
--      agent_id and action stay immediate.
--   2. log_agent_activity() (same signature) now drops any link id that doesn't exist before
--      inserting (nulls it on the row and keeps it in details.dropped_ids), so a deferred check
--      can never fail at commit and roll back the agent's action (Q8: the action always succeeds).
--      A bad agent_id or action code still fails immediately and becomes an alert, as before.

alter table public.agent_activity_log
  alter constraint agent_activity_log_search_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_customer_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_qualifying_offer_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_dealer_alias_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_refund_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_dealer_contact_fk deferrable initially deferred;

create or replace function public.log_agent_activity(
  p_agent_id uuid,
  p_action text,
  p_search_id uuid default null,
  p_customer_id uuid default null,
  p_qualifying_offer_id uuid default null,
  p_dealer_alias_id uuid default null,
  p_refund_id uuid default null,
  p_dealer_contact_id uuid default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_search uuid := p_search_id;
  v_customer uuid := p_customer_id;
  v_offer uuid := p_qualifying_offer_id;
  v_alias uuid := p_dealer_alias_id;
  v_refund uuid := p_refund_id;
  v_contact uuid := p_dealer_contact_id;
  v_dropped jsonb := '{}'::jsonb;
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  -- Links are deferred-checked at commit, so validate them now: a missing target is dropped
  -- (and recorded) instead of failing the caller's transaction later.
  if v_search is not null and not exists (select 1 from public.customer_searches where id = v_search) then
    v_dropped := v_dropped || jsonb_build_object('search_id', v_search); v_search := null;
  end if;
  if v_customer is not null and not exists (select 1 from public.customers where id = v_customer) then
    v_dropped := v_dropped || jsonb_build_object('customer_id', v_customer); v_customer := null;
  end if;
  if v_offer is not null and not exists (select 1 from public.qualifying_offers where id = v_offer) then
    v_dropped := v_dropped || jsonb_build_object('qualifying_offer_id', v_offer); v_offer := null;
  end if;
  if v_alias is not null and not exists (select 1 from public.dealer_aliases where id = v_alias) then
    v_dropped := v_dropped || jsonb_build_object('dealer_alias_id', v_alias); v_alias := null;
  end if;
  if v_refund is not null and not exists (select 1 from public.refunds where id = v_refund) then
    v_dropped := v_dropped || jsonb_build_object('refund_id', v_refund); v_refund := null;
  end if;
  if v_contact is not null and not exists (select 1 from public.dealer_contacts where id = v_contact) then
    v_dropped := v_dropped || jsonb_build_object('dealer_contact_id', v_contact); v_contact := null;
  end if;
  if v_dropped <> '{}'::jsonb then
    v_details := v_details || jsonb_build_object('dropped_ids', v_dropped);
  end if;

  begin
    insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id,
                                           dealer_alias_id, refund_id, dealer_contact_id, details)
    values (p_agent_id, p_action, v_search, v_customer, v_offer,
            v_alias, v_refund, v_contact, v_details)
    returning id into v_id;
  exception when others then
    begin
      insert into public.agent_alerts (kind, search_id, agent_id, details)
      values ('activity_log_failed', v_search,
              case when exists (select 1 from public.agents where id = p_agent_id) then p_agent_id end,
              jsonb_build_object('error', sqlerrm, 'action', p_action, 'agent_id', p_agent_id, 'details', v_details));
    exception when others then
      raise warning 'agent activity and alert both failed: %', sqlerrm;
    end;
  end;
  return v_id;
end;
$$;

-- create or replace keeps existing grants; restated so the file stands on its own.
revoke execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;
