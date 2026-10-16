# maserati configurator re-pass: notes (2026-10-16)

Input `data/maserati-configurator-full-2026-10.csv` → output `data/maserati-configurator-repass-2026-10.csv`. Same header, same 13 rows in the same order, 18 fields per row, same line endings and cell format. Only the cells listed below changed; every changed row also has the source URL added to its `sources` cell.

## Changes

None. Every value checked was already correct or could not be confirmed (see below).

### What was checked

- **B / F3 – GranTurismo / GranCabrio entry trim: "Base" kept.** maserati.com/us lists the 2027 versions as just "GranTurismo" / "GranCabrio" ($147,900 / $158,000), plus Trofeo and Folgore; "Modena" isn't used as a version name. MCPURA and GT2 Stradale Base also kept. Sources: https://www.maserati.com/us/en/models/granturismo , https://www.maserati.com/us/en/models/grancabrio
- **C7 – Grecale Folgore engine text: unchanged.** Maserati's own configurator data gives Transmission "auto" for the Grecale Folgore (code 7827680) but "single-speed" for the GranTurismo and GranCabrio Folgore (8398830, 8392610). So the file's "automatic" matches Maserati's label. Source: https://www.configurator.maserati.com/ccbe/public/api/countryProp/1/7827680/en
- **C9 – MCPURA / MCPURA Cielo / GT2 Stradale US prices: still not published** (model pages show only Build and price; no US pricing in Maserati releases through 14 Oct 2026). Prices stay blank.

## Unresolved

- No Maserati statement says outright that "Modena" was dropped for 2027; the Base conclusion rests on the US model pages and configurator.

## Counts

- Rows: 13 in, 13 out.
- Cells changed: 0 (trim 0, other 0); plus the matching `sources` cells.
- Engine-facts rows for these makes in `data/configurator-engine-facts-2026-10.csv`: 0 (0 with hp, 0 hp blank).
- Prices (section D): not touched in this batch.
