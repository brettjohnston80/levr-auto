import type { ModelYearOptions } from "@/lib/intake-vehicle-options";

/**
 * The model-year selection rules, in one place (2026-09-14).
 *
 * Every surface that lets someone commit to a vehicle -- intake, the free
 * make/model/year correction, both switch forms, and the agent undecided
 * finalize form -- has to agree on two things: which years a make/model
 * can be committed in, and when a single year is pre-selected. Copying
 * that logic into each form is exactly how two surfaces end up offering a
 * different set of cars.
 *
 * Pure and client-safe. The ModelYearOptions import is type-only (erased
 * at build), so this never drags intake-vehicle-options.ts's server-only
 * admin client into a "use client" bundle.
 */

/**
 * The years a make/model can be committed in, ascending, as select values.
 * Empty when the make/model is unknown or no promoted batch exists -- in
 * which case nothing is committable, which the server enforces too.
 */
export function yearsForModel(
  options: ModelYearOptions | undefined,
  make: string,
  model: string,
): string[] {
  return (options?.[make]?.[model] ?? []).map(String);
}

/**
 * The year to pre-select for a make/model: its only year when it has
 * exactly one, otherwise "" (nothing chosen).
 *
 * A single-year model pre-selects because there is nothing to choose
 * between -- the select stays visible and shows the year being committed
 * to. Two or more years always start blank, so a real choice is always
 * made by a person. Approved 2026-09-14.
 */
export function soleYearForModel(
  options: ModelYearOptions | undefined,
  make: string,
  model: string,
): string {
  const years = yearsForModel(options, make, model);
  return years.length === 1 ? years[0] : "";
}
