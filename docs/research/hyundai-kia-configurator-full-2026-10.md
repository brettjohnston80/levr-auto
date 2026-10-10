# Hyundai & Kia 2026(/2027) Configurator Research — Notes & Discrepancies
**Date:** 2026-10-10 · **Companion file:** `hyundai-kia-configurator-full-2026-10.csv` (156 rows, 18 columns, same schema as the Toyota reference CSV)

## Coverage

| Make | Models (rows) |
|---|---|
| Hyundai | Elantra (9), Sonata (6), Venue (3), Kona (4), Tucson (12), Santa Fe (9), Palisade (9), Ioniq 5 (5), Ioniq 5 N (1), Ioniq 6 (4), Ioniq 9 (6), Santa Cruz (3), Santa Cruz+EV misc — **75 rows** |
| Kia | K4 (5), K4 Hatchback (3), K5 (3), Seltos (5), EV6 (4), EV9 (5), Niro (5), Niro EV (2), Sportage (13), Sorento (12), Telluride (15), Carnival + Carnival Hybrid (9) — **81 rows** |

**156 rows total.** Every row passed a full automated format check (every option-column item is `name | availability | price | package_name` with availability restricted to the four required values; every `Package-only` item's package name matches an entry in that row's `package_definitions`; every price is numeric or blank; no duplicate make/model/trim/year/drivetrain rows).

One formatting bug was found and mechanically fixed, not re-researched: 9 items across Sonata/Venue rows (in `hyundai_sedans.csv`) had their trailing empty price/package fields dropped at the very end of the column string (e.g. `Aero Silver | Standalone |` instead of `Aero Silver | Standalone | |`). This was a string-formatting artifact, not a content error — the fix simply restored the missing empty field, it didn't change or add any confirmed fact.

## Model-year findings (2026 vs. 2027)

As of research date (Oct 2026), manufacturer configurators showed a genuinely mixed picture — unlike the Chevrolet/Ford pass, several Hyundai/Kia lines have **split model years within the same nameplate**:

- **Kia Telluride** — full redesign, MY2027 across the board (gas and hybrid). Confirmed genuinely on sale via dealer inventory (carpro.com, kbb.com), not just orderable.
- **Kia Sportage** (gas, Hybrid, PHEV) — MY2027 across the board; Edmunds' /2026/ page is stale/cached, not a live discrepancy.
- **Kia Carnival** (gas + Hybrid) — MY2027, confirmed via Kia's own 2026-07-21 press release and 0-mile 2027 dealer stock at three dealers.
- **Kia Sorento — split year.** Gas trims are MY2027 (Kia's own Oct 1 2026 press release). Hybrid and PHEV trims are **still MY2026** — the same press release explicitly says it "doesn't include 2027 HEV/PHEV details." A prior in-repo draft argued for MY2026 across the board based on a dealer-inventory check that found no 2027 stock; that tension is preserved in each row's `confidence_notes` rather than resolved by guessing.
- **Kia Niro** — kia.com's Build & Price already serves MY2027 pricing (unlike EV6/EV9/Niro EV, which are still MY2026); flagged as not independently cross-checked against live dealer inventory, so held to slightly lower confidence than the other MY2027 calls above.
- **Hyundai Kona, Ioniq 5, Santa Cruz** — MY2027 (per the pre-existing research batch this pass built on).
- Everything else (Elantra, Sonata, Venue, Tucson, Santa Fe, Palisade, Ioniq 6, Ioniq 9, K4/K4 Hatchback, K5, Seltos, EV6, EV9, Niro EV) — MY2026.

## Key discrepancies and flagged ambiguities

**Kia Sportage**
- Package prices (LX/EX Convenience, X-Line Technology, EX Panoramic Sunroof, and Hybrid-line equivalents) have confirmed *contents* from kia.com but no disclosed price anywhere checked — left blank, not guessed.
- EX Hybrid roof-rail availability footnote (FWD vs AWD) couldn't be confidently mapped to the right table column — flagged rather than resolved.
- Hybrid X-Line Technology Package's full contents/price are unconfirmed; only 2 of the gas package's items could be matched.

**Kia Sorento**
- 3-way pricing conflict on LX: KBB $33,885 vs. Edmunds (2026) $32,390 vs. Kia's own 2027 press release $32,590 — unresolved, all three preserved in notes.
- Edmunds' Hybrid/PHEV page internally contradicts itself ("6 total seats" vs. a described manual-folding third row) — not resolved by guessing.
- Hybrid/PHEV color palette uses entirely different names from the gas palette (Mineral Blue, Cityscape Green, etc. vs. Wolf Gray, Panthera Metal); could not confirm whether this is a genuine separate HEV/PHEV palette or stale 2026 naming.
- Per-trim wheel/color/feature granularity below the lineup level is weaker than other models in this dataset: Edmunds' per-trim URLs kept returning identical "S"-trim content regardless of which trim slug was requested; some granular detail (wheel-size progression, captain's-chair seating, premium colors) was carried over from an unverified prior-session source rather than independently re-fetched this session, and is flagged as such per row.

