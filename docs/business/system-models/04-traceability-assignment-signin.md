# Traceability matrix: agent assignment and agent sign-in

**Pilot, 2026-10-15.** Each row is a decision Brett made, where it is built, and which test proves it. Tests are the scratch-account scripts run in the Chunk 8 rehearsal (2026-10-14/15) and the sign-in re-run on the final branch code (`1d95e28`, 2026-10-15), plus the rolled-back database tests Brett ran when each migration was applied. "Step n" is a Phase 1 migration (CLAUDE.md lists them).

**Status key** (the same three statuses as the master matrix, `05-verification-matrix.md`): ✅ **verified by test** (a run against real data) · 🔍 **verified by inspection** (checked by reading the code; no run exercises it) · ⚠ **not yet verified**.

## Agent assignment

| # | Decision (who, when) | Built in | Verified by | Status |
|---|---|---|---|---|
| A1 | Test accounts are never auto-assigned; every `.invalid` customer address counts (Brett N7; Step 15) | `assign_search` step 1, `is_test_customer()` (Step 15); sweep query leaves them out (`search-assignment.ts`) | c3-A "payment (tester domain): skipped_test_account"; "payment (@verify.invalid, newly covered by Step 15)"; c3-B real sweep "examined 0"; c3-switch | ✅ verified by test |
| A2 | Continuity: a customer's next search goes to the agent of their other search, if active and in rotation (Q2) | `assign_search` step 2 (Step 4) | Step 4 database test D only proved round-robin. **No run has exercised continuity.** | ⚠ not yet verified (pending the rolled-back assignment test) |
| A3 | Round-robin over everyone in rotation, least recently assigned first (Q3, Q4) | `assign_search` step 3, `agents.last_assigned_at` (Step 4) | Step 4 database test D (rolled back): method `round_robin`, assigned to Brett | ✅ verified by test |
| A4 | Nobody in rotation → least-recently-assigned active **lead**, with a lead alert (Q4, N1) | `assign_search` step 4 (Step 4; Step 13 ignores test agents) | c4-simulate checks the alert email path with a simulated empty rotation. **The database's own lead pick has never run against real rows.** | ⚠ not yet verified (pending the rolled-back assignment test; the alert email path is ✅) |
| A5 | No active lead → unassigned, admin alert; admins are never picked by the system (N1) | `assign_search` step 5; `agent_alert_recipients()` (Step 13) | c4-simulate: admin alert emailed straight away, nobody assigned. **Simulated; the database rule itself hasn't run.** | ⚠ not yet verified (pending the rolled-back assignment test; the alert email path is ✅) |
| A6 | Deactivated agents are never assigned (Q1, Q5) | `agents.active` in every `assign_search` pick; a deactivated agent is never in rotation (check constraint, Step 1) | Read in the code only | ⚠ not yet verified (pending the rolled-back assignment test) |
| A7 | A switched search keeps its agent (Step 5) | `switch_customer_search` (Steps 5, 9b) | c3-switch "free switch: new search inherits the old agent (inherited_switch history row)" | ✅ verified by test |
| A8 | Assignment at payment never delays or undoes the payment | webhook `after(() => assignSearchAtPayment(...))` | c3-A "assign_search called exactly once (after the response)", response 1,371 ms; c3-B "forced failure: webhook still answers 200 … payment completed" | ✅ verified by test |
| A9 | Hourly backstop at :15, one run at a time, bounded, never reassigns (plan section 4) | `/api/cron/agent-sweeps`, `cron_job_locks` (Step 15) | c3-A "two sweeps at the same moment: exactly one runs", "lock released after the run", "sweep that errors: 500, and the lock is still released", "assigned search never selected" | ✅ verified by test |
| A10 | A failed assignment raises one alert per search, emailed now, retried hourly, closed once the search has an agent | `raiseAssignmentFailedAlert`, `resolveAssignmentFailedAlerts`, `sendPendingAgentAlerts` | c4-B "one assignment_failed alert … emailed straight away", "still exactly one"; c4-autoresolve "old search's open failure alert is closed automatically" | ✅ verified by test |
| A11 | Only leads and admins reassign | `reassign_search` (Step 4), `reassignSearch` action | c3-A "reassign_search: plain agent refused", "lead allowed" (database function; the action has no screen yet) | ✅ verified by test |
| A12 | Tests never assign to, or act as, Brett (LEVRID 1) | test discipline | every assignment test ends "LEVRID 1 untouched"; Brett's activity count 2 → 2 on every run | ✅ verified by test |
| A13 | Production honours `?only=` for a manual run; scoped runs are logged and say so (Brett, 2026-10-14) | `src/lib/job-scope.ts` (`jobScope`, `scopeReport`), sweep route | production-mode route check: no `?only=` → `scoped: false`, same queries as `main`; `?only=` → `[job-scoped]` log, `scoped: true` with the ids | ✅ verified by test |
| A14 | Away is a flag only and never changes assignment (Brett's revision 2 correction) | `assign_search` never reads `agent_away_periods`; `agent_is_away()` is used only for flags (Step 3) | Inspection: the function text has no away condition | 🔍 verified by inspection |

**A2, A4, A5 and A6** are covered by the rolled-back assignment test written 2026-10-15 for Brett to run before deploy day. They stay "not yet verified" until it passes.

## Agent sign-in

| # | Decision (who, when) | Built in | Verified by | Status |
|---|---|---|---|---|
| S1 | A separate agent sign-in at `/agent`; customer `/login` unchanged (Chunk 1, section 7) | `src/app/agent/page.tsx`, `agent-signin-actions.ts` | c1b 24/24 | ✅ verified by test |
| S2 | Two-factor (authenticator) required, checked on the server on **every** agent page and action, not only at sign-in | `requireAgent` / `getAuthorizedAgent` (`agent-auth.ts`, aal2 plus a live factor check) | c1d-pages 28 of 29 on the normal server (the 29th is its idle check, which needs the 2-minute test limit and passes in idle2); c1d-actions **144/144**: all 48 agent actions refused for no session, a customer, and a password-only agent, with no table changed | ✅ verified by test |
| S3 | Every wrong detail gets one generic error; 5 failures per account and 20 per network in 15 minutes | `agent-signin.ts` (`MAX_FAILURES_PER_ACCOUNT`, `MAX_FAILURES_PER_IP`) | c1b 24/24 | ✅ verified by test |
| S4 | Attempts are stored scrambled with `AGENT_SIGNIN_HASH_SECRET`; if it's missing, sign-in fails closed | `agent-signin.ts` | c1b-nosecret: generic error, 0 attempts recorded | ✅ verified by test |
| S5 | Invite-only: a lead or admin adds an agent; the link works once and lasts 1 hour (= Supabase Email OTP Expiration) | `addAgent`, `createAgentSetupLink` (`agent-invite.ts`), `SETUP_LINK_LIFETIME_SECONDS` | c1c 33/33; c1g Add-agent page 71/71 | ✅ verified by test |
| S6 | New agents in rotation by default, leads and admins not; test agents never | `add_agent` default by role (Step 9a); `addAgent` passes false for test agents | c1g-rotation 8/8 | ✅ verified by test |
| S7 | Agent and customer accounts fully separate; an agent login never has a customer record; customer pages refuse agent logins | `app_metadata.account_type` (server-set only), Steps 12/12b/12c, `isAgentAccount` | c1a 21/21; c1d (customer pages refuse agent logins); c1-accept-refusal 4/4 | ✅ verified by test |
| S8 | LEVRID: a permanent agent number, spent when someone is added (Step 11) | `add_agent`, `agent_levrid_counter` | c1g 71/71; c1g-rotation "LEVRID counter unchanged" | ✅ verified by test |
| S9 | Role gates: agent work open to all agents; admin table, articles, social, merging dealerships and undoing a purchase for leads (C16) | `requireAgent({ minRole })`, `getAuthorizedAgent({ minRole })` | c16-1e 36/36 (pages and 11 gated actions) | ✅ verified by test |
| S10 | Self-serve password reset by email; still needs the authenticator to get in (C15) | `requestAgentPasswordReset`, `/agent/forgot-password` | c1c 33/33 | ✅ verified by test |
| S11 | Two-factor reset: leads for agents, admins for anyone, never your own; it ends every session first (Step 14) | `resetAgentTwoFactor`, `resetTwoFactorAction`, `revoke_login_sessions()` | c16-1e (through the real action for agent and lead actors); c1e 17/17 | ✅ verified by test |
| S12 | 8-hour idle sign-out, this browser only; refusals sign out this browser only (C13, `eace17f`) | `supabase/middleware.ts` (`AGENT_IDLE_LIMIT_MS`) | idle2 4/4 with a 2-minute test limit: the idle device signed out, the active device still signed in | ✅ verified by test |
| S13 | Brett moves to `brett@levrauto.com` before or at the deploy, never after (Chunk 1f) | `scripts/agent-cutover-prepare.mjs`, `relink_agent_login`, plan section 5.3 | 1f cutover rehearsal 24/24 with stand-in accounts | ✅ verified by test |

## How this table is kept current
When a chunk is approved, add its decisions here in the same commit, with the test names from that chunk's run. A ⚠ row stays until a run covers it.
