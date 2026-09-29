#!/usr/bin/env bash
# STILLFRESH1 · refresh hub camera pictures (Garage + Backyard) from live video.
# Headless Chrome (own profile, CDP :19333) → nest-webrtc-still.mjs →
# data/nest-snaps/*.jpg + snapCapturedAt in data/nest-live.json → push main.
# Front door is skipped until the doorbell is hardwired (battery = no live).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
LOG_DIR="$HOME/.cache/wardos"; mkdir -p "$LOG_DIR"; LOG="$LOG_DIR/nest-stills.log"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
CAMS="${STILL_CAMS:-Garage,Backyard}"
PROFILE="$(mktemp -d /tmp/nest-still-chrome.XXXX)"
/opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --mute-audio \
  --autoplay-policy=no-user-gesture-required --remote-debugging-port=19333 \
  --user-data-dir="$PROFILE" "http://127.0.0.1:8787/nest-webrtc.html" >/dev/null 2>&1 < /dev/null &
CPID=$!
cleanup() { kill "$CPID" 2>/dev/null; sleep 1; kill -9 "$CPID" 2>/dev/null; rm -rf "$PROFILE"; }
trap cleanup EXIT
for i in $(seq 1 20); do curl -sf http://127.0.0.1:19333/json/version >/dev/null 2>&1 && break; sleep 0.5; done
echo "[$(ts)] stills start ($CAMS)" >>"$LOG"
node scripts/nest-webrtc-still.mjs --cdp 19333 --cams "$CAMS" --wait 20000 >>"$LOG" 2>&1
RC=$?
[[ "${NO_PUSH:-0}" == "1" ]] && { echo "rc=$RC (no push)"; exit $RC; }
git add data/nest-live.json data/nest-snaps/garage.jpg data/nest-snaps/backyard.jpg 2>/dev/null
if git diff --cached --quiet; then echo "[$(ts)] no change" >>"$LOG"; echo "NOCHANGE rc=$RC"; exit 0; fi
git commit -qm "NESTSTILL · fresh hub cam pictures $(date -u +%Y%m%d-%H%M)Z"
git pull -q --rebase --autostash && git push -q origin main
echo "[$(ts)] pushed $(git rev-parse --short HEAD)" >>"$LOG"
echo "PUSHED rc=$RC"
