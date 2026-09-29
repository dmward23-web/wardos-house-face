#!/usr/bin/env bash
# Forever stand-in when box has no crontab: loop lights-refresh every 15m.
# PID file: ~/.cache/wardos/lights-refresh-loop.pid
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${HOME}/.cache/wardos"
mkdir -p "$LOG_DIR"
PIDFILE="$LOG_DIR/lights-refresh-loop.pid"
INTERVAL="${LIGHTS_REFRESH_INTERVAL_SEC:-900}"  # 15 min

if [[ -f "$PIDFILE" ]]; then
  OLD="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "$OLD" ]] && kill -0 "$OLD" 2>/dev/null; then
    echo "lights-refresh-loop already running pid=$OLD"
    exit 0
  fi
fi
echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] loop start interval=${INTERVAL}s" >>"$LOG_DIR/lights-refresh-loop.log"
while true; do
  "$ROOT/scripts/lights-refresh.sh" || true
  sleep "$INTERVAL"
done
