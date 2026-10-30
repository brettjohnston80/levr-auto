// Customer-facing wording for the guarantee exceptions (GX-3). Approved by Brett 2026-10-25
// (docs/plans/guarantee-exceptions-plan.md, section 4 and 4a); W13 (the terms clause) waits for
// the attorney and lives in the terms page, not here.

/** W1, W2, W5, W6, W12. */
export const noGuaranteeLine = (brand: string) => `Our money-back guarantee does not apply to ${brand}.`;
/** W3: the link text is "Terms of Service". */
export const TERMS_AGREE_BEFORE = "I agree to the ";
export const TERMS_AGREE_LINK = "Terms of Service";
export const TERMS_AGREE_AFTER = ".";
/** W3a / FP. */
export const EXCEPTIONS_FINE_PRINT = "Money-back guarantee does not apply to Tesla, Rivian, Lucid or Polestar.";
/** W4. */
export const TERMS_REQUIRED = "Please agree to the Terms of Service to continue.";
/** W7. */
export const SWITCH_TO_COVERED = "Your new search is covered by our money-back guarantee.";
/** W8. */
export const noGuaranteeDealLine = (brand: string, through: string) =>
  `Our money-back guarantee does not apply to ${brand}. Your search runs through ${through}, and you can extend it for $100 per 30 days.`;
/** M1, M3, M5: links to the FAQ entry. */
export const TERMS_APPLY = "Terms apply.";
export const TERMS_APPLY_HREF = "/faq#guarantee-brands";
