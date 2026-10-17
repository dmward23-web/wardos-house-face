#!/usr/bin/env bash
# Standing routine entrypoint: House board calendar refresh (CALFIX + kids-week)
#
# HARDEN 2026-09-28 · CAL-REFRESH must NEVER stomp HEAT/CONSUME HTML/CSS.
# --deploy / --push commit ONLY allowlisted data files. Never call
# house-face-deploy.sh (that full-copies stale board-os → repo and wiped
# heat-v3 / CONSUME1 / house-engage on e77984f).
#
# Usage:
#   Dump dmward23 list_events (today CT → +7d) → JSON file
#   ./scripts/house-board-calendar-refresh.sh /path/to/events.json [--deploy|--push]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# PRIVFEED1 · calendar data is written ONLY to the box-only private folder, served by the house hub with a token.
# Nothing is committed or pushed; --deploy/--push are accepted for old callers and do nothing.
PRIV="${WARDOS_PRIVATE_DIR:-$HOME/.local/share/wardos-private}"; mkdir -p "$PRIV"; chmod 700 "$PRIV"
EVENTS="${1:?events json required (dmward23 list_events dump)}"
shift || true
DEPLOY=0
NOTE="calendar refresh"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy|--push) DEPLOY=1; shift ;;
    --note) NOTE="${2:?}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

TODAY=$(TZ=America/Chicago date +%F)
STAMP=$(TZ=America/Chicago date +%Y%m%d-%H%M)

# Allowlist — ONLY these may be written / committed by calendar refresh.
ALLOW_WRITE=(
  kids-week.json
  data/kids-week.json
  data/cal-live.json
  kids-data.js
  data/calendar-dmward23-dump.json
)

# Protected — NEVER overwrite / stage / restore from board-os snapshots.
PROTECTED=(
  kid-ainsley.html kid-harris.html kid-hayes.html
  kid-ainsley-pre-theme.html kid-harris-pre-theme.html kid-hayes-pre-theme.html
  kid-ioscroll.css
  sheet-allowance.html sheet-chores.html sheet-countdowns.html sheet-dan.html
  sheet-desk-gate.html sheet-dinner.html sheet-gallery-hero.html sheet-gallery.html
  sheet-google-home.html sheet-groceries.html sheet-index.html sheet-lights.html
  sheet-load-day.html sheet-pack.html sheet-sensi.html sheet-status.html
  sheet-today.html sheet-us.html sheet-weekend.html sheet-win.html
  heat-v3.css house-engage.css
  index.html month.html month-chat.html
  data/sensi-live.json data/nest-live.json
)

snapshot_protected() {
  python3 - <<'PY'
import hashlib, json, os
root = os.environ["ROOT"]
paths = os.environ["PROTECTED_PATHS"].split("\n")
out = {}
for rel in paths:
    if not rel:
        continue
    p = os.path.join(root, rel)
    if not os.path.isfile(p):
        out[rel] = None
        continue
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    out[rel] = h.hexdigest()
print(json.dumps(out))
PY
}

assert_protected_untouched() {
  local before="$1" after
  after=$(snapshot_protected)
  python3 - <<PY
import json, sys
before = json.loads('''$before''')
after = json.loads('''$after''')
bad = []
for k, v in before.items():
    if after.get(k) != v:
        bad.append(k)
if bad:
    print("HARD FAIL: calendar refresh mutated protected HTML/CSS/live JSON:", ", ".join(bad), file=sys.stderr)
    print("HEAT/CONSUME/sensi/nest must never be stomped by cal refresh.", file=sys.stderr)
    sys.exit(7)
print("protect-ok: HTML/CSS/sensi/nest untouched")
PY
}

export ROOT
export PROTECTED_PATHS=$(printf '%s\n' "${PROTECTED[@]}")
BEFORE_HASH=$(snapshot_protected)

# Optional: keep a local (gitignored) dump copy for receipts — never publish
if [[ -f "$EVENTS" ]]; then
  mkdir -p "$ROOT/data"
  cp -f "$EVENTS" "$PRIV/calendar-dump.json" 2>/dev/null || true  # PRIVFEED1 · raw dump stays private
fi

# 0) PRIVACY1: public Pages never carries therapy/provider names (kid privacy).
#    Scrub summaries in a temp copy; the private dump above stays raw (gitignored).
SCRUBBED=$(mktemp /tmp/cal-scrubbed-XXXX.json)
python3 - "$EVENTS" "$SCRUBBED" <<'PRIV'
import json, re, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
# Scrub terms live OFF the public repo: ~/.config/wardos/privacy-scrub.tsv
# (one "regex<TAB>replacement" per line). Missing file = HARD FAIL (fail closed).
import os
fp = os.path.expanduser("~/.config/wardos/privacy-scrub.tsv")
if not os.path.exists(fp):
  print("HARD FAIL: privacy-scrub.tsv missing — refusing to publish unscrubbed calendar", file=sys.stderr); sys.exit(9)
RULES = []
for line in open(fp):
  line = line.rstrip("\n")
  if not line or line.startswith("#"): continue
  rx, _, rep = line.partition("\t")
  RULES.append((re.compile(rx, re.I), rep))
def walk(o):
  if isinstance(o, dict):
    for k, v in o.items():
      if k in ("summary", "title", "description") and isinstance(v, str):
        for rx, rep in RULES: v = rx.sub(rep, v)
        o[k] = re.sub(r"\s{2,}", " ", v).strip()
      else: walk(v)
  elif isinstance(o, list):
    for x in o: walk(x)
walk(d)
json.dump(d, open(dst, "w"))
PRIV
EVENTS="$SCRUBBED"

# 1) Full kids-week schedule rewrite (sports/school/appointments/boardStrip queue)
[[ -f "$PRIV/kids-week.json" ]] || { echo "HARD FAIL: $PRIV/kids-week.json missing (seed it once from the last good copy)" >&2; exit 4; }
node "$ROOT/scripts/calendar-refresh.mjs" --events "$EVENTS" --week "$PRIV/kids-week.json" --no-mirror

# 2) cal-live.json = House Face Next Up authority (fail-closed client)
node "$ROOT/scripts/cal-from-events.mjs" \
  --events "$EVENTS" \
  --out "$PRIV/cal-live.json"

# PRIVFEED1 · board-os mirror retired

ASOF=$(python3 -c "import json;print(json.load(open('$PRIV/kids-week.json'))['asOfIso'])")
CAL_ASOF=$(python3 -c "import json;print(json.load(open('$PRIV/cal-live.json'))['asOfIso'])")
CAL_STATUS=$(python3 -c "import json;print(json.load(open('$PRIV/cal-live.json')).get('status'))")

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
w=json.load(open("$PRIV/kids-week.json"))
cal=json.load(open("$PRIV/cal-live.json"))
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

assert_protected_untouched "$BEFORE_HASH"

[[ "$DEPLOY" == "1" ]] && echo "--deploy/--push ignored (PRIVFEED1): data stays in $PRIV, served by the hub"
echo "house-board-calendar-refresh: wrote $PRIV/kids-week.json + $PRIV/cal-live.json (no git)"
exit 0
