"""Builds data/configurator-dealer-installed-packages-2026-10.csv (Brett, 2026-10-17).

Pass 3 of the GM research marked dealer-installed packages inside their
contents ("(dealer-installed LPO accessory package)" / "dealer-installed (LPO); ").
Pass 4 removed those notes as research notes, so the flag is restored from
pass 3: one line per (make, model, trim, model_year, package) that pass 3
marked, kept only when pass 4 still has that row and that package.
"""
import csv
import re
import sys

PAIRS = [
    ("data/gmc-buick-configurator-pass3-2026-10.csv", "data/gmc-buick-configurator-pass4-2026-10.csv"),
    ("data/cadillac-lincoln-configurator-pass3-2026-10.csv", "data/cadillac-lincoln-configurator-pass4-2026-10.csv"),
]
OUT = "data/configurator-dealer-installed-packages-2026-10.csv"
FLAG = re.compile(r"dealer-installed", re.I)
KEY = ("make", "model", "trim", "model_year", "drivetrain", "fuel_type", "body_style")


def packages(cell):
    out = {}
    for entry in (cell or "").split(";;"):
        name = entry.split("|")[0].strip()
        if name:
            out[name] = entry
    return out


rows_out, missing = [], []
for p3, p4 in PAIRS:
    pass4 = {tuple(r[k] for k in KEY): packages(r["package_definitions"]) for r in csv.DictReader(open(p3.replace("pass3", "pass4"), newline=""))}
    for r in csv.DictReader(open(p3, newline="")):
        key = tuple(r[k] for k in KEY)
        for name, entry in packages(r["package_definitions"]).items():
            if not FLAG.search(entry):
                continue
            if key in pass4 and name in pass4[key]:
                rows_out.append([r["make"], r["model"], r["trim"], r["model_year"], name])
            else:
                missing.append((key, name))

seen, unique = set(), []
for row in rows_out:
    if tuple(row) not in seen:
        seen.add(tuple(row))
        unique.append(row)

with open(OUT, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["make", "model", "trim", "model_year", "package"])
    w.writerows(unique)

print(f"{OUT}: {len(unique)} packages ({len(rows_out)} flagged entries); not in pass 4: {len(missing)}")
for m in missing[:20]:
    print("  missing:", m)
sys.exit(0)
