#!/usr/bin/env bash
# Forever stand-in when box has no crontab: loop lights-refresh every 15m.
# PID file: ~/.cache/wardos/lights-refresh-loop.pid
# SELFHEAL1: each pass first rebuilds the kasa .venv / cloudflared if missing.
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

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] loop start interval=${INTERVAL}s" >>"$LOG_DIR/lights-refresh-loop.log"
while true; do
  heal_lights_deps || echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] self-heal rc=$?" >>"$LOG_DIR/lights-refresh-loop.log"
  "$ROOT/scripts/lights-refresh.sh" || true
  sleep "$INTERVAL"
done
