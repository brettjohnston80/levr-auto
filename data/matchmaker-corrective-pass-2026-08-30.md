# Corrective pass on v9 — results per item (2026-08-30)

`matchmaker-vehicle-dataset-2026-v10.csv` — 1,601 rows, same 42-column schema. Going through your six items in order.

## 1. Kia Telluride — investigated, NOT restored, and here's why

Before writing any data, I checked the premise directly (both independently and via the research agent, which was instructed to stop and report rather than proceed if the facts didn't match). They don't: **Kia genuinely has no 2026 Telluride.** I confirmed this myself against Edmunds' live year selector for the model — it lists 2025 (New) and jumps straight to 2027 (New), with no 2026 entry at all. This is corroborated by KBB carrying a direct Kia spokesperson quote ("As the current 2025 Telluride sells down on schedule, we are preparing the all-new 2027 to debut..."), plus multiple auto-news pieces specifically about Kia skipping the model year. The 2027 Telluride is a full redesign (new platform, turbo engine replacing the V6, longer wheelbase) that started arriving in showrooms in calendar-2026 but is titled and sold as model year 2027, same pattern as Hyundai Palisade and Chevrolet Bolt EV.

So this wasn't a data error that needed "fixing, not deleting" — the original removal was correct. **No Telluride rows were added.** If you want Telluride represented in the dataset at all right now, the only honest option is to add it back as `model_year=2027` — which puts it in the same bucket you already confirmed you want excluded (item 2). I did not do that without checking with you first, since it directly contradicts your stated MY2026-only convention. Let me know if you'd rather make an exception for it.

## 2. Palisade / Bolt EV removal — no action, confirmed correct as you said.

## 3. Luxury makes (461 rows, 13 makes) — backfilled

| Field | Before | After |
|---|---|---|
| nhtsa_overall_stars | 18% (82/461) | **18.7%** (86/461) |
| zero_to_60_sec | 26% (119/461) | **82.9%** (382/461) |
| top_speed_mph | 2% (8/461) | **61.6%** (284/461) |
| resale_depreciation_pct | 0% (0/461) | **95.2%** (439/461) |

nhtsa_overall_stars barely moved, and that's a real finding, not a shortfall: NHTSA has these vehicles on file (VehicleId exists) for many but hasn't published a score yet ("Not Rated" — confirmed via direct API query, not guessed), and for others (all of Porsche, all of Polestar, all of Alfa Romeo, most of Land Rover) there's no VehicleId at all — never submitted for testing, consistent with the low-US-volume pattern already established earlier in this project. zero_to_60/top_speed and resale% moved a lot; resale used iSeeCars/CarEdge model-level depreciation studies as a stand-in for MarketCheck (still exhausted — see item 4). A few genuine remaining gaps: Genesis Electrified GV70 and a handful of just-launched or ultra-low-volume trims (Porsche electric Cayenne, BMW M5 Touring/ALPINA XB7, Mercedes Maybach lines) that don't have enough market history yet for a 5-year depreciation figure to exist.

**One thing to flag for a closer look**: the Mercedes-Benz `top_speed_mph` fills (about 64 of them) are based on Mercedes' documented electronic speed-limiter policy (130 mph standard / 155 mph AMG) rather than a per-trim citation, deliberately applied only to mainstream sedan/SUV lines, not the AMG GT/SL halo cars or Maybach. It's a real, verifiable policy (confirmed 3x independently) but it's a different sourcing method than a directly published per-trim spec, so I'm flagging it rather than letting it blend in silently.

**35 "duplicate" rows in the luxury makes — investigated, these are not duplicates.** I checked every one of the 35 flagged groups against the dataset's actual identity key (make + model + trim + model_year + fuel_type + drivetrain + body_style, confirmed unique since early in this project). All 35 differ on drivetrain or body_style — e.g. Porsche 911 Carrera Coupe ($137,850) vs. Convertible ($151,750), Porsche Cayenne Electric SUV ($111,350) vs. Coupe body ($116,150), Lincoln Aviator Premiere RWD ($56,910) vs. AWD ($59,410), Alfa Romeo Giulia Base RWD ($44,995) vs. AWD ($46,995). These are real, distinct, correctly-priced configurations that happen to share a trim name — not the same row duplicated with missing fields. I did not delete or merge any of them; doing so would have destroyed legitimate market data.

## 4. resale_depreciation_pct, 14 target makes (Acura, Buick, Cadillac, Chrysler, GMC, Dodge, Jeep, Kia, Nissan, Mazda, Mitsubishi, Subaru, Volkswagen, Volvo)

Went from 0/569 to **565/569 (99.3%)**. (Side note on the numbers you had — I measured the actual file directly rather than trust the "11/479 → 13/479" figure from before, since I couldn't reconcile it against what's really in v9; the file showed 0 filled and 569 rows for this make list going into this pass. Not something to chase down now, just flagging the discrepancy in case it matters for tracking history.)

MarketCheck's quota is still exhausted (reconfirmed again this pass) — this batch used iSeeCars' 5-Year Depreciation Study as primary source, CarEdge as fallback, both well-established published studies. Real gaps, not skipped: Jeep Recon (1 row, all-new MY2026 model with no 5-year sales history to study yet), Nissan Rogue Plug-In Hybrid (2 rows, newly launched rebadge, no data on either source), Volvo EX30 Cross Country (1 row, not covered by either source under that exact name).

## 5. msrp — 5 remaining rows (4 Hyundai + BMW M5 Touring), re-verified rather than assumed

- **BMW M5 Touring**: filled. bmwusa.com's own page states $125,300 (destination_fee was already correctly $1,450, matching the 5-Series-family tier already used elsewhere).
- **Hyundai Kona Electric SE**: re-checked, and the situation changed since the last pass — Hyundai has now paused the *entire* Kona Electric line for MY2026 (not just other trims), confirmed by InsideEVs, CarsDirect, and Electrek reporting a February 2026 pause; it resumes as MY2027. Left blank, correctly — it's not for sale.
- **Hyundai Ioniq 6 N**: still genuinely unpriced. Hyundai confirms the launch is "on track" for later in 2026 but hasn't published pricing yet.
- **Hyundai Nexo Standard / Blue**: the 2nd-gen Nexo itself is confirmed for MY2026 US sale (revealed at the LA Auto Show), but pricing/trims/on-sale date are still listed as TBD by Hyundai and Edmunds. Both genuinely unpublished, not a research gap.

## 6. Duplicate row count — investigated across the whole dataset, not just luxury

Same check as item 3, run against all 132 (make/model/trim) groups with more than one row (up from the 105 you'd tracked before — the growth is from the luxury-make expansion and Ram Chassis Cab additions, which legitimately added more drivetrain/body_style/fuel_type variants, not from bad duplication). **Every single one of the 132 groups is a legitimate distinct configuration under the dataset's real identity key** — zero true duplicates (identical across all 7 identity fields) exist anywhere in the 1,601-row file. This includes the Ram Chassis Cab rows you called out specifically: those 12 rows are 6 trim/GVWR combinations × Gas/Diesel, not duplicates with mismatched nulls — Gas and Diesel are genuinely different rows, and the "mismatched nulls" you saw is just that gas got priced ($48,605 for 3500 Tradesman) while diesel across the board is still unpriced (see below). No rows were merged or deleted.

## Still open / unresolved

- **Ram Chassis Cab msrp (11 of 12 rows)** — tried Claude in Chrome again this pass; the extension reports not connected at all this time (different failure than last time's timeout). Text-based alternatives were already exhausted last pass and remain contaminated/mismatched for the reasons documented then. Genuinely stuck without either a working browser session or a non-web source (dealer/fleet contact).
- **Kia Telluride** — see item 1. Needs your call: add as MY2027 (breaking the MY2026-only convention as a deliberate exception), or leave out.
- **NHTSA "Not Rated" vs "never tested" luxury gaps** — real, not a research shortfall; will close over time as NHTSA publishes more MY2026 scores, nothing actionable right now.
- A few genuinely-too-new-for-data gaps noted above (Jeep Recon, Rogue PHEV, Volvo EX30 Cross Country, Genesis Electrified GV70, electric Cayenne, several halo/ultra-low-volume luxury trims) — not expected to resolve until more real-world sales history exists.

## Coverage summary (1,601 rows)
| Field | Coverage |
|---|---|
| nhtsa_overall_stars | 48.7% |
| resale_depreciation_pct | 79.3% (up from 16.6%) |
| zero_to_60_sec | 41.1% |
| top_speed_mph | 22.7% |
| msrp | 99.1% |
| destination_fee / true_starting_price | 86.9% / 86.9% |
| front/rear legroom, front/rear headroom | 94.8% / 89.1% / 94.3% / 88.6% |
| cargo (seats-up / max) | 87.3% / 66.7% |
