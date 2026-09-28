#!/usr/bin/env bash
# CAL-LIVE one-shot: events dump → cal-live + kids-week patch → commit+push only if dirty
# Atlas standing / on-arrival path (see CAL-LIVE.md + /workspace/cal-refresh-wire.md)
#
# Usage:
#   ./scripts/cal-live-oneshot.sh /path/to/events-dump.json [--push]
#   ./scripts/cal-live-oneshot.sh /path/to/events-dump.json --push --note "CAL-live · auto"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENTS="${1:?events json required (dmward23 MCP list_events dump)}"
shift || true
PUSH=0
NOTE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=1; shift ;;
    --note) NOTE="${2:?}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

TODAY=$(TZ=America/Chicago date +%F)
STAMP=$(TZ=America/Chicago date +%Y%m%d-%H%M)
NOTE="${NOTE:-CAL-live · snapshot ${STAMP} CT}"

node "$ROOT/scripts/cal-from-events.mjs" \
  --events "$EVENTS" \
  --out "$ROOT/data/cal-live.json" \
  --patch-week "$ROOT/kids-week.json"

# Mirror into board-os house-face when present (deploy roundtrip optional)
if [[ -d /workspace/board-os/house-face ]]; then
  BOS=/workspace/board-os/house-face
  mkdir -p "$BOS/data"
  cp -f "$ROOT/kids-week.json" "$BOS/kids-week.json"
  cp -f "$ROOT/data/kids-week.json" "$BOS/data/kids-week.json"
  cp -f "$ROOT/data/cal-live.json" "$BOS/data/cal-live.json"
  cp -f "$ROOT/kids-data.js" "$BOS/kids-data.js" 2>/dev/null || true
fi

CAL_ASOF=$(python3 -c "import json;print(json.load(open('$ROOT/data/cal-live.json'))['asOfIso'])")
CAL_STATUS=$(python3 -c "import json;print(json.load(open('$ROOT/data/cal-live.json')).get('status'))")
NEXT=$(python3 -c "import json;d=json.load(open('$ROOT/data/cal-live.json'));n=d.get('nextLeave') or {};print(n.get('summary') or '')")

if [[ "$CAL_ASOF" != "$TODAY" ]]; then
  echo "HARD FAIL: cal-live asOfIso=$CAL_ASOF != today CT $TODAY" >&2
  exit 4
fi
if [[ "$CAL_STATUS" != "live" ]]; then
  echo "HARD FAIL: cal-live status=$CAL_STATUS (want live)" >&2
  exit 4
fi
if echo "$NEXT" | grep -qi 'jessy'; then
  echo "HARD FAIL: nextLeave still Jessy vanity: $NEXT" >&2
  exit 4
fi

python3 - <<PY
import json,sys
cal=json.load(open("$ROOT/data/cal-live.json"))
ups=cal.get("upcomingLeaves") or []
blob=json.dumps(ups)
if "2209" not in blob and "HD" not in blob:
    print("WARN: HD #2209 leave not in upcomingLeaves (ok if deleted)")
print("cal-live-oneshot: OK", cal["asOfIso"], "status", cal["status"], "next", (cal.get("nextLeave") or {}).get("summary"))
PY

if [[ "$PUSH" != "1" ]]; then
  echo "dry-run complete (pass --push to commit+push if dirty)"
  exit 0
fi

cd "$ROOT"
git add data/cal-live.json kids-week.json data/kids-week.json kids-data.js
if git diff --cached --quiet; then
  echo "CLEAN · no cal-live / kids-week changes to push"
  exit 0
fi
git -c user.email='dmward23@gmail.com' -c user.name='dmward23-web' commit -m "House Face · $NOTE"
git push origin main
echo "PUSHED · $(git rev-parse --short HEAD) · $NOTE"
