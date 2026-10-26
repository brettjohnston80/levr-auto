# Configurator pass 3: summary (2026-10-16)

Pass 3 worked through the brief's groups A–E for seven files, in order: GMC/Buick, Cadillac/Lincoln, Dodge, BMW, Mercedes, Mitsubishi, Audi/VW. Inputs were the `*-configurator-prices-2026-10.csv` files (not edited). Each file has a new `*-configurator-pass3-2026-10.csv` and a notes file in `docs/research/`. All sources are official US manufacturer sites or their own configurator data feeds. No dealer or third-party sources, no paid APIs, no cookie banners accepted.

Progress: GMC done | Buick done | Cadillac done | Lincoln done | Dodge done | BMW done | Mercedes done | Mitsubishi done | Audi done | Volkswagen done

## Results by group

| group | what was asked | result |
|---|---|---|
| A. GM re-tags | ~230 "requires other items" / "already in default build" items | 66 re-tagged (GMC 44, Cadillac 22); 168 left unchanged and logged (GMC 118, Cadillac 49, Buick 1) |
| A. Acadia AT4 wheel | 2027 Acadia AT4 18-in. Gloss Black wheels | Package-only (Adventure Package) → Standalone, $2,495: GM lists it on its own; choosing it also adds the Black lug nut and wheel lock kit |
| A. Encore GX AUX heater | +$395 in the configurator | Left unchanged: it adds no package or engine and asks to confirm a change |
| B. $0 items | 67 GM items filled as $0 in the prices pass | 67 back to blank (GMC 57, Buick 3, Cadillac 7). None is in GM's standard-feature list for its build, and GM publishes no "$0" for any of them. This includes Night Vision on the 6 Escalade / ESV Platinum and V rows (checked first) |
| C1. Charger Daytona Scat Pack 2027 | add if confirmed | Not added. Stellantis' Dec 2025 release gives $72,495, but Dodge's 2027 configurator offers only the Scat Pack Plus, so there are no trim options to source |
| C2. BMW X5 40 sDrive, X5 50e, 750e | add if confirmed | Not added. BMW USA's model list doesn't include any of them |
| C3. Eclipse Cross SE Pano, SEL Touring 2026 | add if confirmed | Not added. Mitsubishi's 2026 configurator has no such trims (only a Panoramic Sunroof Package) |
| D1. Durango GT 2026 | split if mixed | Split into "GT" (3.6L V6, RWD or AWD, from $38,995) and "GT HEMI" (5.7L HEMI V8, AWD, $43,675). Confirmed there's no 2027 V6 GT |
| D2. EQE SUV EQE 320 2027 | split RWD / 4MATIC | Split into "EQE 320+" (RWD, $64,950) and "EQE 320 4MATIC" (AWD, $67,450), MBUSA names |
| E1. ID.4 Pro 20-in. AWD wheel | Unavailable if confirmed | Unavailable (vw.com offers only the 19-in. wheel on the 2026 ID.4 Pro) |
| E2. Audi paints | price or Unavailable | RS e-tron GT 2026 Ascari Blue, Progressive Red, Bedford Green: $595 each. RS 6 Avant 2026 Sebring Black: $1,095 |
| E3. Audi names | use Audi USA's names | "Nimbus Gray Metallic" → "Nimbus Gray Pearl Effect"; "Bedford Green" → "Bedford Green Metallic" (2026 RS e-tron GT) |
| E4. Lincoln Dynamic Handling Package | record per Aviator trim | Premiere: not offered. Reserve: only with Reserve II, no price. Black Label: $2,500 (2026 and 2027). File already matches; nothing changed |

## How the GM re-tags were decided

Each item was chosen on its own in the row's own build through GM's configurator feed (gmc.com, buick.com, cadillac.com; ZIP 67201), and GM's standard-feature list for that build was read.

- In the standard-feature list → Standard, 0 (1 item: Red calipers on the 2026 CT5 Sport).
- Choosing it adds exactly one package → Package-only with that package's exact name (GMC: Technology Package II, Max Trailering, SLT Convenience, Convenience, Extreme Off-Road; Cadillac: Super Cruise 1, Touring, Driver Assist). All of these were already in package_definitions with their prices.
- Choosing it switches to an engine/transmission choice whose price matches one in drivetrain_engine_variants → Package-only with that choice's exact name (Sierra 1500 AT4/AT4X 6.2L V8; Sierra HD 6.6L Duramax diesel, and the PTO transmission on one row).
- Anything else (the item pulls in other loose options, is in the default build but not the standard list, or changes the engine but not to a listed choice) → left unchanged and logged with the reason.

## For Brett to look at

1. **Engine choices in package_definitions.** The app's parser drops Package-only items whose Package isn't in package_definitions. So the 31 engine-linked GMC items survive, 14 package_definitions entries were added, each named exactly like the engine choice, with its price and the linked items as contents. Keep or remove? The parser drops 0 items with them in.
2. **Package links where the package contents don't name the item** (the configurator adds the package anyway). The least certain is the 2026 XT5: six items (heavy-duty cooling, alternator, Hitch Guidance ×2, heated rear seats, Air Ionizer) → Driver Assist Package.
3. **Durango GT Plus 2026** also mixes the V6 and HEMI versions. It wasn't in the brief, so it wasn't split.
4. **GM item names containing " -- "** (Sierra HD "Gooseneck / 5th Wheel Prep Package -- Hitch platform…", 7 rows). That's GM's name and it wasn't changed, but it collides with the note separator.

## Counts

| file | rows in | rows out | why different | re-tagged | $0 → blank | rows added | rows split | other changes | unresolved |
|---|---|---|---|---|---|---|---|---|---|
| gmc-buick | 81 | 81 | | 44 | 60 | 0 | 0 | 14 | 119 |
| cadillac-lincoln | 95 | 95 | | 22 | 7 | 0 | 0 | 0 | 49 |
| dodge-chrysler-alfa | 41 | 42 | Durango GT split in 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| bmw-mini | 72 | 72 | identical copy | 0 | 0 | 0 | 0 | 0 | 0 |
| mercedes | 61 | 62 | EQE 320 split in 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| mitsubishi-polestar-lucid | 33 | 33 | identical copy | 0 | 0 | 0 | 0 | 0 | 0 |
| vw-audi | 90 | 90 | | 0 | 0 | 0 | 0 | 7 | 0 |

"Other changes" for gmc-buick are the 14 engine-choice package_definitions entries; for vw-audi they are E1, E2 (4 paints) and E3 (2 renames).

Engine facts: `data/configurator-engine-facts-pass3-2026-10.csv` has 3 rows (Durango GT V6; Durango GT HEMI's "AWD HEMI V8" and 5.7L engine). The EQE split rows already state hp in their text and are electric, so they need none.

Checks before saving each file: same header; 18 fields per row; every option cell "Name | Availability | Price | Package"; every existing row present in its original order (split rows replaced in place); app parser drops 0 items in every output.
