"""Splits the 2026 Dodge Durango "GT Plus" row (V6 and HEMI V8 merged) into "GT Plus" (3.6L V6)
and "GT Plus HEMI" (5.7L HEMI V8), Brett's pass 3 decision 3 (2026-10-16).

Reads data/dodge-chrysler-alfa-configurator-pass3-2026-10.csv (kept as received) and writes
data/dodge-chrysler-alfa-configurator-pass3b-2026-10.csv: the same file with that one row replaced,
in place, by the two rows. Every difference comes from Dodge's own Build & Price configurations:
  V6:   CUD202611WDEH75F / 2TH  ($45,595 before destination)
  HEMI: CUD202611WDES75D / 2TT  ($47,275 before destination)
compared option by option (engine, transmission, wheels, package prices and which packages exist).

    python3 scripts/build-durango-gt-plus-split.py
"""
import csv

SRC = "data/dodge-chrysler-alfa-configurator-pass3-2026-10.csv"
OUT = "data/dodge-chrysler-alfa-configurator-pass3b-2026-10.csv"
CFG = "https://www.dodge.com/hostd/api/configure/EN/states/KS/models/{}/lowerLevelPackages/{}/configurations/standard.json"
V6_URL = CFG.format("CUD202611WDEH75F", "2TH")
HEMI_URL = CFG.format("CUD202611WDES75D", "2TT")


def items(cell):
    return [t.split(" | ") for t in cell.split(" ;; ")] if cell else []


def join(parts):
    return " ;; ".join(" | ".join(p) for p in parts)


def set_avail(parts, name, avail, price="", package=""):
    hit = [p for p in parts if p[0] == name]
    assert len(hit) == 1, f"{name}: {len(hit)} matches"
    hit[0][1:] = [avail, price, package]


def main():
    with open(SRC, newline="") as f:
        raw = f.read()
    rows = list(csv.reader(raw.splitlines(keepends=True)))
    header = rows[0]
    col = {c: i for i, c in enumerate(header)}
    idx = [i for i, r in enumerate(rows) if i and (r[col["model"]], r[col["trim"]], r[col["model_year"]]) == ("Durango", "GT Plus", "2026")]
    assert len(idx) == 1, idx
    base = rows[idx[0]]

    # --- GT Plus (3.6L V6), from 2TH
    v6 = list(base)
    v6[col["drivetrain_engine_variants"]] = join([
        ["AWD", "Standard", "0", ""],
        ["3.6L V6 24V VVT Pentastar Engine with Stop/Start", "Standard", "0", ""],
        ["8-Speed Automatic 850RE Transmission", "Standard", "0", ""],
    ])
    w = items(v6[col["wheel_options"]])
    for name in ['20" x 10.0" Forged Y-Spoke Lights Out Wheels', '20" x 8.0" Black Noise Split 5-Spoke Wheels',
                 "20-Inch x 8.0-Inch Satin Carbon Split 5-Spoke Whls", "20-Inch x 10.0-Inch Painted Satin-Carbon Wheels"]:
        set_avail(w, name, "Unavailable")  # only in the HEMI configuration
    v6[col["wheel_options"]] = join(w)
    pk = [p for p in items(v6[col["package_definitions"]]) if p[0] != "Tow N Go Package"]  # HEMI only
    for p in pk:
        if p[0] == "Blacktop Package":
            p[1] = "2595"  # V6 configuration's price ($2,045 is the HEMI's)
    v6[col["package_definitions"]] = join(pk)
    v6[col["sources"]] = f"{V6_URL} (GT Plus split, 2026-10-16) ; " + base[col["sources"]]
    v6[col["discrepancy_notes"]] = ("Base MSRP $45,595 (AWD, 3.6L V6, before $1,995 destination). Split 2026-10-16 from the combined "
                                    "GT Plus row; the HEMI V8 version is its own row, GT Plus HEMI.")
    v6[col["confidence_notes"]] = (f"Source: Dodge Build & Price configuration CUD202611WDEH75F/2TH (Kansas), compared option by option "
                                   f"with CUD202611WDES75D/2TT on 2026-10-16. All prices MSRP before destination.")

    # --- GT Plus HEMI (5.7L HEMI V8), from 2TT
    he = list(base)
    he[col["trim"]] = "GT Plus HEMI"
    he[col["drivetrain_engine_variants"]] = join([
        ["AWD HEMI V8", "Standard", "0", ""],
        ["5.7L V8 HEMI MDS VVT Engine", "Standard", "0", ""],
        ["8-Speed Automatic Transmission", "Standard", "0", ""],
    ])
    w = items(he[col["wheel_options"]])
    for name in ["20-Inch x 8.0-Inch Black Noise Aluminum Wheels", "20-Inch x 8.0-Inch Fine-Silver Wheels"]:
        set_avail(w, name, "Unavailable")  # only in the V6 configuration
    he[col["wheel_options"]] = join(w)
    pk = items(he[col["package_definitions"]])
    for p in pk:
        if p[0] == "Blacktop Package":
            # $2,045 stays (the HEMI configuration's price). Its wheel there is the Split 5-Spoke
            # (code WST); the Black Noise Aluminum wheel (WH4) is only in the V6 configuration.
            assert "20-Inch x 8.0-Inch Black Noise Aluminum Wheels" in p[2]
            p[2] = p[2].replace("20-Inch x 8.0-Inch Black Noise Aluminum Wheels", '20" x 8.0" Black Noise Split 5-Spoke Wheels')
    he[col["package_definitions"]] = join(pk)
    he[col["sources"]] = f"{HEMI_URL} (GT Plus split, 2026-10-16) ; " + base[col["sources"]]
    he[col["discrepancy_notes"]] = ("Base MSRP $47,275 (AWD, 5.7L HEMI V8, before $1,995 destination). Split 2026-10-16 from the "
                                    "combined GT Plus row. Blacktop Package: $2,045, with the 20-in. Black Noise Split 5-Spoke wheel (the V6's "
                                    "Black Noise Aluminum wheel isn't offered on the HEMI).")
    he[col["confidence_notes"]] = (f"Source: Dodge Build & Price configuration CUD202611WDES75D/2TT (Kansas), compared option by option "
                                   f"with CUD202611WDEH75F/2TH on 2026-10-16. All prices MSRP before destination.")

    out = rows[: idx[0]] + [v6, he] + rows[idx[0] + 1:]
    eol = "\r\n" if "\r\n" in raw else "\n"
    with open(OUT, "w", newline="") as f:
        csv.writer(f, lineterminator=eol).writerows(out)
    print(f"{OUT}: {len(out) - 1} rows (was {len(rows) - 1}); GT Plus 2026 split into GT Plus / GT Plus HEMI at row {idx[0]}")


if __name__ == "__main__":
    main()
