#!/usr/bin/env bash
# KEEPALIVE1 · WardOS House Face: bring the hub back after Atlas's computer restarts.
#  1. Nest camera proxy (:8787) up, and its public quick tunnel answering.
#     If the tunnel died, reopen it and save the new address to
#     ~/.config/wardos/nest-webrtc-proxy.url (nest-fetch.mjs bakes it into the PRIVATE
#     nest-live.json, served only through the hub token route · PRIVFEED2).
#  2. Lights refresh loop running (it already heals the lights proxy + tunnel).
#  0. SELFHEAL1: first rebuild the kasa .venv / reinstall cloudflared if a
#     restore dropped them.
# Prints one line: OK, or CHANGED:<what> when something was restarted.
# Never prints keys. Kills only exact PIDs it found for its own port.
# PRIVFEED3 · STAYS OFF until Atlas/Dan say otherwise. When it runs, the proxies start ONLY from the pinned detached
# run tree named in ~/.config/wardos/house-run-tree (one absolute path, e.g. /workspace/wt-house-run-<sha>), never
# from a working branch. Keys are read from files by the proxies themselves (never argv, never env).
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

# --- 1a. Nest proxy (PRIVFEED3 · pinned run tree, key files only, both device + rotated nest keys)
RUN_TREE="$(cat "$CFG/house-run-tree" 2>/dev/null | tr -d '[:space:]')"
if ! curl -sf --max-time 3 http://127.0.0.1:8787/health >/dev/null 2>&1; then
  if [[ -z "$RUN_TREE" || ! -f "$RUN_TREE/scripts/nest-webrtc-proxy.mjs" ]]; then
    echo "[$(ts)] WARN no pinned run tree in $CFG/house-run-tree; nest proxy NOT started" >>"$LOG"
  elif [[ -s "$CFG/nest-device.token" || -s "$CFG/nest-proxy.token" ]]; then
    # HUBPIN1 · house-proc.sh: pid file = the node that owns :8787, every token/keyless variable unset
    . "$RUN_TREE/scripts/house-proc.sh"
    HP_LOG_DIR="$LOG_DIR" hp_start nest-webrtc-proxy 8787 "$RUN_TREE" scripts/nest-webrtc-proxy.mjs \
      --host 127.0.0.1 --port 8787 --auth-token-file "$CFG/nest-device.token" --auth-token-file "$CFG/nest-proxy.token" >>"$LOG" 2>&1
    sleep 2
    CHANGED+=("nest-proxy")
    echo "[$(ts)] nest proxy restarted from pinned run tree" >>"$LOG"
  else
    echo "[$(ts)] WARN nest key files missing" >>"$LOG"
  fi
fi

# HUBDOG1 · 60s tunnel watchdog (catches a connector that is up but answers 502)
[[ -x "$HOME/.local/bin/wardos-hub-watchdog.sh" ]] && ! pgrep -f wardos-hub-watchdog.sh >/dev/null && { setsid nohup "$HOME/.local/bin/wardos-hub-watchdog.sh" >/dev/null 2>&1 </dev/null & CHANGED+=("hub-watchdog"); }

# --- 1b. Named tunnel wardos-hub — stable URLs, no quick tunnels. PRIVFEED2: the hub addresses live only in
#     ~/.config/wardos/{nest-webrtc-proxy,lights-write-proxy}.url (box-only); never written into the repo.
URL_FILE="$CFG/nest-webrtc-proxy.url"
[[ -s "$URL_FILE" ]] || echo "[$(ts)] WARN: $URL_FILE missing (set the cams hub address there)" >>"$LOG"
if [[ "$("$HOME/.local/bin/wardos-hub-tunnel.sh")" == RESTARTED ]]; then
  CHANGED+=("hub-tunnel"); echo "[$(ts)] named tunnel wardos-hub restarted" >>"$LOG"
fi

# --- 2. Lights refresh loop
PIDFILE="$LOG_DIR/lights-refresh-loop.pid"
OLD="$( [[ -f "$PIDFILE" ]] && cat "$PIDFILE" )"
if [[ -z "$OLD" ]] || ! kill -0 "$OLD" 2>/dev/null; then
  # HUBPIN1 · refuse without the pinned run tree (never fall back to this dev checkout)
  if [[ -z "$RUN_TREE" || ! -f "$RUN_TREE/scripts/lights-refresh-loop.sh" ]]; then
    echo "[$(ts)] WARN no pinned run tree in $CFG/house-run-tree; lights refresh loop NOT started" >>"$LOG"
  else
    setsid nohup bash "$RUN_TREE/scripts/lights-refresh-loop.sh" >/dev/null 2>&1 < /dev/null &
    CHANGED+=("lights-loop")
    echo "[$(ts)] lights refresh loop restarted from pinned run tree" >>"$LOG"
  fi
fi

if [[ ${#CHANGED[@]} -eq 0 ]]; then echo OK; else echo "CHANGED:$(IFS=,; echo "${CHANGED[*]}")"; fi
