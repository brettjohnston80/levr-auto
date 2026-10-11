# Agent dashboard review (2026-10-10)

Read-only review of the agent-side pages before the redesign. Nothing was changed: no code, migrations, commits or MarketCheck calls, and no tester data was touched. Everything below was checked against the code and the SQL in `supabase/migrations/` at HEAD `e9eb0fe`, not against CLAUDE.md. Line numbers are approximate where marked `~`.

Shorthand: **OP** = `src/app/internal/outreach/page.tsx`, **OQ** = `src/lib/outreach-queue.ts`, **OA** = `src/lib/outreach-actions.ts`, **OMA** = `src/lib/offer-message-actions.ts`.

## Summary

The agent side is one 1,152-line page (`/internal/outreach`) with 15 stacked sections, plus five smaller pages. No page links to any other; agents reach them by typing the URL. Every queue is global: nothing is assigned to an agent, and most agent writes don't record which agent did them. Most "needs attention" signals are already in the data, but nearly all are pull-only (four signals email agents), several aren't shown anywhere, and a few queues can never be cleared. Turning a dealer quote into a customer offer takes about 8–25 interactions on one form at the bottom of a long card. The offer goes live to the customer the instant it's saved, with no preview and no sanity checks.

---

## 1. Page inventory

### 1.0 What every internal page has in common

- **Auth.** `getAuthorizedAgent()` (`src/lib/agent-auth.ts:18–37`) matches the signed-in Supabase user's email against `agents.email` where `agents.active = true`. The match is case-sensitive. `requireAgent()` (`:40–52`) redirects to `/login` (signed out) or `/` (not an agent).
  - Every page calls `requireAgent()`, and every server action re-checks `getAuthorizedAgent()`.
  - There is no middleware gate on `/internal`. `src/proxy.ts` only refreshes the session.
  - `src/app/robots.ts` doesn't disallow `/internal`; the pages are only left out of `sitemap.ts`.
- **Rendering.** Every page has `export const dynamic = "force-dynamic"`. There is no `layout.tsx` or `loading.tsx` under `src/app/internal/`, so every request re-runs every query before anything paints.
- **Shell.** Internal pages render inside the customer root layout (`src/app/layout.tsx:53–59`: `DriveTransitionProvider`, `SiteHeader`, `SiteFooter`). Agents see the public marketing header and footer.
- **Navigation.** There is no internal navigation. No `<Link>` or `<a>` to an `/internal/*` page exists outside the pages themselves. The only entry points are:
  - typing the URL;
  - the agent emails from `src/lib/agent-call-notifications.ts` (links to `/internal/outreach#finalization-calls|#switch-calls|#cancellation-calls`) and `src/lib/article-reminders.ts` (links to `/internal/articles`);
  - inside outreach, `#search-<id>` anchors.
- **No pagination, search or sort controls on any page.** The only filter is the status `<select>` on `/internal/admin`.
- **Write pattern.** Server actions write through `createAdminClient()` (service role, no RLS for agents) and then call `revalidatePath("/internal/<page>")`.

### 1.1 `/internal/outreach` — the main work page

`src/app/internal/outreach/page.tsx`. Container `max-w-5xl`. Heading "Outreach Queue" and "Signed in as …".

It loads 11 queue functions in one `Promise.all` (OP:~357–385). `getIntakeMakeModelOptions()` and `getIntakeModelYearOptions()` run **before** `requireAgent()` (OP:352–356).

Sections, in render order:

| # | Line | Heading | Fed by | Components → actions | Reads / writes |
|---|---|---|---|---|---|
| 1 | 395 | Vehicle consultation needed (N) | `getVehicleConsultationQueue` (OQ:1116): `customer_searches.make IS NULL AND paid_at IS NOT NULL`, **no `search_status` filter** | `AgentUndecidedFinalizeForm` → `finalizeUndecidedSearch` (OA:971) | Writes `customer_searches` (make, model, model_year, trim, colors, required_options, pickup_travel_*, finalized_at, search_status→`pending_refinement`); starts a MarketCheck sync |
| 2 | 431 | Customer activity (N) | `getGeneralThreadActivityQueue` (OQ:1477), `getCustomerOfferActivityQueue` (OQ:1344). Both paginate; unreviewed = `customer_activity_at > agent_reviewed_at`, computed in JS | `OfferMessageList`, `OfferMessageComposer` → `sendAgentGeneralMessage` (OMA:208) / `sendAgentMessage` (OMA:124); `MarkOfferActivityReviewedButton` → `markGeneralActivityReviewed` (OMA:249) / `markOfferActivityReviewed` (OA:531) | Reads `general_threads`, `qualifying_offers`, `customer_searches` (status in searching/paused/purchased), `customers`, `offer_messages`, `zip_coordinates`. Writes `offer_messages`, `*.agent_reviewed_at` |
| 3 | 591 | Inventory blocked (only when `MODEL_YEAR_INVENTORY_BLOCK_ENABLED`, which is `false` in `src/lib/inventory-block.ts:42`) | `getInventoryBlockedQueue` (OQ:1169) | read-only | — |
| 4 | 625 | Grant extension bypass | lookup | `AgentBypassLookup` → `searchCustomers` / `getCustomerSearchesForBypass` (`src/lib/agent-bypass-lookup.ts:35/101`) → `grantExtensionBypass` (`agent-bypass-actions.ts:18`) → RPC `grant_extension_bypass` | Writes `customer_searches.search_deadline_at` and status, `agent_bypass_log` |
| 5 | 636 | Resolve a cancellation | lookup | `AgentCancellationLookup` → `AgentCancellationResolutionForm` → `getCustomerPaymentsForCancellation` / `resolveCancellation` (`agent-cancellation-actions.ts:31/100`) | RPC `cancel_search` (`customer_searches`, `cancellation_log`), Stripe `refunds.create`, RPC `record_refund` (`payments.refunded_cents`, `refunds`) |
| 6 | 647 | Revert a purchased search | lookup | `AgentRevertPurchasedLookup` → `revertPurchasedSearch` (OA:386) → RPC `revert_purchased_search` | `customer_searches`, `purchase_status_log` |
| 7 | 658 `#finalization-calls` | Finalization calls requested (N) | `getFinalizationQueue` (OQ:793): `awaiting_finalization` + `call_requested_at` set; listings per make/model via `buildTrimOptions` | `AgentFinalizeSearchForm` → `finalizeSearchByAgent` (OA:866) | Writes the legacy `customer_searches` columns only (trim, colors, required_options, finalized_at, search_status) |
| 8 | 691 `#switch-calls` | Switch calls requested (N) | `getSwitchCallQueue` (OQ:884): `switch_call_requested_at` set and `search_status <> 'switched'` | `AgentSwitchSearchForm` → `switchCustomerSearch` (`switch-actions.ts:50`) → RPC `switch_customer_search` | New and old `customer_searches` rows, `agent_bypass_log`, `customers.free_switch_used_at` |
| 9 | 721 `#cancellation-calls` | Cancellation calls requested (N) | `getCancellationCallQueue` (OQ:934): `cancellation_call_requested_at` set and status `<> 'cancelled'` | `AgentCancellationResolutionForm` | as in row 5 |
| 10 | 747 | Customer callbacks requested (N) | `getNotificationCallbackQueue` (OQ:1252), filtered to `callback_requested` | `ResolveNotificationCallbackButton` → `resolveNotificationCallback` (OA:1091) | Writes `notification_events.flag_resolved_at` |
| 11 | 775 | Notification undeliverable (N) | same queue, filtered to `no_deliverable_channel` | same | same |
| 12 | 805 | Overdue follow-ups (N) | `getOverdueFollowUpQueue` (OQ:996): `awaiting_finalization`, paid ≥48h ago, `finalized_at` and `call_requested_at` null | **no action** | read-only |
| 13 | 828 | Paused searches (N) | `getPausedSearchesQueue` (OQ:1056), days remaining in the 30-day resume window | **no action** | read-only |
| 14 | 851–889 | Delivery estimates to get (N), shown only when non-empty | derived inline from `getOutreachQueue` | `#search-` anchors only | — |
| 15 | 892 | Active searches (N) | `getOutreachQueue` (OQ:359): every `search_status='searching'` row, ordered by `created_at` | see the card breakdown below | see below |

