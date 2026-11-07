#!/usr/bin/env bash
# Lights and private-feed startup. Default is a plan. --activate execs the
# proxy only after the gate. Cameras are not a mode of this program.
set -euo pipefail
PREFIX="${WARDOS_PREFIX:-/opt/wardos}"
MODE="plan"
GATE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --activate) MODE="activate" ;;
    --gate) GATE="${2:-}"; shift ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done
if [ -f "$PREFIX/etc/hub.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PREFIX/etc/hub.env"
  set +a
fi
LIGHTS_HOST="${LIGHTS_HOST:-127.0.0.1}"
LIGHTS_PORT="${LIGHTS_PORT:-8788}"
RUN_TREE="${RUN_TREE:-$PREFIX/run}"
NODE="${WARDOS_NODE:-node}"
TOKEN="${LIGHTS_TOKEN_FILE:-$PREFIX/secrets/lights-proxy.token}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# When installed, lib sits next to bin. The source tree uses ops/pi-hub/lib.
if [ -f "$HERE/lib/pi_gate.py" ]; then GATE_PY="$HERE/lib/pi_gate.py"
elif [ -f "$(dirname "$0")/../lib/pi_gate.py" ]; then GATE_PY="$(dirname "$0")/../lib/pi_gate.py"
else GATE_PY="$PREFIX/lib/pi_gate.py"; fi

lights_exec() {
  exec "$NODE" "$RUN_TREE/scripts/lights-write-proxy.mjs" --host "$LIGHTS_HOST" --port "$LIGHTS_PORT"
}

if [ "$MODE" = "plan" ]; then
  echo "PLAN lights exec: $NODE $RUN_TREE/scripts/lights-write-proxy.mjs --host $LIGHTS_HOST --port $LIGHTS_PORT"
  echo "PLAN cams: not started"
  exit 0
fi
python3 "$GATE_PY" "$GATE"
if [ -L "$TOKEN" ] || [ ! -f "$TOKEN" ]; then echo "REFUSE device token path"; exit 78; fi
if [ "$(stat -c %a "$TOKEN")" != "600" ]; then echo "REFUSE device token mode"; exit 78; fi
if [ "$(stat -c %s "$TOKEN")" -le 0 ]; then echo "REFUSE device token empty"; exit 78; fi
stills="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("cached_stills") or "")' "$GATE")"
if [ "$stills" != "allow-existing" ]; then
  echo "REFUSE cached stills decision is not allow-existing"
  exit 78
fi
proxy="$RUN_TREE/scripts/lights-write-proxy.mjs"
if [ -f "$proxy" ] && grep -q 'sensi-control.mjs' "$proxy"; then
  if [ ! -f "$RUN_TREE/scripts/sensi-control.mjs" ]; then
    echo "REFUSE Sensi source is absent; not starting the real proxy"
    exit 78
  fi
fi
lights_exec
