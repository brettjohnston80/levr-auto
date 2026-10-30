-- GX-3 M26 ROLLED-BACK TEST: the update, twice, inside a transaction that's rolled back.
-- Expected: 1 row the first time, 0 the second, the fine print once; nothing kept.
begin;
create temp table m26_test (n int, test text, expected text, result text) on commit drop;
do $$
declare v int;
begin
  update public.articles set content = content || E'\n\nMoney-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar.'
   where slug = 'msrp-vs-invoice-price' and content not like '%Money-back guarantee does not apply to Tesla%';
  get diagnostics v = row_count; insert into m26_test values (1, 'first run updates one row', '1', v::text);
  update public.articles set content = content || E'\n\nMoney-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar.'
   where slug = 'msrp-vs-invoice-price' and content not like '%Money-back guarantee does not apply to Tesla%';
  get diagnostics v = row_count; insert into m26_test values (2, 'a second run changes nothing', '0', v::text);
end $$;
select n, test, expected, result, result = expected as pass from m26_test order by n;
rollback;
