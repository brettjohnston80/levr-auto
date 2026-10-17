// The configurator import's dealer-installed rule (Brett, 2026-10-17; plan
// docs/plans/dealer-installed-options-2026-10-16.md). Pure, so it is tested
// on its own (tests/dealer-installed.test.mjs).
//
// An option is dealer-installed when:
//   1. GM's own name carries the LPO code (hasLpoCode), or
//   2. it belongs to a package listed in
//      data/configurator-dealer-installed-packages-2026-10.csv (GM's pass 3
//      flags, restored after pass 4 removed them as research notes),
//      unless it's a paint or interior colour: a dealer can't paint the car,
//      so a colour that's only sold with a dealer-installed package is still
//      factory work (e.g. CT5 Black Raven with the Exterior Accent Package).
// Other makes get an explicit marker from a later Cowork pass; nothing is
// inferred from words like "accessory".

import type { ParsedTrimRow } from "./configurator-parse";
import { hasLpoCode } from "./option-display";

export interface DealerInstalledPackage {
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  packageName: string;
}

export interface DealerInstalledReport {
  /** Options flagged by GM's LPO code. */
  byLpoCode: number;
  /** Options flagged because their package is listed (and not already LPO). */
  byPackage: number;
  /**
   * Listed packages that flagged nothing, for review. Either the row wasn't
   * imported (held, or another make), or no option on the row is sold
   * through that package, so customers never see the package anyway.
   */
  unmatchedPackages: (DealerInstalledPackage & { why: "row_not_imported" | "no_option_in_package" })[];
}

/** Factory-only categories the package rule never flags (see the header). */
const PACKAGE_RULE_SKIPS = new Set(["exterior_color", "interior"]);

const keyOf = (make: string, model: string, trim: string, year: number, pkg: string) =>
  [make, model, trim, String(year), pkg].map((s) => s.trim().toLowerCase()).join("|");

export function dealerInstalledPackagesFromRows(rows: Record<string, string>[]): DealerInstalledPackage[] {
  return rows
    .map((r) => ({
      make: (r.make ?? "").trim(),
      model: (r.model ?? "").trim(),
      trim: (r.trim ?? "").trim(),
      modelYear: Number.parseInt((r.model_year ?? "").trim(), 10),
      packageName: (r.package ?? "").trim(),
    }))
    .filter((p) => p.make && p.model && p.trim && Number.isFinite(p.modelYear) && p.packageName);
}

/**
 * Sets `dealerInstalled` on every option of the given rows (in place) and
 * reports what it did. Rows are matched on make, model, trim and model year
 * (case-insensitive) plus the option's package name. A listed package is
 * reported as unmatched only when the import carried that make at all, so
 * a one-make import doesn't list every other make's packages.
 */
export function applyDealerInstalledRule(
  rows: ParsedTrimRow[],
  packages: DealerInstalledPackage[],
): DealerInstalledReport {
  const listed = new Map(packages.map((p) => [keyOf(p.make, p.model, p.trim, p.modelYear, p.packageName), p]));
  const used = new Set<string>();
  const rowKeys = new Set(rows.map((r) => keyOf(r.make, r.model, r.trim, r.modelYear, "")));
  const report: DealerInstalledReport = { byLpoCode: 0, byPackage: 0, unmatchedPackages: [] };

  for (const row of rows) {
    for (const o of row.options) {
      if (hasLpoCode(o.name)) {
        o.dealerInstalled = true;
        report.byLpoCode += 1;
      }
      if (o.packageName && !PACKAGE_RULE_SKIPS.has(o.category)) {
        const k = keyOf(row.make, row.model, row.trim, row.modelYear, o.packageName);
        if (listed.has(k)) {
          used.add(k);
          if (!o.dealerInstalled) report.byPackage += 1;
          o.dealerInstalled = true;
        }
      }
    }
  }

  const importedMakes = new Set(rows.map((r) => r.make.trim().toLowerCase()));
  for (const [k, p] of listed) {
    if (used.has(k) || !importedMakes.has(p.make.toLowerCase())) continue;
    const rowImported = rowKeys.has(keyOf(p.make, p.model, p.trim, p.modelYear, ""));
    report.unmatchedPackages.push({ ...p, why: rowImported ? "no_option_in_package" : "row_not_imported" });
  }
  return report;
}
