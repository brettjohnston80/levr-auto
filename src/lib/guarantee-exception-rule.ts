/**
 * Guarantee exceptions for direct-sale brands (GX-2; docs/plans/guarantee-exceptions-plan.md).
 * Pure and import-free so the Node unit tests load it directly; guarantee-exceptions.ts feeds it
 * the data file.
 */

export interface GuaranteeException {
  make: string;
  why: string;
  since: string;
}

export interface WhileInventoryLasts {
  make: string;
  model?: string;
  model_year?: string;
  why: string;
  since: string;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The list's spelling of the make when the guarantee doesn't apply to it, else null. */
export function exceptionMake(list: GuaranteeException[], make: string | null | undefined): string | null {
  if (!make) return null;
  return list.find((e) => norm(e.make) === norm(make))?.make ?? null;
}

/**
 * The guarantee columns for a search whose brand is being set now (payment, the undecided pick,
 * a correction, a switch). An undecided search (no make yet) stays pending until its vehicle is
 * chosen. The database trigger keeps the two columns in step.
 */
export function guaranteeColumnsFor(
  list: GuaranteeException[],
  make: string | null | undefined,
): { guarantee_status: "pending" | "not_applicable"; guarantee_exception_make: string | null } {
  const m = exceptionMake(list, make);
  return m ? { guarantee_status: "not_applicable", guarantee_exception_make: m } : { guarantee_status: "pending", guarantee_exception_make: null };
}

/** Is this make/model/year on the while-inventory-lasts list? (Offered only while listings exist.) */
export function whileInventoryLastsEntry(
  list: WhileInventoryLasts[],
  make: string,
  model: string,
  modelYear: number | null,
): WhileInventoryLasts | null {
  return (
    list.find(
      (e) =>
        norm(e.make) === norm(make) &&
        (!e.model || norm(e.model) === norm(model)) &&
        (!e.model_year || (modelYear != null && Number(e.model_year) === modelYear)),
    ) ?? null
  );
}

/** The current terms version a customer must have accepted before paying (GX-2). Bumped when
 *  the real, attorney-reviewed terms are published (GX-6); everyone is then asked again. */
export const TERMS_VERSION = "interim-2026-10";

export function hasCurrentTerms(customer: { terms_version: string | null } | null | undefined): boolean {
  return customer?.terms_version === TERMS_VERSION;
}
