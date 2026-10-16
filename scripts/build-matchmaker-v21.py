"""Builds data/matchmaker-vehicle-dataset-2026-v21.csv (raw, 46 columns) from v20.

Wave 3 decisions (docs/research/configurator-wave3-review-2026-10-15.md section 7)
and the re-pass review (docs/research/configurator-repass-review-2026-10-16.md):
  - add the Wave 3 Matchmaker rows (re-pass file), except the six Charger Daytona
    rows: our dataset already has the Charger Daytona as model "Charger";
  - 2027 Charger Daytona sedans carry the +$500 four-door premium
    (plain Scat Pack $72,495 coupe / $72,995 sedan; Scat Pack Plus +$500 likewise);
  - 2027 Daytona Scat Pack Plus is 670 hp (v20 already says so; checked, not changed).

Raw only: scoring (data/matchmaker_scoring_pipeline.py), import, promotion and the
/matchmaker redeploy are separate, later steps.

    python3 scripts/build-matchmaker-v21.py
"""
import csv

BASE = "data/matchmaker-vehicle-dataset-2026-v20.csv"
ADDITIONS = "data/matchmaker-additions-wave3-repass-2026-10.csv"
OUT = "data/matchmaker-vehicle-dataset-2026-v21.csv"
SEDAN_PREMIUM_2027 = 500.0


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
        if (r["make"], r["model"], r["model_year"], r["body_style"]) == ("Dodge", "Charger", "2027", "Sedan") and r["trim"].startswith("Daytona"):
            old = r["msrp"]
            msrp = float(old) + SEDAN_PREMIUM_2027
            r["msrp"] = f"{msrp:.1f}"
            r["true_starting_price"] = f"{msrp + float(r['destination_fee']):.1f}"
            log.append(f"Charger {r['trim']} 2027 Sedan: msrp {old} -> {r['msrp']}, true_starting_price -> {r['true_starting_price']}")
        if (r["make"], r["model"], r["model_year"], r["trim"]) == ("Dodge", "Charger", "2027", "Daytona Scat Pack Plus"):
            assert r["horsepower"] == "670.0", f"expected 670 hp, found {r['horsepower']}"

    kept = [a for a in additions if not (a["make"] == "Dodge" and a["model"] == "Charger Daytona")]
    log.append(f"added {len(kept)} Wave 3 rows (dropped {len(additions) - len(kept)} Charger Daytona rows)")

    keys = {(r["make"], r["model"], r["trim"], r["model_year"], r["body_style"], r["drivetrain"], r["fuel_type"]) for r in rows}
    for a in kept:
        k = (a["make"], a["model"], a["trim"], a["model_year"], a["body_style"], a["drivetrain"], a["fuel_type"])
        assert k not in keys, f"duplicate vehicle: {k}"
        keys.add(k)

    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
        w.writeheader()
        w.writerows(rows + kept)
    log.append(f"{OUT}: {len(rows) + len(kept)} rows ({len(rows)} from v20 + {len(kept)})")
    print("\n".join(log))


if __name__ == "__main__":
    main()
