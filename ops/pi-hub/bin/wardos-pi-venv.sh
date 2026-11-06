#!/usr/bin/env bash
# Kasa virtualenv installer. The pip command is real. It runs only on aarch64
# after a separate arm-import gate. Wheel hashes are not that gate.
set -euo pipefail
PREFIX="${WARDOS_PREFIX:-/opt/wardos}"
if [ -f "$PREFIX/etc/hub.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PREFIX/etc/hub.env"
  set +a
fi
LOCK="${KASA_LOCK:-$PREFIX/deps/kasa-aarch64-cp313.lock.txt}"
VENV="${KASA_VENV:-$PREFIX/venv}"
if [ "$(uname -m)" != "aarch64" ] || [ "${WARDOS_ARM_IMPORT:-}" != "passed-on-trixie-aarch64" ]; then
  echo "REFUSE ARM import is unmet on $(uname -m). Wheel hashes are not an install."
  exit 78
fi
python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --require-hashes --no-input --disable-pip-version-check -r "$LOCK"
"$VENV/bin/python" -c 'import kasa, tplinkcloud'
echo "OK venv import"
