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

say "--- 1/3 collect new lessons from Oak"
$PY -u "$S/oak-mirror.py" --max-calls 900 >> "$LOG" 2>&1
say "collect finished with code $?"

say "--- 2/3 match new units to our topics"
$PY -u "$S/oak-map-units.py" --apply --max-calls 40 >> "$LOG" 2>&1
say "match finished with code $?"

say "--- 3/3 publish"
$PY -u "$S/oak-publish.py" --apply --target 40 --limit 4000 >> "$LOG" 2>&1
say "publish finished with code $?"

say "=== end ==="
