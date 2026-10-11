# Agent dashboard redesign, Phase 1: data foundation (plan, revision 3: final answers)

**Status:** plan only (2026-10-10; final answers 2026-10-11). Nothing in this document has been built except the Step 1 migration file, which is written for Brett to run (`supabase/migrations/20261011130000_agent_roles_rotation.sql`). The rest of the SQL in section 10 is a draft to review, not run.

**Revision 3** applies Brett's answers to N1–N8 (2026-10-11), including his correction to N1: the system never picks an admin. Section 15 lists the changes.

**Revision 2** applies Brett's answers to the open questions from revision 1 (2026-10-10), plus his correction that "away" never removes anyone from assignment. Section 15 lists what changed since revision 1.

**Based on:** the live code and schema at HEAD `8b67217`, and `docs/plans/agent-dashboard-review-2026-10-10.md` ("the review"). Shorthand:
- **OA** = `src/lib/outreach-actions.ts`
- **OQ** = `src/lib/outreach-queue.ts`
- **OMA** = `src/lib/offer-message-actions.ts`

**What Phase 1 delivers:**
- agent permissions and per-person workload settings;
- away status with lead approval;
- automatic search assignment, with history;
- one agent activity log;
- a dealer outreach log;
- refunds that don't need a cancellation;
- an alerts table;
- the database functions, triggers and server checks that enforce all of it.

**No new agent screens.** Migrations can run now; the code ships after the tester round (Q14).

---

## Decisions this plan implements

