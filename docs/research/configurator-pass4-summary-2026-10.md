# Configurator pass 4: summary (2026-10-16)

Pass 4 worked through items A–G of `cowork-pass4-prompt-2026-10-16.md` in order. Only official US manufacturer sources were used: audiusa.com, configurator.porsche.com and newsroom.porsche.com, mbusa.com's Build & Price data service, configure.bmwusa.com, gmc.com / buick.com configurator data, lincoln.com Build & Price, dodge.com Build & Price data, media.vw.com and mitsubishicars.com. No dealer or third-party sources, no MarketCheck or other paid APIs, no cookie banners accepted.

Progress: A done | B done | C done | D done | E done | F done | G done

## Files

| file | rows in | rows out | what changed |
|---|---|---|---|
| data/porsche-landrover-configurator-pass4-2026-10.csv | 113 | 118 | B: 5 rows added (2026 Macan Electric Base, 4, 4S, GTS, Turbo) |
| data/mercedes-configurator-pass4-2026-10.csv | 62 | 67 | C: 5 rows added (2026 E-Class E 350, E 450 4MATIC, AMG E 53 HYBRID; 2026 E-Class Wagon E 450 4MATIC All-Terrain, AMG E 53 HYBRID) |
| data/gmc-buick-configurator-pass4-2026-10.csv | 81 | 81 | E: 518 package entries cleaned; 38 requirement lines moved to the notes |
| data/cadillac-lincoln-configurator-pass4-2026-10.csv | 95 | 95 | E: 362 package entries cleaned (Lincoln 7, Cadillac 355) |
| data/configurator-engine-facts-pass4-2026-10.csv | | 59 rows | B: 2026 Macan GTS; G: Audi, VW Atlas 2026, Mitsubishi |

There are no pass 4 files for vw-audi (A: nothing to add), bmw-mini (D: nothing to add) or dodge-chrysler-alfa (F: report only). Every output keeps the input's header, 18 fields per row, the "Name | Availability | Price | Package" cell format and line endings, with every existing row in its original order. The app parser (`src/lib/configurator-parse.ts`) drops 0 items in all four CSVs.

## A. Audi: nothing to add (16 models)

audiusa.com's Build page offers **one version** for every one of these models in its file year. For 2027 Audi sells each as a single version with packages (e.g. Q5 "TFSI quattro S tronic" $53,300; the Premium / Premium Plus / Prestige split is gone), and the 2026 RS 6 Avant and RS 7 are single-version too. So no rows were added:
- A5 2027, A6 2027, A8 2027, Q3 2027, Q5 2027, Q5 Sportback 2027, RS 3 2027, RS 6 Avant 2026, RS 7 2026, RS Q8 2027, S3 2027, S5 2027, S8 2027, SQ5 2027, SQ5 Sportback 2027, SQ9 2027: Audi USA sells one version.
- Dealer listings named "Premium Plus" / "Prestige" for these models are 2026 cars, which this file doesn't cover.

## B. 2026 Porsche Macan Electric: 5 rows added

- porsche.com/usa's model pages show 2027 only, but **Porsche's US configurator still serves model year 2026** (`configurator.porsche.com/en-US/mode/model/2026/<code>`, price date 2026-06-15). The rows come from there, not from a price list or press release.
- Base MSRPs are the same as 2027: Base $80,300, 4 $84,000, 4S $89,900, GTS $105,300, Turbo $112,700, plus $2,350 delivery. **Paint to Sample is $13,870 for 2026.**
- The 2026 and 2027 option data were compared item by item. Differences:
  - 22-in. RS Spyder Design Wheels: $5,230 on Base, 4 and 4S; $4,110 on Turbo.
  - Remote ParkAssist incl. 3D Surround View and Porsche Digital Key: $1,310.
  - No Technology Package for 2026; Drive Assist is a $1,140 option instead.
  - GTS and Turbo offer a 19.2 kW On-Board Charger ($1,780).
- Horsepower: only the GTS (563 hp) is stated in Porsche USA's 2026 material. **Unresolved:** 2026 hp for Base, 4, 4S and Turbo.

## C. 2026 Mercedes-Benz E-Class: 5 rows added

- mbusa.com's model menu shows 2027 only, but **Mercedes-Benz USA's own Build & Price data service still serves model year 2026** (option tree, content, default options). The rows come from there.
- 2026 MSRPs before the $1,350 destination charge (2027: $1,450):

| model | 2026 MSRP |
|---|---|
| E 350 Sedan | $63,900 |
| E 350 4MATIC Sedan | $66,400 |
| E 450 4MATIC | $72,300 |
| AMG E 53 HYBRID Sedan | $89,600 |
| E 450 4MATIC All-Terrain | $78,300 |
| AMG E 53 HYBRID Wagon | $93,350 |

- The engine lines (255 / 375 / 577 hp) match the 2026 data, so no engine-facts rows were needed.
- The main differences from 2027 are in the mercedes notes file.

## D. BMW X3 sDrive: nothing to add

**BMW USA doesn't sell an sDrive (RWD) X3 for 2026.** Its model list (configure.bmwusa.com/UBYOConfigurator/v4/BM/modellist) has only the X3 30 xDrive ($51,300) and X3 M50 xDrive ($66,500) for 2026, and no 2027 X3. The "30" listings correctly match "30 xDrive".

## E. GM package contents: notes removed

