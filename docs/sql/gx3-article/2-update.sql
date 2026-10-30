-- GX-3 M26 (approved 2026-10-25): the fine print at the end of the published article's guarantee
-- section, a data update like the 2026-08-26 wording migration. NOT YET RUN. One row; refuses to
-- run twice (the second condition).
begin;
update public.articles
   set content = content || E'\n\nMoney-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar.'
 where slug = 'msrp-vs-invoice-price'
   and content not like '%Money-back guarantee does not apply to Tesla%';
commit;
