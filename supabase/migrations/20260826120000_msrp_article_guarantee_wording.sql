-- Real content fix, requested and approved 2026-08-26: the published
-- "MSRP vs. Invoice Price" article's 6 general-explanation mentions of
-- "MSRP" are correct as-is (real, standard industry meaning -- the base
-- figure, not including destination) and stay untouched. Only the closing
-- section, where the article ties into LEVR's own guarantee, changes from
-- "MSRP" to "Total Suggested Retail Price" -- matching the terminology
-- change applied to guarantee.tsx and the FAQ in the same pass, since the
-- guarantee itself always compares against the Total figure, not the base
-- MSRP. Exactly two spots change: the closing section header and the
-- final guarantee sentence.
update public.articles
set content = $md$If you've spent any time researching how to buy a car, you've run into two numbers that get thrown around constantly: MSRP and invoice price. Dealers, forums, and "insider tips" articles all treat these as the key to a good deal. They're useful — but not in the way most people think.

## MSRP is the number that actually matters.

MSRP stands for Manufacturer's Suggested Retail Price — the sticker price the automaker recommends, printed right on the window sticker (officially called the Monroney label, and federally required on every new car). It's not just a suggestion pulled from thin air — it reflects the specific trim, options, and packages on that exact vehicle, which is why two of the "same" car on the same lot can have different MSRPs down to the dollar.

What makes MSRP genuinely useful, unlike almost every other number in car buying, is that it's public, fixed, and verifiable. It's printed on the car itself. It doesn't change based on who's asking or how good a negotiator they are. That makes it a real, honest baseline you can compare against — which is exactly why it's the number worth anchoring to.

It's also not a reflection of what the car is actually worth in the moment. Popular, high-demand vehicles sometimes sell above MSRP; slower-moving models often sell well below it. Where a specific car actually lands depends on real-time supply, demand, and how motivated a given dealer is to move it — which is exactly the kind of thing that's hard to know from the outside, and exactly what real negotiation is for.

## Invoice price sounds more useful than it actually is.

Invoice price is supposed to represent what the dealer paid the manufacturer for the car — and for years, "buy at invoice" was treated as the ultimate win. The catch: it's not actually what the dealer paid. Manufacturers pay dealers back through holdback, dealer cash, and volume incentives that never show up on that invoice number, which means a dealer can still profit meaningfully on a car sold "at invoice." It's a real number, just not the honest floor it's often made out to be.

## This is exactly why LEVR Auto's guarantee is built on Total Suggested Retail Price, not invoice.

It's the one number in this whole process that's public, consistent, and impossible to quietly move — which makes it the right foundation for a real promise. If we can't bring you at least one real offer below Total Suggested Retail Price, you get your $699 back. No guessing at holdback, no chasing a number that was never the real floor to begin with — just a fixed, honest baseline, and real work to beat it.$md$,
    updated_at = now()
where slug = 'msrp-vs-invoice-price';
