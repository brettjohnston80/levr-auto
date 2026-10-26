#!/bin/zsh
# Phase 1 end-to-end tests: every chunk, against the branch dev server on :3100 (restarted with each
# phase's test-only settings). Brett's :3000 server is never started or stopped (c1g/rehearse-1f only
# reads pages from it). Everything is logged under .test-logs/phase1/ (git-ignored).
#
# Usage, from anywhere:  scripts/tests/phase1/lib/run.sh [label ...]
#   no labels = the full run; with labels, only those tests (the server phases they need still run).
# Each test has a time limit (TEST_LIMIT seconds, default 1800): a test past it is stopped and
# reported as STALLED. A health probe (GET /agent) is logged every 30 s to show server stalls.
set -u
# Keep the Mac awake for the whole run (a sleeping Mac stalls every test and drops the network).
[[ -z "${PHASE1_CAFFEINATED:-}" ]] && exec env PHASE1_CAFFEINATED=1 caffeinate -i -m "$0" "$@"
TESTS=${0:A:h:h}; ROOT=${TESTS:h:h:h}; LOGS=$ROOT/.test-logs/phase1
STAMP=$(date +%Y%m%d-%H%M%S); RUN=$LOGS/run-$STAMP; mkdir -p $RUN
SUMMARY=$RUN/summary.txt; DEV=$LOGS/dev3100.log; LIMIT=${TEST_LIMIT:-1800}
ONLY=("$@")
want() { [[ ${#ONLY[@]} -eq 0 || ${ONLY[(Ie)$1]} -gt 0 ]]; }
say() { echo "$*" | tee -a $SUMMARY; }

stop_server() { lsof -t -i :3100 -sTCP:LISTEN | xargs kill 2>/dev/null; for i in {1..20}; do lsof -t -i :3100 -sTCP:LISTEN >/dev/null || return 0; sleep 1; done; }
server() { # $@ = env assignments for this phase
  stop_server; : > $DEV
  (cd $ROOT && env "$@" nohup npx next dev --webpack -p 3100 > $DEV 2>&1 &)
  for i in {1..180}; do grep -q "Ready in" $DEV && break; sleep 1; done
  # Warm the pages and routes the tests use (first compiles are slow on webpack).
  for u in / /login /account /agent /agent/accept /agent/enroll /agent/forgot-password /agent/set-password /internal/outreach /internal/admin /internal/agents /internal/refunds-due /internal/dealerships /internal/articles /internal/social /api/cron/agent-sweeps; do
    curl -s -o /dev/null --max-time 300 http://localhost:3100$u
  done
  node $TESTS/lib/action-ids.mjs >> $RUN/action-ids.log 2>&1
  say "=== server: ${*:-normal settings} ($(date +%H:%M:%S))"
}
t() { # $1 label, $2 folder, rest = command
  local label=$1 dir=$2; shift 2
  want $label || return 0
  local log=$RUN/$label.log st=$(date +%s)
  (cd $TESTS/$dir && perl -e 'alarm shift; exec @ARGV or die' $LIMIT "$@") > $log 2>&1
  local code=$? took=$(( $(date +%s) - st ))
  local res=$(grep -E "^[0-9]+ passed, [0-9]+ failed" $log | tail -1)
  [[ $code -eq 142 ]] && res="STALLED (stopped after ${LIMIT}s)${res:+; last: $res}"
  say "$label: ${res:-NO RESULT (exit $code)} (${took}s)"
}

# Health probe: one line every 30 s, so a stalled server shows up as slow or failed probes.
( while true; do echo "$(date +%H:%M:%S) $(curl -s -o /dev/null -w '%{http_code} %{time_total}s' --max-time 60 http://localhost:3100/agent)"; sleep 30; done ) > $RUN/health.log 2>&1 &
PROBE=$!
trap 'kill $PROBE 2>/dev/null' EXIT

say "Phase 1 tests, $STAMP, branch $(git -C $ROOT rev-parse --short HEAD)$(git -C $ROOT diff --cached --quiet || echo ' + staged merge')"
node $TESTS/lib/guard.mjs > $RUN/guard.log 2>&1 || { say "$(cat $RUN/guard.log)"; say "ABORTED by the before-run guard: nothing was run"; exit 1; }
say "$(cat $RUN/guard.log)"
node $TESTS/lib/build-modules.cjs >> $RUN/build-modules.log 2>&1 || { say "build-modules failed"; exit 1; }
node $TESTS/lib/state.mjs > $RUN/state-before.json || { say "state check failed"; exit 1; }

server
t c1a-accounts      c1a node test.mjs
t c1g-rotation      c1g node rotation.mjs
t c1e-reset         c1  node c1e.mjs
t c1c-emails        c1  node c1c-emails.mjs
t c1b-signin        c1  node c1b.mjs
t c1c-invite        c1  node c1c.mjs
t c1c-key           c1  node c1c-key.mjs
t c1c-hang          c1  node c1c-hang.mjs
t c1d-probe         c1  node c1d-probe.mjs
t c1d-actions       c1  node c1d-actions.mjs
t c16-1e            c1  node c16-1e.mjs
t c1g-addagent      c1  node c1g.mjs
t c1-accept-refusal c1g node accept-refusal.mjs
t c1f-rehearsal     c1g node rehearse-1f.mjs
t c2-normal         c2  env MODE=normal node c2.mjs
t c3-A              c3  env PHASE=A node c3.mjs
t c3-switch         c3  node c3s.mjs
t c4-A              c4  env PHASE=A node c4.mjs
t c4-autoresolve    c4  env PHASE=R node c4b.mjs
t c5-A              c5  env PHASE=A node c5.mjs
t c6-A              c6  env PHASE=A node c6.mjs
t c7                c7  env LABEL=after node c7.mjs
t c7b-listings      c7b env LABEL=after node listings.mjs
t c7b-idlist        c7b env LABEL=after node idlist.mjs
t c8-jobs           c8  node jobs.mjs
want c8-scope && { (cd $ROOT && npx tsx --conditions=react-server $TESTS/c8/scope/scope-test.mts) > $RUN/c8-scope.log 2>&1; say "c8-scope: exit $? (output in c8-scope.log)"; }

server AGENT_IDLE_LIMIT_MS_OVERRIDE=120000
t c1-idle           c1  node idle2.mjs
t c1d-pages         c1  node c1d.mjs   # its idle case needs the 2-minute test limit
server AGENT_SIGNIN_HASH_SECRET=
t c1b-nosecret      c1  node c1b-nosecret.mjs
server AGENT_ACTIVITY_FORCE_FAIL="salesperson_added:code,salesperson_updated:call"
t c2-forced         c2  env MODE=forced node c2.mjs
server AGENT_ASSIGN_FORCE_FAIL=payment,sweep AGENT_ALERT_FORCE_SEND_FAIL=1
t c3-B              c3  env PHASE=B node c3.mjs
t c4-B              c4  env PHASE=B node c4.mjs
server AGENT_ASSIGN_SIMULATE_NO_ROTATION=1
t c4-simulate       c4  env PHASE=S node c4b.mjs
t c6-B              c6  env PHASE=B node c6.mjs
server AGENT_REFUND_FORCE_RECORD_FAIL=1
t c5-B              c5  env PHASE=B node c5.mjs
server AGENT_ADMIN_USERS_PAGE_SIZE=5
t c7-paging         c7  env LABEL=paging USERS_PAGE=5 node c7.mjs
stop_server

node $TESTS/lib/state.mjs --compare $RUN/state-before.json > $RUN/state-compare.json
say "safety check: $([[ $? -eq 0 ]] && echo 'clean (Brett, off-limits accounts and leftovers unchanged/0)' || echo "PROBLEMS, see state-compare.json")"
gaps=$(awk '{split($1,t,":"); s=t[1]*3600+t[2]*60+t[3]; if (NR>1) { d=s-p; if (d<0) d+=86400; if (d>120) printf "%s->%s (%ds) ", pt, $1, d }; p=s; pt=$1}' $RUN/health.log)
say "machine awake throughout: $([[ -z $gaps ]] && echo yes || echo "NO, health-check gaps: $gaps(results during a gap are void)")"
say "=== done $(date +%H:%M:%S); logs in $RUN"
