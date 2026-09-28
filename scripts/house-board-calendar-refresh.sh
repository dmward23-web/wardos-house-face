#!/usr/bin/env bash
# Standing routine entrypoint: House board calendar refresh (CALFIX + kids-week)
# Usage:
#   Dump dmward23 list_events (today CT → +7d) → JSON file
#   ./scripts/house-board-calendar-refresh.sh /path/to/events.json [--deploy]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENTS="${1:?events json required (dmward23 list_events dump)}"
shift || true
DEPLOY=0
NOTE="calendar refresh"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy) DEPLOY=1; shift ;;
    --note) NOTE="${2:?}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

TODAY=$(TZ=America/Chicago date +%F)

# 1) Full kids-week schedule rewrite (sports/school/appointments/boardStrip queue)
node "$ROOT/scripts/calendar-refresh.mjs" --events "$EVENTS" --week "$ROOT/kids-week.json"

# 2) cal-live.json = House Face Next Up authority (fail-closed client)
node "$ROOT/scripts/cal-from-events.mjs" \
  --events "$EVENTS" \
  --out "$ROOT/data/cal-live.json"

# Mirror into board-os when present
if [[ -d /workspace/board-os/house-face ]]; then
  BOS=/workspace/board-os/house-face
  cp -f "$ROOT/kids-week.json" "$BOS/kids-week.json"
  mkdir -p "$BOS/data"
  cp -f "$ROOT/data/kids-week.json" "$BOS/data/kids-week.json"
  cp -f "$ROOT/data/cal-live.json" "$BOS/data/cal-live.json"
  cp -f "$ROOT/kids-data.js" "$BOS/kids-data.js"
  cp -f "$ROOT/house-board-strip.js" "$BOS/house-board-strip.js"
fi

ASOF=$(python3 -c "import json;print(json.load(open('$ROOT/kids-week.json'))['asOfIso'])")
CAL_ASOF=$(python3 -c "import json;print(json.load(open('$ROOT/data/cal-live.json'))['asOfIso'])")
CAL_STATUS=$(python3 -c "import json;print(json.load(open('$ROOT/data/cal-live.json')).get('status'))")

if [[ "$ASOF" != "$TODAY" || "$CAL_ASOF" != "$TODAY" ]]; then
  echo "HARD FAIL: asOfIso kids=$ASOF cal=$CAL_ASOF != today CT $TODAY" >&2
  exit 4
fi
if [[ "$CAL_STATUS" != "live" ]]; then
  echo "HARD FAIL: cal-live status=$CAL_STATUS (want live)" >&2
  exit 4
fi

python3 - <<PY
import json,sys
from datetime import datetime
from zoneinfo import ZoneInfo
CT=ZoneInfo("America/Chicago")
now=datetime.now(CT)
w=json.load(open("$ROOT/kids-week.json"))
cal=json.load(open("$ROOT/data/cal-live.json"))
place=(w.get("boardStrip") or {}).get("place") or ""
if "jessy" in place.lower() and w.get("asOfIso","") >= "2026-09-28":
    print("HARD FAIL: boardStrip still shows past Jessy vanity", place, file=sys.stderr)
    sys.exit(4)
nxt=(cal.get("boardStrip") or {}).get("place") or ""
if "jessy" in nxt.lower():
    print("HARD FAIL: cal-live Next Up still Jessy vanity", nxt, file=sys.stderr)
    sys.exit(4)
# Ensure HD leave is somewhere in upcoming or dan.week
blob=json.dumps(cal.get("upcomingLeaves") or [])+json.dumps(w.get("kids",{}).get("dan",{}).get("week") or [])
if "2209" not in blob and "HD" not in blob:
    print("WARN: HD #2209 leave not seen in cal-live/dan.week (ok if deleted)")
print("house-board-calendar-refresh: OK", w["asOfIso"], "next", (cal.get("boardStrip") or {}).get("time"), (cal.get("boardStrip") or {}).get("place"))
PY

if [[ "$DEPLOY" == "1" ]]; then
  /workspace/board-os/scripts/house-face-deploy.sh "$NOTE $TODAY CT"
fi
