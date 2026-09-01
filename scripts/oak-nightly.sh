#!/usr/bin/env bash
# The whole Oak chain, once a night, in the only order that works.
#
# Each step feeds the next, so they must not run at the same time:
#   1. collect  — fetch lessons we have never seen. The ONLY step with a daily
#                 allowance to spend on Oak's question service.
#   2. match    — work out which of our topics any newly seen unit belongs to.
#   3. pictures — fetch each new picture once and record whether it really loads.
#   4. publish  — turn matched lessons into questions children can answer.
#
# Only step 1 spends the daily allowance. Steps 2 and 4 touch nothing outside our
# own database, and step 3 talks to Oak's picture host, which does not share that
# allowance. So a bad night on step 1 never stops the rest finishing yesterday's
# work — and the steps that actually put questions in front of children are the
# ones that do not depend on Oak at all.
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
say "--- 1/4 collect new lessons from Oak"
timeout 90m $PY -u "$S/oak-mirror.py" --max-calls 900 >> "$LOG" 2>&1
code=$?
[ $code -eq 124 ] && say "collect hit its 90 minute limit — moving on, nothing lost" \
                  || say "collect finished with code $code"

say "--- 2/4 match new units to our topics"
timeout 40m $PY -u "$S/oak-map-units.py" --apply --max-calls 40 >> "$LOG" 2>&1
say "match finished with code $?"

# Between matching and publishing, because publishing refuses any question whose
# picture has not been fetched and seen to load. Skipping this would not show a
# broken picture — it would quietly hold back every question that has one.
say "--- 3/4 check that every picture loads"
timeout 45m $PY -u "$S/oak-check-images.py" --recheck-days 30 >> "$LOG" 2>&1
say "picture check finished with code $?"

say "--- 4/4 publish"
timeout 30m $PY -u "$S/oak-publish.py" --apply --target 60 --limit 4000 >> "$LOG" 2>&1
say "publish finished with code $?"

say "=== end ==="
