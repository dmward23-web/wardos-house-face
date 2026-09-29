#!/usr/bin/env bash
# KEEPALIVE1 · WardOS House Face: bring the hub back after Atlas's computer restarts.
#  1. Nest camera proxy (:8787) up, and its public quick tunnel answering.
#     If the tunnel died, reopen it and save the new address to
#     ~/.config/wardos/nest-webrtc-proxy.url (nest-fetch.mjs bakes it into
#     data/nest-live.json; pages follow the newest address · PROXYFOLLOW1).
#  2. Lights refresh loop running (it already heals the lights proxy + tunnel).
# Prints one line: OK, or CHANGED:<what> when something was restarted.
# Never prints keys. Kills only exact PIDs it found for its own port.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CFG="$HOME/.config/wardos"
LOG_DIR="$HOME/.cache/wardos"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/house-keepalive.log"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
CHANGED=()
CF_BIN="/tmp/cloudflared"; [[ -x "$CF_BIN" ]] || CF_BIN="$(command -v cloudflared || true)"

# --- 1a. Nest proxy
if ! curl -sf --max-time 3 http://127.0.0.1:8787/health >/dev/null 2>&1; then
  if [[ -f "$CFG/nest-proxy.token" ]]; then
    NEST_PROXY_TOKEN="$(cat "$CFG/nest-proxy.token")" setsid nohup node scripts/nest-webrtc-proxy.mjs \
      --host 127.0.0.1 --port 8787 >>/tmp/nest-proxy.log 2>&1 < /dev/null &
    sleep 2
    CHANGED+=("nest-proxy")
    echo "[$(ts)] nest proxy restarted" >>"$LOG"
  else
    echo "[$(ts)] WARN nest-proxy.token missing" >>"$LOG"
  fi
fi

# --- 1b. Nest tunnel
URL_FILE="$CFG/nest-webrtc-proxy.url"
CUR="$( [[ -f "$URL_FILE" ]] && tr -d '[:space:]' < "$URL_FILE" )"
if [[ -z "$CUR" ]] || ! curl -sf --max-time 8 "$CUR/health" >/dev/null 2>&1; then
  # second look before reopening (quick tunnels blip)
  sleep 5
  if [[ -z "$CUR" ]] || ! curl -sf --max-time 8 "$CUR/health" >/dev/null 2>&1; then
    for pid in $(ps -eo pid=,args= | awk '$2 ~ /cloudflared$/ && /--url http:\/\/127\.0\.0\.1:8787( |$)/ {print $1}'); do
      kill "$pid" 2>/dev/null || true
    done
    if [[ -n "$CF_BIN" && -x "$CF_BIN" ]]; then
      rm -f /tmp/nest-cf-tunnel.log
      setsid nohup "$CF_BIN" tunnel --url http://127.0.0.1:8787 --no-autoupdate \
        >>/tmp/nest-cf-tunnel.log 2>&1 < /dev/null &
      NEW=""
      for i in $(seq 1 40); do
        NEW="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/nest-cf-tunnel.log 2>/dev/null | tail -1)"
        [[ -n "$NEW" ]] && break; sleep 1
      done
      if [[ -n "$NEW" ]]; then
        umask 077; printf '%s\n' "$NEW" > "$URL_FILE"; chmod 600 "$URL_FILE"
        CHANGED+=("nest-tunnel")
        echo "[$(ts)] nest tunnel reopened -> $NEW" >>"$LOG"
      else
        echo "[$(ts)] ERROR nest tunnel started but no URL" >>"$LOG"
      fi
    fi
  fi
fi

# --- 2. Lights refresh loop
PIDFILE="$LOG_DIR/lights-refresh-loop.pid"
OLD="$( [[ -f "$PIDFILE" ]] && cat "$PIDFILE" )"
if [[ -z "$OLD" ]] || ! kill -0 "$OLD" 2>/dev/null; then
  setsid nohup bash scripts/lights-refresh-loop.sh >/dev/null 2>&1 < /dev/null &
  CHANGED+=("lights-loop")
  echo "[$(ts)] lights refresh loop restarted" >>"$LOG"
fi

if [[ ${#CHANGED[@]} -eq 0 ]]; then echo OK; else echo "CHANGED:$(IFS=,; echo "${CHANGED[*]}")"; fi
