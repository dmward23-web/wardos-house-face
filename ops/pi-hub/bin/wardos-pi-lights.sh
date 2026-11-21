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
  export HOME="${SERVICE_HOME:-$HOME}"
  export NODE_PATH="${NODE_PATH:-$PREFIX/vendor}"
  if [ -n "${KASA_VENV_PYTHON_BOUND:-}" ]; then
    export KASA_VENV_PYTHON="$KASA_VENV_PYTHON_BOUND"
  fi
  exec "$NODE" "$RUN_TREE/scripts/lights-write-proxy.mjs" --host "$LIGHTS_HOST" --port "$LIGHTS_PORT" --token-file "$TOKEN"
}

if [ "$MODE" = "plan" ]; then
  echo "PLAN lights exec: $NODE $RUN_TREE/scripts/lights-write-proxy.mjs --host $LIGHTS_HOST --port $LIGHTS_PORT"
  echo "PLAN cams: not started"
  exit 0
fi
python3 "$GATE_PY" "$GATE"
profile="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("exec_profile") or "target")' "$GATE")"
case "$profile" in
  target|fixture-stub) ;;
  *) echo "REFUSE exec profile"; exit 78 ;;
esac
if [ "$profile" = "target" ]; then
  if ! KASA_VENV_PYTHON_BOUND="$(python3 "$GATE_PY" --preflight-target "${PREFLIGHT_RESULT:-$PREFIX/deps/preflight-result.json}" "$PREFIX" "${KASA_LOCK:-$PREFIX/deps/kasa-aarch64-cp313.lock.txt}" "${KASA_WHEELHOUSE:-$PREFIX/deps/wheelhouse}")"; then
    printf '%s\n' "$KASA_VENV_PYTHON_BOUND" >&2
    exit 78
  fi
  export KASA_VENV_PYTHON_BOUND
fi
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
  sensi="$RUN_TREE/scripts/sensi-control.mjs"
  accept="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("sensi_opaque") or "")' "$GATE")"
  if [ "$accept" != "accept-existing-hash" ] || [ ! -f "$sensi" ]; then
    echo "REFUSE Sensi presence is not approval and the review stays open"
    exit 78
  fi
  have="$(sha256sum "$sensi" | cut -c1-64)"
  if [ "$have" != "54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc" ]; then
    echo "REFUSE Sensi hash is not the opaque pin"
    exit 78
  fi
  echo "Sensi hash matches the opaque pin; security_review stays open"
fi
if [ "$profile" = "fixture-stub" ] && grep -q 'sensi-control.mjs' "$proxy"; then
  echo "REFUSE fixture profile cannot start the real proxy"
  exit 78
fi
if [ "$profile" = "fixture-stub" ]; then
  case "$PREFIX" in
    /opt/wardos|/opt/wardos/*) echo "REFUSE fixture profile is not the production prefix"; exit 78 ;;
  esac
  fixture_root="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("fixture_root") or "")' "$GATE")"
  standin="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("standin_sha256") or "")' "$GATE")"
  have="$(sha256sum "$proxy" | cut -c1-64)"
  if [ "$fixture_root" != "$PREFIX" ] || [ "$standin" != "$have" ]; then
    echo "REFUSE fixture stand-in"
    exit 78
  fi
fi
lights_exec
