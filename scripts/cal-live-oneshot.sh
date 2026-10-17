#!/usr/bin/env bash
# CAL-LIVE one-shot: events dump → cal-live + kids-week patch in the box-only private folder (PRIVFEED1).
# Nothing is committed or pushed: the house hub serves the private folder with a token. --push is a no-op.
# Atlas standing / on-arrival path (see CAL-LIVE.md + /workspace/cal-refresh-wire.md)
#
# Usage:
#   ./scripts/cal-live-oneshot.sh /path/to/events-dump.json [--push]
#   ./scripts/cal-live-oneshot.sh /path/to/events-dump.json --push --note "CAL-live · auto"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIV="${WARDOS_PRIVATE_DIR:-$HOME/.local/share/wardos-private}"; mkdir -p "$PRIV"; chmod 700 "$PRIV"
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
  --out "$PRIV/cal-live.json" \
  --patch-week "$PRIV/kids-week.json"

# PRIVFEED1 · board-os mirror retired (it copied private data into another work tree)

CAL_ASOF=$(python3 -c "import json;print(json.load(open('$PRIV/cal-live.json'))['asOfIso'])")
CAL_STATUS=$(python3 -c "import json;print(json.load(open('$PRIV/cal-live.json')).get('status'))")
NEXT=$(python3 -c "import json;d=json.load(open('$PRIV/cal-live.json'));n=d.get('nextLeave') or {};print(n.get('summary') or '')")

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
cal=json.load(open("$PRIV/cal-live.json"))
ups=cal.get("upcomingLeaves") or []
blob=json.dumps(ups)
if "2209" not in blob and "HD" not in blob:
    print("WARN: HD #2209 leave not in upcomingLeaves (ok if deleted)")
print("cal-live-oneshot: OK", cal["asOfIso"], "status", cal["status"], "next", (cal.get("nextLeave") or {}).get("summary"))
PY

# PRIVFEED1 · no git: private data never enters any repo. Old --push callers get a clean exit.
[[ "$PUSH" == "1" ]] && echo "--push ignored (PRIVFEED1): private data stays in $PRIV, served by the hub"
echo "cal-live-oneshot: wrote $PRIV/cal-live.json + $PRIV/kids-week.json"
exit 0
