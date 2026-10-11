# LEVR Auto documents

Where things live in this repo:

- **`docs/business/`** — business documents: business plan and roadmap, core processes, agreements, website copy, content calendars, and **`how-brett-works.md`** (how Brett wants work done — read first).
- **`docs/plans/`** — build plans for features, reviewed before code is written (one file per feature, e.g. `signup-to-payment-plan.md`).
- **`docs/research/`** — research write-ups and notes: market and vendor research, audits, and the notes that come with a data delivery (e.g. Cowork's configurator notes).
- **`data/`** — files the app imports or builds from: configurator and Matchmaker CSVs (read by the `/api/internal/import-*` routes) and the Matchmaker scoring pipeline. Import routes read from `data/` by filename, so CSVs stay here, not in `docs/`.

`CLAUDE.md` (repo root) is the working context for Claude Code sessions: current state, in-flight work and rules.

A few older build plans still sit at the repo root (`plan.md`, `articles-phase2-plan.md`, `social-posts-plan.md`, `matchmaker-data-spec.md`). New documents go in the folders above.
