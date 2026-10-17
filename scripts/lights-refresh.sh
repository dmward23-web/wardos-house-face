#!/usr/bin/env bash
# WardOS House Face · Lights recurring refresh (Sensi/Nest shape)
# PRIVFEED2: Kasa cloud -> PRIVATE lights-live.json (~/.local/share/wardos-private, served via the hub token route).
# No git, no push: the repo is public. Cron: every 15 min. Does NOT touch sensi/nest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PRIV="${WARDOS_PRIVATE_DIR:-$HOME/.local/share/wardos-private}"
LOG_DIR="${HOME}/.cache/wardos"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/lights-refresh.log"
ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }

{
  echo "[$(ts)] lights-refresh start"

  # Ensure write proxy is up (local)
  if ! curl -sf --max-time 3 "http://127.0.0.1:8788/health" >/dev/null 2>&1; then
    echo "[$(ts)] lights-write-proxy down — restarting on :8788"
    RUN_TREE="$(cat "$HOME/.config/wardos/house-run-tree" 2>/dev/null | tr -d '[:space:]')"
    if [[ -z "$RUN_TREE" || ! -f "$RUN_TREE/scripts/lights-write-proxy.mjs" ]]; then
      echo "[$(ts)] WARN: no pinned run tree in ~/.config/wardos/house-run-tree — lights proxy NOT started (PRIVFEED3)"
    elif [[ -s "$HOME/.config/wardos/lights-proxy.token" ]]; then
      # PRIVFEED3 · pinned run tree; key read from the file by the proxy (never argv/env); no keyless switch can leak in
      # HUBPIN1 · house-proc.sh: pid file = the node that owns :8788, every token/keyless variable unset
      . "$RUN_TREE/scripts/house-proc.sh"
      NODE_PATH="${WARDOS_NODE_PATH:-$HOME/.cache/wardos-deps/node_modules}" HP_LOG_DIR="$LOG_DIR" \
        hp_start lights-write-proxy 8788 "$RUN_TREE" scripts/lights-write-proxy.mjs --host 127.0.0.1 --port 8788 --token-file "$HOME/.config/wardos/lights-proxy.token"
      sleep 1
    else
      echo "[$(ts)] WARN: missing lights-proxy.token — cannot restart proxy"
    fi
  fi

  # Named tunnel wardos-hub: the stable hub address stays in ~/.config/wardos/lights-write-proxy.url (box-only).
  [[ -s "$HOME/.config/wardos/lights-write-proxy.url" ]] || echo "[$(ts)] WARN: lights-write-proxy.url missing"
  "$HOME/.local/bin/wardos-hub-tunnel.sh" >/dev/null

  node scripts/lights-fetch.mjs
  STATUS="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('status',''))" "$PRIV/lights-live.json")"
  echo "[$(ts)] lights-refresh done status=$STATUS (private only, nothing pushed)"
} >>"$LOG" 2>&1
