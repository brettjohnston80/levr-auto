# System models

Flowcharts and systems-engineering models of how LEVR Auto works, for the final full review and the agent training and reference materials (`docs/plans/build-completion-roadmap.md`). Written in **Mermaid**, so GitHub draws them and they live next to the code.

## The pilot (2026-10-15, from agent dashboard Phase 1 only)

| File | Model | What it shows |
|---|---|---|
| `01-context-diagram.md` | Context diagram | The system boundary, every person and outside service, what passes between them, and the 15 scheduled jobs |
| `02-search-state-machine.md` | State machine | The 8 search statuses, every transition, and the code that makes each one |
| `03-payment-to-assignment-sequence.md` | Sequence diagram | Payment → webhook → assignment → alert email, plus the hourly backstop |
| `04-traceability-assignment-signin.md` | Traceability matrix | Each assignment and sign-in decision → where it's built → which test proves it (and which aren't tested yet) |

## For Brett to choose before the set is extended

1. **Notation for the context diagram:** a plain Mermaid flowchart (used here; renders everywhere) or Mermaid's C4 diagram type (formal C4 shapes, but marked experimental and less reliable on GitHub).
2. **Detail level:**
   - (a) **as in the pilot:** plain-language diagrams, with a table of the code behind each step underneath;
   - (b) **plain language only:** better for agent training, but harder to check against the code;
   - (c) **code names on the diagrams themselves:** precise, but busy.
   The pilot uses (a), so one model can serve both the review and training.
3. **Granularity of state machines:** one diagram per object (as here), or split by phase (before payment / searching / closing).
4. **Traceability format:** one table per area (as here), or one master table across the whole build.

## The full set (roadmap)

Once the notation and detail are chosen, the set adds:
- use cases by role (customer, agent, lead, admin, scheduled jobs);
- activity flowcharts with decision points (customer journey, offer entry, refunds, call resolution, invite / sign-in / two-factor reset);
- state machines for the offer, call request, agent account and alert;
- sequences for the hourly sweep and switches;
- traceability for every area.

They're kept current as later work is approved, in the same commit as the approval, like `docs/business/site-language-inventory.md` and `docs/business/agent-process-reference.md`.
