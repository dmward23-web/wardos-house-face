#!/usr/bin/env bash
# STILLFRESH1 · refresh hub camera pictures from live video.
# Headless Chrome (own profile, CDP :19333) → nest-webrtc-still.mjs →
# <private>/nest-snaps/*.jpg (PRIVFEED1, box-only, served by the hub with a token) + snapCapturedAt in
# data/nest-live.json. Camera pictures never enter git and nothing is pushed.
# FOLLOWUP3 · which cameras: STILL_CAMS, else the box-only list ~/.config/wardos/nest-still-cams (comma separated,
# never git). With neither, it logs "no still list, skipping" and exits 0: fail closed, never every camera.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
LOG_DIR="$HOME/.cache/wardos"; mkdir -p "$LOG_DIR"; LOG="$LOG_DIR/nest-stills.log"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
CAMS="${STILL_CAMS:-}"
STILL_LIST="$HOME/.config/wardos/nest-still-cams"
if [ -z "${CAMS//[[:space:],]/}" ] && [ -r "$STILL_LIST" ]; then CAMS="$(tr -d '\n\r' < "$STILL_LIST")"; fi
if [ -z "${CAMS//[[:space:],]/}" ]; then
  echo "[$(ts)] no still list, skipping" >>"$LOG"
  echo "STILLS no still list, skipping"
  exit 0
fi
PROFILE="$(mktemp -d /tmp/nest-still-chrome.XXXX)"
/opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --mute-audio \
  --autoplay-policy=no-user-gesture-required --remote-debugging-port=19333 \
  --user-data-dir="$PROFILE" "http://127.0.0.1:8787/nest-webrtc.html" >/dev/null 2>&1 < /dev/null &
CPID=$!
cleanup() { kill "$CPID" 2>/dev/null; sleep 1; kill -9 "$CPID" 2>/dev/null; rm -rf "$PROFILE"; }
trap cleanup EXIT
for i in $(seq 1 20); do curl -sf http://127.0.0.1:19333/json/version >/dev/null 2>&1 && break; sleep 0.5; done
echo "[$(ts)] stills start" >>"$LOG"
node scripts/nest-webrtc-still.mjs --cdp 19333 --cams "$CAMS" --wait 20000 >>"$LOG" 2>&1
RC=$?
echo "[$(ts)] stills done rc=$RC (private folder, no push · PRIVFEED1)" >>"$LOG"
echo "STILLS rc=$RC"
exit $RC
