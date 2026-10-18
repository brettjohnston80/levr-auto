# Build completion roadmap (added 2026-10-14, Brett)

The final steps once building is complete, in this order, **before costing out running the business**.

## 1. Final full review
A detailed review document covering every process, every step, and every piece of customer-facing and agent-facing language across the whole site:
- the customer journey (intake, sign-up, payment, finalize, Your Car, Your Deal, messages, account settings, cancellation, switching, purchase, survey);
- every email (customer and agent);
- the agent dashboard and every internal page (`/agent`, `/internal/*`);
- error messages and empty states.

Organized so Brett can go through it in order and leave a final comment on each item. Built from the two running documents below plus a pass over the code for anything they missed.

## 2. Agent training and reference materials
- Complete onboarding and training for new agents.
- A quick-reference set ("how do I…") for day-to-day tasks.
- Matched to the roles: agent, lead, admin (what each can and can't do).

Built from the agent process reference below.

## System models (part of 1 and 2; added 2026-10-14, Brett)
Both the final review and the agent training/reference materials include flowcharts showing decisions and processes, plus systems-engineering models. They're written in **Mermaid** (renders on GitHub, lives in the repo) under **`docs/business/system-models/`**. The set:
- **Context diagram:** the system boundary and every external system and actor.
- **Use cases by role:** customer, agent, lead, admin, scheduled jobs.
- **Activity flowcharts with decision points** for each major process: the customer journey, offer entry, refunds, call resolution, invite / sign-in / two-factor reset.
- **State machines:** search, offer, call request, agent account, alert.
- **Sequence diagrams** for cross-system hand-offs: payment → webhook → assignment → alert email; the hourly sweep; switches.
- **Requirements traceability matrix:** each decision Brett has made → where it's implemented → which test verifies it.

**Pilot first** (after the Chunk 8 rehearsal is reviewed), from Phase 1 only: the context diagram, the search state machine, the payment-to-assignment sequence diagram, and the traceability matrix for the agent assignment and sign-in decisions. Brett chooses the notation and level of detail from it before the set is extended. After that, the models are kept current as later work is approved, the same way as the two running documents.

## 3. Then: cost out running the business
Only after 1 and 2 are done.

## Running documents (start once Chunk 6 is wrapped, then update as each chunk is approved)
- **`docs/business/site-language-inventory.md`:** every piece of approved wording, grouped by page, flow or email, with where it appears and the date approved.
- **`docs/business/agent-process-reference.md`:** each agent workflow as it's built (what it's for, who can do it, step by step, what the customer sees), written for agents rather than developers.

Both are backfilled first with everything already approved in agent dashboard Phase 1: sign-in, invites, two-factor, resets, Add-agent, alerts, refunds, call resolution. They're kept out of the way of the chunk in progress.

## Future items

- **AI streamlining review** (added 2026-10-16, Brett). Catalog every way AI could further streamline the business:
  - **Content:** video editing and clips, captions, social drafts.
  - **Customer help:** an AI assistant on the website, with handoff to an agent.
  - **Agent work:** dealer outreach drafting, quote parsing, pre-call summaries, attention flags.
  - **Operations:** survey insights, dealer responsiveness, research data checks.
- **Matchmaker scoring robustness** (added 2026-10-16, Brett). Scores are relative within a body-style class, so one outlier added to a class shifts other cars a lot. Adding the Fiat 500e (rear legroom 29.4 in., a new class low) moved every Mazda3's Comfort from 50.9 to 65.4. Consider percentile-based or outlier-capped scoring. See `docs/research/matchmaker-v21-score-changes-2026-10-16.md`.
- **"Not rated" instead of a neutral 50** (added 2026-10-16, Brett). When a vehicle has no data for a score category, show "Not rated" rather than the neutral floor score of 50 (e.g. Maserati and Lexus TZ Safety, Comfort and Reliability in v21).
- **Very long option lists** (added 2026-10-16, Brett). Revisit trims whose paint and feature lists run very long: Maserati Fuoriserie (about 45 paints and 45 features per trim), Porsche Paint to Sample and exclusive options, and any similar make. For example, group personalisation options under a collapsed section so the core choices show first. Approved as is for now; nothing built.

## From tester feedback: Terry (decided 2026-10-17, Brett)

Review: `docs/research/tester-feedback-terry-2026-10-17.md`. Customer-facing wording for every item needs Brett's sign-off.

**Offer-entry phase:**
- **Interior colour and included options on offers.** The agent ticks off the customer's own ranked list (colours, interiors, packages and features) when logging an offer, with a free-text "other". The customer's card and detail view show what the car has and what it lacks. Sample offers carry the same, so testers see the real layout.
- **Side-by-side offer comparison**, reusing the trim comparison table's layout (sticky label column, column widths, collapsible sections) with new rows: price, Total SRP, savings, delivery, add-ons, out-the-door, trim, colour, interior, included options, distance. Built after the two items around it.
- **Itemized out-the-door quotes from dealers**, tracked like delivery estimates (requested / provided per offer; doc fee, tax, title and registration as the dealer states them). Used in "Best total price" and the comparison.
- **No LEVR-computed tax estimate.**

**Work-queue phase (Phase 3):**
- **"Ask my agent" messages** from the customer (e.g. about other trims or options) land in the agent's queue.
- **An "out-the-door quote to get" list**, like "Delivery estimates to get" on `/internal/outreach`.
- **Optional alert when a customer changes their pickup range** on a live search.

**Later, decisions for Brett:**
- **A read-only "explore" view** on a live search: trim comparison and option lists from Your Car with nothing saved.
- **Whether options can ever change on a live search** (trim, colour, options within the same make and model), and if so what happens to the guarantee and existing offers.
