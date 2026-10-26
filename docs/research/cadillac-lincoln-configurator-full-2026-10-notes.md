# Cadillac + Lincoln configurator research: notes (2026-10-11)

Companion to `data/cadillac-lincoln-configurator-full-2026-10.csv`. It has **95 rows** (71 Cadillac, 24 Lincoln), one row per trim, in the same 18 columns as the Toyota CSV.

A script checked all 5,225 option items:
- every availability is one of Standard / Standalone / Package-only / Unavailable
- every price is a whole number or blank
- every Package-only item names a package listed in that row's `package_definitions`
- there are no duplicate make/model/trim/year rows

## Method

- **Cadillac:** the live cadillac.com Build & Price configurator, read through its own data feed (`aec-cp-configurator-gateway`), using ZIP 67201. This is the same GM feed used for the GMC/Buick pass.
  - The `trim` call gave every trim × drive × engine/transmission combination and its MSRP.
  - `configurator-state` gave colors, interiors, wheels, roof, seats, factory options, LPO accessories and packages with their contents.
  - `standard-features` gave each trim's standard-equipment list.
- **Lincoln:** the live lincoln.com Build & Price configurator. Each trim's build page carries its full option set as server-rendered data (`initialConfig`): colors, packages, powertrain, wheels, seating color, 2nd-row seats, options, prices and destination.
- **Representative build:** each row's options come from one build, which is the configurator's default drive for that trim (stated in `confidence_notes`). `drivetrain_engine_variants` lists every drive/engine/transmission choice, priced as the difference from that build.
- **MSRPs** exclude destination. Destination is given per row in `discrepancy_notes`.
- **Edmunds cross-check:** base MSRP for every trim against Edmunds' features-specs style prices. 2027 on-sale status was checked on Edmunds and MarketCheck.
- **Live-screen spot checks** against the rendered configurator pages:
  - 2027 Aviator Reserve matched the data exactly: paint $950/$750/$0, Reserve II $7,995, 22" wheels $1,500, mini spare $450, block heater $190, base $67,295, destination $1,695.
  - 2026 Escalade Platinum Sport also matched: paint $725/$1,325 and the 24" 7-spoke wheel $1,800.
- **Raw pulls** are kept in `data/raw/cadillac-configurator-raw.json` and `data/raw/lincoln-configurator-raw.json`, so the CSV can be rebuilt without re-scraping.

## Coverage

| Make | Model | Years | Trims |
|---|---|---|---|
| Cadillac | CT5 | 2026 | Premium Luxury, Sport, V, V Blackwing |
| Cadillac | XT5 | 2026 | Luxury, Premium Luxury, Sport |
| Cadillac | Escalade / Escalade ESV | 2026 | Base, Luxury, Sport, Platinum Luxury, Platinum Sport, V |
| Cadillac | Escalade / Escalade ESV | 2027 | Luxury, Sport, Platinum Luxury, Platinum Sport, V |
| Cadillac | Escalade IQ / IQL | 2026 | Luxury, Sport, Premium Luxury, Premium Sport |
| Cadillac | Lyriq | 2026, 2027 | Luxury, Premium Luxury, Signature Luxury, Sport, Premium Sport, Signature Sport, V, V Premium |
| Cadillac | Optiq | 2026, 2027 | Luxury, Premium Luxury, Sport, Premium Sport, V |
| Cadillac | Vistiq | 2026, 2027 | Luxury, Premium Luxury, Sport, Platinum |
| Lincoln | Aviator | 2026, 2027 | Premiere, Reserve, Black Label |
| Lincoln | Corsair | 2026 | Premiere, Reserve, Grand Touring (PHEV) |
| Lincoln | Nautilus | 2026 | Premiere, Reserve, Black Label (hybrid is a powertrain option) |
| Lincoln | Navigator / Navigator L | 2026, 2027 | Premiere, Reserve, Black Label |

Trim and model names follow the existing matchmaker dataset: CT5 V and V Blackwing sit under CT5, V-Series is written as "V", and Navigator L is its own model.

**MY2027 rows** are included only where the configurator is live and dealers have stock. MarketCheck on 2026-10-11 showed new 2027 units for Lyriq (4,220), Optiq (2,780), Vistiq (2,460), Escalade (2,056), Escalade ESV (1,091), Navigator (5,693) and Aviator (4,723). Edmunds lists all seven with prices.

## Exclusions