**Each Active-search card (`id="search-{id}"`), top to bottom:**

1. Make/model/trim as an `h2`, `customers.email` (no name) and `TestBadge`.
2. The general message thread (`AgentOfferThread` with `offerId=null`).
3. Colors, ZIP and pickup range.
4. `ConfiguratorSelections` (OP:226–338), built from `search_trim_preferences`, `search_combination_preferences` and `search_option_selections`.
5. "Offers logged (N)". For each offer:
   - price, below-MSRP flag and status;
   - distance and handoff method;
   - `AgentDeliveryEstimate` → `setOfferDeliveryEstimate` (OA:1188);
   - `MarkSoldButton` → `markOfferVehicleSold` (OA:237);
   - the per-offer thread;
   - add-ons with `ResolveAddonRemovalForm` → `resolveAddonRemoval` (OA:628) and `AddOfferAddonForm` → `logOfferAddon` (OA:570);
   - for accepted offers, the closing panel: `ConfirmAvailabilityButton` (OA:691), `ConfirmDepositForm` (OA:736), the financing summary with a signed proof URL, `CheckSigningStatusButton` (OA:796), `MarkPurchasedButton` (OA:297) and `WithdrawAcceptedOfferButton` (OA:443).
6. "Matching dealers (N)" with `RefreshInventoryButton` → `refreshSearchInventory` (OA:1225).
7. `LogOfferForm` (`src/components/log-offer-form.tsx`) → `parseDealerOffer` (`src/lib/offer-parsing-actions.ts:107`) and `logQualifyingOffer` (OA:53).
8. `AgentSwitchSearchForm`.

**What `getOutreachQueue` reads:**
- `customer_searches` and `customers.email`.
- `listings` once per distinct make/model, about 15 columns including `raw_data->dealer->>street` and `raw_data->>stock_no` (OQ:386–393).
- `getLastSyncedAt`.
- `qualifying_offers`, `agents` (names for withdrawals), `offer_addons`, `deal_progress`, `documents` (financing_proof, service_agreement), with one Storage signed URL per financing proof.
- The three ranked-preference tables (these paginate).
- `offer_messages` (paginated) and `zip_coordinates` (chunked by 200).

**Volume and correctness risks on this page:**
- It loads every searching search in full on every request. Every card also gets **every listing for its make/model** serialized into the client `LogOfferForm` (OQ:739–754). Cost grows with searches × listings.
- Unpaginated selects can hit PostgREST's silent 1,000-row cap: `listings` per make/model (OQ:386–393, and again in `getFinalizationQueue` at OQ:819–828), `qualifying_offers`, `offer_addons`, `deal_progress`, `documents`. The `.in()` lists aren't chunked.
- **`getNotificationCallbackQueue` reads every `notification_events` row with `flag_resolved_at IS NULL`** (OQ:1255–1259), oldest first and unpaginated, then filters for callbacks in JS (OQ:1265). Only flagged rows ever get `flag_resolved_at`, so ordinary events stay "unresolved" forever. Once the table passes 1,000 rows, **new callback requests silently drop off the page.** The right partial index already exists (`20260824120000_notification_events.sql:~84`); the query just doesn't use the predicate.

### 1.2 `/internal/admin`

- `src/app/internal/admin/page.tsx` (33 lines), `max-w-6xl`. It renders `AdminSearchesTable` (`src/components/admin-searches-table.tsx`, client component).
- Filters client-side by status, plus a synthetic "Unpaid (checkout not completed)" option. "All" hides unpaid rows (`:54–59`).
- **Data:** `getAdminSearches()` (`src/lib/admin-actions.ts:39–117`):
  - `customer_searches` (id, customer_id, make, model, search_status, paid_at, search_deadline_at, paused_at), unpaginated;
  - `customers` (email, first_name, last_name, assigned_agent_id);
  - `agents`;
  - `auth.admin.listUsers({page:1, perPage:1000})`, a single page.
- **Read-only.** The Pause/Resume buttons were removed (comment at `admin-searches-table.tsx:41–49`). The `admin_pause_search` / `admin_resume_search` RPCs remain but have no callers.
- The "Deadline" column shows raw `search_deadline_at`, which is NULL until a first extension. The real deadline (`effectiveDeadline()` in `src/lib/day60-extension.ts`) is never shown.

### 1.3 `/internal/dealerships`

- `src/app/internal/dealerships/page.tsx`. Two sections:
  - **Unconfirmed dealer identities:** `UnconfirmedAliasQueue` → `confirmAliasAsNewDealership` (RPC `confirm_dealer_alias_as_new`) and `mergeAliasIntoDealership` (`src/lib/dealership-actions.ts:19/58`).
  - **Dealerships:** `DealershipsList` → `DealershipCard` → `addSalesperson` / `updateSalesperson` / `removeSalesperson` (`:92/128/157`).
