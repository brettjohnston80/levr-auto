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
