/**
 * VIN check for offers (offer-entry plan 4.B): 17 characters, no I, O or Q, and the
 * check digit in position 9 (the North American rule every car sold new in the US carries).
 *
 * Pure; used in the browser and on the server.
 */

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Upper case, with spaces and dashes removed (how VINs get pasted). */
export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

export type VinCheck =
  | { ok: true; vin: string }
  | { ok: false; vin: string; problem: "length" | "characters" | "check_digit" };

export function checkVin(raw: string): VinCheck {
  const vin = normalizeVin(raw);
  if (vin.length !== 17) return { ok: false, vin, problem: "length" };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { ok: false, vin, problem: "characters" };
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const value = c >= "0" && c <= "9" ? Number(c) : TRANSLITERATION[c];
    sum += value * WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  if (vin[8] !== expected) return { ok: false, vin, problem: "check_digit" };
  return { ok: true, vin };
}
