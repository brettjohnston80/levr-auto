-- Build order item 11 (delivery coordination), first slice: capture the
-- customer's pickup/delivery preference. Pure record-keeping, same pattern
-- as financing_choice on this same table -- LEVR doesn't coordinate
-- transporters or charge a delivery fee yet, the dealer and customer handle
-- logistics directly once a preference is on file.
alter table public.deal_progress
  add column delivery_method text check (delivery_method in ('pickup', 'delivery'));
