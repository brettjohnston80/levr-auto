# System models

Flowcharts and systems-engineering models of how LEVR Auto works, for the final full review and the agent training and reference materials (`docs/plans/build-completion-roadmap.md`). Written in **Mermaid**, so GitHub draws them and they live next to the code.

## Conventions (Brett's choices, 2026-10-15, from the pilot review)

1. **Context diagram:** a plain Mermaid flowchart, split into two: **people and money**, and **services and jobs**.
2. **Detail:** two layers in these system docs: short labels on each diagram, and a table of the code behind it underneath. **For the agent training materials, make plain-language versions of the relevant diagrams with no code names.**
3. **State machines:** one per object; split one by phase only if it becomes unreadable.
4. **Traceability:** a table per area, plus a master summary (VCRM style, `05-verification-matrix.md`) listing every requirement with its verification method and status: **verified by test**, **verified by inspection**, or **not yet verified**.

## Files

| File | Model | What it shows |
|---|---|---|
| `01-context-diagram.md` | Context diagrams (two) | People and money; services and jobs; the 15 scheduled jobs |
| `02-search-state-machine.md` | State machine | The 8 search statuses, every transition, and the code that makes each one |
| `03-payment-to-assignment-sequence.md` | Sequence diagram | Payment → webhook → assignment → alert email, plus the hourly backstop |
| `04-traceability-assignment-signin.md` | Traceability (per area) | Each assignment and sign-in decision → where it's built → which test or inspection proves it |
| `05-verification-matrix.md` | Verification matrix (master) | Every requirement in one list: method and status |

The pilot was drawn from agent dashboard Phase 1 only (2026-10-15).

## The full set (roadmap)

The set still to add:
- use cases by role (customer, agent, lead, admin, scheduled jobs);
- activity flowcharts with decision points (customer journey, offer entry, refunds, call resolution, invite / sign-in / two-factor reset);
- state machines for the offer, call request, agent account and alert;
- sequences for the hourly sweep and switches;
- traceability for every area, each added to the master matrix.

They're kept current as later work is approved, in the same commit as the approval, like `docs/business/site-language-inventory.md` and `docs/business/agent-process-reference.md`.
