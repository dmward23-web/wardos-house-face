#!/usr/bin/env bash
# KEEPALIVE1 · WardOS House Face: bring the hub back after Atlas's computer restarts.
#  1. Nest camera proxy (:8787) up, and its public quick tunnel answering.
#     If the tunnel died, reopen it and save the new address to
#     ~/.config/wardos/nest-webrtc-proxy.url (nest-fetch.mjs bakes it into
#     data/nest-live.json; pages follow the newest address · PROXYFOLLOW1).
#  2. Lights refresh loop running (it already heals the lights proxy + tunnel).
#  0. SELFHEAL1: first rebuild the kasa .venv / reinstall cloudflared if a
#     restore dropped them.
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

# SELFHEAL1 · rebuild what a box restart/restore drops: the kasa .venv (from
# plates requirements.txt) and cloudflared (~/.local/bin, official GitHub
# release). Idempotent, flock-guarded, logs to ~/.cache/wardos/heal-deps.log.
# Never reads or prints keys. Exit bits: 1 venv rebuilt · 2 cloudflared
# installed · 4 a repair failed.
KASA_VENV_DIR="${KASA_VENV_DIR:-/workspace/plates/2026-09-28/kasa-live}"
CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
heal_lights_deps() {
  mkdir -p "$HOME/.local/bin" "$HOME/.cache/wardos"
  (
    _ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }
    flock -w 600 9 || { echo "[$(_ts)] heal: lock busy — skip"; exit 0; }
    rc=0
    venv="$KASA_VENV_DIR/.venv"; req="$KASA_VENV_DIR/requirements.txt"
    if ! "$venv/bin/python" -c 'import kasa, tplinkcloud' >/dev/null 2>&1; then
      echo "[$(_ts)] heal: kasa venv missing/broken — rebuilding $venv"
      mkdir -p "$KASA_VENV_DIR"; rm -rf "$venv"
      if [[ -f "$req" ]]; then set -- -r "$req"; else set -- python-kasa==0.10.2 tplink-cloud-api==5.2.1; fi
      if python3 -m venv "$venv" && "$venv/bin/pip" install -q "$@" \
         && "$venv/bin/python" -c 'import kasa, tplinkcloud'; then
        echo "[$(_ts)] heal: kasa venv rebuilt"; rc=$((rc | 1))
      else
        echo "[$(_ts)] heal: ERROR kasa venv rebuild failed"; rc=$((rc | 4))
      fi
    fi
    if [[ ! -x /tmp/cloudflared ]] && ! command -v cloudflared >/dev/null 2>&1; then
      echo "[$(_ts)] heal: cloudflared missing — installing to ~/.local/bin"
      tmp="$HOME/.local/bin/.cloudflared.$$"
      if curl -fsSL --max-time 180 -o "$tmp" "$CF_URL" && chmod +x "$tmp" \
         && "$tmp" --version >/dev/null 2>&1 && mv -f "$tmp" "$HOME/.local/bin/cloudflared"; then
        echo "[$(_ts)] heal: cloudflared installed ($("$HOME/.local/bin/cloudflared" --version 2>&1 | head -1))"
        rc=$((rc | 2))
      else
        rm -f "$tmp"; echo "[$(_ts)] heal: ERROR cloudflared install failed"; rc=$((rc | 4))
      fi
    fi
    exit $rc
  ) 9>"$HOME/.cache/wardos/heal-deps.lock" >>"$HOME/.cache/wardos/heal-deps.log" 2>&1
}

# --- 0. Self-heal deps (SELFHEAL1) before anything needs them
heal_lights_deps; HEAL_RC=$?
(( HEAL_RC & 1 )) && CHANGED+=("kasa-venv")
(( HEAL_RC & 2 )) && CHANGED+=("cloudflared")
(( HEAL_RC & 4 )) && echo "[$(ts)] WARN self-heal failed (see heal-deps.log)" >>"$LOG"
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
