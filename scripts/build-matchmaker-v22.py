"""Builds data/matchmaker-vehicle-dataset-2026-v22.csv (raw, 46 columns) from v21.

Tesla and Rivian, from Cowork's 2026-10-25 research (data/tesla-rivian-configurator-full-2026-10.csv,
docs/research/tesla-rivian-configurator-notes-2026-10.md) and Brett's decisions
(docs/research/tesla-rivian-configurator-review-2026-10-25.md, sections 5 and 8):
  - Tesla Model 3 and Model Y: 2027 rows added, copies of the 2026 rows (Tesla's configurator
    builds them as 2027 at the same prices). The 2026 rows stay; the site offers them only while
    2026 inventory lasts (guarantee-exceptions plan, data/while-inventory-lasts.json);
  - Tesla Cybertruck: trims renamed to the configurator's names ("Dual Motor AWD", "Premium AWD"),
    destination $1,995 (was $1,390; tesla.com's own totals agree), and the 600 hp on the Dual Motor
    and Premium AWD blanked (a KBB figure Tesla doesn't publish);
  - Rivian 2027 R1T and R1S: destination $1,895 (Rivian's configurator summary; was blank);
  - Rivian 2027 R1T and R1S "Premium Long Range" rows added: the Premium with the $7,000 Max
    (Long Range) battery, $86,990 and $90,990 before destination, range "up to 420 miles"
    (rivian.com builder, Compare panel, 2026-10-25); copies of the Premium rows otherwise;
  - Rivian 2026 R1 rows (old Dual/Tri/Quad names, Launch Editions included) unchanged, destination
    left blank (not researched); the site offers them only while 2026 inventory lasts;
  - models in data/held-models.json are left out, as in v21 (now also the Rivian R2).

Raw only: scoring (data/matchmaker_scoring_pipeline.py), import, promotion and the
/matchmaker redeploy are separate, later steps.

    python3 scripts/build-matchmaker-v22.py
"""
import csv
import json

BASE = "data/matchmaker-vehicle-dataset-2026-v21.csv"
OUT = "data/matchmaker-vehicle-dataset-2026-v22.csv"
HELD = "data/held-models.json"

CYBERTRUCK_RENAMES = {
    "Dual Motor All-Wheel Drive": "Dual Motor AWD",
    "Premium All-Wheel Drive": "Premium AWD",
}
CYBERTRUCK_DESTINATION = 1995.0
CYBERTRUCK_HP_BLANKED = {"Dual Motor AWD", "Premium AWD"}
RIVIAN_R1_DESTINATION_2027 = 1895.0
# The Premium with the Max (Long Range) battery: base price before destination, and range.
PREMIUM_LONG_RANGE = {
    "R1T": {"msrp": 86990.0, "link": "https://rivian.com/configurations/builder/r1t"},
    "R1S": {"msrp": 90990.0, "link": "https://rivian.com/configurations/builder/r1s"},
}
PREMIUM_LONG_RANGE_RANGE_MI = 420.0


def held_entry(row, held):
    """The held-models entry covering this row: make and model, plus trim / model_year when the entry names them."""
    for h in held:
        if (h["make"], h["model"]) != (row["make"], row["model"]):
            continue
        if "trim" in h and h["trim"] != row["trim"]:
            continue
        if "model_year" in h and h["model_year"] != row["model_year"]:
            continue
        return h
    return None


def money(x: float) -> str:
    return f"{x:.1f}"


def main() -> None:
    with open(BASE, newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)
    with open(HELD) as f:
        held = json.load(f)

    log = []
    out = []
    added = []
    for r in rows:
        if r["make"] == "Tesla" and r["model"] == "Cybertruck":
            if r["trim"] in CYBERTRUCK_RENAMES:
                log.append(f"Cybertruck trim {r['trim']!r} -> {CYBERTRUCK_RENAMES[r['trim']]!r}")
                r["trim"] = CYBERTRUCK_RENAMES[r["trim"]]
            r["destination_fee"] = money(CYBERTRUCK_DESTINATION)
            r["true_starting_price"] = money(float(r["msrp"]) + CYBERTRUCK_DESTINATION)
            log.append(f"Cybertruck {r['trim']}: destination -> {r['destination_fee']}, true_starting_price -> {r['true_starting_price']}")
            if r["trim"] in CYBERTRUCK_HP_BLANKED and r["horsepower"]:
                log.append(f"Cybertruck {r['trim']}: horsepower {r['horsepower']} -> blank")
                r["horsepower"] = ""
        if r["make"] == "Rivian" and r["model"] in ("R1T", "R1S") and r["model_year"] == "2027":
            assert not r["destination_fee"], f"Rivian {r['model']} {r['trim']} already has a destination"
            r["destination_fee"] = money(RIVIAN_R1_DESTINATION_2027)
            r["true_starting_price"] = money(float(r["msrp"]) + RIVIAN_R1_DESTINATION_2027)
            log.append(f"Rivian {r['model']} {r['trim']} 2027: destination -> {r['destination_fee']}, true_starting_price -> {r['true_starting_price']}")
        out.append(r)
        if r["make"] == "Tesla" and r["model"] in ("Model 3", "Model Y") and r["model_year"] == "2026":
            copy = dict(r, model_year="2027")
            added.append(copy)
            log.append(f"added Tesla {r['model']} {r['trim']} 2027 (copy of 2026)")
        if r["make"] == "Rivian" and r["model"] in PREMIUM_LONG_RANGE and r["model_year"] == "2027" and r["trim"] == "Premium":
            lr = PREMIUM_LONG_RANGE[r["model"]]
            copy = dict(
                r,
                trim="Premium Long Range",
                msrp=money(lr["msrp"]),
                true_starting_price=money(lr["msrp"] + RIVIAN_R1_DESTINATION_2027),
                range_mi=money(PREMIUM_LONG_RANGE_RANGE_MI),
                manufacturer_link=lr["link"],
            )
            added.append(copy)
            log.append(f"added Rivian {r['model']} Premium Long Range 2027: msrp {copy['msrp']}, range {copy['range_mi']}")
    out.extend(added)

    kept = []
    for r in out:
        h = held_entry(r, held)
        if h:
            log.append(f"held: {r['make']} {r['model']} {r['trim']} {r['model_year']} ({h['why']})")
            continue
        kept.append(r)

    keys = [(r["make"], r["model"], r["trim"], r["model_year"], r["body_style"], r["drivetrain"], r["fuel_type"]) for r in kept]
    assert len(keys) == len(set(keys)), "duplicate vehicle identity in v22"

    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
        w.writeheader()
        w.writerows(kept)
    print(f"{BASE}: {len(rows)} rows -> {OUT}: {len(kept)} rows ({len(added)} added, {len(out) - len(kept)} held)")
    for line in log:
        print("  " + line)


if __name__ == "__main__":
    main()
