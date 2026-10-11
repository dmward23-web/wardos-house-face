#!/usr/bin/env bash
# WardOS House Face · Lights recurring refresh (Sensi/Nest shape)
# Fetches Kasa cloud → data/lights-live.json (writeProxy baked) → push main.
# Cron: every 15 min. Does NOT touch sensi/nest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="${HOME}/.cache/wardos"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/lights-refresh.log"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }

{
  echo "[$(ts)] lights-refresh start"

  # Ensure write proxy is up (local)
  if ! curl -sf --max-time 3 "http://127.0.0.1:8788/health" >/dev/null 2>&1; then
    echo "[$(ts)] lights-write-proxy down — restarting on :8788"
    if [[ -f "$HOME/.config/wardos/lights-proxy.token" ]]; then
      LIGHTS_PROXY_TOKEN="$(cat "$HOME/.config/wardos/lights-proxy.token")" \
        nohup node scripts/lights-write-proxy.mjs --host 127.0.0.1 --port 8788 \
        >>"$LOG_DIR/lights-write-proxy.log" 2>&1 &
      sleep 1
    else
      echo "[$(ts)] WARN: missing lights-proxy.token — cannot restart proxy"
    fi
  fi

  # Ensure CF tunnel URL still answers; if dead, reopen quick tunnel + re-persist URL
  # Named tunnel wardos-hub serves lights.wardhousehub.com — stable URL, no quick tunnels
  printf '%s\n' "https://lights.wardhousehub.com" > "$HOME/.config/wardos/lights-write-proxy.url"
  "$HOME/.local/bin/wardos-hub-tunnel.sh" >/dev/null

  node scripts/lights-fetch.mjs
  STATUS="$(python3 -c "import json;print(json.load(open('data/lights-live.json')).get('status',''))")"
  if [[ "$STATUS" != "live" ]]; then
    echo "[$(ts)] ABORT: status=$STATUS (not pushing)"
    exit 1
  fi

  git add data/lights-live.json
  if git diff --cached --quiet; then
    echo "[$(ts)] no JSON change — skip commit"
  else
    git commit -m "LIGHTS-live · auto refresh $(date -u +%Y%m%d-%H%M)Z"
    scripts/data-only-guard.sh || { echo "DATAGUARD1: not pushing"; exit 3; }
    git push origin main
    echo "[$(ts)] pushed $(git rev-parse --short HEAD)"
  fi
  echo "[$(ts)] lights-refresh done"
} >>"$LOG" 2>&1