| # | Decision (2026-10-10) |
|---|---|
| Roles | Stacked, for **permissions only**: `admin` ⊇ `lead` ⊇ `agent`. |
| Workload | A **separate per-person setting**, `in_rotation`, defaulted by role: agent = in rotation; lead = not in rotation (overflow; can take or reassign work for anyone, including themselves); admin = never auto-assigned. Changeable per person. Brett (the only person, an admin) is put in rotation by the backfill until other agents exist. |
| Away | **A status signal only.** Away agents stay in rotation and keep receiving new searches. Their searches, including newly assigned ones, are flagged in the lead view so a lead can cover or reassign. Away needs lead approval (Q16). |
| Deactivated | A separate state (removed or left): never assigned, never in rotation. |
| Q1 | Assign at payment. |
| Q2 | A customer's later separate search goes to the same agent if that agent is **not deactivated and in rotation**; otherwise round-robin. |
| Q3 | Least recently assigned. |
| Q4 (as corrected by N1) | No assignment cap. Round-robin covers everyone in rotation who isn't deactivated. Only if nobody is in rotation does it fall back to the least-recently-assigned **active lead**, with an alert to leads. **Admins are never picked by the system:** if there is no active lead either, the search stays unassigned and **admins are alerted** (record + email). An admin can still opt into rotation by hand with `in_rotation`; Brett's backfill keeps him in rotation for now. |
| Q5 | A deactivated or away agent keeps their searches; leads see them flagged. Leads and admins can reassign. |
| Q6 | Call-request emails go only to the assigned agent. Items belonging to an away agent surface in the lead view; that part is the attention-engine phase. |
| Q7 | Activity types are a fixed list in a lookup table. |
| Q8 | If writing the activity record fails, the agent's action still succeeds, and the failure is logged and alerted. Refunds still record the agent on the refund row itself. |
| Q9 | Past actions stay unattributed. No inferred attribution. |
| Q10 | Dealer follow-up defaults to 48 hours, the agent can change the date, and the app prompts (doesn't enforce) "mark unresponsive". |
| Q11 | The only 48-hour clock is paid-but-not-finalized (the existing rule). Dealer follow-ups are due dates, not clocks. |
| Q12 | Per-agent "seen" status is a later phase. |
| Q13 | `customer_searches.assigned_agent_id` is the single source of truth. Drop `customers.assigned_agent_id` later. |
| Q14 | Migrations can run now. Code deploys after the tester round. |
| Q15 | Refund reasons: cancellation, guarantee, goodwill, duplicate charge, other. They are lookup rows, so more can be added. |
| Q16 | Agents request away time for themselves and a lead approves it; until then nothing changes. Leads can set away for anyone. A lead's or admin's own request is approved by another lead or admin. Admins can set their own. |
| Q17 | Leads can add agents. Only admins can grant lead or admin. |
| N1 | The fallback picks leads only, never admins (see Q4). The admin role is a different scope; researching deals isn't part of it. |
| N2 | A role change resets `in_rotation` to the new role's default. The person making the change sees the reset and can override it before saving. |
| N3 | Leads can change `in_rotation` for agents and leads; admins can for anyone. |
| N4 | Leads can deactivate or reactivate agents; admins can for anyone. |
| N5 | Never allow zero active admins. |
| N6 | Every alert creates an `agent_alerts` record and emails its audience: leads, or admins when no active lead exists. |
| N7 | **Test accounts are never auto-assigned**, even after the tester round. That covers `@levrauto-test.invalid` (CLAUDE.md `TEST_EMAIL_SUFFIX`) and the `@levrauto.invalid` production verification account. Leads can still assign them by hand for testing. |
| N8 | No covering-agent field for now; leads reassign instead. |

---

## 1. Agents: permissions, workload, away, deactivated

### 1.1 Today

- **`agents` table** (`20260807230209_initial_schema.sql:16–23`): `id`, `name`, `email` (unique), `phone`, `active`, `created_at`.
- **Sign-in check:** `getAuthorizedAgent()` (`src/lib/agent-auth.ts:18–37`) matches the signed-in user's email to `agents.email` where `active = true`. The match is case-sensitive, with no link to `auth.users.id`.
- **No roles.** Every agent action re-checks `getAuthorizedAgent()` in application code.
- **No database-side enforcement.** All agent data access uses the service-role admin client, so RLS never applies to agents.

### 1.2 Four separate things

| Concept | Stored as | Meaning | Affects assignment? |
|---|---|---|---|
| **Permission role** | `agents.role` ∈ `agent` < `lead` < `admin` | What the person may do | No |
| **Workload** | `agents.in_rotation boolean` | Whether round-robin hands them new searches | **Yes** |
| **Away** | Approved rows in `agent_away_periods` covering now | They're out; their work needs cover | **No.** Flag only |
| **Deactivated** | `agents.active = false` (+ `deactivated_at`, `deactivated_by_agent_id`) | Removed or left. Can't sign in, never assigned, never in rotation | **Yes.** Excluded everywhere |

**Default for `in_rotation` by role**, set on insert when not given: agent → `true`, lead → `false`, admin → `false`. A database check guarantees a deactivated agent is never in rotation: `active or not in_rotation`.

### 1.3 New `agents` columns

| Column | Type | Notes |
|---|---|---|
| `role` | `text not null default 'agent'`, check in (`agent`, `lead`, `admin`) | Compare with `agent_role_rank()`, never `=`. |
| `in_rotation` | `boolean not null` (no column default; a trigger fills it from the role) | Workload setting. |
| `auth_user_id` | `uuid unique references auth.users(id) on delete set null` | Stable identity. The sign-in check matches on this first, then on `lower(email)`. |
| `last_assigned_at` | `timestamptz` | Round-robin cursor. |
| `deactivated_at`, `deactivated_by_agent_id` | `timestamptz`, `uuid → agents` | Set when `active` goes false; cleared on reactivation. |
| `updated_at` | `timestamptz not null default now()` | |

### 1.4 Away periods: table `agent_away_periods`

| Column | Notes |
|---|---|
| `id`, `agent_id → agents` | Whose time off |
| `starts_at`, `ends_at` | `ends_at > starts_at` (required, so away always ends on its own) |
| `reason text` | ≤ 500 characters |
| `status` | `requested` / `approved` / `rejected` / `cancelled` |
| `requested_by_agent_id` | Who created it (the agent themselves, or a lead setting it for them) |
| `decided_by_agent_id`, `decided_at`, `decision_note` | Who approved or rejected it |
| `cancelled_by_agent_id`, `cancelled_at` | Who cancelled it. An approved period can be cancelled; it keeps its decision fields |
| `created_at` | |

- **"Away now"** = an `approved` row with `starts_at <= now() < ends_at`. The helper `agent_is_away(agent_id)` reads exactly that, and it is used only for flags, never for assignment.
- **Approval rules** are enforced inside the database functions (section 9):
  - An agent can only *request* away time for themselves (status `requested`).
  - A lead can *set* away time for anyone other than themselves (created `approved`).
  - Deciding a request needs a lead or admin who **isn't the subject**. That covers "a lead's or admin's own request is approved by another lead or admin".
  - An **admin can set their own** away time (created `approved`, decided by themselves).
  - Anyone can cancel their own request; a lead can cancel anyone's.

---

## 2. Permissions: who can do what

"≥ lead" means lead or admin.

| Action | agent | lead | admin | Enforced in |
|---|---|---|---|---|
| All existing agent work (offers, messages, deal steps, cancellations…) | ✅ | ✅ | ✅ | app (`getAuthorizedAgent`) |
| **Process a refund** (any reason) | ✅ | ✅ | ✅ | app + `record_payment_refund` (agent recorded on the refund row) |
| Log dealer contacts | ✅ | ✅ | ✅ | app |
| Request away for self | ✅ | ✅ | ✅ (auto-approved) | `request_away` |
| Approve or reject an away request | ❌ | ✅ (not own) | ✅ (not own) | `decide_away` |
| Set away for someone else | ❌ | ✅ | ✅ | `set_away` |
| Reassign any search to anyone, including self | ❌ | ✅ | ✅ | `reassign_search` |
| Add an agent (role `agent`) | ❌ | ✅ | ✅ | `add_agent` |
| Add someone as lead or admin; change anyone's role | ❌ | ❌ | ✅ | `add_agent`, `set_agent_role` |
| Change `in_rotation` | ❌ | ✅ for agents and leads | ✅ for anyone | `set_agent_rotation` (N3) |
| Deactivate / reactivate | ❌ | ✅ for agents | ✅ for anyone | `set_agent_active` (N4) |
| Resolve an alert | ❌ | ✅ | ✅ | `resolve_agent_alert` |

**Last-admin guard:** no function may leave zero active admins, whether by demoting or deactivating one (N5).

---

## 3. How permissions are enforced server-side

There are three layers. Each one alone would stop a plain mistake; together they stop a bug in any single layer.

1. **App (first check, gives readable errors).**
   - `src/lib/agent-auth.ts` changes:
     - `getAuthorizedAgent()` returns `{ id, name, email, role, inRotation }`. It matches `auth_user_id`, then `lower(email)`, and fills in `auth_user_id` on the first match. Deactivated agents return null.
     - New `hasRole(agent, min)`.
     - New `requireAgent({ minRole })` for pages; `getAuthorizedAgent({ minRole })` returns null for actions when the role is too low.
   - All existing call sites keep today's behaviour (minimum role: agent).
2. **Database functions (the real rule).**
   - Every privileged change goes through a function that takes the acting agent's id and re-checks the rules inside the same transaction: `agent_has_role(actor, 'lead')`, actor ≠ subject, last-admin guard.
   - Functions are `security invoker`, the same as every function today.
   - `execute` is revoked from `public`, `anon` and `authenticated` and granted only to `service_role`. **No existing migration revokes execute.** The current functions are safe only because RLS blocks their table writes for anon and authenticated callers.
3. **Guard triggers (stop direct writes that skip the functions).**
   - The service role skips RLS, so a stray `update agents set role = 'admin'` from app code would succeed.
   - Two `before` triggers reject changes to the protected columns unless the transaction has set a flag that only the functions set:
     - `agents`: `role`, `in_rotation`, `active`. The flag is `set_config('levr.agent_admin','on', true)`.
     - `customer_searches`: `assigned_agent_id`. The flag is `levr.assignment`.
   - A plain insert of a role-`agent` row is still allowed, which keeps disposable test agents simple (section 12). An insert with role lead/admin, or of an assigned search, needs the flag.
   - The flag is transaction-local, so it can't leak to other requests.
4. **Table grants (the second lock, from Step 3).**
   - Supabase grants `anon` and `authenticated` INSERT/UPDATE/DELETE/TRUNCATE on every new public table by default; RLS with no policies is what blocks them today.
   - Every agent table (`agents` and each Phase 1 table) gets those writes **revoked** from `anon` and `authenticated`, so customers would still be blocked if a policy were ever added by mistake.
   - TRUNCATE matters most: RLS doesn't apply to it.
   - **SELECT is revoked too, from Step 4** (Brett, 2026-10-11): these are internal staff tables, and reads must not depend on RLS alone. Every read already goes through the service role.
   - **Rule for every new Phase 1 table:** revoke SELECT, INSERT, UPDATE, DELETE and TRUNCATE from `anon` and `authenticated` in the same migration that creates it.
   - Every step that creates a table revokes in the same migration, and every step's verification includes the grant check.
   - **Checked 2026-10-11:** no deployed code writes to `agents` or any Phase 1 table with a customer or anonymous login. All six `agents` references in `src/` are reads through the service-role admin client (`agent-auth.ts:30`, `admin-actions.ts:72`, `offer-messages.ts:40`, `article-reminders.ts:67`, `agent-call-notifications.ts:112`, `outreach-queue.ts:416`). The only SQL that writes `agents` is the Step 1 migration itself. Nothing in `src/` touches the Phase 1 tables yet.
5. **Backfill and emergency fixes in the SQL Editor (no trigger drop).**
   - The guard only checks a transaction-local flag. Anything run by hand, the Step 10 backfill included, sets the flag inside an explicit transaction:
     ```sql
     begin;
     select set_config('levr.agent_admin', 'on', true);  -- agents: role / in_rotation / active
     -- select set_config('levr.assignment', 'on', true); -- customer_searches.assigned_agent_id (from Step 4)
     update public.agents set role = 'admin', in_rotation = true where lower(email) = 'someone@levrauto.com';
     commit;
     ```
   - The `true` makes the flag last only until `commit`, so it can't leak into later queries or other sessions. Keep `begin`/`commit` around it; without them the flag is gone before the update runs.
   - The table's check constraints still apply: a deactivated agent can't be in rotation, and roles are limited to the three values. The functions' own rules don't run, and that includes the last-admin guard, so check by hand that at least one active admin remains.
   - Once Step 2 exists, record the fix in the activity log in the same transaction, for example `select public.log_agent_activity(<your agent id>, 'agent_role_changed', p_details => '{"manual_sql": true, "note": "..."}');`.
   - **Never drop or disable the trigger.** If the flag route ever fails, stop and investigate.
6. **RLS.**
   - Every new table, including the lookup tables, has RLS enabled and **no policies**: anon and authenticated get nothing.
   - Policies keyed on `auth.uid() = agents.auth_user_id` only matter if agent pages ever stop using the service role. `auth_user_id` keeps that possible; it isn't proposed now.
   - **`agent_has_role` and the other helpers are not callable by signed-in customers** (`authenticated` has no execute), and no Phase 1 RLS policy calls them.
     - If a future policy needs a role check, the policy runs with the signed-in user's privileges, so it would need execute on the helper.
     - The safe pattern then is a `security definer` copy in a separate `private` schema. That schema is **not exposed through the API** (Supabase only exposes `public` via `/rest/v1`), with execute granted to `authenticated` and `search_path` pinned.
     - Policies can call it; customers can't reach it through `/rest/v1/rpc`.
     - Not needed for Phase 1.

---

## 4. Assignment

### 4.1 Where

- `customer_searches.assigned_agent_id` and `assigned_at`: the single source of truth (Q13).
- `search_assignments`: the history (who, from whom, by whom, method, reason).
- `customers.assigned_agent_id` (never written, read only by `getAdminSearches`, `src/lib/admin-actions.ts:62–101`) stops being read in Phase 1 and is dropped in a later cleanup migration.

### 4.2 When (Q1: at payment)

- **Payment:** the Stripe webhook `checkout.session.completed`, `search_payment` branch (`src/app/api/stripe/webhook/route.ts`, right after `paid_at` is set at ~:79–88), calls `assign_search`. It's non-fatal, like the MarketCheck sync beside it: a failure is logged and alerted, and the sweep retries.
- **Switches** (free, paid, or agent-initiated) all go through `switch_customer_search`. The new row **inherits the old row's agent** inside that function (method `inherited_switch`), so a switch never re-rolls the agent.
  - **Deactivated agent (Brett, 2026-10-11):** a switch must not inherit a deactivated agent. The Step 5 version inherits whoever is on the old row, active or not. **Fix, folded into Step 9 and required before Step 10:**
    1. inherit only if `agents.active` is true for the old agent;
    2. otherwise insert the new row unassigned and, if it's paid, call `assign_search(v_new.id)`. That applies the normal rules: test accounts skipped; continuity, which also skips the deactivated agent because it requires `active and in_rotation`; round-robin; the lead fallback; then admin alerts.
    - An away agent, or one taken out of rotation, is still inherited: only deactivation breaks the link, matching how existing searches stay with an away agent (Q5).
  - **Why Step 9, not a separate follow-up:** nothing is assigned until the Step 10 backfill, so the gap can't affect anyone before then, and Step 9 already replaces functions. It must land before Step 10. Step 9's verification adds a rolled-back test: deactivate a test agent inside the transaction, switch a search assigned to them, and expect the new row assigned by `assign_search` (method `round_robin` to Brett), not `inherited_switch`.
- **Undecided searches** are the same row after `finalizeUndecidedSearch`, so the assignment carries over.
- **Safety net:** an `assignUnassignedPaidSearches()` sweep inside the existing hourly `/api/cron/solidify-pending-searches` job (no new cron). Paginated (section 7).
- **When the Phase 1 code deploys (confirmed):** the sweep runs on its first hourly tick after the deploy, and immediately assigns every **real** paid search that stayed unassigned in between. That means anything paid after the Step 10 backfill, while the migrations were in but the code wasn't. It can also be triggered by hand right after the deploy (a `CRON_SECRET` call to the same cron route), so there's no wait. The deploy check counts real paid searches with no agent, before and after; the expected result afterwards is 0, unless no active lead or admin exists, in which case there are alert rows instead.
- **Test accounts are skipped by every automatic path (N7):** the webhook step, the sweep and continuity. `assign_search` returns `skipped_test_account` without assigning or alerting. Only `reassign_search` (a lead, by hand) can give a test-account search an agent. A tester's switch then inherits that hand-picked agent, which is not an automatic choice.

### 4.3 Picking the agent (`assign_search`)

All automatic assignments are serialized with `pg_advisory_xact_lock`, so two simultaneous payments can't both take the same "least recent" agent.

1. **Continuity (Q2).** If the same customer has another search whose agent is **not deactivated and in rotation**, use that agent (method `continuity`).
2. **Routing preferences: future, not built.** The place where a state/make preference would narrow the pool.
3. **Round-robin (Q3).** Among everyone with `active and in_rotation`, pick the oldest `last_assigned_at` (never-assigned first), ties broken by `created_at, id` (method `round_robin`).
   - **Away status is ignored here**, by decision.
   - With a fixed team this cycles A→B→C→A. A new agent goes first once.
0. **Test account?** Return `skipped_test_account`; no assignment, no alert (N7).
4. **Nobody in rotation → lead fallback (Q4, N1).** The least-recently-assigned **active lead**: `role = 'lead'` exactly, so **admins are never picked** (method `lead_fallback`). An `assignment_lead_fallback` alert goes to leads (record + email).
5. **No active lead either.** The search stays unassigned and an `assignment_no_lead` alert goes to **admins** (record + email). There is one open alert per search: the hourly sweep retries assignment but doesn't re-alert until the alert is resolved. The search is assigned as soon as someone is put in rotation or a lead exists. An admin can also take it by hand with `reassign_search`.

An admin who has opted into rotation (`in_rotation = true`, like Brett now) is picked by step 1 or 3 like anyone else in rotation. The system just never chooses an admin through the fallback.

**No cap (Q4).** There is no maximum load; least-recently-assigned spreads the work evenly.

### 4.4 Reassignment (Q5)

`reassign_search(search, new_agent, actor, reason)`:
- the actor must be ≥ lead;
- the new agent must be active (any role and any rotation setting, so a lead can **take work themselves** or hand it to someone not in rotation);
- a reason is required;
- it writes `search_assignments` (method `manual`) and the activity log.

**Deactivated and away agents keep their searches.** The lead view (a later phase) flags:
- searches whose agent is away;
- searches whose agent is deactivated.

Bulk reassignment is the same function in a loop.

### 4.5 Future routing by region or make (not built)

- A later `agent_routing_preferences(agent_id, kind ∈ {'state','make'}, value, weight)` table slots in at step 2 of 4.3.
- The function is written in labelled steps so step 2 is a no-op now.
- `search_assignments.method` would gain `preference_match`.
- Undecided searches have no make at payment, so make routing would apply when the make is chosen, or not at all.

---

## 5. Agent activity log

### 5.1 Tables

- **`agent_activity_types`** (lookup, Q7): `code` (primary key), `label`, `category` (`offer`, `deal`, `messages`, `search`, `refund`, `dealer`, `team`, `content`), `is_active`, `created_at`. Seeded with the list in 5.3. Adding a type means inserting one row.
- **`agent_activity_log`:**

  | Column | Notes |
  |---|---|
  | `id`, `created_at` | |
  | `agent_id → agents` (not null) | Who acted. System actions aren't logged here |
  | `action → agent_activity_types(code)` | |
  | `search_id`, `customer_id`, `qualifying_offer_id`, `dealer_alias_id`, `refund_id`, `dealer_contact_id` | Typed links, all `on delete set null` |
  | `details jsonb` | Action-specific facts: price, amount, old/new values, acknowledged publish warnings (later phase), reason |

  Indexes: `(search_id, created_at desc, id)`, `(agent_id, created_at desc, id)`, `(customer_id, created_at desc, id)`, `(action, created_at desc, id)`.

- **`agent_alerts`** (new, for Q4 and Q8):

  | Column | Notes |
  |---|---|
  | `id`, `created_at` | |
  | `kind` | Check in (`assignment_lead_fallback`, `assignment_no_lead`, `assignment_failed`, `activity_log_failed`, `other`) |
  | `audience` | `leads` or `admins`: who the app emails (N6). `assignment_no_lead` → admins; everything else → leads (and admins too when no active lead exists) |
  | `search_id`, `agent_id` | Nullable links |
  | `details jsonb` | |
  | `resolved_at`, `resolved_by_agent_id` | |

  Partial index on open alerts, plus a partial unique index on `(search_id, kind)` for open **assignment** alerts, so the hourly retry never piles up duplicates. Activity-write failures are each recorded.

### 5.2 How activity is written (Q8)

- **One SQL function, `log_agent_activity(...)`.** It inserts the activity row inside its own `begin … exception when others` block. If the insert fails, it writes an `agent_alerts` row (`activity_log_failed`, with the error and the intended row in `details`) instead of raising. **The caller's action therefore never fails because of logging**, even inside a database function, where a plain insert failure would otherwise roll back the whole transaction.
- **Database functions** (switch, bypass, cancel, revert, refund, reassign, away, agent management) call it in the same transaction.
- **App-level actions** call it through a small helper, `logAgentActivity()` in `src/lib/agent-activity.ts`, after their own write succeeds. If the call itself fails (for example the network), the helper:
  1. logs `console.error("[agent-activity-failed] …")`, a fixed tag that can be searched in Vercel logs;
  2. tries to write an `agent_alerts` row;
  3. emails active leads.

  The action is not failed.
- **Refunds** keep the agent on the refund row itself: `refunds.agent_id` is not null, enforced by `record_payment_refund` (Q8).
- **Columns on the action's own row**, for hot queries:
  - `qualifying_offers.logged_by_agent_id`
  - `deal_progress.availability_confirmed_by_agent_id`, `deposit_confirmed_by_agent_id`
  - `notification_events.flag_resolved_by_agent_id`

### 5.3 Activity types, and every code path that needs to start writing

**(fn)** = written inside a database function; otherwise an app-level call.

| `code` | Code path |
|---|---|
| `offer_logged` | `logQualifyingOffer` (OA:53) |
| `offer_addon_added` | `logOfferAddon` (OA:570); add-ons inside `logQualifyingOffer` (OA:177) |
| `addon_removal_resolved` | `resolveAddonRemoval` (OA:628) |
| `offer_vehicle_marked_sold` | `markOfferVehicleSold` (OA:237) |
| `delivery_estimate_set` | `setOfferDeliveryEstimate` (OA:1188) |
| `offer_released` | `withdrawAcceptedOffer` (OA:443) |
| `availability_confirmed` | `confirmAvailability` (OA:691) |
| `deposit_confirmed` | `confirmDepositReceived` (OA:736) |
| `signing_status_checked` | `checkServiceAgreementSigningStatus` (OA:796) |
| `search_marked_purchased` | `markSearchPurchased` (OA:297) |
| `purchase_reverted` | `revert_purchased_search` **(fn)** via OA:386 |
| `search_finalized_by_agent` | `finalizeSearchByAgent` (OA:866) |
| `undecided_search_finalized` | `finalizeUndecidedSearch` (OA:971) |
| `inventory_refreshed` | `refreshSearchInventory` (OA:1225) |
| `activity_reviewed` | `markOfferActivityReviewed` (OA:531), `markGeneralActivityReviewed` (OMA:249), and the review inside the agent replies (OMA:157, :239) |
| `message_sent` | `sendAgentMessage` (OMA:124), `sendAgentGeneralMessage` (OMA:208) |
| `notification_flag_resolved` | `resolveNotificationCallback` (OA:1091) |
| `search_switched` | `switch_customer_search` **(fn)** via `src/lib/switch-actions.ts:50` |
| `extension_bypass_granted` | `grant_extension_bypass` **(fn)** via `agent-bypass-actions.ts:18` |
| `search_cancelled_by_agent` | `cancel_search` **(fn)** via `agent-cancellation-actions.ts:100` |
| `refund_processed` | `record_payment_refund` **(fn)** |
| `call_request_resolved` | new switch/cancellation call resolution (section 8) |
| `search_reassigned` | `reassign_search` **(fn)** |
| `away_requested`, `away_decided`, `away_set`, `away_cancelled` | away functions **(fn)** |
| `agent_added`, `agent_role_changed`, `agent_rotation_changed`, `agent_deactivated`, `agent_reactivated` | agent-management functions **(fn)** |
| `alert_resolved` | `resolve_agent_alert` **(fn)** |
| `dealer_contact_logged`, `dealer_follow_up_closed` | new `logDealerContact` / closing logic |
| `dealer_alias_confirmed`, `dealer_alias_merged` | `dealership-actions.ts:19/58` |
| `salesperson_added`, `salesperson_updated`, `salesperson_removed` | `dealership-actions.ts:92/128/157` |
| `article_saved`, `article_approved`, `article_regenerated`, `article_image_attached` | `article-actions.ts:25/72/135/163` |
| `social_post_saved`, `social_post_approved`, `social_post_regenerated`, `social_post_image_attached`, `platform_marked_posted` | `social-actions.ts:21/58/102/125/161` |

`parseDealerOffer` writes nothing; its use is recorded as `details.ai_parsed` on `offer_logged`.

---

## 6. Dealer outreach log (Q10)

**Table `dealer_contacts`**, one row per contact attempt or reply:

| Column | Notes |
|---|---|
| `search_id → customer_searches` | `on delete cascade` |
| `agent_id → agents` | |
| `dealer_alias_id → dealer_aliases` | **Not null.** Off-lot dealers get an alias through the existing `getOrCreateDealerAlias` (`src/lib/dealer-aliases.ts`), the same approach as `post_deal_surveys` |
| `salesperson_id → dealership_salespeople`, `listing_id → listings` | Optional, `on delete set null` |
| `channel` | `phone`, `email`, `text`, `in_person`, `web_form`, `other` |
| `direction` | `outbound`, `inbound` |
| `outcome` | `no_answer`, `left_message`, `spoke`, `request_sent`, `quote_received`, `declined`, `unit_unavailable`, `unresponsive`, `other` |
| `notes` | ≤ 2,000 characters |
| `contacted_at` | Editable, for "called yesterday" |
| `next_follow_up_at` | **A due date, not a clock (Q11)** |
| `follow_up_closed_at`, `follow_up_closed_reason` | `new_contact`, `offer_logged`, `terminal_outcome`, `search_closed`, `manual` |

**Rules (app, in `logDealerContact`):**
- **Due date.** Default `contacted_at + 48h` for `no_answer`, `left_message` and `request_sent`. The agent can change it or clear it. Terminal outcomes (`quote_received`, `declined`, `unit_unavailable`, `unresponsive`) get none.
- **One open due date per search and dealer.** Logging a new contact closes the earlier one (`new_contact`). Logging an offer whose `qualifying_offers.dealer_alias_id` matches closes it (`offer_logged`). A search leaving `searching` closes all of its due dates (`search_closed`, done by the hourly sweep).
- **"Mark unresponsive" prompt.** When an agent logs a second unanswered outbound contact for the same pair (no `quote_received` or inbound row since the first), the form suggests outcome `unresponsive`. It's a prompt, not enforced.

---

## 7. Paging rule and the review's 1,000-row fixes

### 7.1 Paging rule for every new query

Applies to `agent_activity_log`, `dealer_contacts`, `search_assignments`, `agent_away_periods`, `agent_alerts`, and the assignment sweep's reads of `customer_searches`.
1. **Never an unbounded select.** Every read filters on an indexed key (`search_id`, `agent_id`, `customer_id`, open/due flags) and/or a time window.
2. **Lists for screens use keyset paging:** `order by created_at desc, id desc limit N` (N ≤ 100), and the next page continues from the last row with `(created_at, id) < (last.created_at, last.id)`. The indexes above are built for exactly this order.
3. **Background reads that must see everything** (the sweep, exports) loop `.range(from, from + 499)` in a stable order until a short page. This is the existing pattern in `matchmaker-vehicles.ts`. They never trust a single response.
4. **Counts** use `{ count: "exact", head: true }`, never `rows.length`.
5. **`.in()` lists** are chunked at ≤ 200 ids, like `zip_coordinates` in OQ:34–49.
6. **Each new loader gets a test case past 1,000 rows** (seeded on a disposable account) before it ships.

### 7.2 Which of the review's truncation fixes belong in Phase 1

| Review item | Phase 1? | Why |
|---|---|---|
| Callback queue reads every unresolved `notification_events` row and drops new callbacks past 1,000 (OQ:1255–1265) | **Yes** | Phase 1 already edits `resolveNotificationCallback` (attribution). The fix is filtering on `agent_callback_requested_at is not null or flagged_no_deliverable_channel` plus paging. It will bite as soon as events pass 1,000 |
| `getAdminSearches` unpaginated, and `auth.admin.listUsers` a single 1,000-user page (`admin-actions.ts:47–86`) | **Yes** | Phase 1 rewrites it to read `customer_searches.assigned_agent_id` |
| The assignment sweep and backfill reads | **Yes** | New code; follows 7.1 |
| `listings` unpaginated in `getOutreachQueue` / `getFinalizationQueue` (OQ:386–393, 819–828) | Later (work-queue phase) | Rewritten with the new queue |
| Dealerships listing counts from an unpaginated whole-table select (`dealership-queue.ts:16–31`) | Later (dealer pages) | |
| `qualifying_offers` / `offer_addons` / `deal_progress` / `documents` unpaginated `.in()` reads in `getOutreachQueue` | Later (work-queue phase) | |
| Social posting worklist grows forever (`social-queue.ts:82–132`) | Later (content pages) | |

### 7.3 Other review guardrails

| Item | Phase 1? |
|---|---|
| Agent lookup case-sensitive / email only | **Yes** (`auth_user_id` + `lower(email)`) |
| New functions callable by anon / authenticated | **Yes** (revoke execute) |
| Switch/cancellation call requests never clear | **Yes** (resolved columns + actions) |
| Day-30 refunds can't be recorded; refunds-due never clears | **Yes** (section 8) |
| Vehicle-consultation queue lists cancelled searches (OQ:1116) | **Yes** (add the status filter; it decides which searches need an owner) |
| Duplicate / above-MSRP / inactive-search offer warnings | **Data only** (`qualifying_offers.dealer_alias_id`, `logged_by_agent_id`, `(customer_search_id, vin)` index). Warnings and the confirm click come later |
| Dealer grouping by name, labels, stale copy, accessibility, seed reset | Later |

---

## 8. Refunds outside a cancellation (Q15) and call-request resolution

### 8.1 Refunds

1. **New lookup `refund_reasons(code pk, label, is_active)`**, seeded with `cancellation`, `guarantee`, `goodwill`, `duplicate_charge` and `other`.
2. **Changes to `refunds`:**
   - `cancellation_log_id` becomes nullable;
   - new `reason → refund_reasons(code)` (existing rows become `cancellation`);
   - new `notes`;
   - check `(reason = 'cancellation') = (cancellation_log_id is not null)`;
   - unique index on `stripe_refund_id`.
3. **New function `record_payment_refund(payment, agent, amount, stripe_refund_id, reason, cancellation_log_id?, notes?)`.**
   - Same locking and balance check as today.
   - Checks that the agent is active.
   - **Writes `agent_id` on the refund row**, then calls `log_agent_activity`.
4. **`record_refund` keeps its signature** as a thin wrapper (reason `cancellation`), so the deployed cancellation flow works between the migration and the deploy. It is dropped later.
5. **New app action `recordGuaranteeRefund`.** Same order as `resolveCancellation`:
   1. re-check the remaining balance;
   2. `stripe.refunds.create`;
   3. `record_payment_refund`.

   Any agent can use it; there is no screen until a later phase.
6. **The refunds-due list clears by derivation:** a refunded-guarantee search drops off once its `search_fee` payment has a `guarantee` refund.
7. **Out of scope, flagged:** reconciling refunds made in the Stripe dashboard (a future `charge.refunded` handler).

### 8.2 Call-request resolution

New columns on `customer_searches`:
- `switch_call_resolved_at`, `switch_call_resolved_by_agent_id`, `switch_call_outcome` (`switched`, `kept_vehicle`, `unreachable`, `other`);
- the same three for cancellation, with outcomes `cancelled`, `retained`, `unreachable`, `other`.

New actions:
- `resolveSwitchCall` and `resolveCancellationCall` set them and log `call_request_resolved`;
- the queues at OQ:884 and OQ:934 exclude resolved rows.

The agent-facing button and wording will be quoted for sign-off when built.

### 8.3 Call-request emails to the assigned agent only (Q6)

`notifyAgentsOfCallRequest` (`src/lib/agent-call-notifications.ts:100`) changes from "every active agent" (line 112) to **the search's assigned agent only**.
- **If the search has no agent:**
  - **Real customer:** run `assign_search` first, then email the agent it picks. If it can't assign (no rotation and no lead), email admins along with the `assignment_no_lead` alert.
  - **Test account (never auto-assigned, N7):** email the leads; no alert, since an unassigned test search is expected. Their own email suppression still applies to any `@levrauto-test.invalid` recipient.
- **If the assigned agent is away:** Phase 1 still emails them only. Surfacing the item to leads is the attention-engine phase (flagged below).
- **Wording:** the email text doesn't change. It's agent-facing; any wording change will be shown for sign-off.

---

## 9. Agent-management and away functions

All of these are `security invoker`, have `execute` revoked from anon and authenticated, set the guard flag, write `log_agent_activity`, and take `p_actor_agent_id`.

| Function | Rule |
|---|---|
| `add_agent(actor, email, name, role default 'agent', in_rotation default null)` | actor ≥ lead. Role lead or admin needs actor = admin. `in_rotation` null → role default |
| `set_agent_role(actor, subject, role, in_rotation default null)` | actor = admin. Last-admin guard. **`in_rotation` null → reset to the new role's default** (agent true, lead/admin false). A value given = the promoter's override (N2). The app shows the reset value before saving so the admin can change it |
| `set_agent_rotation(actor, subject, in_rotation)` | actor ≥ lead; subject is an admin → actor must be an admin; deactivated subjects can't be put in rotation |
| `set_agent_active(actor, subject, active)` | actor ≥ lead; subject ≥ lead → actor must be an admin. Last-admin guard. Deactivating also sets `in_rotation = false`, `deactivated_at`, `deactivated_by_agent_id` |
| `request_away(actor, starts, ends, reason)` | For the actor themselves. Admin → `approved` (self-decided); otherwise `requested` |
| `decide_away(actor, period, approve, note)` | actor ≥ lead, actor ≠ subject, period is `requested` |
| `set_away(actor, subject, starts, ends, reason)` | actor ≥ lead; actor ≠ subject unless the actor is an admin; created `approved` |
| `cancel_away(actor, period)` | actor = subject, or actor ≥ lead |
| `resolve_agent_alert(actor, alert)` | actor ≥ lead |

---

## 10. Draft migration SQL (review only; not migration files yet)

Run one step at a time in the Supabase SQL Editor (project `couiovhducwytlckfgvo`), with each step's verification before the next.
- Steps 1–9 are additive: new columns, tables and functions, plus same-signature replacements of `switch_customer_search` and `record_refund`.
- **No step changes what the currently deployed code does.** It doesn't call the new functions, and the replaced functions keep their behaviour.
- Step 10 is the backfill.
- **Every step from 3 on ends with the grant check** for the tables it creates (same query as Step 3, with that step's table names). Expected: every `can_select` / `can_insert` / `can_update` / `can_delete` / `can_truncate` is false for `anon` and `authenticated`, for every agent table created so far.

### Step 1: agents, role helpers, deactivation, guard trigger

```sql
alter table public.agents
  add column role text not null default 'agent' check (role in ('agent', 'lead', 'admin')),
  add column in_rotation boolean,
  add column auth_user_id uuid unique references auth.users (id) on delete set null,
  add column last_assigned_at timestamptz,
  add column deactivated_at timestamptz,
  add column deactivated_by_agent_id uuid references public.agents (id),
  add column updated_at timestamptz not null default now();

-- Existing rows: the role default applies (agent -> in rotation). Brett is set in step 10.
update public.agents set in_rotation = active where in_rotation is null;
alter table public.agents alter column in_rotation set not null;
alter table public.agents add constraint agents_deactivated_not_in_rotation check (active or not in_rotation);

comment on column public.agents.role is
  'Permissions only, stacked: admin implies lead implies agent. Compare with agent_role_rank().';
comment on column public.agents.in_rotation is
  'Workload, separate from role: whether round-robin assigns new searches. Defaults by role on insert (agent true, lead/admin false). Away status never changes it.';

create unique index agents_email_lower_idx on public.agents (lower(email));

create function public.agent_role_rank(p_role text) returns integer
language sql immutable as $$
  select case p_role when 'agent' then 1 when 'lead' then 2 when 'admin' then 3 else 0 end;
$$;

create function public.agent_has_role(p_agent_id uuid, p_min_role text) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.agents
    where id = p_agent_id and active
      and public.agent_role_rank(role) >= public.agent_role_rank(p_min_role)
  );
$$;

-- Insert default for in_rotation, plus the guard against direct role/rotation/active changes.
create function public.agents_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.in_rotation is null then
      new.in_rotation := (new.role = 'agent');
    end if;
    if new.role <> 'agent' and coalesce(current_setting('levr.agent_admin', true), '') <> 'on' then
      raise exception 'leads and admins can only be added through add_agent()';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.role, new.in_rotation, new.active) is distinct from (old.role, old.in_rotation, old.active)
       and coalesce(current_setting('levr.agent_admin', true), '') <> 'on' then
      raise exception 'role, in_rotation and active change only through the agent-management functions';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger agents_guard before insert or update on public.agents
for each row execute function public.agents_guard();

revoke execute on function public.agent_role_rank(text), public.agent_has_role(uuid, text)
  from public, anon, authenticated;
grant execute on function public.agent_role_rank(text), public.agent_has_role(uuid, text) to service_role;
```

Verify:

```sql
select email, role, in_rotation, active, public.agent_has_role(id, 'lead') as is_lead from public.agents;
-- expect: bjohnston@levrauto.com, agent, true, true, false  (admin comes in step 10)
-- guard check (expect ERROR "role, in_rotation and active change only through ..."):
update public.agents set role = 'admin' where lower(email) = 'bjohnston@levrauto.com';
```

### Step 2: activity types, activity log, alerts, log function

```sql
create table public.agent_activity_types (
  code text primary key,
  label text not null,
  category text not null check (category in ('offer', 'deal', 'messages', 'search', 'refund', 'dealer', 'team', 'content')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.agent_activity_types enable row level security;

insert into public.agent_activity_types (code, label, category) values
  ('offer_logged', 'Logged an offer', 'offer'),
  ('offer_addon_added', 'Added an add-on', 'offer'),
  ('addon_removal_resolved', 'Resolved an add-on removal', 'offer'),
  ('offer_vehicle_marked_sold', 'Marked a vehicle sold', 'offer'),
  ('delivery_estimate_set', 'Set a delivery estimate', 'offer'),
  ('offer_released', 'Released an accepted offer', 'deal'),
  ('availability_confirmed', 'Confirmed availability', 'deal'),
  ('deposit_confirmed', 'Confirmed a deposit', 'deal'),
  ('signing_status_checked', 'Checked signing status', 'deal'),
  ('search_marked_purchased', 'Marked a search purchased', 'deal'),
  ('purchase_reverted', 'Reverted a purchase', 'deal'),
  ('search_finalized_by_agent', 'Finalized a search', 'search'),
  ('undecided_search_finalized', 'Chose a vehicle for an undecided search', 'search'),
  ('inventory_refreshed', 'Refreshed inventory', 'search'),
  ('search_switched', 'Switched a search', 'search'),
  ('extension_bypass_granted', 'Granted an extension bypass', 'search'),
  ('search_cancelled_by_agent', 'Cancelled a search', 'search'),
  ('call_request_resolved', 'Resolved a call request', 'search'),
  ('search_reassigned', 'Reassigned a search', 'team'),
  ('activity_reviewed', 'Marked customer activity reviewed', 'messages'),
  ('message_sent', 'Sent a message', 'messages'),
  ('notification_flag_resolved', 'Resolved a notification flag', 'messages'),
  ('refund_processed', 'Processed a refund', 'refund'),
  ('dealer_contact_logged', 'Logged a dealer contact', 'dealer'),
  ('dealer_follow_up_closed', 'Closed a dealer follow-up', 'dealer'),
  ('dealer_alias_confirmed', 'Confirmed a dealer identity', 'dealer'),
  ('dealer_alias_merged', 'Merged a dealer identity', 'dealer'),
  ('salesperson_added', 'Added a salesperson', 'dealer'),
  ('salesperson_updated', 'Updated a salesperson', 'dealer'),
  ('salesperson_removed', 'Removed a salesperson', 'dealer'),
  ('away_requested', 'Requested time away', 'team'),
  ('away_decided', 'Decided a time-away request', 'team'),
  ('away_set', 'Set time away', 'team'),
  ('away_cancelled', 'Cancelled time away', 'team'),
  ('agent_added', 'Added an agent', 'team'),
  ('agent_role_changed', 'Changed a role', 'team'),
  ('agent_rotation_changed', 'Changed rotation', 'team'),
  ('agent_deactivated', 'Deactivated an agent', 'team'),
  ('agent_reactivated', 'Reactivated an agent', 'team'),
  ('alert_resolved', 'Resolved an alert', 'team'),
  ('article_saved', 'Saved an article draft', 'content'),
  ('article_approved', 'Approved an article', 'content'),
  ('article_regenerated', 'Regenerated an article', 'content'),
  ('article_image_attached', 'Attached an article image', 'content'),
  ('social_post_saved', 'Saved a social post', 'content'),
  ('social_post_approved', 'Approved a social post', 'content'),
  ('social_post_regenerated', 'Regenerated a social post', 'content'),
  ('social_post_image_attached', 'Attached a social image', 'content'),
  ('platform_marked_posted', 'Marked a post published', 'content');

create table public.agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id),
  action text not null references public.agent_activity_types (code),
  search_id uuid references public.customer_searches (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  qualifying_offer_id uuid references public.qualifying_offers (id) on delete set null,
  dealer_alias_id uuid references public.dealer_aliases (id) on delete set null,
  refund_id uuid references public.refunds (id) on delete set null,
  dealer_contact_id uuid, -- FK added in step 6 (dealer outreach log)
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agent_activity_log_search_idx on public.agent_activity_log (search_id, created_at desc, id);
create index agent_activity_log_agent_idx on public.agent_activity_log (agent_id, created_at desc, id);
create index agent_activity_log_customer_idx on public.agent_activity_log (customer_id, created_at desc, id);
create index agent_activity_log_action_idx on public.agent_activity_log (action, created_at desc, id);
alter table public.agent_activity_log enable row level security;

create table public.agent_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'assignment_lead_fallback', 'assignment_no_lead', 'assignment_failed', 'activity_log_failed', 'other')),
  audience text not null default 'leads' check (audience in ('leads', 'admins')), -- who the app emails (N6)
  search_id uuid references public.customer_searches (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_agent_id uuid references public.agents (id)
);
create index agent_alerts_open_idx on public.agent_alerts (created_at desc, id) where resolved_at is null;
-- One open assignment alert per search, so the hourly retry never piles up duplicates.
-- Activity-write failures are deliberately not limited: each one is recorded.
create unique index agent_alerts_one_open_assignment_idx on public.agent_alerts (search_id, kind)
  where resolved_at is null and search_id is not null
    and kind in ('assignment_lead_fallback', 'assignment_no_lead');
alter table public.agent_alerts enable row level security;

-- Never raises: a failed activity insert becomes an alert, so the caller's action still succeeds (Q8).
create function public.log_agent_activity(
  p_agent_id uuid,
  p_action text,
  p_search_id uuid default null,
  p_customer_id uuid default null,
  p_qualifying_offer_id uuid default null,
  p_dealer_alias_id uuid default null,
  p_refund_id uuid default null,
  p_dealer_contact_id uuid default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  begin
    insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id,
                                           dealer_alias_id, refund_id, dealer_contact_id, details)
    values (p_agent_id, p_action, p_search_id, p_customer_id, p_qualifying_offer_id,
            p_dealer_alias_id, p_refund_id, p_dealer_contact_id, coalesce(p_details, '{}'::jsonb))
    returning id into v_id;
  exception when others then
    begin
      insert into public.agent_alerts (kind, search_id, agent_id, details)
      values ('activity_log_failed', p_search_id, p_agent_id,
              jsonb_build_object('error', sqlerrm, 'action', p_action, 'details', p_details));
    exception when others then
      raise warning 'agent activity and alert both failed: %', sqlerrm;
    end;
  end;
  return v_id;
end;
$$;

revoke execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;
```

Verify:

```sql
select count(*) from public.agent_activity_types;  -- expect 49
select count(*) from public.agent_activity_log;     -- expect 0
-- failure path writes an alert instead of raising (unknown action code):
select public.log_agent_activity((select id from public.agents limit 1), 'not_a_real_action');
select kind, details->>'action' from public.agent_alerts;  -- expect one activity_log_failed row
delete from public.agent_alerts where details->>'action' = 'not_a_real_action';  -- clean up the test row
```

### Step 3: away periods, plus the second lock (no customer or anonymous writes on agent tables)

```sql
create table public.agent_away_periods (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  requested_by_agent_id uuid not null references public.agents (id),
  decided_by_agent_id uuid references public.agents (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  cancelled_by_agent_id uuid references public.agents (id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_away_periods_window check (ends_at > starts_at),
  -- requested: not decided yet. approved/rejected: decided. cancelled: may or may not have been
  -- decided first (an approved period can be cancelled), but always records who cancelled it.
  constraint agent_away_periods_status_shape check (
    (status = 'requested' and decided_by_agent_id is null and decided_at is null
       and cancelled_by_agent_id is null and cancelled_at is null)
    or (status in ('approved', 'rejected') and decided_by_agent_id is not null and decided_at is not null
       and cancelled_by_agent_id is null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_by_agent_id is not null and cancelled_at is not null))
);
create index agent_away_periods_agent_idx on public.agent_away_periods (agent_id, starts_at desc, id);
create index agent_away_periods_pending_idx on public.agent_away_periods (created_at, id) where status = 'requested';
alter table public.agent_away_periods enable row level security;

-- Status signal only: used for lead-view flags, never for assignment.
create function public.agent_is_away(p_agent_id uuid, p_at timestamptz default now()) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.agent_away_periods
    where agent_id = p_agent_id and status = 'approved' and starts_at <= p_at and ends_at > p_at
  );
$$;

revoke execute on function public.agent_is_away(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.agent_is_away(uuid, timestamptz) to service_role;

-- Second lock (2026-10-11): RLS with no policies already blocks these, but Supabase's default
-- grants still give anon/authenticated INSERT/UPDATE/DELETE/TRUNCATE on every public table.
-- TRUNCATE is not covered by RLS at all. Revoke the writes so a mistaken future policy can't open them.
-- SELECT stays granted (RLS with no policies returns nothing) so nothing that relies on it breaks.
revoke insert, update, delete, truncate on public.agents,
  public.agent_activity_types, public.agent_activity_log, public.agent_alerts, public.agent_away_periods
  from anon, authenticated;
```

Verify:

```sql
select (select count(*) from public.agent_away_periods) as away_rows,          -- expect 0
       (select bool_and(not public.agent_is_away(id)) from public.agents) as nobody_away; -- expect true
```

Grant check (as run for Step 3: expect 10 rows, every write column false. From Step 4 the same query also shows `can_select`, which must be false too):

```sql
select c.relname as table_name, r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT')   as can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT')   as can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE')   as can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE')   as can_delete,
       has_table_privilege(r.role_name, c.oid, 'TRUNCATE') as can_truncate
from pg_class c
cross join (values ('anon'), ('authenticated')) as r(role_name)
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('agents', 'agent_activity_types', 'agent_activity_log', 'agent_alerts', 'agent_away_periods')
order by 1, 2;
```

### Step 4: assignment columns, history, assign and reassign, guard trigger

```sql
alter table public.customer_searches
  add column assigned_agent_id uuid references public.agents (id),
  add column assigned_at timestamptz;

create index customer_searches_assigned_agent_idx
  on public.customer_searches (assigned_agent_id, created_at desc, id) where assigned_agent_id is not null;
create index customer_searches_unassigned_paid_idx
  on public.customer_searches (paid_at, id) where assigned_agent_id is null and paid_at is not null;

create table public.search_assignments (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  previous_agent_id uuid references public.agents (id),
  assigned_by_agent_id uuid references public.agents (id), -- null = automatic
  method text not null check (method in (
    'continuity', 'round_robin', 'lead_fallback', 'inherited_switch', 'manual', 'backfill')),
  reason text,
  created_at timestamptz not null default now()
);
create index search_assignments_search_idx on public.search_assignments (search_id, created_at desc, id);
create index search_assignments_agent_idx on public.search_assignments (agent_id, created_at desc, id);
alter table public.search_assignments enable row level security;
revoke select, insert, update, delete, truncate on public.search_assignments from anon, authenticated;

-- Second lock, reads too (2026-10-11): internal staff data must not depend on RLS alone for reads.
-- Every read of these tables goes through the service role (checked 2026-10-11), so nothing breaks.
revoke select on public.agents, public.agent_activity_types, public.agent_activity_log,
  public.agent_alerts, public.agent_away_periods from anon, authenticated;

create function public.customer_searches_assignment_guard() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' and (new.assigned_agent_id is not null or new.assigned_at is not null))
     or (tg_op = 'UPDATE' and (new.assigned_agent_id, new.assigned_at)
                              is distinct from (old.assigned_agent_id, old.assigned_at)) then
    if coalesce(current_setting('levr.assignment', true), '') <> 'on' then
      raise exception 'assigned_agent_id / assigned_at change only through assign_search(), reassign_search() or switch_customer_search()';
    end if;
  end if;
  return new;
end;
$$;

create trigger customer_searches_assignment_guard
before insert or update of assigned_agent_id, assigned_at on public.customer_searches
for each row execute function public.customer_searches_assignment_guard();

-- Test accounts (N7): the CLAUDE.md rules, by the auth email (never customers.email, which is not unique).
-- security definer so it can read auth.users whatever role calls it; safe because execute is
-- revoked from anon/authenticated below, and search_path is pinned.
create function public.is_test_customer(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_customer_id
      and (lower(u.email) like '%@levrauto-test.invalid' or lower(u.email) like '%@levrauto.invalid')
  );
$$;

-- Automatic assignment. Idempotent. Returns what happened so the app can email the alert's audience.
create function public.assign_search(p_search_id uuid) returns jsonb
language plpgsql as $$
declare
  v_search public.customer_searches;
  v_agent uuid;
  v_method text;
  v_alert uuid;
begin
  perform pg_advisory_xact_lock(hashtext('levr_assign_search'));

  select * into v_search from public.customer_searches where id = p_search_id for update;
  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;
  if v_search.assigned_agent_id is not null then
    return jsonb_build_object('search_id', p_search_id, 'agent_id', v_search.assigned_agent_id, 'method', 'already_assigned');
  end if;
  if v_search.paid_at is null then
    raise exception 'search % is not paid; only paid searches are assigned', p_search_id;
  end if;

  -- 0. Test accounts are never auto-assigned (N7); a lead can still use reassign_search.
  if public.is_test_customer(v_search.customer_id) then
    return jsonb_build_object('search_id', p_search_id, 'agent_id', null, 'method', 'skipped_test_account');
  end if;

  -- 1. Continuity (Q2): the customer's most recent other search, if that agent is active and in rotation.
  select s.assigned_agent_id into v_agent
  from public.customer_searches s
  join public.agents a on a.id = s.assigned_agent_id
  where s.customer_id = v_search.customer_id and s.id <> v_search.id
    and a.active and a.in_rotation
  order by s.assigned_at desc nulls last
  limit 1;
  v_method := 'continuity';

  -- 2. (Future) routing preferences by state/make narrow the pool here.

  -- 3. Round-robin (Q3): everyone in rotation who isn't deactivated. Away status is ignored by design.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and in_rotation
    order by last_assigned_at nulls first, created_at, id
    limit 1;
    v_method := 'round_robin';
  end if;

  -- 4. Nobody in rotation (Q4/N1): least-recently-assigned ACTIVE LEAD. role = 'lead' exactly:
  --    the system never picks an admin.
  if v_agent is null then
    select id into v_agent from public.agents
    where active and role = 'lead'
    order by last_assigned_at nulls first, created_at, id
    limit 1;
    v_method := 'lead_fallback';
  end if;

  -- 5. No active lead either: stay unassigned, alert ADMINS (record + email by the app). One open alert
  --    per search; the hourly sweep retries the assignment without re-alerting.
  if v_agent is null then
    insert into public.agent_alerts (kind, audience, search_id, details)
    values ('assignment_no_lead', 'admins', p_search_id, jsonb_build_object('reason', 'nobody in rotation and no active lead'))
    on conflict (search_id, kind)
      where resolved_at is null and search_id is not null
        and kind in ('assignment_lead_fallback', 'assignment_no_lead')
      do nothing
    returning id into v_alert;
    return jsonb_build_object('search_id', p_search_id, 'agent_id', null, 'method', 'unassigned', 'alert_id', v_alert);
  end if;

  -- The guard flag is on only for this one update, so it can't carry over to later statements.
  perform set_config('levr.assignment', 'on', true);
  update public.customer_searches set assigned_agent_id = v_agent, assigned_at = now() where id = p_search_id;
  perform set_config('levr.assignment', 'off', true);

  -- last_assigned_at isn't a guarded column, so no agents flag is needed here.
  update public.agents set last_assigned_at = now() where id = v_agent;

  insert into public.search_assignments (search_id, agent_id, method) values (p_search_id, v_agent, v_method);

  if v_method = 'lead_fallback' then
    insert into public.agent_alerts (kind, audience, search_id, agent_id, details)
    values ('assignment_lead_fallback', 'leads', p_search_id, v_agent, jsonb_build_object('reason', 'nobody in rotation'))
    on conflict (search_id, kind)
      where resolved_at is null and search_id is not null
        and kind in ('assignment_lead_fallback', 'assignment_no_lead')
      do nothing
    returning id into v_alert;
  end if;

  return jsonb_build_object('search_id', p_search_id, 'agent_id', v_agent, 'method', v_method, 'alert_id', v_alert);
end;
$$;

-- Lead/admin reassignment to anyone active, including themselves (Q5).
create function public.reassign_search(
  p_search_id uuid, p_new_agent_id uuid, p_actor_agent_id uuid, p_reason text
) returns public.customer_searches
language plpgsql as $$
declare
  v_search public.customer_searches;
  v_previous uuid;
begin
  if not public.agent_has_role(p_actor_agent_id, 'lead') then
    raise exception 'only leads and admins can reassign searches';
  end if;
  if not exists (select 1 from public.agents where id = p_new_agent_id and active) then
    raise exception 'agent % is deactivated or does not exist', p_new_agent_id;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to reassign a search';
  end if;

  select * into v_search from public.customer_searches where id = p_search_id for update;
  if not found then
    raise exception 'customer_searches row % not found', p_search_id;
  end if;
  v_previous := v_search.assigned_agent_id;
  if v_previous is not distinct from p_new_agent_id then
    return v_search;
  end if;

  perform set_config('levr.assignment', 'on', true);
  update public.customer_searches set assigned_agent_id = p_new_agent_id, assigned_at = now()
  where id = p_search_id returning * into v_search;
  perform set_config('levr.assignment', 'off', true);

  insert into public.search_assignments (search_id, agent_id, previous_agent_id, assigned_by_agent_id, method, reason)
  values (p_search_id, p_new_agent_id, v_previous, p_actor_agent_id, 'manual', p_reason);

  perform public.log_agent_activity(p_actor_agent_id, 'search_reassigned', p_search_id, v_search.customer_id,
    p_details => jsonb_build_object('from_agent_id', v_previous, 'to_agent_id', p_new_agent_id, 'reason', p_reason));

  return v_search;
end;
$$;

revoke execute on function public.assign_search(uuid), public.reassign_search(uuid, uuid, uuid, text),
  public.is_test_customer(uuid) from public, anon, authenticated;
grant execute on function public.is_test_customer(uuid) to service_role;
grant execute on function public.assign_search(uuid), public.reassign_search(uuid, uuid, uuid, text) to service_role;
```

Verify (A–C are read-only; D runs inside a transaction that is rolled back, using Brett's own customer row, never a tester's):

```sql
-- A. columns, table, guard trigger, functions locked
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_searches'
      and column_name in ('assigned_agent_id', 'assigned_at')) as new_columns,               -- expect 2
  (select count(*) from public.search_assignments) as history_rows,                           -- expect 0
  (select count(*) from public.customer_searches where assigned_agent_id is not null) as assigned, -- expect 0
  (select count(*) from pg_trigger where tgname = 'customer_searches_assignment_guard') as guard,   -- expect 1
  has_function_privilege('authenticated', 'public.assign_search(uuid)', 'execute') as customer_can_assign,       -- expect false
  has_function_privilege('authenticated', 'public.is_test_customer(uuid)', 'execute') as customer_can_test_check; -- expect false

-- B. grant check, now including SELECT: expect 12 rows, every can_* false
select c.relname as table_name, r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE') as can_delete,
       has_table_privilege(r.role_name, c.oid, 'TRUNCATE') as can_truncate
from pg_class c cross join (values ('anon'), ('authenticated')) as r(role_name)
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('agents', 'agent_activity_types', 'agent_activity_log', 'agent_alerts',
                    'agent_away_periods', 'search_assignments')
order by 1, 2;

-- C. the guard blocks a direct write (expect ERROR "assigned_agent_id / assigned_at change only through ...")
update public.customer_searches set assigned_at = now()
where id = (select id from public.customer_searches limit 1);

-- D. assignment works end to end, rolled back (run these lines together as one query).
--    It runs assign_search as service_role (the website's role), so it proves the real path,
--    including is_test_customer reading auth.users.
--    Expected final result: one row, agent_email = bjohnston@levrauto.com, method = round_robin.
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('phase1.test_search_id', (select id::text from s), true);
set local role service_role;          -- the role the website uses
select public.assign_search(current_setting('phase1.test_search_id')::uuid);
reset role;
select a.email as agent_email, sa.method
from public.search_assignments sa
join public.agents a on a.id = sa.agent_id
where sa.search_id = current_setting('phase1.test_search_id')::uuid;
rollback;
```
Afterwards, query A should still show `history_rows = 0` and `assigned = 0`: the rollback removed the test search and its assignment.

### Step 5: switches inherit the agent

Built from the live function text in `20260926130000_pickup_travel_and_handoff.sql` (no later migration replaces it). The diff against it is **additions only**: the two assignment columns on the new row inside the guard flag, the `inherited_switch` history row, and the activity row for agent switches. Same signature, so `create or replace` replaces it in place. Callers, all unchanged: `src/app/api/stripe/webhook/route.ts:192`, `src/lib/switch-actions.ts:92`, `src/lib/switch-self-service-actions.ts:185`.

```sql
create or replace function public.switch_customer_search(
  p_old_search_id uuid,
  p_new_make text,
  p_new_model text,
  p_new_model_year smallint default null,
  p_paid_at timestamptz default null,
  p_agent_id uuid default null,
  p_reason_category text default null,
  p_notes text default null
)
returns public.customer_searches
language plpgsql
as $$
declare
  v_old public.customer_searches;
  v_new public.customer_searches;
begin
  select * into v_old
  from public.customer_searches
  where id = p_old_search_id
  for update;

  if not found then
    raise exception 'customer_searches row % not found', p_old_search_id;
  end if;

  if v_old.superseded_by_id is not null or v_old.search_status = 'switched' then
    raise exception 'search % has already been switched', p_old_search_id;
  end if;

  if p_agent_id is not null and p_reason_category is null then
    raise exception 'p_reason_category is required when p_agent_id is provided';
  end if;

  -- trim/colors/required_options deliberately reset to defaults, not copied
  -- from the old row -- they're model-specific. zip and the pickup travel
  -- answer carry over: customer-level, not vehicle-specific. model_year is
  -- the switched-TO year, never the old row's.
  -- Phase 1 (Step 5): the assigned agent carries over too (method inherited_switch),
  -- so a switch never re-rolls the agent. An unassigned old row gives an unassigned
  -- new row. The assignment guard flag is on only for this insert.
  perform set_config('levr.assignment', 'on', true);
  insert into public.customer_searches (
    customer_id, make, model, model_year, zip, paid_at,
    pickup_travel_choice, pickup_travel_miles, pickup_travel_set_at,
    assigned_agent_id, assigned_at
  )
  values (
    v_old.customer_id, p_new_make, p_new_model, p_new_model_year, v_old.zip, p_paid_at,
    v_old.pickup_travel_choice, v_old.pickup_travel_miles, v_old.pickup_travel_set_at,
    v_old.assigned_agent_id, case when v_old.assigned_agent_id is not null then now() end
  )
  returning * into v_new;
  perform set_config('levr.assignment', 'off', true);

  update public.customer_searches
  set superseded_by_id = v_new.id,
      search_status = 'switched'
  where id = p_old_search_id;

  if v_old.assigned_agent_id is not null then
    insert into public.search_assignments (search_id, agent_id, method, reason)
    values (v_new.id, v_old.assigned_agent_id, 'inherited_switch', 'switched from search ' || p_old_search_id);
  end if;

  if p_agent_id is not null then
    insert into public.agent_bypass_log (search_id, agent_id, fee_type, reason_category, notes)
    values (p_old_search_id, p_agent_id, 'switch', p_reason_category, p_notes);

    perform public.log_agent_activity(p_agent_id, 'search_switched', p_old_search_id, v_old.customer_id,
      p_details => jsonb_build_object('new_search_id', v_new.id, 'new_make', p_new_make,
                                      'new_model', p_new_model, 'reason_category', p_reason_category));
  end if;

  return v_new;
end;
$$;
```

Verify (A is read-only; B and C are rolled back and use Brett's own customer row, never a tester's):

```sql
-- A. one function, same signature, new behaviour present
select count(*) as overloads,
       bool_and(pg_get_function_identity_arguments(oid) =
         'p_old_search_id uuid, p_new_make text, p_new_model text, p_new_model_year smallint, p_paid_at timestamp with time zone, p_agent_id uuid, p_reason_category text, p_notes text') as same_signature,
       bool_and(position('inherited_switch' in pg_get_functiondef(oid)) > 0) as inherits_agent
from pg_proc where proname = 'switch_customer_search';
-- expect 1 | true | true

-- B. agent switch of an ASSIGNED search, as the website's role, rolled back
--    expect: old_status switched | new_inherits_brett true | new_method inherited_switch | bypass_rows 1 | activity_rows 1
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('p5.old', (select id::text from s), true);
set local role service_role;
select public.assign_search(current_setting('p5.old')::uuid);
select set_config('p5.new', (public.switch_customer_search(
  current_setting('p5.old')::uuid, 'Honda', 'Civic', 2026::smallint, now(),
  (select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
  'Goodwill gesture', 'phase1 step5 check')).id::text, true);
reset role;
select (select search_status from public.customer_searches where id = current_setting('p5.old')::uuid) as old_status,
       n.assigned_agent_id = (select id from public.agents where lower(email) = 'bjohnston@levrauto.com') as new_inherits_brett,
       (select method from public.search_assignments where search_id = n.id) as new_method,
       (select count(*) from public.agent_bypass_log where search_id = current_setting('p5.old')::uuid) as bypass_rows,
       (select count(*) from public.agent_activity_log
         where action = 'search_switched' and search_id = current_setting('p5.old')::uuid) as activity_rows
from public.customer_searches n where n.id = current_setting('p5.new')::uuid;
rollback;

-- C. customer self-service switch of an UNASSIGNED search (how every switch behaves today), rolled back
--    expect: old_status switched | new_assigned_agent null | history_rows 0 | activity_rows 0
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('p5.old', (select id::text from s), true);
set local role service_role;
select set_config('p5.new', (public.switch_customer_search(
  current_setting('p5.old')::uuid, 'Honda', 'Civic', 2026::smallint, now())).id::text, true);
reset role;
select (select search_status from public.customer_searches where id = current_setting('p5.old')::uuid) as old_status,
       n.assigned_agent_id as new_assigned_agent,
       (select count(*) from public.search_assignments where search_id = n.id) as history_rows,
       (select count(*) from public.agent_activity_log where search_id = current_setting('p5.old')::uuid) as activity_rows
from public.customer_searches n where n.id = current_setting('p5.new')::uuid;
rollback;

-- D. nothing left behind (run after B and C)
--    expect 0 | 0 | 0 | 0
select (select count(*) from public.search_assignments) as history_rows,
       (select count(*) from public.customer_searches where assigned_agent_id is not null) as assigned,
       (select count(*) from public.agent_activity_log) as activity_rows,
       (select count(*) from public.agent_bypass_log where notes = 'phase1 step5 check') as test_bypass_rows;
```

Step 5 creates no tables, so there's no new grant check. The grant check from Step 4 is unchanged.

### Step 6: dealer outreach log

```sql
create table public.dealer_contacts (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.customer_searches (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  dealer_alias_id uuid not null references public.dealer_aliases (id),
  salesperson_id uuid references public.dealership_salespeople (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  channel text not null check (channel in ('phone', 'email', 'text', 'in_person', 'web_form', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome text not null check (outcome in (
    'no_answer', 'left_message', 'spoke', 'request_sent', 'quote_received',
    'declined', 'unit_unavailable', 'unresponsive', 'other')),
  notes text check (notes is null or char_length(notes) <= 2000),
  contacted_at timestamptz not null default now(),
  next_follow_up_at timestamptz, -- a due date, not a clock (Q11); default +48h is set by the app (Q10)
  follow_up_closed_at timestamptz,
  follow_up_closed_reason text check (follow_up_closed_reason in (
    'new_contact', 'offer_logged', 'terminal_outcome', 'search_closed', 'manual')),
  created_at timestamptz not null default now(),
  constraint dealer_contacts_closed_shape check ((follow_up_closed_at is null) = (follow_up_closed_reason is null))
);
create index dealer_contacts_search_dealer_idx on public.dealer_contacts (search_id, dealer_alias_id, contacted_at desc, id);
create index dealer_contacts_agent_idx on public.dealer_contacts (agent_id, contacted_at desc, id);
create index dealer_contacts_due_idx on public.dealer_contacts (next_follow_up_at, id)
  where follow_up_closed_at is null and next_follow_up_at is not null;
alter table public.dealer_contacts enable row level security;
revoke select, insert, update, delete, truncate on public.dealer_contacts from anon, authenticated;

alter table public.agent_activity_log
  add constraint agent_activity_log_dealer_contact_fk
  foreign key (dealer_contact_id) references public.dealer_contacts (id) on delete set null;
```

Verify (A, B, E read-only; C errors on purpose and writes nothing; D is rolled back and uses Brett's own customer row):

```sql
-- A. structure: expect 0 | 1 | 3 | true
select (select count(*) from public.dealer_contacts) as contact_rows,
       (select count(*) from pg_constraint where conname = 'agent_activity_log_dealer_contact_fk') as activity_fk,
       (select count(*) from pg_indexes where tablename = 'dealer_contacts' and indexname like 'dealer_contacts_%_idx') as indexes,
       (select relrowsecurity from pg_class where relname = 'dealer_contacts') as rls_on;

-- B. grant check, all agent tables so far: expect 14 rows, every can_* false
select c.relname as table_name, r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE') as can_delete,
       has_table_privilege(r.role_name, c.oid, 'TRUNCATE') as can_truncate
from pg_class c cross join (values ('anon'), ('authenticated')) as r(role_name)
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('agents', 'agent_activity_types', 'agent_activity_log', 'agent_alerts',
                    'agent_away_periods', 'search_assignments', 'dealer_contacts')
order by 1, 2;

-- C. the closed-follow-up shape rule rejects a half-closed row (expect ERROR ... "dealer_contacts_closed_shape").
--    Uses random ids: the check fails before any foreign key is looked at, so nothing is written.
insert into public.dealer_contacts (search_id, agent_id, dealer_alias_id, channel, outcome, follow_up_closed_at)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'phone', 'no_answer', now());

-- D. end to end as the website's role, rolled back: log a contact + its activity row, then delete
--    the test search. Expect: contacts_after_delete 0 | activity_rows_unlinked 1
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('p6.search', (select id::text from s), true);
set local role service_role;
with c as (
  insert into public.dealer_contacts (search_id, agent_id, dealer_alias_id, channel, outcome, next_follow_up_at)
  values (current_setting('p6.search')::uuid,
          (select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
          (select id from public.dealer_aliases order by created_at limit 1),
          'phone', 'left_message', now() + interval '48 hours')
  returning id
)
select set_config('p6.contact', (select id::text from c), true);
select public.log_agent_activity((select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
  'dealer_contact_logged', current_setting('p6.search')::uuid,
  p_dealer_contact_id => current_setting('p6.contact')::uuid);
delete from public.customer_searches where id = current_setting('p6.search')::uuid;
reset role;
select (select count(*) from public.dealer_contacts) as contacts_after_delete,
       (select count(*) from public.agent_activity_log
         where action = 'dealer_contact_logged' and search_id is null and dealer_contact_id is null) as activity_rows_unlinked;
rollback;

-- E. nothing left behind: expect 0 | 0 | 0
select (select count(*) from public.dealer_contacts) as contacts,
       (select count(*) from public.agent_activity_log) as activity_rows,
       (select count(*) from public.customer_searches where make = 'Toyota' and model = 'Camry'
          and customer_id = (select id from auth.users where lower(email) = 'bjohnston@levrauto.com')
          and created_at > now() - interval '1 day') as leftover_test_searches;
```

### Step 6b: activity-log links checked at commit (found by Step 6's test D, 2026-10-11)

**What failed.** Step 6's rolled-back test D failed on deleting the test search with `23503 … agent_activity_log_dealer_contact_fk`.
- One delete can reach an activity row by several routes:
  - search → `search_id` (set null);
  - search → dealer contact (cascade) → `dealer_contact_id` (set null);
  - search → offer (cascade) → `qualifying_offer_id` (set null);
  - customer → `customer_id` plus customer → search → all of the above.
- When the activity row was **inserted in the same transaction**, Postgres re-checks every foreign key on it during the first set-null update (`ri_triggers.c`: "our UPDATE will invalidate the INSERT so that the INSERT RI trigger will not do anything").
- So the check of a link whose target is being deleted in the same statement fails.
- Rows logged in an earlier transaction (normal use) were not affected. Rolled-back tests, and any future function that logs and then deletes in one transaction, were.

**Fix (`20261011190000_activity_log_deferred_links.sql`):**
- The six link foreign keys become `deferrable initially deferred`: checked at commit, after the set-null actions have run. The delete actions are unchanged, and `agent_id` / `action` stay immediate.
- `log_agent_activity` (same signature) drops any link id that doesn't exist before inserting. It nulls the link on the row and keeps the id in `details.dropped_ids`, so a deferred check can never fail at commit and roll back the agent's action (Q8).
- **Alternatives rejected:**
  - dropping the foreign keys: loses the database's guarantee that links point at real rows;
  - cascade-deleting activity rows: deletes audit history;
  - blocking the delete: stops legitimate cleanups.

**Dealer aliases in use can't be deleted (noted 2026-10-11, Brett).**
- `dealer_contacts.dealer_alias_id` (Step 6) and, from Step 8, `qualifying_offers.dealer_alias_id` are plain foreign keys, so an alias that's in use can't be deleted. `post_deal_surveys.dealer_alias_id` already behaves this way today.
- **Checked against the code (2026-10-11):**
  - nothing in `src/` deletes a dealer alias or a dealership;
  - "merge" (`mergeAliasIntoDealership`, `src/lib/dealership-actions.ts:58`) only sets an alias's `dealership_id`, so several aliases point at one dealership and none is deleted or repointed;
  - the sync only inserts aliases it hasn't seen (`dealer-aliases.ts:127`, `ignoreDuplicates`).
  - So nothing today is affected.
- **The one manual process that is affected:** test-data cleanup that deletes a seeded alias (as with "Seeded Test Motors" during tester setup). It must first delete or repoint that alias's `dealer_contacts`, offers and surveys. Activity rows clear their link on their own.
- **If duplicate dealerships or aliases are ever genuinely merged** (deleting one), the merge has to repoint `dealer_contacts`, `qualifying_offers`, `post_deal_surveys` and `agent_activity_log` rows to the surviving alias first, inside one transaction. That should be a database function, not hand-run SQL.

**Rule for every later step:** any new foreign key on a table that a single delete can reach by more than one route must be deferrable, and its writer must validate links first. Steps 7–10 add no such key: their new keys are plain links with no delete action, onto lookup tables and agents. Rolled-back tests that delete a parent must run `set constraints all immediate` before reading results, or the deferred checks never run.

```sql
alter table public.agent_activity_log
  alter constraint agent_activity_log_search_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_customer_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_qualifying_offer_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_dealer_alias_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_refund_id_fkey deferrable initially deferred,
  alter constraint agent_activity_log_dealer_contact_fk deferrable initially deferred;

create or replace function public.log_agent_activity(
  p_agent_id uuid,
  p_action text,
  p_search_id uuid default null,
  p_customer_id uuid default null,
  p_qualifying_offer_id uuid default null,
  p_dealer_alias_id uuid default null,
  p_refund_id uuid default null,
  p_dealer_contact_id uuid default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_search uuid := p_search_id;
  v_customer uuid := p_customer_id;
  v_offer uuid := p_qualifying_offer_id;
  v_alias uuid := p_dealer_alias_id;
  v_refund uuid := p_refund_id;
  v_contact uuid := p_dealer_contact_id;
  v_dropped jsonb := '{}'::jsonb;
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  -- Links are deferred-checked at commit, so validate them now: a missing target is dropped
  -- (and recorded) instead of failing the caller's transaction later.
  if v_search is not null and not exists (select 1 from public.customer_searches where id = v_search) then
    v_dropped := v_dropped || jsonb_build_object('search_id', v_search); v_search := null;
  end if;
  if v_customer is not null and not exists (select 1 from public.customers where id = v_customer) then
    v_dropped := v_dropped || jsonb_build_object('customer_id', v_customer); v_customer := null;
  end if;
  if v_offer is not null and not exists (select 1 from public.qualifying_offers where id = v_offer) then
    v_dropped := v_dropped || jsonb_build_object('qualifying_offer_id', v_offer); v_offer := null;
  end if;
  if v_alias is not null and not exists (select 1 from public.dealer_aliases where id = v_alias) then
    v_dropped := v_dropped || jsonb_build_object('dealer_alias_id', v_alias); v_alias := null;
  end if;
  if v_refund is not null and not exists (select 1 from public.refunds where id = v_refund) then
    v_dropped := v_dropped || jsonb_build_object('refund_id', v_refund); v_refund := null;
  end if;
  if v_contact is not null and not exists (select 1 from public.dealer_contacts where id = v_contact) then
    v_dropped := v_dropped || jsonb_build_object('dealer_contact_id', v_contact); v_contact := null;
  end if;
  if v_dropped <> '{}'::jsonb then
    v_details := v_details || jsonb_build_object('dropped_ids', v_dropped);
  end if;

  begin
    insert into public.agent_activity_log (agent_id, action, search_id, customer_id, qualifying_offer_id,
                                           dealer_alias_id, refund_id, dealer_contact_id, details)
    values (p_agent_id, p_action, v_search, v_customer, v_offer,
            v_alias, v_refund, v_contact, v_details)
    returning id into v_id;
  exception when others then
    begin
      insert into public.agent_alerts (kind, search_id, agent_id, details)
      values ('activity_log_failed', v_search,
              case when exists (select 1 from public.agents where id = p_agent_id) then p_agent_id end,
              jsonb_build_object('error', sqlerrm, 'action', p_action, 'agent_id', p_agent_id, 'details', v_details));
    exception when others then
      raise warning 'agent activity and alert both failed: %', sqlerrm;
    end;
  end;
  return v_id;
end;
$$;

-- create or replace keeps existing grants; restated so the file stands on its own.
revoke execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_agent_activity(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;
```

Verify (A read-only; B–E rolled back, using Brett's own customer row; F read-only):

```sql
-- A. constraint states: expect 8 rows. The six links deferrable/deferred = true/true;
--    agent_activity_log_action_fkey and agent_activity_log_agent_id_fkey = false/false (still immediate).
select conname, condeferrable, condeferred
from pg_constraint
where conrelid = 'public.agent_activity_log'::regclass and contype = 'f'
order by conname;

-- B. Step 6 test D again, now forcing the deferred checks before reading the result.
--    expect: contacts_after_delete 0 | activity_rows_unlinked 1   (and no error)
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('p6.search', (select id::text from s), true);
set local role service_role;
with c as (
  insert into public.dealer_contacts (search_id, agent_id, dealer_alias_id, channel, outcome, next_follow_up_at)
  values (current_setting('p6.search')::uuid,
          (select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
          (select id from public.dealer_aliases order by created_at limit 1),
          'phone', 'left_message', now() + interval '48 hours')
  returning id
)
select set_config('p6.contact', (select id::text from c), true);
select public.log_agent_activity((select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
  'dealer_contact_logged', current_setting('p6.search')::uuid,
  p_dealer_contact_id => current_setting('p6.contact')::uuid);
delete from public.customer_searches where id = current_setting('p6.search')::uuid;
set constraints all immediate;   -- run the commit-time checks now, inside the transaction
reset role;
select (select count(*) from public.dealer_contacts) as contacts_after_delete,
       (select count(*) from public.agent_activity_log
         where action = 'dealer_contact_logged' and search_id is null and dealer_contact_id is null) as activity_rows_unlinked;
rollback;

-- C. the offer route (search -> offer -> activity), same pattern.
--    expect: offers_after_delete 0 | activity_rows_unlinked 1   (and no error)
begin;
with s as (
  insert into public.customer_searches (customer_id, make, model, model_year, paid_at)
  select c.id, 'Toyota', 'Camry', 2026, now()
  from public.customers c join auth.users u on u.id = c.id
  where lower(u.email) = 'bjohnston@levrauto.com'
  returning id
)
select set_config('p6b.search', (select id::text from s), true);
set local role service_role;
with o as (
  insert into public.qualifying_offers (customer_search_id, dealer_name, offer_price_cents, msrp_cents)
  values (current_setting('p6b.search')::uuid, 'Phase1 Step6b Check Motors', 3000000, 3200000)
  returning id
)
select set_config('p6b.offer', (select id::text from o), true);
select public.log_agent_activity((select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
  'offer_logged', current_setting('p6b.search')::uuid,
  p_qualifying_offer_id => current_setting('p6b.offer')::uuid);
delete from public.customer_searches where id = current_setting('p6b.search')::uuid;
set constraints all immediate;
reset role;
select (select count(*) from public.qualifying_offers where dealer_name = 'Phase1 Step6b Check Motors') as offers_after_delete,
       (select count(*) from public.agent_activity_log
         where action = 'offer_logged' and search_id is null and qualifying_offer_id is null) as activity_rows_unlinked;
rollback;

-- D. a link to a row that doesn't exist is dropped and recorded, never failing the caller (Q8).
--    expect: search_id NULL | dropped_recorded true   (and no error after forcing the checks)
begin;
set local role service_role;
select public.log_agent_activity((select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
  'agent_role_changed', gen_random_uuid());
set constraints all immediate;
reset role;
select search_id, details ? 'dropped_ids' and details->'dropped_ids' ? 'search_id' as dropped_recorded
from public.agent_activity_log;
rollback;

-- E. a bad action code still becomes an alert straight away (unchanged from Step 2).
--    expect one row: activity_log_failed | leads
begin;
select public.log_agent_activity((select id from public.agents where lower(email) = 'bjohnston@levrauto.com'), 'not_a_real_action');
select kind, audience from public.agent_alerts;
rollback;

-- F. nothing left behind: expect 0 | 0 | 0 | 0 | 0
select (select count(*) from public.agent_activity_log) as activity_rows,
       (select count(*) from public.agent_alerts) as alerts,
       (select count(*) from public.dealer_contacts) as contacts,
       (select count(*) from public.qualifying_offers where dealer_name = 'Phase1 Step6b Check Motors') as test_offers,
       (select count(*) from public.customer_searches where make = 'Toyota' and model = 'Camry'
          and customer_id = (select id from auth.users where lower(email) = 'bjohnston@levrauto.com')
          and created_at > now() - interval '1 day') as leftover_test_searches;
```

### Step 7: refund reasons and refunds without a cancellation

```sql
create table public.refund_reasons (
  code text primary key,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.refund_reasons enable row level security;
revoke select, insert, update, delete, truncate on public.refund_reasons from anon, authenticated;
insert into public.refund_reasons (code, label) values
  ('cancellation', 'Cancellation'),
  ('guarantee', 'Day-30 guarantee'),
  ('goodwill', 'Goodwill'),
  ('duplicate_charge', 'Duplicate charge'),
  ('other', 'Other');

alter table public.refunds
  alter column cancellation_log_id drop not null,
  add column reason text not null default 'cancellation' references public.refund_reasons (code),
  add column notes text check (notes is null or char_length(notes) <= 2000);
alter table public.refunds alter column reason drop default; -- new rows must say why
alter table public.refunds add constraint refunds_reason_matches_cancellation
  check ((reason = 'cancellation') = (cancellation_log_id is not null));
create unique index refunds_stripe_refund_id_idx on public.refunds (stripe_refund_id);

create function public.record_payment_refund(
  p_payment_id uuid,
  p_agent_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text,
  p_reason text,
  p_cancellation_log_id uuid default null,
  p_notes text default null
) returns public.payments
language plpgsql as $$
declare
  v_payment public.payments;
  v_refund_id uuid;
begin
  if not public.agent_has_role(p_agent_id, 'agent') then
    raise exception 'agent % is not an active agent', p_agent_id;
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payments row % not found', p_payment_id;
  end if;
  if p_amount_cents <= 0 then
    raise exception 'p_amount_cents must be positive';
  end if;
  if v_payment.refunded_cents + p_amount_cents > v_payment.amount_cents then
    raise exception 'refund of % cents would exceed remaining balance of % cents on payment %',
      p_amount_cents, v_payment.amount_cents - v_payment.refunded_cents, p_payment_id;
  end if;

  update public.payments set refunded_cents = refunded_cents + p_amount_cents
  where id = p_payment_id returning * into v_payment;

  -- The agent is recorded on the refund row itself (Q8), independent of the activity log.
  insert into public.refunds (cancellation_log_id, payment_id, agent_id, amount_cents, stripe_refund_id, reason, notes)
  values (p_cancellation_log_id, p_payment_id, p_agent_id, p_amount_cents, p_stripe_refund_id, p_reason, p_notes)
  returning id into v_refund_id;

  perform public.log_agent_activity(p_agent_id, 'refund_processed', v_payment.search_id, v_payment.customer_id,
    p_refund_id => v_refund_id,
    p_details => jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason,
                                    'payment_type', v_payment.payment_type, 'stripe_refund_id', p_stripe_refund_id));
  return v_payment;
end;
$$;

-- Same signature as today: the deployed cancellation flow keeps working.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_cancellation_log_id uuid,
  p_agent_id uuid,
  p_amount_cents integer,
  p_stripe_refund_id text
) returns public.payments
language plpgsql as $$
begin
  return public.record_payment_refund(
    p_payment_id, p_agent_id, p_amount_cents, p_stripe_refund_id, 'cancellation', p_cancellation_log_id, null);
end;
$$;

revoke execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_payment_refund(uuid, uuid, integer, text, text, uuid, text) to service_role;
```

Verify:

```sql
select code from public.refund_reasons order by code; -- expect 5 rows
select reason, count(*), count(*) filter (where cancellation_log_id is null) as without_cancellation
from public.refunds group by reason; -- expect only cancellation rows, 0 without a cancellation
select count(*) from pg_proc where proname = 'record_refund'; -- expect 1
```

### Step 8: attribution, call resolution and message-time columns

```sql
alter table public.qualifying_offers
  add column logged_by_agent_id uuid references public.agents (id),
  add column dealer_alias_id uuid references public.dealer_aliases (id),
  add column last_customer_message_at timestamptz;
create index qualifying_offers_search_vin_idx on public.qualifying_offers (customer_search_id, vin) where vin is not null;
create index qualifying_offers_search_dealer_idx on public.qualifying_offers (customer_search_id, dealer_alias_id)
  where dealer_alias_id is not null;

alter table public.general_threads add column last_customer_message_at timestamptz;

alter table public.deal_progress
  add column availability_confirmed_by_agent_id uuid references public.agents (id),
  add column deposit_confirmed_by_agent_id uuid references public.agents (id);

alter table public.notification_events
  add column flag_resolved_by_agent_id uuid references public.agents (id);

alter table public.customer_searches
  add column switch_call_resolved_at timestamptz,
  add column switch_call_resolved_by_agent_id uuid references public.agents (id),
  add column switch_call_outcome text check (switch_call_outcome in ('switched', 'kept_vehicle', 'unreachable', 'other')),
  add column cancellation_call_resolved_at timestamptz,
  add column cancellation_call_resolved_by_agent_id uuid references public.agents (id),
  add column cancellation_call_outcome text check (cancellation_call_outcome in ('cancelled', 'retained', 'unreachable', 'other'));
```

Verify:

```sql
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and table_name in ('qualifying_offers', 'general_threads', 'deal_progress', 'notification_events', 'customer_searches')
  and column_name in ('logged_by_agent_id', 'dealer_alias_id', 'last_customer_message_at',
    'availability_confirmed_by_agent_id', 'deposit_confirmed_by_agent_id', 'flag_resolved_by_agent_id',
    'switch_call_resolved_at', 'cancellation_call_resolved_at')
order by 1, 2;
-- expect 9 rows: qualifying_offers x3, general_threads x1, deal_progress x2,
-- notification_events x1, customer_searches x2
```

### Step 9: agent management and away functions; activity from the remaining functions

- **Section 9's functions** are written in full in the migration file, each following the same pattern as `reassign_search`: role checks first, then `set_config('levr.agent_admin', 'on', true)`, then the change, then `log_agent_activity`.
- **`cancel_search` (agent path), `grant_extension_bypass` and `revert_purchased_search`** each get a same-signature `create or replace` that adds one `perform public.log_agent_activity(...)`. Their bodies are copied verbatim from:
  - `20260821120000_purchase_reversal.sql` (`cancel_search`);
  - `20260816140000_agent_bypass_log.sql` (`grant_extension_bypass`);
  - `20260823140000_revert_purchased_search_clears_offer.sql` (`revert_purchased_search`).

  Retyping a guard from memory is how bugs get in, so these bodies aren't reproduced in this plan.
- **`set_agent_active`** must turn off `in_rotation` before setting `active = false`, because of the `agents_deactivated_not_in_rotation` check.
- **`switch_customer_search` (deactivated-agent fix, see 4.2):** same signature again, built from the Step 5 text (`20261011170000_switch_inherits_agent.sql`). It inherits only an active agent; otherwise the new row starts unassigned and, if paid, goes through `assign_search`.
- **`agent_alerts.notified_at`** (new column): alerts can now be raised inside other functions (`assign_search` called from a switch, `log_agent_activity`), not only when the app calls `assign_search` itself. So the app sends alert emails from a sweep over `agent_alerts where notified_at is null` (in the hourly cron, plus right after any call that returned an `alert_id`) and stamps `notified_at`. No alert email depends on which code path raised it.

Verify:

```sql
select proname, position('log_agent_activity' in pg_get_functiondef(oid)) > 0 as logs
from pg_proc
where proname in ('cancel_search', 'grant_extension_bypass', 'revert_purchased_search', 'switch_customer_search',
                  'record_payment_refund', 'reassign_search', 'add_agent', 'set_agent_role', 'set_agent_rotation',
                  'set_agent_active', 'request_away', 'decide_away', 'set_away', 'cancel_away', 'resolve_agent_alert')
order by proname; -- expect 15 rows, logs = true
select proname, has_function_privilege('authenticated', oid, 'execute') as exposed
from pg_proc where proname in ('add_agent', 'set_agent_role', 'reassign_search', 'decide_away'); -- expect all false
```

### Step 10: backfill (one transaction, test accounts excluded)

```sql
begin;
select set_config('levr.agent_admin', 'on', true);
select set_config('levr.assignment', 'on', true);

-- 10a. Link agents to auth users; Brett = admin, in rotation until other agents exist.
update public.agents a set auth_user_id = u.id
from auth.users u
where lower(u.email) = lower(a.email) and a.auth_user_id is null;

update public.agents set role = 'admin', in_rotation = true
where lower(email) = 'bjohnston@levrauto.com';

-- 10b. Assign every paid, non-test search to Brett.
with brett as (select id from public.agents where lower(email) = 'bjohnston@levrauto.com'),
targets as (
  select s.id, coalesce(s.paid_at, s.created_at) as at
  from public.customer_searches s
  join auth.users u on u.id = s.customer_id
  where s.paid_at is not null and s.assigned_agent_id is null
    and lower(u.email) not like '%@levrauto-test.invalid'
    and lower(u.email) not like '%@levrauto.invalid'
),
upd as (
  update public.customer_searches s set assigned_agent_id = (select id from brett), assigned_at = t.at
  from targets t where s.id = t.id
  returning s.id
)
insert into public.search_assignments (search_id, agent_id, method, reason)
select id, (select id from brett), 'backfill', 'Phase 1 backfill: sole agent' from upd;

-- 10c. Last customer message times (exact).
update public.qualifying_offers o set last_customer_message_at = m.latest
from (select qualifying_offer_id, max(created_at) as latest from public.offer_messages
      where author_type = 'customer' and qualifying_offer_id is not null group by qualifying_offer_id) m
where m.qualifying_offer_id = o.id;

update public.general_threads g set last_customer_message_at = m.latest
from (select customer_id, max(created_at) as latest from public.offer_messages
      where author_type = 'customer' and qualifying_offer_id is null group by customer_id) m
where m.customer_id = g.customer_id;

-- 10d. Offer -> dealer alias, where the offer links a listing.
update public.qualifying_offers o set dealer_alias_id = da.id
from public.listings l
join public.dealer_aliases da
  on da.dealer_name = l.dealer_name
 and da.dealer_city_key = coalesce(l.dealer_city, '')
 and da.dealer_state_key = coalesce(l.dealer_state, '')
where o.listing_id = l.id and o.dealer_alias_id is null;

-- 10e. Activity history only from rows that already record the agent (Q9: nothing inferred).
--      Sources: purchase_status_log, agent_bypass_log, cancellation_log (agent rows), refunds,
--      offer_messages (agent rows), withdrawn offers, dealer_aliases.confirmed_by_agent_id,
--      dealership_salespeople.added_by_agent_id, articles/social_posts.approved_by_agent_id.
--      Each insert sets details = {"backfilled": true, "source": "<table>"} and skips test-account
--      rows. The full statements are written out in the migration file.
commit;
```

Verify:

```sql
select email, role, in_rotation, active, auth_user_id is not null as linked from public.agents;
-- expect Brett: admin, true, true, true
select count(*) filter (where s.assigned_agent_id is null and s.paid_at is not null
                          and lower(u.email) not like '%@levrauto-test.invalid'
                          and lower(u.email) not like '%@levrauto.invalid') as real_unassigned,
       count(*) filter (where s.assigned_agent_id is not null
                          and lower(u.email) like '%@levrauto-test.invalid') as test_rows_touched
from public.customer_searches s join auth.users u on u.id = s.customer_id;
-- expect real_unassigned = 0, test_rows_touched = 0
select method, count(*) from public.search_assignments group by method; -- expect only backfill
```

---

## 11. Time-based signals and the agent's three jobs (revised for Q11)

### 11.1 The one 48-hour clock

The business plan's "48-hour follow-up clocks" are the **existing paid-but-not-finalized rule**, and only that:
- **Starts:** `customer_searches.paid_at`.
- **Fires:** 48h later (`OVERDUE_FOLLOW_UP_HOURS = 48`, `getOverdueFollowUpQueue`, OQ:996).
- **Cleared by:** `finalized_at` or `call_requested_at` being set (or the search leaving `awaiting_finalization`).
- **Phase 1 adds no new data.** It now has an owner: the search's `assigned_agent_id`.

### 11.2 The three jobs, and the dates and signals behind them

None of these is a clock. They are due dates or states, all computable from Phase 1 data. ★ = new in Phase 1.

| Job | Signal | Starts | Cleared by | From |
|---|---|---|---|---|
| Dealer outreach | ★ Dealer follow-up due date (default 48h, editable) | `dealer_contacts.contacted_at` → `next_follow_up_at` | a new contact for the pair, an offer from that dealer, a terminal outcome, the search closing | `dealer_contacts` where `follow_up_closed_at is null` |
| Dealer outreach | ★ Live search with no outreach yet | `solidified_at` | first `dealer_contacts` row or first offer | `customer_searches`, `dealer_contacts`, `qualifying_offers` |
| Dealer outreach | Day-30 guarantee risk | `solidified_at` (+30d) | a counting offer (`evaluateOfferGuaranteeContribution`) or `guarantee_status` resolving | existing columns |
| Dealership interaction | Accepted deal: availability / deposit | `customer_responded_at` (accepted) | `deal_progress.availability_reconfirmed_at` / `deposit_confirmed_at` | existing |
| Dealership interaction | Add-on removal waiting | `offer_addons.removal_requested_at` | `removal_resolved_at` | existing |
| Dealership interaction | Delivery estimate requested | `delivery_estimate_requested_at` | provided or unavailable | existing |
| Dealership interaction | ★ Salesperson history | `dealer_contacts.salesperson_id` | n/a | `dealer_contacts` |
| Client follow-up | **Paid, not finalized (the 48h clock)** | `paid_at` | `finalized_at` / `call_requested_at` | existing |
| Client follow-up | ★ Unanswered customer message | `last_customer_message_at` | an agent reply (`last_agent_message_at` later). "Mark reviewed" alone doesn't answer it | new columns + existing |
| Client follow-up | Unreviewed customer activity | `customer_activity_at` | `agent_reviewed_at` | existing |
| Client follow-up | Call requested | `call_requested_at` / ★ switch / ★ cancellation `*_call_requested_at` | finalized / ★ `*_call_resolved_at` | existing + new |
| Client follow-up | Offer awaiting the customer (guarantee's 24h window) | `delivered_at` | `customer_responded_at` | existing |
| Client follow-up | Paused search (30-day resume window) | `paused_at` | resumed | existing |
| Team | ★ Searches owned by an away or deactivated agent | `agent_away_periods` / `agents.active` | the period ends or the search is reassigned | new |
| Team | ★ Open alerts | `agent_alerts.created_at` | `resolved_at` | new |

- Every signal belongs to the search's `assigned_agent_id`. That gives "my work" and, for leads, "team work".
- Time limits stay as app constants in one new `src/lib/agent-clocks.ts`, replacing today's scattered copies (the review §4.3 item 1).
- Computing and ranking these into a work queue is the attention-engine phase.

### 11.3 Business plan vs current code: conflicts (revised)

1. **"48-hour follow-up clocks described below"** (`LEVR-Auto-Business-Plan-and-Roadmap.md:156`). Per Q11 this means only the existing paid-but-not-finalized rule (OQ:996); the doc never describes it. **Suggested doc fix (not made):** replace "including the 48-hour follow-up clocks described below" with "including the 48-hour paid-but-not-finalized follow-up".
2. **Dealer response standard** (Stage 1 item 6: "reply within 24–48 hours, follow up once, then mark unresponsive") is still "define". It's now covered: a 48h follow-up due date that the agent can change, plus a "mark unresponsive" prompt (Q10). Nothing in code records contacts today. The doc could be updated to say the standard is decided.
3. **Core Processes step 5** says the "System contacts matching dealers". In code, outreach is entirely manual and unrecorded. **Step 7** ("Early Notify", a regional outreach summary for customers) isn't built and has no data until `dealer_contacts` exists.
4. **Core Processes Day-30 refund:** "refunded in full, automatically, within about a week."
   - In code, the job sets `guarantee_status = 'refunded'` and emails the customer straight away (`guarantee-assessment.ts:118`).
   - No agent is told, and nothing records the refund.
   - Section 8 fixes the recording; telling the assigned agent is the attention phase.
5. **Agent continuity** (CLAUDE.md "Critical schema decisions"): `assigned_agent_id` "from day one" was never written, and it lives on the customer. It's now on the search, with continuity for a customer's later searches only while their agent is active and in rotation (Q2).
6. **"Agent dashboard: not started"** lists five sections; `/internal/outreach` now has 15 sections and 11 queues.

---

## 12. Code changes that go with the migration (ship after the tester round, Q14)

1. **`src/lib/agent-auth.ts`:** role-aware checks (section 3).
2. **`src/lib/agent-activity.ts`:** `logAgentActivity`, with the failure path of section 5.2. Called from every app-level path in 5.3.
3. **`src/lib/search-assignment.ts`:**
   - `assignSearch` (calls `assign_search`; when it returns an `alert_id`, runs the alert-email sweep straight away);
   - `sendPendingAgentAlerts()` (emails each alert's audience and stamps `agent_alerts.notified_at`; also runs hourly);
   - `assignUnassignedPaidSearches` (paginated sweep);
   - `reassignSearch` (≥ lead).
   - Wired into the webhook `search_payment` branch and the hourly solidify cron.
4. **`src/lib/agent-team-actions.ts`:** server actions wrapping the section 9 functions, each with a matching app-level role check.
5. **`src/lib/dealer-contacts.ts`:** `logDealerContact`, follow-up closing, and the unresponsive prompt rule.
6. **Writes to the new columns:**
   - `logQualifyingOffer`: `logged_by_agent_id`, `dealer_alias_id`, and closing a matching follow-up;
   - `confirmAvailability` / `confirmDepositReceived`;
   - `resolveNotificationCallback`;
   - customer message sends: `last_customer_message_at`.
7. **Refunds:** `resolveCancellation` calls `record_payment_refund`; new `recordGuaranteeRefund`.
8. **Call requests:**
   - `resolveSwitchCall` / `resolveCancellationCall`;
   - queue filters;
   - `notifyAgentsOfCallRequest` emails only the assigned agent (section 8.3).
9. **Admin table:** reads `customer_searches.assigned_agent_id`, paginated (section 7.2).
10. **Queue fixes:** callback queue predicate plus paging; consultation-queue status filter.

**Verification rules** (unchanged from how this project works):
- Every piece is checked on a disposable `claude-verify-…@levrauto-test.invalid` account and deleted by count afterwards.
- **A disposable test agent is inserted with `in_rotation = false`**, so a real or tester payment during verification can never be assigned to it.
- Lead/admin test agents go through `add_agent` with Brett as the actor, and they are deactivated, then deleted, at cleanup.
- Never tester accounts, the review account or the verification account.

---

## 13. Effects on customers and the tester round

- **Customers:** nothing visible.
  - No customer-facing copy changes and no new customer emails.
  - Payment, finalize, switch and cancellation behave as today.
  - The webhook gains one non-fatal step after deploy.
- **Running migrations now (Q14):**
  - Steps 1–9 are additive. The replaced `switch_customer_search` and `record_refund` behave the same for current callers.
  - The guard triggers only reject direct changes to `agents.role` / `in_rotation` / `active` and to `customer_searches.assigned_agent_id`, which no deployed code makes.
  - Step 10 excludes `@levrauto-test.invalid` and `@levrauto.invalid`, and its verification checks `test_rows_touched = 0`.
- **Until the code deploys:** new paid searches stay unassigned, which is harmless. The first sweep after the deploy assigns every real one (4.2). Tester searches are never auto-assigned (N7).
- **The tester watch** (read-only) isn't affected.

---

## 14. Risks and new open questions

### 14.1 Risks

| Risk | Mitigation |
|---|---|
| A replaced function loses a guard | Bodies copied verbatim from the latest migration; verification checks one overload and the activity write |
| Guard triggers block a legitimate path nobody listed | Grep for every write to `agents` and `customer_searches.assigned_agent_id` before writing the migration (today: none in `src/` for either); the seed route never sets either |
| Activity failures go unnoticed | Alert row, the `[agent-activity-failed]` log tag and a lead email; open alerts show in the lead view |
| Everyone's searches pile on Brett | Expected while he's the only person; adding an agent (in rotation by default) puts them first in line once |
| A test agent picks up real work | Test agents are always inserted with `in_rotation = false` (section 12) |

### 14.2 Open questions

None open. N1–N8 were answered on 2026-10-11 (decisions table).

**For the attention-engine phase (flagged, not Phase 1):** surfacing an away agent's items (call requests included) to leads (Q6). Showing open `assignment_no_lead` alerts to admins.

---

## 15. What changed

**Revision 3 (2026-10-11):**
- The fallback picks active leads only. With no lead, the search stays unassigned and **admins are alerted**; the system never picks an admin (N1 as corrected).
- `agent_alerts.audience` added (leads or admins); one open alert per search.
- Test accounts are never auto-assigned (`is_test_customer()`, step 0 of `assign_search`); leads can assign them by hand (N7).
- `set_agent_role` resets `in_rotation` to the new role's default unless overridden (N2). N3–N6 and N8 confirmed as proposed.
- The post-deploy sweep is confirmed in 4.2.
- The Step 1 migration file is written (`20261011130000_agent_roles_rotation.sql`).

**Revision 2:**

- **Workload is separate from roles:** new `in_rotation` with role-based defaults. Brett is admin and in rotation.
- **Away** moved from `accepting_assignments` / `away_until` columns to an approval-based `agent_away_periods` table, and is **never** an assignment filter.
- **Deactivated** (`active = false`) is the only thing that removes someone from assignment; a check makes it imply out of rotation.
- **Assignment chain:** continuity (active and in rotation) → round-robin over everyone in rotation → lead fallback with an alert. (Superseded in revision 3: admins are never picked; with no lead, admins are alerted.)
- **Activity types and refund reasons** are lookup tables (Q7, Q15). `duplicate_charge` added.
- **Activity writes** go through `log_agent_activity`, which turns a failure into an alert instead of failing the action (Q8). New `agent_alerts` table.
- **Permissions:** a table of who can do what, three enforcement layers, guard triggers and a last-admin guard. Leads can add agents; only admins grant lead or admin (Q17). Away approval rules (Q16).
- **Call-request emails** go only to the assigned agent (Q6).
- **Q11:** the only 48-hour clock is paid-but-not-finalized; dealer follow-ups are due dates. Conflicts section updated.
- **New paging rule** for all new queries, and the Phase 1 subset of the review's 1,000-row fixes (callback queue, admin table).
- **Migrations can run now; code deploys after the tester round** (Q14).
