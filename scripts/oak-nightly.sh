#!/usr/bin/env bash
# The whole Oak chain, once a night, in the only order that works.
#
# Each step feeds the next, so they must not run at the same time:
#   1. collect  — fetch lessons we have never seen. The ONLY step that talks to
#                 Oak, and the only one with a daily allowance to spend.
#   2. match    — work out which of our topics any newly seen unit belongs to.
#   3. publish  — turn matched lessons into questions children can answer.
#
# Steps 2 and 3 never contact Oak, so a failure in step 1 (Oak throttling us, the
# network) does not stop the other two from finishing yesterday's work.
#
# Runs to a budget and stops. Nothing here needs to finish in one night; every step
# picks up exactly where the last one stopped.
set -uo pipefail

PY=/root/pipeline-venv/bin/python3
S=/root/decifer-learning/scripts
LOG=/var/log/decifer-oak-nightly.log

say() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

say "=== start ==="

# Every step gets a wall-clock limit as well as its own budget.
#
# Collecting is the one that can stall. When Oak has had enough of us it answers
# 429, and the collector waits and tries again — correctly, but a night of that
# can run for hours, and steps 2 and 3 would never start. They are the steps that
# actually put questions in front of children, and they do not need Oak at all.
# So collecting gets ninety minutes and then we move on regardless. Nothing is
# lost: every lesson already saved stays saved, and tomorrow picks up from there.
say "--- 1/3 collect new lessons from Oak"
timeout 90m $PY -u "$S/oak-mirror.py" --max-calls 900 >> "$LOG" 2>&1
code=$?
[ $code -eq 124 ] && say "collect hit its 90 minute limit — moving on, nothing lost" \
                  || say "collect finished with code $code"

say "--- 2/3 match new units to our topics"
timeout 40m $PY -u "$S/oak-map-units.py" --apply --max-calls 40 >> "$LOG" 2>&1
say "match finished with code $?"

say "--- 3/3 publish"
timeout 30m $PY -u "$S/oak-publish.py" --apply --target 60 --limit 4000 >> "$LOG" 2>&1
say "publish finished with code $?"

say "=== end ==="
