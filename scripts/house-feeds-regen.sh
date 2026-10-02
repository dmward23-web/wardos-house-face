#!/usr/bin/env bash
# REGEN3AM · "House feeds 3 AM regen" · one idempotent, data-only command for the 3:00 AM CT house-day reset.
#   scripts/house-feeds-regen.sh --push
# Regenerates kids-week / cal-live / kids-data.js and the 8 wall feeds from the latest calendar dump (the one the
# 10-minute "House board calendar refresh" routine writes, /workspace/cal-dmward23-week.json) through the SAME
# entrypoint and SAME data-only allowlist (scripts/house-board-calendar-refresh.sh). If nothing but the
# refresh stamps (fetchedAt / refreshedAt / the "source" stamp line / the temp dump name) changed, it restores
# the files and exits 0 with "CLEAN" (no commit, no push). Otherwise it commits + pushes data only.
# No HTML/CSS, no sensi/nest JSON, no deploy script. Installs no timer: the routine owns the clock.
# Usage: scripts/house-feeds-regen.sh [--events <dump.json>] [--push]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENTS="/workspace/cal-dmward23-week.json"; PUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --events) EVENTS="${2:?}"; shift 2 ;;
    --push|--deploy) PUSH=1; shift ;;
    -h|--help) sed -n 2,10p "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -f "$EVENTS" ]] || { echo "HARD FAIL: calendar dump missing: $EVENTS" >&2; exit 2; }
cd "$ROOT"
# the committed half of house-board-calendar-refresh.sh ALLOW_WRITE (the raw dump copy is never committed)
FILES=(kids-week.json data/kids-week.json data/cal-live.json kids-data.js
  data/house-mode.json data/next-up.json data/kid-seats.json data/unlocks.json
  data/pickup-chain.json data/school-night.json data/who-home.json data/logistics-taps.json)
if ! git diff --quiet -- "${FILES[@]}" || ! git diff --cached --quiet; then
  echo "HARD FAIL: local edits in the data files or the index; refusing to regen over them" >&2; exit 3
fi
scripts/house-board-calendar-refresh.sh "$EVENTS" >/tmp/house-feeds-regen.log 2>&1 || { cat /tmp/house-feeds-regen.log >&2; git checkout -- "${FILES[@]}"; exit 4; }
if python3 - "${FILES[@]}" <<'PY'
import re, subprocess, sys
STAMP = re.compile(r'"(fetchedAt|refreshedAt|generatedAt|updatedAt)"\s*:\s*"[^"]*"')
SRC = re.compile(r'"source"\s*:\s*"[^"]*"')
TMP = re.compile(r'cal-scrubbed-[A-Za-z0-9]+\.json')
def norm(s): return TMP.sub("cal-scrubbed.json", SRC.sub('"source":""', STAMP.sub(r'"\1":""', s)))
for f in sys.argv[1:]:
    try: old = subprocess.run(["git", "show", "HEAD:" + f], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError: sys.exit(1)
    if norm(old) != norm(open(f).read()): print("changed:", f); sys.exit(1)
sys.exit(0)
PY
then
  git checkout -- "${FILES[@]}"
  echo "CLEAN · House feeds 3 AM regen: nothing but refresh stamps changed · no commit"; exit 0
fi
if [[ "$PUSH" != "1" ]]; then echo "dry-run: data changed (pass --push to commit + push data only)"; exit 0; fi
scripts/house-board-calendar-refresh.sh "$EVENTS" --push --note "3 AM regen"