- Reads `dealer_aliases`, `dealerships`, `dealership_salespeople`, `listings`. Writes `dealerships`, `dealer_aliases` (dealership_id, confirmed_at, confirmed_by_agent_id), `dealership_salespeople`.
- **Listing counts are computed from an unfiltered, unpaginated `listings` select** (`src/lib/dealership-queue.ts:16–31`). With more than 1,000 listings, every count and the "highest impact first" order come from an arbitrary 1,000 rows.

### 1.4 `/internal/articles`

- `getDraftArticles()` (`src/lib/article-queue.ts:24`, `articles.status='draft'`) → one `ArticleReviewForm` per draft.
- Actions (`src/lib/article-actions.ts`): `updateArticleDraft` (25), `approveArticle` (72), `regenerateArticleDraft` (135), `attachArticleImage` (163; Storage `social-post-images`, `articles.image_storage_path`).
- A database error shows as "No drafts awaiting review" (`article-queue.ts:34`).

### 1.5 `/internal/social`

- **Drafts:** `getDraftSocialPosts` (`src/lib/social-queue.ts:25`) → `SocialPostReviewForm` → `updateSocialPostDraft` / `approveSocialPost` / `regenerateSocialPost` / `attachSocialPostImage` (`src/lib/social-actions.ts:21/58/102/125`).
- **"Ready to post":** `getPostingWorklist` (`social-queue.ts:82–132`) → `markPlatformPosted` (`social-actions.ts:161` → `social-posting.ts:37`). It reads every approved and published `social_posts` and `articles` row, unpaginated, and grows forever.
- A database error shows as an empty list.

### 1.6 `/internal/refunds-due`

- `getRefundsDueQueue` (`src/lib/refunds-due.ts:26`): `customer_searches.guarantee_status='refunded'` minus `getTestCustomerIds()`, joined to `customers`.
- Read-only inline table: no processed state, no amount, no PaymentIntent, no link to `payments` or `refunds`. Rows never leave the list.

### 1.7 Agent-only API routes

All are gated by `Authorization: Bearer $CRON_SECRET`; none by agent session.

- `POST /api/internal/sync-listings` → `syncListingsForMakeModel` (writes `listings`, `dealer_aliases`).
- `POST /api/internal/import-vehicle-dataset` (writes `vehicle_dataset_batches`, `vehicles`; optional promote).
- `POST /api/internal/import-configurator` (writes `configurator_batches`, `configurator_trims`, `configurator_options`; no promote).
- `POST /api/internal/seed-test-state` (test-suffix emails only; 403 in production unless `ALLOW_TEST_SEEDING`).
- 14 `/api/cron/*` routes, matching `vercel.json` one-to-one.

---

## 2. Agent workflow trace