**Kia Telluride**
- Motor1 claims a +$2,000 AWD option on the SX trim; three other sources (Kia's own pricing announcement via CarPro, Edmunds, KBB) show SX as FWD-only at a single price. The guessed AWD line was NOT added.
- KBB's hybrid pricing table is consistently $400–$1,900 off from kia.com's own stated MSRPs; kia.com was treated as authoritative.
- No genuine bundled packages found for Telluride (trim-differentiated, not package-based) — all `package_definitions` cells are blank by design, not by omission.
- Per-trim wheel size, roof type, and interior material are unconfirmed for several trims (EX, SX, SX Prestige, X-Pro SX Prestige, and most of the hybrid lineup) because kia.com's configurator only fully rendered the LX default build via WebFetch.

**Kia Carnival**
- KBB's 2026 Carnival Hybrid page lists an implausible 64.00 kWh battery figure — flagged as a likely data error, not used.
- KBB and Edmunds disagree on 2026 Hybrid LXS MSRP by ~$1,445; Edmunds' figure was used (it matched Kia's press release and dealer invoice pricing).
- Real confirmed 2027 changes: Flare Red discontinued, Iceberg Green added (EX/SX/SX Prestige only); 2nd-row Captain's Chairs became a no-cost option on EX/SX specifically (not LXS or SX Prestige) — corroborated by JD Power, a trade article, and an actual window sticker.
- No Hybrid-specific per-trim color/wheel page was found; Hybrid colors/options were carried over from the equivalent gas trim and spot-checked against two real dealer listings — an inference, not a direct kia.com confirmation, flagged per row.
- SX Prestige's optional VIP Lounge heated/ventilated 2nd-row package is confirmed to exist but no source gave a price — left blank.

**Earlier-sourced models (Elantra/Sonata/Venue/Kona/Tucson/Santa Fe/Palisade/Ioniq 5-6-9/Santa Cruz, K4/K5/Seltos/EV6/EV9/Niro):** built in an earlier pass this session using the same manufacturer-site-first/Edmunds-second priority; one minor formatting bug (see above) was found and fixed on review, no content-level issues.

## Exclusions (per task instructions)

- **Kia Forte, Kia Soul** — not included; both discontinued for the US market (Forte superseded by K4, Soul discontinued) — consistent across all sources checked.
- **Kia Niro Plug-in Hybrid** — not found on kia.com's current Niro configurator; consistent with Kia having dropped the Niro PHEV from the US lineup. Not independently re-verified with a dedicated source check this pass — flagged here as a gap rather than asserted with full confidence.
- **Hyundai Nexo** — hydrogen fuel-cell model, extremely limited/CA-only distribution. **Not researched in this pass at all** (not assigned to any research agent) — this is a genuine coverage gap, not a confirmed exclusion. Flag for a follow-up pass if Nexo needs to be in the matchmaker.
- **Hyundai Accent, Veloster, original Ioniq (compact)** — not included; all discontinued in the US market.
- **Kia Stinger, Kia Rio** — not included; both discontinued in the US market.
- No commercial/fleet-only variants were found for any Kia model researched (Sportage, Sorento, Telluride, Carnival); none excluded on that basis.

## Primary sources used

- **Manufacturer Build & Price / specs-compare tools:** kia.com (Sportage, Sorento, Telluride, Carnival, Niro, Niro EV — all JS SPAs; WebFetch rendered static specs-compare pages fully but could not render the interactive Build & Price tool itself on most models), hyundai.com (earlier pass).
- **Edmunds** (secondary, as instructed) — features-specs pages for essentially every trim/powertrain combination; used for the bulk of per-trim option/package/color detail and model-year verification.
- **Manufacturer press releases**, used as primary pricing sources where the live configurator wasn't fully renderable: Kia's own 2027 Telluride and Carnival pricing announcements (via CarPro/The Auto Channel), kiamedia.com's 2027 Sorento press release.
- **Trade press**, used only as flagged tertiary cross-checks: autoguide.com (Sportage pricing), motor1.com (Telluride trim naming — treated as an outlier where it conflicted with 3+ other sources), vhcars.com, kbb.com (used for cross-checks throughout, flagged wherever it conflicted with Kia's own pricing).
- **Dealer listings / window stickers**, used only as spot-checks for on-sale verification and a handful of option-package confirmations: carpro.com, kbb.com inventory search, mandanford.com (a real factory window sticker for a 2027 Carnival EX), jeffwylerspringfieldkia.com, midtownkia.com.

## Process note

This research built on a partially-completed prior pass already present in this session's scratchpad (Elantra/Sonata/Venue, Kona/Tucson, Santa Fe/Palisade, Ioniq 5/6/9 + Santa Cruz, K4/K5, Seltos, EV6/EV9/Niro/Niro EV — 107 rows), which was independently re-validated column-by-column against the task's strict format rules (one formatting bug found and fixed, detailed above). Four additional model groups — Sportage, Sorento, Telluride, Carnival (49 rows) — were researched fresh this turn via four parallel agents, each instructed to avoid Claude-in-Chrome browser automation (to prevent cross-agent tab collisions on a shared browser session) and to rely on WebFetch against manufacturer static/specs-compare pages plus Edmunds instead. All 156 rows passed a final combined programmatic validation with zero format issues and zero duplicate trim rows.