- **Cadillac Celestiq:** hand-built, with no standard configurator (per your instructions).
- **2026 CT4 / CT4-V:** Edmunds still lists a 2026 CT4, and the matchmaker dataset has 2026 CT4 rows. But cadillac.com's configurator rejects 2026 CT4 ("Unsupported Vehicle") and only links a 2025 CT4 build. With no live configurator, it's excluded. **Worth deciding whether the existing 2026 CT4 matchmaker rows should stay.**
- **XT4 and XT6:** discontinued; there's no 2026 configurator or Edmunds page.
- **2027 CT5, XT5, Escalade IQ / IQL:** no 2027 configurator exists yet ("Unsupported Vehicle").
- **2027 Corsair and 2027 Nautilus:** lincoln.com already has live 2027 configurators for both. But Edmunds says they aren't released yet (Corsair "Early 2027", Nautilus "Late 2026"), and MarketCheck shows no 2027 Corsair or Nautilus dealer listings. They're left out under the "already on sale" rule.
  - The existing matchmaker dataset already has 2027 Corsair and Nautilus rows. Those were added before they went on sale.
  - Lincoln's 2027 Corsair is hybrid-only (Premiere $46,495, Reserve $53,495). The raw file has its data for when it lands.
- **Lincoln Aviator Grand Touring:** not offered. The configurator returns Premiere when asked for it.

## Discrepancies

1. **The 2026 Escalade / ESV base trim** is labelled only by its order code "1SA" in Cadillac's configurator. Edmunds calls it "Base" at identical prices, so "Base" is used. That also matches the matchmaker dataset.
2. **2026 CT5:** the configurator is higher than Edmunds on every trim (RWD, ex-destination):
   - Premium Luxury and Sport +$600
   - V +$700
   - V Blackwing +$1,300

   Edmunds also lists no AWD CT5 styles, but the configurator offers AWD at +$2,000 on Premium Luxury, Sport and V.
3. **2027 Lyriq Signature Luxury and Signature Sport:** the configurator is **$1,200 lower** than Edmunds ($66,800 vs $68,000 and $67,300 vs $68,500, RWD). All other 2027 Lyriq trims match exactly. This could be a Cadillac price cut that Edmunds hasn't picked up.
4. **2026 Nautilus destination:** Lincoln's configurator charges $2,295, while Edmunds' price page implies $1,995. Base MSRPs match exactly.
5. **Navigator 2027 is cheaper than 2026:**
   - Premiere $89,995 vs $91,995 (4x2 is new for 2027)
   - Black Label $114,995 vs $119,525

   Both figures match Edmunds, so this is real, not a data error.
6. **Lincoln drive-choice prices:** Lincoln's configurator lists the alternative drive (AWD or 4x4) at $0 until its change dialog runs, and the rendered page shows no price either. So those prices come from Edmunds' style-price differences, and each row says so:
   - Aviator 2026 AWD +$2,500
   - Aviator 2027 AWD +$2,000
   - Corsair 2026 AWD +$2,300
   - Navigator 2027 4x4 +$3,000
7. **Cadillac trim-endpoint prices include destination.** The configurator's trim cards show MSRP plus destination, and the CSV uses the ex-destination figure. Edmunds' /msrp/ pages also include destination; its features-specs pages don't.

All other trims match Edmunds' base MSRP exactly.

## Known gaps (see each row's confidence_notes)

- **Cadillac items left out of option columns:** in 9 rows, the configurator flags some items as "requires another selection" without naming a package (e.g. 24" wheels, Night Vision, AKG 38-speaker audio on 2026 Escalade Luxury). They're listed by name and price in confidence_notes rather than guessed into a package.
- **Cadillac items with no price shown** (no-charge LPO items, see-dealer items) have a blank price. Choose-one items with no surcharge (paint, interior, seat layout) are recorded as 0.
- **Lincoln $0 package prices:** some Lincoln packages show $0 in the data even though they're selectable, for example Dynamic Handling on Aviator Reserve, Heavy-Duty Trailer Tow on 2027 Navigator, and Black Label Atmospheric Special Edition on 2027 Navigator Black Label. Their prices are left blank.
- **Lincoln package contents:** a few packages' contents are stored as unresolved references in Lincoln's page data (e.g. Jet Appearance on Aviator) and are marked "not itemized by configurator".
- **Lincoln has no full standard-equipment list.** Key features (heated or ventilated seats, power liftgate, HUD, etc.) are Standard only where they appear as included items or inside the trim's standard package text. Ones that can't be confirmed are **left out** rather than tagged Unavailable; this shows up most on Navigator.
  - For the same reason, `roof_options` is blank on 6 Navigator rows (Premiere and Black Label, both years and lengths).
  - `seating_configuration` is blank on Corsair and Nautilus (6 rows), because the configurator exposes no seating item for them.
- **Cadillac key features** are tagged Unavailable only when they appear neither in Cadillac's standard-feature list nor as an option or package item. Inteluxe and leatherette are not counted as leather.
- **Third-party accessory catalog items** (Thule, Husky, Napier, etc.) are left out of Lincoln rows. Lincoln's own retailer-installed options are kept.
- **XT5 Premium Luxury 3.6L V6:** the configurator gives it the same style price and no separate option price, so its price is blank.
- **Option prices are captured for one build per trim.** Other drive or engine choices can change a few options.
