# Verification matrix (master summary)

**Started 2026-10-15** with agent dashboard Phase 1 (agent assignment and agent sign-in). VCRM style: every requirement, how it's verified, and its status. Each row links to its area table, which gives the decision's source, where it's built, and the exact test names. Areas are added as each phase's traceability is written.

**Methods:**
- **Test:** a scripted run against real data on scratch accounts, or a rolled-back database test.
- **Inspection:** checked by reading the code; nothing runs it.
- **—:** not verified yet.

**Statuses:** ✅ verified by test · 🔍 verified by inspection · ⚠ not yet verified.

## Summary

| Area | Requirements | ✅ by test | 🔍 by inspection | ⚠ not yet verified |
|---|---|---|---|---|
| Agent assignment (`04`, A1–A14) | 14 | 13 | 1 | 0 |
| Agent sign-in (`04`, S1–S13) | 13 | 13 | 0 | 0 |
| **Total** | **27** | **26** | **1** | **0** |

## Every requirement

| ID | Requirement | Method | Evidence | Status |
|---|---|---|---|---|
| A1 | Test accounts (any `.invalid` customer) are never auto-assigned | Test | c3-A, c3-B, c3-switch | ✅ |
| A2 | Continuity: a customer's next search goes to the agent of their other search, if active and in rotation | Test | rolled-back assignment test, part A (Brett, 2026-10-15) | ✅ |
| A3 | Round-robin over everyone in rotation, least recently assigned first | Test | Step 4 database test D | ✅ |
| A4 | Nobody in rotation → least-recently-assigned active lead, with a lead alert | Test | rolled-back assignment test, part C (Brett, 2026-10-15); alert email by c4-simulate | ✅ |
| A5 | No active lead → unassigned, admin alert; admins never picked by the system | Test | rolled-back assignment test, part D (Brett, 2026-10-15); alert email by c4-simulate | ✅ |
| A6 | Deactivated agents are never assigned | Test | rolled-back assignment test, part B (Brett, 2026-10-15) | ✅ |
| A7 | A switched search keeps its agent | Test | c3-switch | ✅ |
| A8 | Assignment at payment never delays or undoes the payment | Test | c3-A, c3-B | ✅ |
| A9 | Hourly backstop at :15: one run at a time, bounded, never reassigns | Test | c3-A | ✅ |
| A10 | A failed assignment raises one alert per search, emailed now, retried hourly, closed once assigned | Test | c4-B, c4-autoresolve | ✅ |
| A11 | Only leads and admins reassign | Test | c3-A (database function; no screen yet) | ✅ |
| A12 | Tests never assign to, or act as, Brett (LEVRID 1) | Test | every run: "LEVRID 1 untouched", Brett's activity 2 → 2 | ✅ |
| A13 | Production honours `?only=` for a manual run; scoped runs are logged and say so | Test | production-mode route check, c8-jobs | ✅ |
| A14 | Away is a flag only and never changes assignment | Inspection | `assign_search` reads no away data | 🔍 |
| S1 | A separate agent sign-in at `/agent` | Test | c1b | ✅ |
| S2 | Two-factor required on every agent page and action | Test | c1d-pages, c1d-actions (144/144) | ✅ |
| S3 | One generic error; 5 failures per account, 20 per network in 15 minutes | Test | c1b | ✅ |
| S4 | Sign-in fails closed without `AGENT_SIGNIN_HASH_SECRET` | Test | c1b-nosecret | ✅ |
| S5 | Invite-only; one-use links lasting 1 hour | Test | c1c, c1g | ✅ |
| S6 | Rotation defaults: agents in, leads and admins out, test agents never | Test | c1g-rotation | ✅ |
| S7 | Agent and customer accounts fully separate | Test | c1a, c1d, accept-refusal | ✅ |
| S8 | LEVRID: permanent, spent when someone is added | Test | c1g, c1g-rotation | ✅ |
| S9 | Role gates (C16) | Test | c16-1e | ✅ |
| S10 | Self-serve password reset; authenticator still needed | Test | c1c | ✅ |
| S11 | Two-factor reset rules; it ends every session first | Test | c16-1e, c1e | ✅ |
| S12 | 8-hour idle sign-out, this browser only | Test | idle2 | ✅ |
| S13 | Brett's cutover to `brett@` before or at the deploy | Test | 1f rehearsal | ✅ |

## Keeping it current
When a test or inspection changes a status, update the row here and in its area table in the same commit. A requirement is ✅ only after its run has passed against real data and been cleaned up.
