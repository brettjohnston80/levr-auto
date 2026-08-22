-- Website audit item 12, low-commitment email capture. Scoped minimal on
-- purpose: no confirmation email, no drip campaign, just capturing
-- interest. A repeat submission of the same email is a no-op, not an
-- error, thanks to the unique constraint plus an upsert-with-ignore
-- write path, so a visitor who submits twice never sees a failure.

create table public.email_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'homepage',
  created_at timestamptz not null default now(),
  constraint email_signups_email_key unique (email)
);

comment on table public.email_signups is
  'Low-commitment interest capture, not a full account. No confirmation
  email sent yet -- that is a natural follow-up, not part of this pass.
  source lets future capture points (other than the homepage) share this
  table without a schema change.';

alter table public.email_signups enable row level security;
-- No policies. Service role only, same convention as every other table
-- in this codebase.