- **GMC/Buick:** 518 entries changed.
  - The ~175 the brief counted:
    - 120 entries had "RPO X (name not exposed by configurator)". Each code was named from GM's configurator data for that build (e.g. UKL = Super Cruise, PZ8 = Hitch View). "-SUSP", "-OFFRD" and "-WATTS" were named from the package descriptions (Off-Road suspension; Watts to Freedom).
    - 27 entries were "not itemized". They were replaced with the configurator's own list, or "contents: not published" for Hitch Package (13) and Heavy Duty Front Spring/Camper Package (6).
    - 38 entries had "Requires Package". The note was moved to the notes file's Package requirements table, with the package each one needs.
  - Also removed, the same kind of note:
    - "(dealer-installed LPO accessory package)" on 363 entries;
    - "(shown at $0 because it is bundled inside: …)" on 40 entries.
- **Lincoln:** all 7 "not itemized" entries were rewritten from lincoln.com:
  - Jet Appearance Package (2027 Aviator Reserve);
  - Lincoln Co-Pilot360 Drive 2.0 (2026 Nautilus ×3);
  - the Premiere collection (2027 Navigator and Navigator L).
  - 2026 Corsair Grand Touring "Adaptive Suspension" isn't shown on lincoln.com, so its contents are "not published".
- **Cadillac:** "dealer-installed (LPO); " was removed from 355 entries, the same kind of note.
- Names and prices are unchanged.

## F. 2027 Dodge Durango prices (report only)

Source: https://www.dodge.com/hostd/api/cvd/CUD202711/CUD202711_CVD.json. **All 8 known prices are confirmed, and there are no other 2027 Durango configurations.** Destination is $1,995 ($2,045 in Hawaii).

| configuration | Dodge code | MSRP before destination | brief said | result | default build as configured |
|---|---|---|---|---|---|
| GT HEMI V8 AWD | CUD202711WDES75A / 2TS | $43,875 | $43,875 | confirmed | $43,875 |
| GT HEMI V8 Plus AWD | CUD202711WDES75D / 2TT | $47,475 | $47,475 | confirmed | $48,070 |
| GT HEMI V8 Premium AWD | CUD202711WDES75E / 2TU | $50,475 | $50,475 | confirmed | $51,070 |
| R/T 392 AWD | CUD202711WDEX75A / 2TL | $51,745 | $51,745 | confirmed | $52,340 |
| R/T 392 Plus AWD | CUD202711WDEX75E / 2TC | $55,645 | $55,645 | confirmed | $56,240 |
| R/T 392 Premium AWD | CUD202711WDEX75C / 2TN | $58,345 | $58,345 | confirmed | $58,940 |
| SRT Hellcat AWD | CUD202711WDEM75H / 2TP | $81,495 | $81,495 | confirmed | $82,090 |
| SRT Hellcat Jailbreak AWD | CUD202711WDEM75G / 2TM | $82,490 | $82,490 | confirmed | $83,085 |

"As configured" adds the default build's $595 paint on every configuration except the GT HEMI V8 AWD.

## G. Horsepower

Rows in `configurator-engine-facts-pass4-2026-10.csv`:
- **Audi (32 lines),** from each model's audiusa.com overview page. A3 201; A5 268; A6 362; A8 335; Q3 255; Q5 and Q5 Sportback 268; Q8 335; RS 3 394; RS 6 Avant 621; S3 328; S5 362; S8 563; SQ5 and SQ5 Sportback 362. Electric:
  - RS e-tron GT 2027: 912 (with launch control);
  - A6 Sportback e-tron: 456 quattro / 375 RWD, both with launch control. The RWD figure is from the "similar models" card on the A6 Sedan page.
  - Q4 e-tron 2026: 45 RWD 282, 55 quattro 335 (the Q4 page itself says 282; a card elsewhere says 280).
  - Q4 Sportback e-tron 55: 335.
- **VW Atlas 2026 (10 lines):** 269 hp, 2.0L I4, from VW's 2026 Atlas tech specs (media.vw.com).
- **Mitsubishi (16 lines):** Outlander Sport 2027: 2.0L 148 hp, 2.4L (SEL) 168 hp. Eclipse Cross 2026: 152 hp, from mitsubishicars.com specs pages.
- **Lexus TZ 2027 (3 lines): unresolved.** Lexus's TZ page and press release give no horsepower, and the linked spec sheet PDF is access-denied.

## Unresolved

- 2026 Macan Electric Base, 4, 4S and Turbo horsepower (B).
- Lexus TZ 2027 horsepower (G).
- GMC/Buick package requirements that couldn't be named (18): the configurator either adds no other package when they're chosen, or the package isn't in today's data (Canyon Off Road Lighting / Recovery / Sports Bar, Sierra Cargo Convenience, HUMMER Bronze Beadlock / Off-Road Readiness).
- Contents not published: GMC Hitch Package (13 rows), Heavy Duty Front Spring/Camper Package (6), Lincoln Corsair Adaptive Suspension (1).
- Full lists are in each notes file.

## For Brett

1. **Standard-equipment package notes left alone.** 198 GMC/Buick entries read "contents: standard equipment on this trim (GM standard-features list names the package but does not itemize it separately)", and 52 Lincoln entries start "standard equipment group on this trim; …". They're research notes too, but weren't in the brief's list. Clean them the same way next pass ("contents: not published", or the brand's list)?
2. **The dealer-installed and "shown at $0" notes were removed too** (GMC/Buick 363 + 40, Cadillac 355). The brief named "dealer-installed LPO accessory package" as an example, but its ~175 count suggests it meant only the RPO / not-itemized / requires entries. Removing those notes loses the "dealer-installed" flag; say if you want it kept somewhere else, such as the confidence notes.
3. **Item F for Matchmaker v21:** all eight 2027 Durango MSRPs above are Dodge's own, before destination.
4. New 2026 rows were placed just before the same model's 2027 rows. There were no same-year rows to follow, so this was the nearest spot that keeps each model together.
