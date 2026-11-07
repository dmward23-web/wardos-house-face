#!/usr/bin/env bash
# One named-tunnel connector. Default is a plan. --activate execs cloudflared
# only after the same gate as the lights process. There is no camera connector.
set -euo pipefail
PREFIX="${WARDOS_PREFIX:-/opt/wardos}"
MODE="plan"
GATE=""
CONNECTOR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --activate) MODE="activate" ;;
    --gate) GATE="${2:-}"; shift ;;
    --connector) CONNECTOR="${2:-}"; shift ;;
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
CF="${WARDOS_CLOUDFLARED:-cloudflared}"
CFG="${TUNNEL_CONFIG:-$PREFIX/etc/tunnel.yml}"
NAME="${TUNNEL_NAME:-wardos-hub}"
case "$CONNECTOR" in
  r1) METRICS="${METRICS_R1:-20241}" ;;
  r2) METRICS="${METRICS_R2:-20242}" ;;
  *) echo "REFUSE connector must be r1 or r2"; exit 2 ;;
esac
HERE="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$HERE/lib/pi_gate.py" ]; then GATE_PY="$HERE/lib/pi_gate.py"
else GATE_PY="$PREFIX/lib/pi_gate.py"; fi

tunnel_exec() {
  exec "$CF" tunnel --config "$CFG" --protocol http2 --metrics "127.0.0.1:$METRICS" run "$NAME"
}

if [ "$MODE" = "plan" ]; then
  echo "PLAN tunnel $CONNECTOR exec: $CF tunnel --config $CFG --protocol http2 --metrics 127.0.0.1:$METRICS run $NAME"
  echo "PLAN cams: not started"
  exit 0
fi
python3 "$GATE_PY" "$GATE"
if [ ! -f "$CFG" ]; then echo "REFUSE tunnel config path"; exit 78; fi
if [ "$NAME" = "wardos-hub" ]; then
  cut="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("cutover") or "")' "$GATE")"
  if [ "$cut" != "approved" ]; then
    echo "REFUSE tunnel name wardos-hub needs a separate cutover approval"
    exit 78
  fi
fi
tunnel_exec