| Step | What happens in code | Agent page / action | Tables written | Notifications | Manual steps |
|---|---|---|---|---|---|
| **a1. Unpaid search** | `saveIntakeSearch` / `saveUndecidedIntakeSearch` / `updateUnpaidSearch` (`src/lib/intake-actions.ts:40/68/77`) → `saveUnpaidSearch` (`src/lib/unpaid-search.ts:147`) | Visible only in `/internal/admin` under the "Unpaid" filter | `customer_searches` | Customer reminders (`unpaid-reminders.ts:109`), off until `REMINDER_MAILING_ADDRESS` is set | None possible (no agent action exists) |
| **a2. Payment** | `createCheckoutSession` (`payment-actions.ts:14`) → Stripe → webhook (`src/app/api/stripe/webhook/route.ts:47–137`) | none | `customer_searches.paid_at`, `stripe_checkout_session_id`; `payments` (`search_fee`) via `recordPayment`; MarketCheck sync (`route.ts:127`) | **No agent notification** | — |
| **a3. Undecided paid search** | `make IS NULL` | OP §1 → `finalizeUndecidedSearch` (OA:971–1077) | `customer_searches` | none | Agent must call the customer; nothing records the call |
| **a4. Finalize** | Self-service: `finalizeSelfService` (`src/lib/finalize-actions.ts:1178`) writes `search_trim_preferences`, `search_option_selections`, `search_combination_preferences`, then `customer_searches` (1236–1253). Call request: `requestFinalizationCall` (92–130) stamps `call_requested_at` | OP §7 → `AgentFinalizeSearchForm` → `finalizeSearchByAgent` (OA:866–954) | Agent path writes **only** the legacy `trim`/`colors`/`required_options` and **no ranked preferences**, and no agent id | Call request emails every active agent (`notifyAgentsOfCallRequest`, `agent-call-notifications.ts:100`) | Agent places the call. There is no claim, scheduling or "called" record |
| **a5. Overdue** | 48h after `paid_at`, still unfinalized | OP §12, **no action** | — | none | Agent must notice it and follow up off-system; the row stays until the customer finalizes or requests a call |
| **a6. Solidify** | Hourly cron → `solidifySearch` (`src/lib/search-solidification.ts:52–67`) once `finalized_at` is >24h old | Search appears in OP §15 | `solidified_at`, `search_status='searching'` | none | — |
| **a7. Tester instant start** | `startTesterSearchNow` (`src/lib/tester-sample-offers.ts:50–68`), from `finalize-actions.ts:1267` | — | Solidifies and inserts 3 `qualifying_offers` with `notes = SAMPLE_OFFER_NOTE` | `offer_logged` | — |
| **b. Dealer outreach** | `getOutreachQueue` lists dealers from `listings`, **grouped by `dealer_name` only** (OQ:700–722), in-range first, then by listing count (OQ:730) | OP §15 "Matching dealers" shows name, phone, city/state, count, distance, "within range". The `dealership_salespeople` roster and website are not shown | **Nothing.** There is no outreach log anywhere in the schema | none | **Every dealer contact is manual and unrecorded**: who was called, when, the result and the next follow-up all live in the agent's head |
| **c. Offer entry** | `logQualifyingOffer` (OA:53–221); details in §3 | OP §15 `LogOfferForm` | `qualifying_offers` (no agent column), `offer_addons`, `documents` (`offer_sheet`) + Storage | `logNotificationEvent('offer_logged')` → **immediate** highlight email to a real-time customer | Later per-offer actions: add-ons, delivery estimate, mark sold |
| **d. Customer messages** | `sendCustomerMessage` (OMA:57) / `sendCustomerGeneralMessage` (OMA:174) write `offer_messages` and bump `customer_activity_at` on `qualifying_offers` / `general_threads` | OP §2 Customer activity; replies via `sendAgentMessage` / `sendAgentGeneralMessage` (store `author_agent_id`) | `offer_messages`, `*.last_message_at`, `*.agent_reviewed_at` | **No agent email.** Customers get a daily digest of unread agent replies (`notification-digest.ts`) | Agent must check the page. "Mark reviewed" clears the item without a reply |
| **e. Offer accepted** | `respondToOffer` (`src/lib/offer-response-actions.ts:40–149`), with partial unique index `qualifying_offers_one_accepted_per_search_idx`. **Accepts don't bump `customer_activity_at`** (:104–106) | Only the green "Accepted — closing this deal" panel inside the card | `qualifying_offers.status`, `customer_responded_at`, `handoff_method` | `offer_response_recorded` (customer digest only); nothing to agents | Agent must spot the panel |
| **e2. Closing** | `confirmAvailability` (OA:691), `confirmDepositReceived` (OA:736), customer `submitFinancingChoice` (`deal-progress-actions.ts:23`), e-sign `startServiceAgreementSigning` / `checkServiceAgreementSigningStatus` (OA:796) | Closing panel | `deal_progress` (no agent column), `documents` | `deal_progress_update` → customer highlight email | All manual: call the dealer, confirm the deposit, remember to click "Check signing status" (the PandaDoc webhook is off; the key is sandbox-only) |
| **f. Release** | "Release" = `withdrawAcceptedOffer` (OA:443–517): accepted offers only, reason required | "Deal fell through?" button | `status='withdrawn'`, `withdrawn_at`, `withdrawn_by_agent_id`, `withdrawal_reason` (check constraint `qualifying_offers_withdrawn_requires_metadata`) | `offer_withdrawn` → customer email | Known race with `markSearchPurchased` (OA:439–442 comment) |
| **g. Purchase** | `markSearchPurchased` (OA:297–372) requires `deal_progress.availability_reconfirmed_at` and `deposit_confirmed_at`, guarded `search_status='searching'`. Revert: RPC `revert_purchased_search` | Button in the closing panel; revert only via the OP §6 lookup (purchased searches have no card) | `purchased_at`, `purchased_qualifying_offer_id`; `purchase_status_log` (agent_id; insert not atomic) | `search_purchased` → customer email | — |
| **h. Survey** | Daily cron `sendPostDealSurveys` (`src/lib/post-deal-survey.ts:77`), 2 days after purchase; customer `submitPostDealSurvey` (`survey-actions.ts:32`) | **No agent view** | `post_deal_surveys` (has `agent_recommend` / `agent_comment` but **no `agent_id`**) | Customer email | Nobody sees the results |
| **Switch** | Customer: `executeFreeSwitch` (`switch-self-service-actions.ts:165`), `createSwitchFeeCheckoutSession` (250) → webhook `handleSwitchFeePayment`; call: `requestSwitchCall` (88) | OP §8 or per-card `AgentSwitchSearchForm` | RPC `switch_customer_search` + `agent_bypass_log` | Call request → agent email | `switch_call_requested_at` is **never cleared**, so a customer who decides not to switch stays in the queue forever |
| **Cancellation** | Customer `cancelSearch` (`cancellation-actions.ts:66`), call `requestCancellationCall` (90) | OP §5/§9 → `resolveCancellation` | `cancellation_log`, `refunds` (agent_id) | Call request → agent email | Same never-cleared problem with `cancellation_call_requested_at` |
| **Day 30** | Cron `assessSearch` (`src/lib/guarantee-assessment.ts:75`) sets `guarantee_status` met/refunded and logs `guarantee_resolved` | `/internal/refunds-due` (read-only) | `customer_searches.guarantee_status`, `guarantee_resolved_at` | The customer is emailed immediately that the $699 is being refunded; **no agent is told** | Refund must be done in the Stripe dashboard. **It can't be recorded in the app**: `refunds.cancellation_log_id` is `NOT NULL` (`20260818120000_cancellation_purchased_payments.sql:138`), and `payments.refunded_cents` won't update |
| **Day 60** | Crons `sendDay60Reminders`, `pauseOverdueSearches`, `sendResumeReminders` (`day60-extension.ts:59/332/391`) | OP §13 (no action); OP §4 bypass lookup | `search_status='paused'`, `paused_at`; `agent_bypass_log` | Customer emails | A failed auto-renew charge is only `console.error`'d |

**What reaches an agent by email today:** only the three call-request types (`agent-call-notifications.ts`, `CallRequestType = "finalization" | "switch" | "cancellation"`) and article reminders (`article-reminders.ts:103`). Both go to **every active agent**.

Nothing reaches an agent for:
- payment;
- undecided searches;
- solidification;
- customer messages, highlights, accepts or declines;
- add-on removal requests;
- financing submissions or signing;
- refunds due;
- pauses.

---

## 3. Offer entry deep dive

The single path is `LogOfferForm` (`src/components/log-offer-form.tsx`) → `logQualifyingOffer` (OA:53–221), at the bottom of the search's card on `/internal/outreach`.

### 3.1 Steps, best case (dealer quote for a car in synced inventory)

| # | Action | Interactions | Page change? |
|---|---|---|---|
| 1 | Open `/internal/outreach` (URL or bookmark; no nav) | 1 load | yes (full page) |
| 2 | Find the search: scroll past up to 14 sections, then down the card past the general thread, build preferences, every logged offer and the dealer list. **There is no search box and no per-search URL** other than the `#search-<id>` anchor | scrolling | no |
| 3 | Click "+ Log an offer" (`:193–199`) | 1 click | in place |
| 4 | *(optional)* AI parse: choose Paste text / Upload PDF (`:208–223`), paste or pick the file, click "Parse with AI" (`:243–250`, Claude call). It fills **only** dealer name, dealer contact, offer price and add-ons (`:131–137`). MSRP is never parsed | 2–3 | no (server action) |
| 5 | Choose the dealer's listing in "Link the dealer's listing" (`:265–277`). This is **one `<select>` holding every listing nationwide for that make/model**: unsorted, unfiltered by trim, year, colour or distance, labelled `year trim color — dealer — price`. Choosing one fills 12 fields (`handleListingSelect`, `:69–86`): dealer name, contact (from `listings.dealer_phone`), price, MSRP, trim, colour, street, city, state, ZIP, VIN, stock # | 2 clicks + scanning up to hundreds of options | no |
| 6 | Overwrite **Offer price** with the dealer's actual quote (the listing price is the advertised price) | 1 click + typing | no |
| 7 | Check **MSRP**: required, and must be the Monroney total. It's pre-filled only when `listings.msrp_cents` is set | 0–1 + typing | no |
| 8 | **Delivery estimate**: 4 radios (`:445–462`), plus a fee and note when "Dealer's delivery fee" is picked. Whether it's required (dealer beyond range, or customer prefers delivery) is only checked **on the server after Save** (OA:127–142). The form doesn't show the distance or the rule up front | 0–3 | no |
| 9 | Add-ons: "+ Add line" plus description and amount for each line (`:402–435`) | 3 per add-on | no |
| 10 | Notes (internal) | 0–1 | no |
| 11 | Click **Save offer** | 1 | no; `revalidatePath` re-renders the whole page |

