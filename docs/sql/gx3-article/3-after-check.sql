-- GX-3 M26 AFTER check (read-only).
select * from (values
  (1, 'ends with the fine print', (select (content like '%real work to beat it.' || E'\n\n' || 'Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar.')::text
      from public.articles where slug = 'msrp-vs-invoice-price'), 'true'),
  (2, 'the fine print appears once', (select ((length(content) - length(replace(content, 'Money-back guarantee does not apply to Tesla', ''))) / length('Money-back guarantee does not apply to Tesla'))::text
      from public.articles where slug = 'msrp-vs-invoice-price'), '1'),
  (3, 'still published', (select status from public.articles where slug = 'msrp-vs-invoice-price'), 'published')
) as t(n, check_name, actual, expected) order by n;
