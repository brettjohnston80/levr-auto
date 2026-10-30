-- GX-3 M26 BEFORE check (read-only): the published article's guarantee section, before the fine print.
select * from (values
  (1, 'article found and published', (select status from public.articles where slug = 'msrp-vs-invoice-price'), 'published'),
  (2, 'ends with the guarantee section''s last sentence',
      (select (content like '%just a fixed, honest baseline, and real work to beat it.')::text from public.articles where slug = 'msrp-vs-invoice-price'), 'true'),
  (3, 'fine print not there yet',
      (select (content like '%Money-back guarantee does not apply to Tesla%')::text from public.articles where slug = 'msrp-vs-invoice-price'), 'false')
) as t(n, check_name, actual, expected) order by n;
