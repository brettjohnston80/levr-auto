-- A customer must always have at least one way to be contacted (2026-09-14).
--
-- notify_by_email / notify_by_text / notify_by_agent_callback have been
-- three independent booleans since 20260819140000, with nothing anywhere
-- preventing all three from being false. That state is not a preference --
-- it is an account we have no way to reach. It matters most for exactly the
-- message a customer cares about: "a dealer sent an offer."
--
-- Verified missing at every layer before this was written: no client guard,
-- no server guard, and no constraint here -- an all-false write was accepted
-- outright when tried against the real table.
--
-- ⚠ THE RULE IS "AT LEAST ONE", NOT "EMAIL MUST BE TRUE", AND THAT IS A
-- DATA-DRIVEN CHOICE RATHER THAN A STYLISTIC ONE. A real customer is
-- deliberately email-off / text-on today (checked across all 13 rows before
-- writing this). A notify_by_email-must-be-true constraint would have
-- required flipping that row to satisfy it, silently overwriting a genuine
-- preference to enforce a rule that was only ever aimed at the zero state.
-- "At least one" fixes the actual bug and leaves every legitimate
-- combination alone.
--
-- NO BACKFILL IS NEEDED. Zero rows are currently all-false -- counted over
-- every customer row, paginated, not a capped select. The signup trigger
-- also cannot create the bad state: notify_by_email defaults to true and
-- the trigger never sets these columns explicitly.
--
-- The application layer is deliberately STRICTER than this constraint. The
-- account settings form will not let email be switched off while it is the
-- last channel standing, and the server action rejects an all-false save
-- with a readable message rather than auto-correcting it. This constraint
-- is the backstop under both -- it catches any future write path that
-- forgets the rule, which is precisely how this gap appeared in the first
-- place.

alter table public.customers
  drop constraint if exists customers_at_least_one_contact_channel;

alter table public.customers
  add constraint customers_at_least_one_contact_channel check (
    notify_by_email or notify_by_text or notify_by_agent_callback
  );

comment on constraint customers_at_least_one_contact_channel on public.customers is
  'A customer must keep at least one contact channel enabled. All three '
  'false is an unreachable account, not a preference. Deliberately does NOT '
  'require notify_by_email specifically -- a real customer runs text-only, '
  'and forcing email would overwrite a genuine choice to fix a bug that is '
  'only about the zero-channel case.';
