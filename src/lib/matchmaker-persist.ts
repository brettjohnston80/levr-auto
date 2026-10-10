// Matchmaker answers that survive a refresh, Back and coming back later
// (Cruz's tester feedback #2), and the shareable list link (#3). Approved
// 2026-10-10.
//
// SEPARATE FROM THE INTAKE PREFILL. `levr_matchmaker_prefill`
// (matchmaker-prefill.ts) hands one vehicle to the intake form and must
// never resume anything; intake's own keys can resume a checkout. This key
// holds only Matchmaker's own on-page state, and nothing outside
// matchmaker.tsx reads it.

import type { Answers } from "./matchmaker-data";

const STATE_KEY = "levr_matchmaker_state_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SavedMatchmakerState {
  v: 1;
  savedAt: number;
  step: number;
  done: boolean;
  answers: Answers;
  dismissed: string[];
  flaggedGroups: { flagKey: string; make: string; model: string; trimId: string }[];
  prioritiesTouched: boolean;
  modelYearTouched: boolean;
  powertrainTouched: boolean;
}

/** Raw stored string (for useSyncExternalStore); null when absent or blocked. */
export function readSavedMatchmakerRaw(): string | null {
  try {
    return window.localStorage.getItem(STATE_KEY);
  } catch {
    return null;
  }
}

export function parseSavedMatchmakerState(raw: string | null): SavedMatchmakerState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedMatchmakerState;
    if (s?.v !== 1 || typeof s.savedAt !== "number" || Date.now() - s.savedAt > MAX_AGE_MS) return null;
    if (!s.answers || !Array.isArray(s.answers.priorities)) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveMatchmakerState(state: Omit<SavedMatchmakerState, "v" | "savedAt">): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...state }));
  } catch {
    // Private mode / storage blocked: the page still works, it just won't remember.
  }
}

export function clearSavedMatchmakerState(): void {
  try {
    window.localStorage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
}

// --- Share link ------------------------------------------------------------
//
// Carries only vehicle ids and the ranked priorities -- no personal data.
// /matchmaker is a static page, so the recipient's browser reads it.

export interface SharedList {
  ids: string[];
  priorities: string[];
}

function toBase64Url(text: string): string {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function buildShareUrl(origin: string, list: SharedList): string {
  return `${origin}/matchmaker?share=${toBase64Url(JSON.stringify({ i: list.ids, p: list.priorities }))}`;
}

/** Parses a `share` param; null for anything malformed. Ids are checked against real vehicles by the caller. */
export function parseShareParam(search: string): SharedList | null {
  const param = new URLSearchParams(search).get("share");
  if (!param) return null;
  try {
    const raw = JSON.parse(fromBase64Url(param)) as { i?: unknown; p?: unknown };
    const ids = Array.isArray(raw.i) ? raw.i.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
    const priorities = Array.isArray(raw.p) ? raw.p.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
    return ids.length > 0 ? { ids, priorities } : null;
  } catch {
    return null;
  }
}
