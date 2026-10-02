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
  # LIVEDATA1 · the 8 wall feeds ride the same 10-minute data-only commit (scripts/house-feeds-refresh.sh)
  data/house-mode.json
  data/next-up.json
  data/kid-seats.json
  data/unlocks.json
  data/pickup-chain.json
  data/school-night.json
  data/who-home.json
  data/logistics-taps.json
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
  cp -f "$EVENTS" "$ROOT/data/calendar-dmward23-dump.json" 2>/dev/null || true
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
node "$ROOT/scripts/calendar-refresh.mjs" --events "$EVENTS" --week "$ROOT/kids-week.json" --no-mirror

# 2) cal-live.json = House Face Next Up authority (fail-closed client)
node "$ROOT/scripts/cal-from-events.mjs" \
  --events "$EVENTS" \
  --out "$ROOT/data/cal-live.json"

# 3) LIVEDATA1 · the 8 wall feeds at the current clock from the same scrubbed dump (no network, no git).
#    The 3:00 AM CT house-day reset runs the same entrypoint (config/house-feeds.schedule.json);
#    standalone: scripts/house-feeds-refresh.sh --events <dump>.
"$ROOT/scripts/house-feeds-refresh.sh" --events "$EVENTS"

# Mirror DATA ONLY into board-os when present (never HTML/CSS)
if [[ -d /workspace/board-os/house-face ]]; then
  BOS=/workspace/board-os/house-face
  mkdir -p "$BOS/data"
  cp -f "$ROOT/kids-week.json" "$BOS/kids-week.json"
  cp -f "$ROOT/data/kids-week.json" "$BOS/data/kids-week.json"
  cp -f "$ROOT/data/cal-live.json" "$BOS/data/cal-live.json"
  cp -f "$ROOT/kids-data.js" "$BOS/kids-data.js"
  for f in house-mode next-up kid-seats unlocks pickup-chain school-night who-home logistics-taps; do
    cp -f "$ROOT/data/$f.json" "$BOS/data/$f.json"
  done
  # Explicitly do NOT copy kid-*.html sheet-*.html heat-v3.css house-engage.css
  # Explicitly do NOT copy sensi-live.json nest-live.json
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

assert_protected_untouched "$BEFORE_HASH"

if [[ "$DEPLOY" != "1" ]]; then
  echo "dry-run complete (pass --deploy or --push to commit+push DATA ONLY)"
  exit 0
fi

# DATA-ONLY ship — NEVER house-face-deploy.sh (full board-os copy stomps HEAT/CONSUME)
cd "$ROOT"
# Refuse if protected paths are staged somehow
git add -- "${ALLOW_WRITE[@]}" 2>/dev/null || true
# Only the allowlist that exists
ADD_LIST=()
for f in "${ALLOW_WRITE[@]}"; do
  if [[ -f "$ROOT/$f" ]] && [[ "$f" != data/calendar-dmward23-dump.json ]]; then
    ADD_LIST+=("$f")
  fi
done
git add -- "${ADD_LIST[@]}"

# Guard: nothing outside allowlist in the index for this commit
BAD=$(git diff --cached --name-only | python3 -c "
import sys
allow = set('''$(printf '%s\n' "${ADD_LIST[@]}")'''.strip().splitlines())
bad = [l.strip() for l in sys.stdin if l.strip() and l.strip() not in allow]
print('\n'.join(bad))
")
if [[ -n "${BAD}" ]]; then
  echo "HARD FAIL: attempted to stage non-data files in calendar refresh:" >&2
  echo "$BAD" >&2
  git reset HEAD -- . >/dev/null 2>&1 || true
  exit 7
fi

if git diff --cached --quiet; then
  echo "CLEAN · no cal-live / kids-week changes to push"
  exit 0
fi

MSG="House Face · ${NOTE} ${TODAY} CT · data-only ${STAMP}"
git -c user.email='dmward23@gmail.com' -c user.name='dmward23-web' commit -m "$MSG"
git push origin main
echo "PUSHED data-only · $(git rev-parse --short HEAD) · $MSG"
echo "PROTECTED intact: kid-*.html sheet-*.html heat-v3.css house-engage.css sensi-live nest-live"
