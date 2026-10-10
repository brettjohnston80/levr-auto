# LEVR Auto documents

Where things live in this repo:

- **`docs/business/`** — business documents: business plan and roadmap, core processes, agreements, website copy, content calendars.
- **`docs/plans/`** — build plans for features, reviewed before code is written (one file per feature, e.g. `signup-to-payment-plan.md`).
- **`docs/research/`** — research write-ups and notes: market and vendor research, audits, and the notes that come with a data delivery (e.g. Cowork's configurator notes).
- **`data/`** — files the app imports or builds from: configurator and Matchmaker CSVs (read by the `/api/internal/import-*` routes) and the Matchmaker scoring pipeline. Import routes read from `data/` by filename, so CSVs stay here, not in `docs/`.

`CLAUDE.md` (repo root) is the working context for Claude Code sessions: current state, in-flight work and rules.

Some older documents still sit at the repo root (e.g. `LEVR-Auto-Business-Plan-and-Roadmap.md`, `LEVR-Auto-Core-Processes-v1.md`) and older research notes sit in `data/`. New documents go in the folders above.
