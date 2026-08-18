-- Inbound dealer-reply parsing (Claude API) + offer-sheet PDF storage.
-- Plan approved 2026-08-19 -- see the conversation/plan for full reasoning.
-- No new table: reuses documents/its existing Storage bucket, adding
-- 'offer_sheet' as a third type alongside financing_proof/service_agreement.
-- No staging/audit table for parse attempts -- the only things that ever
-- persist are the real confirmed offer (as today) and, when a PDF was
-- attached, the offer-sheet document row.

alter table public.documents
  drop constraint documents_type_check;

alter table public.documents
  add constraint documents_type_check
  check (type in ('financing_proof', 'service_agreement', 'offer_sheet'));

-- Soft-delete marker for the cleanup cron (delete-stale-offer-sheets):
-- the real Storage object is deleted for real, but this row stays,
-- storage_path nulled, deleted_at set -- same "keep the history, not the
-- artifact" convention as cancelled_at/purchased_at elsewhere in this schema.
alter table public.documents
  add column deleted_at timestamptz;

comment on column public.documents.deleted_at is
  'Set by the delete-stale-offer-sheets cron when the underlying Storage '
  'object is deleted (search reached a terminal status: cancelled, '
  'purchased, or switched -- never on guarantee_status resolving, since a '
  'search stays active through Day 60 regardless of that outcome). '
  'storage_path is nulled at the same time; this row is kept as a '
  'historical record that a file existed, not the file itself.';
