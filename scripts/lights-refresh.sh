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
  PROXY_URL_FILE="$HOME/.config/wardos/lights-write-proxy.url"
  NEED_TUNNEL=0
  if [[ ! -f "$PROXY_URL_FILE" ]]; then
    NEED_TUNNEL=1
  else
    CUR_URL="$(tr -d '[:space:]' < "$PROXY_URL_FILE")"
    if [[ -z "$CUR_URL" ]] || ! curl -sf --max-time 8 "$CUR_URL/health" >/dev/null 2>&1; then
      echo "[$(ts)] CF write tunnel dead or missing ($CUR_URL) — reopening"
      NEED_TUNNEL=1
    fi
  fi
  if [[ "$NEED_TUNNEL" -eq 1 ]]; then
    # Kill prior lights CF tunnel to :8788 if any (best-effort)
    pkill -f 'cloudflared tunnel --url http://127.0.0.1:8788' 2>/dev/null || true
    sleep 1
    CF_BIN="/tmp/cloudflared"
    [[ -x "$CF_BIN" ]] || CF_BIN="$(command -v cloudflared || true)"
    if [[ -z "$CF_BIN" || ! -x "$CF_BIN" ]]; then
      echo "[$(ts)] ERROR: cloudflared not found — cannot reopen tunnel"
    else
      rm -f /tmp/lights-cf-tunnel.log
      nohup "$CF_BIN" tunnel --url http://127.0.0.1:8788 --no-autoupdate \
        >>/tmp/lights-cf-tunnel.log 2>&1 &
      # Wait for trycloudflare URL
      NEW_URL=""
      for i in $(seq 1 30); do
        NEW_URL="$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/lights-cf-tunnel.log 2>/dev/null | tail -1 || true)"
        if [[ -n "$NEW_URL" ]]; then break; fi
        sleep 1
      done
      if [[ -n "$NEW_URL" ]]; then
        umask 077
        printf '%s\n' "$NEW_URL" > "$PROXY_URL_FILE"
        chmod 600 "$PROXY_URL_FILE"
        echo "[$(ts)] CF tunnel reopened → $NEW_URL"
      else
        echo "[$(ts)] ERROR: CF tunnel started but URL not found in log"
      fi
    fi
  fi

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
    git push origin main
    echo "[$(ts)] pushed $(git rev-parse --short HEAD)"
  fi
  echo "[$(ts)] lights-refresh done"
} >>"$LOG" 2>&1
