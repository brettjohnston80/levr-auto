// Where the tests live and write. ROOT is the repo (worktree) root; LOGS is git-ignored and
// inside the repo, so macOS's /tmp cleanup can't remove logs, reports or screenshots.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
export const LOGS = path.join(ROOT, ".test-logs", "phase1");
for (const d of ["shots", "shots/agent-phase1-chunk5", "shots/agent-phase1-chunk6", "shots/agent-phase1-chunk7", "shots/agent-phase1-chunk7b", "c4", "c7b", "c8"]) fs.mkdirSync(path.join(LOGS, d), { recursive: true });