- **Best case:** about **8 interactions** (open form, select listing ×2, edit price, choose delivery radio, save, plus scrolling), assuming no AI parse, MSRP present and no add-ons.
- **Typical case with AI parse, one add-on and a delivery fee:** about **15–18**.
- **Off-lot dealer (no listing):** all 12 dealer/vehicle fields are typed by hand: name, contact, price, MSRP, trim, colour, street, city, ST, ZIP, VIN, stock #. That's about **20–25 interactions**.
- **Form size:** 1 listing select + 12 text fields + 4 delivery radios (+ fee + note) + 2 per add-on + notes. The AI block adds 2 radios + a textarea or file input.

### 3.2 What "published" means

There is no draft or review state. The moment Save succeeds:
- the `qualifying_offers` row exists with `status='pending'`;
- `logNotificationEvent('offer_logged')` (OA:171) sends a real-time customer the new-offer email immediately;
- the offer appears on the customer's Your Deal page. `delivered_at` is stamped when the customer next loads their dashboard (`src/lib/customer-dashboard.ts:322–329`), which starts the guarantee's 24h response window.

Insert, notification, add-ons and PDF are four separate writes (OA:144–217). If add-ons or the PDF fail, **the offer is already live and the customer already emailed** ("Offer saved, but add-ons failed…").

### 3.3 Gaps in the current flow

- **Order of operations overwrites data.** `handleListingSelect` overwrites dealer name, contact and price unconditionally (`:73–75`), and a parse overwrites the same three (`:132–134`). Parse-then-select discards the parsed quote price; select-then-parse keeps the listing's address and VIN but swaps in the parsed name.
- **No sanity checks before going live:**
  - no warning when the price is above MSRP (open follow-up 5);
  - no duplicate check (same dealer or VIN already logged on this search);
  - no check that the search is still `searching`: `logQualifyingOffer` only confirms the search exists (OA:114–122), so a stale tab can log onto a purchased, cancelled or switched search;
  - no customer-name confirmation (cards show only email; open follow-up 6).
- **No agent attribution:** `qualifying_offers` has no logged-by column.
- **Delivery rule found late:** the delivery requirement is discovered only through a failed save, which costs an extra round trip.
- **No preview** of what the customer will see.

### 3.4 Fields that could be prefilled or derived

| Field | Possible source |
|---|---|
| Dealer name / identity | `dealer_aliases` → `dealerships` via `listings.mc_dealer_id` (already captured), instead of raw `listings.dealer_name` |
| Dealer contact | `dealership_salespeople` (name/phone/email roster on `/internal/dealerships`, never offered in the form) |
| Listing choice | Narrow the select to the search's committed `model_year`, ranked `search_trim_preferences`, `search_option_selections` colours, and dealers within `pickup_travel_miles` (distance is already computed for the dealer list); sort by match quality |
| Trim / colour / year | From the listing, or VIN-decoded (no VIN decode exists in `src/`; a MarketCheck NeoVIN decode exists but would spend API calls) |
| MSRP | `listings.msrp_cents` (already used when present); the configurator's priced build could estimate a cross-check |
| Delivery requirement | Compute client-side from the dealer ZIP vs `customer_searches.zip` + `pickup_travel_*` (the same `deliveryEstimateStandard` logic) and show it before Save |
| Address / VIN / stock | Already from the listing; for off-lot dealers, from `dealerships` (city/state) |
| Add-ons | AI parse already fills these |
| Offer price | AI parse, or a one-field "quoted price" when starting from a listing |
| Search | Starting from a dealer row ("Log offer for this dealer") would pre-select that dealer's listings |

---

## 4. Attention signals

### 4.1 Signals the existing data already supports

"Pull" means the agent has to go and look; nothing tells them.

