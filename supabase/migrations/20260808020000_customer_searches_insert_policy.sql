-- Allows a signed-in customer to create their own customer_searches rows
-- directly from the intake flow (no payment/backend step involved yet).
--
-- Constrained to fresh, unpaid, not-yet-solidified rows only — a client can
-- insert its own pending intake, but cannot forge an already-paid or
-- already-active search via a crafted insert. Everything past this point
-- (payment, solidification, guarantee assessment) is set by backend code
-- using the service_role client, not by the customer directly.
create policy "Customers can create their own pending searches"
  on public.customer_searches for insert
  with check (
    auth.uid() = customer_id
    and guarantee_status = 'pending'
    and search_status = 'pending_refinement'
    and paid_at is null
  );
