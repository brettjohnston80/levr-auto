# true_starting_price MSRP-only fallback (2026-08-31)

`matchmaker-vehicle-dataset-2026-v14.csv` — 1,601 rows, 43 columns. Per your instruction, wherever `destination_fee` can't be determined, `true_starting_price` now falls back to `msrp` alone rather than staying blank.

## Result: true_starting_price 86.9% → **99.3%** (1,391 → 1,590 of 1,601)

199 rows filled — every row that had `msrp` set but `destination_fee` blank. Verified clean: 1,601 rows, identity keys unchanged, only `true_starting_price` touched, exactly 199 cells changed.

**Convention going forward**: `true_starting_price` = `msrp` + `destination_fee` when both are known; `msrp` alone when destination isn't known. It no longer implies a destination charge is included — it's now "best available starting price." Flag if you'd rather these 199 rows carry a note or separate flag distinguishing them from the true msrp+destination rows (the field is a plain number now, same as the rest, with no marker for which basis was used).

## By make (rows filled)

| Make | Rows filled |
|---|---|
| Genesis | 40 |
| Ram | 36 |
| Mini | 32 |
| GMC | 29 |
| Jeep | 17 |
| Lincoln | 16 |
| Rivian | 12 |
| Chrysler | 8 |
| Lexus | 6 |
| Buick | 3 |
| **Total** | **199** |

## Still blank (11 rows) — msrp itself is missing, not just destination

This fallback only helps when `msrp` is known. These 11 have no `msrp` at all, so there's nothing to fall back to:
- Hyundai Kona Electric SE EV FWD, Ioniq 6 N EV AWD, Nexo Standard EV FWD, Nexo Blue EV FWD
- Ram Chassis Cab: all 7 remaining diesel/RWD-Big-Horn rows carried forward from the earlier MSRP gap (3500 Tradesman Diesel, 3500 Big Horn Gas & Diesel, 4500 Tradesman/Big Horn Diesel, 5500 Tradesman/Big Horn Diesel)

## Coverage summary (1,601 rows)

| Field | Before this pass | After |
|---|---|---|
| true_starting_price | 86.9% | **99.3%** |
| destination_fee (unchanged — still genuinely unknown for these 199) | 86.9% | 86.9% |
