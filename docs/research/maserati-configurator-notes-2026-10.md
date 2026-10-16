# Maserati configurator data: notes (2026-10-15)

Goes with `data/maserati-configurator-full-2026-10.csv`: 13 trim rows, same 18 columns and cell format as the Toyota file. Matchmaker rows for the same 13 trims are in `data/matchmaker-additions-wave3-2026-10.csv`.

## Coverage

Maserati's US configurator offers **model year 2027 only** (no 2026 version is on the selector). Every version on it is included:

| Model | Trims (rows) | Body | Fuel | Base MSRP | Destination |
|---|---|---|---|---|---|
| Grecale | V6, Modena V6, Trofeo V6, Folgore | SUV | Gas / EV (Folgore) | $77,900 / $84,500 / $115,500 / $97,000 | $1,995 |
| GranTurismo | Base, Trofeo, Folgore | Coupe | Gas / EV (Folgore) | $147,900 / $166,000 / $140,000 | $2,495 |
| GranCabrio | Base, Trofeo, Folgore | Convertible | Gas / EV (Folgore) | $158,000 / $176,200 / $150,200 | $2,495 |
| MCPURA | Base, Cielo | Coupe / Convertible | Gas | not published | not published |
| GT2 Stradale | Base | Coupe | Gas | not published | not published |

Option count after running the real import parser (`configurator-parse.ts`, `blankPriceUnknown`): 1,638 options, 0 dropped package references, 287 unpriced extra-cost options. 268 of them are on MCPURA (97), MCPURA Cielo (105) and GT2 Stradale (66), which have no published prices at all; the other 19 are spread over the priced trims: Grecale V6 1, Modena V6 3, Trofeo V6 1, Folgore 1; GranTurismo Base 2, Trofeo 2, Folgore 4; GranCabrio Base 1, Trofeo 1, Folgore 3.

## Sources

All official Maserati US:
- Configurator landing page (model list, starting prices, destination disclaimer): https://www.maserati.com/us/en/shopping-tools/configurator
- Per-trim configurator: `https://www.maserati.com/us/en/shopping-tools/configurator?modelCode=<code>&modelName=<name>` (codes are in each row's `sources`).
- The configurator's own data feeds, read in Chrome: `https://www.configurator.maserati.com/ccbe/public/api/carGrid/1/<code>` (options, prices, defaults, packages and their contents) and `.../countryProp/1/<code>/en` (option names, tech data).
- Paint, interior and wheel prices come from the configurator's own price labels on each swatch (the carGrid feed doesn't carry paint prices).
- Model pages: https://www.maserati.com/us/en/models/grecale, /granturismo, /grancabrio, /mcpura, /gt2-stradale, and /grancabrio/grancabrio-folgore (Folgore horsepower).

No Edmunds or other secondary source was used for the configurator CSV. The Matchmaker rows needed some (see below).

## How the D2 rules were applied

- **Trim names (rule 1/2).** Maserati's own version names, minus the model name: Grecale "V6", "Modena V6", "Trofeo V6", "Folgore"; GranTurismo/GranCabrio "Trofeo" and "Folgore". `Base` is used only where Maserati gives the version no name of its own: the entry GranTurismo and GranCabrio (Maserati calls them just "GranTurismo"/"GranCabrio" for 2027, after dropping "Modena"), MCPURA and GT2 Stradale.
- **Engine (rule 4).** One short line per row, e.g. `3.0L twin-turbo V6, 385 hp, automatic, AWD`. Maserati gives the transmission only as "auto", "Automatic", "single-speed" or "DCT", so no gear count is stated (dual-clutch rows say `dual-clutch automatic`).
- **Drivetrain (rule 7).** One per row: AWD for Grecale/GranTurismo/GranCabrio, RWD for MCPURA and GT2 Stradale. No trim offers a drivetrain choice.
- **Body style (rule 6).** SUV, Coupe, Convertible. The GranCabrio's configurator data calls it a "Coupé"; it is a soft-top convertible and is stored as `Convertible`. MCPURA Cielo ("Spyder" in the tech data) is `Convertible`.
- **Fuel (rule 8).** `Gas` and `EV`.
- **Prices (rule 5).** Blank only where the configurator shows no price. Never estimated.

## Things that could not be confirmed

- **MCPURA, MCPURA Cielo, GT2 Stradale have no US prices anywhere.** The configurator shows no starting price, no destination, and every option price is blank (dealer price on request). Edmunds/KBB had no figures either. All price cells are blank on purpose, and their `discrepancy_notes` say so. The configurator's default picks (for example the "AI Aqua Rainbow Matte" paint, the white Fuoriserie logo) were changed from "$0" to blank with a note, so nothing reads as free.
- **GranTurismo/GranCabrio Trofeo horsepower.** The configurator's tech sheet still says 542 HP, but its own model-selector card says 582 HP, which is the MY2027 figure (+40 hp, confirmed by Maserati dealer and press coverage). 582 is used; the row says so.
- **GranTurismo/GranCabrio Folgore horsepower.** Blank in the configurator; 751 hp (818 hp with MaxBoost) is taken from Maserati's GranCabrio Folgore page. The GranTurismo Folgore page gives no figure; the same powertrain is assumed and noted.
- **Missing standard equipment on four trims.** The configurator data for GranTurismo Folgore, GranCabrio Folgore and GT2 Stradale (and partly MCPURA) leaves out most standard items (CarPlay, digital cluster, heated seats). Those checks are left blank ("not confirmed"), not marked Unavailable.
- **A few individual choices show no price** (e.g. Grecale "Ghiaccio/Greige - Fuoriserie" interior, GranTurismo "Nero Assoluto" paint): left blank with a note.
- **Two Fuoriserie items on Grecale Modena V6 are listed at 0.00** in the data (body-color grille inserts, dark chrome trident) while the same items cost $2,020 and $1,070 on other Grecales. Left blank with a note rather than shown as free.
- **Grecale V6 required option.** The default build adds the required Inox Sport Pedals ($350), so the configurator's "yours at" price is $78,250. The base MSRP stays $77,900 and the pedals are listed as Standard +$350 with a note.
- **Fuel tank sizes for MCPURA (18.9 gal) vs MCPURA Cielo/GT2 Stradale (13.2 gal)** look wrong in Maserati's data, so tank capacity is left blank in the Matchmaker rows for all three.
- **GranCabrio soft-top colors** are in `roof_options` (Black standard, four colors at $730).

## Models deliberately excluded

None. MCPURA and GT2 Stradale are included even though they have no prices, because they are on the live US configurator; Brett may want to hold them from promotion until prices exist (open question in the summary).

## Possible naming mismatches with MarketCheck

Not checked against MarketCheck (no calls made). Likely differences:
- **Grecale entry trim:** Maserati says "V6" for 2027; older stock and many sources use "GT". MarketCheck likely has "GT" for MY2025-2026 listings.
- **"Modena V6" / "Trofeo V6":** MarketCheck and KBB probably say "Modena" / "Trofeo".
- **GranTurismo/GranCabrio base:** "Base" here; older listings say "Modena"; KBB says "Base Style".
- **Folgore:** EPA and Cars.com treat "GranTurismo Folgore" / "GranCabrio Folgore" as separate models. Here they are trims (D3: one model name).
- **MCPURA:** usually spelled "MCPura" by third parties; Cielo is a trim here, while the EPA calls it "MCPURA Spyder" and Maserati's code treats it as its own model. Predecessor listings will say "MC20" / "MC20 Cielo".
