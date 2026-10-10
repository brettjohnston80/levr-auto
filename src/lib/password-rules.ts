// Password rules for any NEW password: sign-up (/signup and the intake
// pop-up), reset, and change (Brett, 2026-10-10; digit added the same day so
// it matches Supabase's "lowercase, uppercase letters, digits and symbols"
// setting exactly, which Brett sets in the dashboard). Plain module, no server
// imports, so the forms and the server actions share one definition. Login
// is deliberately not checked: accounts created under the old 6/8-character
// rule must still be able to sign in.
//
// "Special character" uses Supabase Auth's own symbol set, so if the
// Supabase password setting is tightened to require symbols, the app and
// Supabase can never disagree about what counts.

export const PASSWORD_MIN_LENGTH = 8;

// Approved wording (Brett, 2026-10-10).
export const PASSWORD_REQUIREMENTS =
  "Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character (like ! or #).";

const SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~";

/** The requirement message if the password falls short, otherwise null. */
export function passwordProblem(password: string | null | undefined): string | null {
  const pw = password ?? "";
  const ok =
    pw.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    [...pw].some((ch) => SPECIAL_CHARACTERS.includes(ch));
  return ok ? null : PASSWORD_REQUIREMENTS;
}
