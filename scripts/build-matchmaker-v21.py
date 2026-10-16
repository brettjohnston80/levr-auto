"""Builds data/matchmaker-vehicle-dataset-2026-v21.csv (raw, 46 columns) from v20.

Wave 3 decisions (docs/research/configurator-wave3-review-2026-10-15.md section 7)
and the re-pass review (docs/research/configurator-repass-review-2026-10-16.md):
  - add the Wave 3 Matchmaker rows (re-pass file), except the six Charger Daytona
    rows: our dataset already has the Charger Daytona as model "Charger";
  - 2027 Charger sedans carry Dodge's four-door premium (dodge.com Build & Price,
    docs/research/dodge-chrysler-alfa-configurator-prices-notes-2026-10.md): +$2,000 on
    the gas R/T, R/T Plus, Scat Pack and Scat Pack Plus; +$500 on the Daytona (plain
    Scat Pack $72,495 coupe / $72,995 sedan; Scat Pack Plus likewise);
  - 2027 Daytona Scat Pack Plus is 670 hp (v20 already says so; checked, not changed);
  - models in data/held-models.json are left out (Volvo EX40, Maserati MCPURA / MCPURA
    Cielo / GT2 Stradale). The same file holds them out of the configurator import, so
    removing an entry releases the model in both places.

Raw only: scoring (data/matchmaker_scoring_pipeline.py), import, promotion and the
/matchmaker redeploy are separate, later steps.

    python3 scripts/build-matchmaker-v21.py
"""
import csv
import json

BASE = "data/matchmaker-vehicle-dataset-2026-v20.csv"
ADDITIONS = "data/matchmaker-additions-wave3-repass-2026-10.csv"
OUT = "data/matchmaker-vehicle-dataset-2026-v21.csv"
# 2027 four-door premium over the two-door, by trim (dodge.com, 2026-10-16).
SEDAN_PREMIUM_2027 = {
    "R/T": 2000.0,
    "R/T Plus": 2000.0,
    "Scat Pack": 2000.0,
    "Scat Pack Plus": 2000.0,
    "Daytona Scat Pack": 500.0,
    "Daytona Scat Pack Plus": 500.0,
}
HELD = "data/held-models.json"


def main() -> None:
    with open(BASE, newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)
    with open(ADDITIONS, newline="") as f:
        add_reader = csv.DictReader(f)
        assert add_reader.fieldnames == header, "additions columns differ from v20"
        additions = list(add_reader)

    log = []
    for r in rows:
        if (r["make"], r["model"], r["model_year"], r["body_style"]) == ("Dodge", "Charger", "2027", "Sedan"):
            assert r["trim"] in SEDAN_PREMIUM_2027, f"no four-door premium for Charger {r['trim']} 2027"
            old = r["msrp"]
            msrp = float(old) + SEDAN_PREMIUM_2027[r["trim"]]
            r["msrp"] = f"{msrp:.1f}"
            r["true_starting_price"] = f"{msrp + float(r['destination_fee']):.1f}"
            log.append(f"Charger {r['trim']} 2027 Sedan: msrp {old} -> {r['msrp']}, true_starting_price -> {r['true_starting_price']}")
        if (r["make"], r["model"], r["model_year"], r["trim"]) == ("Dodge", "Charger", "2027", "Daytona Scat Pack Plus"):
            assert r["horsepower"] == "670.0", f"expected 670 hp, found {r['horsepower']}"

    kept = [a for a in additions if not (a["make"] == "Dodge" and a["model"] == "Charger Daytona")]
    log.append(f"added {len(kept)} Wave 3 rows (dropped {len(additions) - len(kept)} Charger Daytona rows)")

    with open(HELD) as f:
        held = {(h["make"], h["model"]): h["why"] for h in json.load(f)}
    for source, rs in (("v20", rows), ("Wave 3", kept)):
        for r in rs:
            if (r["make"], r["model"]) in held:
                log.append(f"held ({source}): {r['make']} {r['model']} {r['trim']} {r['model_year']}: {held[(r['make'], r['model'])]}")
    rows = [r for r in rows if (r["make"], r["model"]) not in held]
    kept = [a for a in kept if (a["make"], a["model"]) not in held]

    keys = {(r["make"], r["model"], r["trim"], r["model_year"], r["body_style"], r["drivetrain"], r["fuel_type"]) for r in rows}
    for a in kept:
        k = (a["make"], a["model"], a["trim"], a["model_year"], a["body_style"], a["drivetrain"], a["fuel_type"])
        assert k not in keys, f"duplicate vehicle: {k}"
        keys.add(k)

    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
        w.writeheader()
        w.writerows(rows + kept)
    log.append(f"{OUT}: {len(rows) + len(kept)} rows ({len(rows)} from v20 + {len(kept)} Wave 3)")
    print("\n".join(log))


if __name__ == "__main__":
    main()