| # | Signal | Source / condition | When it matters | Shown to agents today | Agent alerted? |
|---|---|---|---|---|---|
| 1 | Unpaid search | `customer_searches.paid_at IS NULL`; `unpaid_reminder_1/2_sent_at` | 24h–7d | `/internal/admin` "Unpaid" filter only; "unpaid" badge on general-thread activity (OQ:1499–1520) | No |
| 2 | Paid, unfinalized ≥48h | `getOverdueFollowUpQueue` (OQ:996) | 48h after `paid_at` | OP §12, no action. Undecided searches also match and render a blank title (`{null} {null}`, OP:~817) | No |
| 3 | Finalization call requested | `call_requested_at` (OQ:793) | Immediate | OP §7 | **Email, every agent** |
| 4 | Switch call requested | `switch_call_requested_at` (OQ:884) | Immediate | OP §8 (never clears) | **Email** |
| 5 | Cancellation call requested | `cancellation_call_requested_at` (OQ:934) | Immediate | OP §9 (never clears) | **Email** |
| 6 | Vehicle consultation | `make IS NULL AND paid_at IS NOT NULL` (OQ:1116) | Blocking | OP §1 (also lists cancelled ones) | No |
| 7 | Inventory blocked | `computeInventoryBlock` (OQ:1169) | Blocks finalize | OP §3, flag off | No |
| 8 | 24h change window open | `search_status='pending_refinement'`, `finalized_at + 24h` | Goes live within ~1h after | **Not on OP**; raw status in admin | No |
| 9 | Day-30 guarantee, no counting offer yet | `solidified_at + 30d`, `guarantee_status='pending'`, `evaluateOfferGuaranteeContribution` (`src/lib/guarantee.ts`) | Countdown | **Not shown anywhere to agents.** `getOutreachQueue` doesn't select `solidified_at` / `guarantee_status`; the countdown exists customer-side only (`guarantee-timeline.ts`) | No |
| 10 | Below-SRP offer not yet delivered | `is_below_msrp AND delivered_at IS NULL` | An offer the customer never views never counts | **Not shown** (loaded at OQ:~401, never rendered) | No |
| 11 | Offer awaiting customer response | `status='pending'`, `delivered_at + 24h` | 24h window | Status word only | No |
| 12 | Sold before response | `vehicle_sold_at` | Guarantee edge case | Inline note | No |
| 13 | Customer declined | `status='customer_declined'` (bumps `customer_activity_at`) | — | OP §2 | No |
| 14 | Customer accepted | `status='customer_accepted'` (**doesn't** bump activity) | Starts closing | Inline green panel only | No |
| 15 | Highlight / handoff change / customer delivery-estimate request | `customer_highlighted_at`, `handoff_method_set_at`, `delivery_estimate_requested_by='customer'` | Immediate | OP §2 | No |
| 16 | Unanswered offer-thread message | `offer_messages` (customer) newer than `qualifying_offers.agent_reviewed_at` | Immediate | OP §2 with composer. No "answered" state: Mark reviewed = reply | No |
| 17 | Unanswered general message | `general_threads.customer_activity_at > agent_reviewed_at` | Immediate | OP §2 and inline on the card | No |
| 18 | Agent reply unread by customer | `last_agent_message_at > customer_messages_read_at` | Feeds the customer digest | Not shown | — |
| 19 | Add-on removal requested | `offer_addons.removal_status='pending'` (no activity bump) | Needs a dealer call | Inline form on the card only; invisible for paused or purchased searches | No |
| 20 | Customer callback requested | `notification_events.agent_callback_requested_at`, `flag_resolved_at IS NULL` | Immediate | OP §10 (subject to the 1,000-row bug) | No |
| 21 | Notification undeliverable | `flagged_no_deliverable_channel` | Immediate | OP §11 | No |
| 22–26 | Accepted offer missing availability / deposit / financing / handoff / signed agreement | `deal_progress.availability_reconfirmed_at`, `deposit_confirmed_at`, `financing_choice`; `qualifying_offers.handoff_method`; `documents` `service_agreement.signed_at` | Availability and deposit block purchase | Inline in the closing panel only | No |
| 27 | Delivery estimate to get | `delivery_estimate_status='requested'`, or standard with none | Before acceptance | OP §14 | No |
| 28 | Paused / resume window | `paused_at + 30d` | Countdown | OP §13, no action | No |
| 29 | Day-60 deadline approaching | `coalesce(search_deadline_at, solidified_at + 60d)`, 7-day window | 7 days before | **Not shown.** Admin "Deadline" shows raw `search_deadline_at` ("—") | No |
| 30 | Auto-renew on / charge failed | `auto_renew_enabled`; failure only in logs | At deadline | Not shown | No |
| 31 | Survey pending / not sent | `post_deal_surveys.sent_at` / `submitted_at` | After purchase | Not shown | No |
| 32 | Low survey ratings | `levr_overall_rating`, `dealership_*_rating`, `agent_recommend=false`, `agent_comment` | After submission | **Not shown anywhere** | No |
| 33 | Refund due | `guarantee_status='refunded'` | Once resolved | `/internal/refunds-due` (never clears) | No |
| 34 | Unconfirmed dealer alias | `dealer_aliases.dealership_id IS NULL` | Anytime | `/internal/dealerships` | No |
| 35 | Stale inventory | newest `listings.synced_at` per make/model | Informational | "Inventory last refreshed" line; no stale highlight | No |
| 36 | No inventory synced | dealer list empty | Outreach impossible | Inline | No |
| 37 | Searching with zero / no recent offers | `qualifying_offers` count, `received_at` | Day-30 risk | Implicit only (no offers block) | No |
| 38 | Released offer | `status='withdrawn'` | — | Inline | No |
| 39 | Article draft due | `articles.status='draft'`, `reminder_last_threshold_days` | Before the month | `/internal/articles` | **Email** |
| 40–41 | Social drafts / posts due | `social_posts.status='draft'`; `getPostingWorklist` | Weekly / scheduled | `/internal/social` | No |

### 4.2 Signals that would need new data

| Signal | Missing today | Suggested shape |
|---|---|---|
| Dealer contact attempts / follow-up due | No outreach record at all | `dealer_contacts(id, search_id, dealership_id / dealer_alias_id, agent_id, channel, outcome, notes, contacted_at, follow_up_due_at)` |
| Last agent touch per search | Only per-offer/thread timestamps | `customer_searches.last_agent_action_at`, or an `agent_activity_log(search_id, agent_id, action, at)` |
| Assignment / ownership | `customers.assigned_agent_id` exists with zero writers | Search-level assignment with history: `search_assignments(search_id, agent_id, assigned_at, unassigned_at, assigned_by)` |
| Per-agent read state | `agent_reviewed_at` is one shared value | `agent_thread_reads(agent_id, offer_id / customer_id, read_at)` |
| Answered vs merely reviewed | Mark reviewed and reply clear the same flag | `agent_replied_at`, or compare the last customer message time with `last_agent_message_at` |
| SLA / due-by | All ages computed ad hoc | Per-signal SLA constants, or a generic `work_items(kind, ref_id, opened_at, due_at, resolved_at, resolved_by)` |
| Call request resolved / dismissed | `switch_` / `cancellation_call_requested_at` never cleared | `*_call_resolved_at`, `*_resolved_by`, `*_outcome` |
| Pending paid switch (abandoned checkout) | `pending_switch_make` / `model`, `switch_requested_at` have **no writers** | Write them at checkout creation, or a `switch_requests` table |
| Auto-renew failures | Logs only | `payment_attempts(search_id, kind, stripe_pi_id, status, error, at)` |
| Day-30 refund processed | No processed marker; `refunds` needs a `cancellation_log_id` | `guarantee_refund_processed_at` / `_by`, or a nullable `refunds.cancellation_log_id` |
| Dealer response time | No outreach start time | Derive from `dealer_contacts` |
| Listing sold / gone | The sync only upserts | `listings.last_seen_at` / `removed_at` |
| Deal-step due dates | None on `deal_progress` | `deal_progress.next_step_due_at` |
| Survey triage | None | `post_deal_surveys.agent_reviewed_at`, `followup_notes`, plus a subject `agent_id` |

### 4.3 Inconsistent or duplicated computations

1. **24h window defined three times.** `EDIT_WINDOW_MS` (`src/lib/edit-window.ts:3`), `TWENTY_FOUR_HOURS_MS` (`search-solidification.ts:4`) and `GUARANTEE_RESPONSE_WINDOW_MS` (`guarantee.ts`). The 30 and 60 day constants are each defined twice (`guarantee-assessment.ts:7` vs `guarantee-timeline.ts:9`; `day60-extension.ts:8` vs `guarantee-timeline.ts:10`). The customer timeline's Day-60 marker ignores extensions.
2. **The deadline is shown two different ways:** raw `search_deadline_at` on admin, `effectiveDeadline()` everywhere else.
3. **"Delivery estimate needed" differs between customer and agent.** The agent side (`deliveryEstimateStandard`, OQ:~690) ignores the offer's own `handoff_method='delivery'`, while the customer side honours it. An in-range offer where the customer chose delivery shows "estimate pending" to the customer but never reaches the agent's list.
4. **Undecided searches appear twice** (§1 and §12).
5. **Test detection uses three sources:**
   - outreach: `isTestEmail(customers.email)`;
   - admin: `auth.users`;
   - refunds-due: `getTestCustomerIds()`.
6. **"Unpaid" is defined three ways:** `admin-searches-table.tsx:13`, OQ:1499–1520, `unpaid-reminders.ts`.
7. **Dealer grouping differs:** outreach groups by `dealer_name`, dealerships by `dealerIdentityKey(name, city, state)`.
8. **"Customer activity" is inconsistent.** Declines, highlights, handoff changes, delivery requests and messages bump it; accepts, add-on removal requests and financing submissions don't.

---

## 5. Team readiness

### 5.1 Identification and authorization

- **Identification.** An agent is a row in `agents` (`id, name, email unique, phone, active, created_at`; `20260807230209_initial_schema.sql:16–23`), matched to the signed-in user by email (case-sensitive). The auth trigger also creates a `customers` row for every agent.
- **No roles.** No `role` column exists anywhere. Every active agent can do everything, including Stripe refunds, fee bypasses, purchase reverts and content approval.
- **Server checks.** Every agent-facing server action I checked re-verifies `getAuthorizedAgent()`: all 16 exports in OA, the agent functions in OMA, `switch-actions`, `agent-cancellation-actions`, `agent-bypass-actions` / `-lookup`, `admin-actions`, `dealership-actions` / `-queue` (a `"use server"` file), `article-actions`, `social-actions`, `offer-parsing-actions`.
  - The queue loaders in OQ and `refunds-due.ts` have no check, but they aren't `"use server"`, so they can't be called from the browser. This stays safe only while that's true.
- **No RLS for agents.** All agent data access is service-role, so authorization lives only in application code.

### 5.2 Assignment

- `customers.assigned_agent_id` (`initial_schema.sql:40`, commented "set from day one") has **zero writers** in `src/` or migrations.
- Its only reader is `getAdminSearches` (`admin-actions.ts:62–101`), so the "Assigned agent" column is always blank.
- There is no search-level assignment, claim, lock, "my work" view or handoff record. Every OQ query is global.

### 5.3 Attribution per agent action

| Action | Where it's stored | Agent recorded? |
|---|---|---|
| Log offer | `qualifying_offers` | ❌ |
| Add add-on / resolve removal | `offer_addons` | ❌ |
| Offer-sheet PDF | `documents` | ❌ |
| Mark vehicle sold | `qualifying_offers.vehicle_sold_at` | ❌ |
| Delivery estimate | `delivery_estimate_requested_by='agent'` | ⚠ role only, not which agent |
| Release accepted offer | `withdrawn_by_agent_id` | ✅ |
| Mark activity reviewed | `agent_reviewed_at` (shared) | ❌ |
| Send message | `offer_messages.author_agent_id` | ✅ |
| Confirm availability / deposit | `deal_progress` | ❌ |
| Check signing status | `documents.signed_at` | ❌ |
| Agent finalize / undecided finalize | `customer_searches` | ❌ (looks the same as self-service) |
| Refresh inventory | nothing | ❌ |
| Mark purchased / revert | `purchase_status_log.agent_id` | ✅ (mark's log insert isn't atomic) |
| Switch / extension bypass | `agent_bypass_log` | ✅ |
| Cancellation / refund | `cancellation_log.agent_id`, `refunds.agent_id` | ✅ |
| Resolve callback flag | `notification_events.flag_resolved_at` | ❌ |
| Confirm / merge dealer alias | `dealer_aliases.confirmed_by_agent_id` | ✅ |
| Add / edit / remove salesperson | `dealership_salespeople.added_by_agent_id` | ✅ add only |
| Approve article / social post | `approved_by_agent_id` | ✅ (edits, regenerate and mark-posted ❌) |
| Dealer contact | no table | ❌ |
| Survey agent feedback | `post_deal_surveys` | ❌ (no subject agent) |

### 5.4 What's missing for several agents plus a lead view

1. **Roles and permissions:** `agents.role` (agent / lead / admin), with money and irreversible actions (refunds, bypasses, revert, content approval) restricted to the right roles.
2. **Assignment:** a writer for assignment (at payment, or by claim), search-level ownership, reassignment and handoff history.
3. **Per-agent queues:** "my work" filters across every queue.
4. **Lead workload view:** needs attribution columns first (logged-by on offers and add-ons, `*_by_agent_id` on `deal_progress`, reviewer and resolver ids). Today almost nothing can be counted per agent.
5. **Outreach log and follow-up tasks:** see 4.2.
6. **Concurrency:**
   - Writes mostly use optimistic guards (`.eq(status)` / `.is(null)`), and some RPCs row-lock (`revert_purchased_search`, `switch_customer_search`, `cancel_search`, `record_refund`).
   - Still missing: a guard against duplicate offers, a "someone is working this" marker, and protection for the release-vs-purchase race.
   - The shared `agent_reviewed_at` hides items from everyone once one agent marks them.
7. **Notification routing:** call-request emails go to every active agent. They should route to the assigned agent and escalate to a lead. Most customer events reach no agent at all.
8. **Resolution states:**
   - switch and cancellation call requests can't be dismissed;
   - the overdue and paused sections have no action;
   - consultation keeps cancelled searches;
   - refunds-due never clears and can't record a Day-30 refund.
9. **Customer identity on cards:** most cards show email only, no name.

---

## 6. Design and UI state

### 6.1 Styling and components

- **Tailwind CSS v4 only** (`src/app/globals.css`, `@import "tailwindcss"`). No component library: `package.json` has no shadcn, Radix, cva, clsx or tailwind-merge, and there's no `src/components/ui/`.
- **No shared internal primitives.** Buttons, inputs, cards and badges are hand-written in each of ~100 flat files in `src/components/`.
  - `TestBadge` exists twice with different text: OP:112–119 ("Test account") and inline in `admin-searches-table.tsx:105–109` ("Test").
  - Global button press `scale(0.97)` and touch-input 16px rules from `globals.css` apply to internal pages too.
- **Conventions:**

  | Element | Classes |
  |---|---|
  | Page | `section.min-h-screen.bg-zinc-950.py-16` + `mx-auto max-w-{4xl\|5xl\|6xl} px-6` (outreach 5xl; admin and dealerships 6xl; articles, social and refunds 4xl) |
  | `h1` | `text-2xl font-semibold text-white` |
  | `h2` | `text-lg font-semibold` |
  | Card | `rounded-2xl border border-white/10 bg-white/[0.03] p-6` |
  | Body | `text-sm text-zinc-400/500` |
  | Inputs | `rounded-md border-white/10 bg-zinc-900 px-3 py-2 text-sm` |

  - At least three button styles: small bordered `text-xs` (e.g. `mark-sold-button.tsx:27`), `rounded-lg border-white/20 px-3 py-1.5`, and underlined emerald text links.
  - Colour meaning is ad hoc: emerald = good/accepted, amber = warning/test/unconfirmed, red = declined/error.
  - Tables (admin, refunds) scroll horizontally, with no sticky header and no sort.

### 6.2 Compared with the customer site

- **Same parts.** Same dark zinc/emerald palette and the same root layout with the public `SiteHeader` / `SiteFooter`.
- **Customer pages** use a larger centred scale (`py-24`, `max-w-2xl`, `text-3xl`, solid `bg-emerald-500` CTAs).
- **Internal pages** are that same look, smaller and longer. There's no density treatment, sidebar, ops header, agent identity bar or keyboard support.
- **Responsiveness.** `outreach/page.tsx` has 0 `sm:` / `md:` / `lg:` breakpoints and `admin-searches-table.tsx` has 0; `log-offer-form.tsx` uses a fixed `grid-cols-2`. The `max-w` caps waste most of a desktop screen.

### 6.3 Accessibility gaps

- Form `<label>`s have no `htmlFor` and inputs no `id` across internal forms. Counts (labels / associated): `log-offer-form` 12/0, `agent-undecided-finalize-form` 6/0, `agent-switch-search-form` 5/0, `article-review-form` 5/0, `social-post-review-form` 4/0. Radios wrapped in their label are fine.
- `aria-*` appears only in `agent-offer-thread.tsx` and `offer-message-composer.tsx`. There are no live regions for busy or error states.
- Heading order is broken on outreach: active cards use `h2` (OP:906) under the section `h2` (OP:893), while other queues use `h3`.

### 6.4 Bugs and dead code found (not fixed)

1. **Callback queue drops new requests past 1,000 `notification_events` rows** (OQ:1255–1265).
2. **Dealership listing counts and order are wrong past 1,000 listings** (`dealership-queue.ts:16–31`).
3. **Unpaginated `listings` reads in `getOutreachQueue` and `getFinalizationQueue`** (OQ:386–393, 819–828). Past 1,000 rows for a model, dealers drop off the outreach card, and the agent's trim list stops matching the customer's paginated one on `/finalize`.
4. **Queues that never clear:**
   - vehicle consultation has no `search_status` filter (OQ:1118–1124), so cancelled searches stay and their form can only fail;
   - `switch_call_requested_at` and `cancellation_call_requested_at` have no clearing writer (the only writers are `switch-self-service-actions.ts:95` and `cancellation-actions.ts:97`);
   - the switch queue only excludes `switched`, so a cancelled or purchased search stays listed.
5. **`logQualifyingOffer` doesn't check `search_status`** (OA:114–122).
6. **Outreach dealers grouped by name only** (OQ:700–722), ignoring `dealer_aliases` / `mc_dealer_id`.
7. **Outreach reads vehicle options before `requireAgent()`** (OP:352–356).
8. **Admin "Deadline" column** shows `search_deadline_at`, not the effective deadline.
9. **Admin users list is a single 1,000-user page** (`admin-actions.ts:~86`).
10. **Articles and social turn database errors into "no drafts"** (`article-queue.ts:34`, `social-queue.ts`).
11. **`NOTIFICATION_EVENT_LABELS` (OP:340–345)** has no labels for `offer_withdrawn` or `guarantee_resolved`, so cards show the raw type.
12. **Stale page copy.** Bypass section says "works on any search regardless of status" (OP:~627), but the RPC accepts only `searching` / `paused` (`20260816140000_agent_bypass_log.sql:172`).
13. **Seed route:**
    - looks up the account by `customers.email` (`seed-test-state/route.ts:388–391`), which CLAUDE.md forbids;
    - its reset doesn't delete `payments`, `agent_bypass_log`, `admin_action_log` or `social_posts.source_customer_search_id` references (non-cascading foreign keys), so it fails on accounts with those rows.
14. **Undecided searches show `{null} {null}`** in the overdue queue (OP:~817) and in the bypass, cancellation and revert lookups (`agent-bypass-lookup.tsx:~105/122/194`). This is open follow-up 8.
15. **Dead code:** `admin_pause_search` / `admin_resume_search` RPCs (no callers).
16. **Stale code comment:** above `getOutreachQueue` (OQ:~355), it says "no zip/radius filtering / sorted by inventory count", but in-range dealers are sorted first.
17. **Stale migration comment:** `offer_withdrawn` "no customer notice today" (`20260928120000`). A highlight email is sent (OA:~504–511).

### 6.5 Stale or wrong CLAUDE.md descriptions

| CLAUDE.md says | Code says |
|---|---|
| "all eight agent queues" / "0 hits across all eight … every one of them is search-driven" | 11 queue functions now (`getCustomerOfferActivityQueue`, `getGeneralThreadActivityQueue`, `getInventoryBlockedQueue` added). The general-thread queue is not search-driven |
| "`assigned_agent_id` on every customer case, from day one" | Zero writers |
| Outreach dealers "sorted by inventory count — no zip/radius filtering" | Distance computed; in-range first |
| `getStalePausedSearchesQueue` / "Paused past resume window" | Renamed `getPausedSearchesQueue` / "Paused searches" |
| Build-order item 12: admin Pause/Resume buttons | Removed 2026-09-27; page is read-only |
| "`pending_switch_make`/`model` are display-only…" | Nothing writes them |
| Notification system "four events, five call sites" | 6 event types, 8 call sites (OA:171, 356, 507, 713, 770; `offer-response-actions.ts:138`; `guarantee-assessment.ts:118`; `tester-sample-offers.ts:218`) |
| "`guarantee_status = 'refunded'` is itself the worklist" for a manual refund | No in-app way to record it or clear it; the customer is told immediately it's being refunded |
| Reset deletion order "verified against the worst case … back to 0" | Only for accounts with no `payments` / bypass / admin-log rows |
| "`customers.email` … never usable as a lookup key; no production path does this" | `seed-test-state` (L388); `searchCustomers` `ilike`s it to find candidates |
| Dealerships counts "computed at read time" (implied correct) | Unpaginated; wrong past 1,000 listings |

Accurate: "`/internal/outreach` queues are a long single page" (one 1,152-line server component, 15 sections) and "Undecided searches show a blank vehicle name in agent customer lookups."
