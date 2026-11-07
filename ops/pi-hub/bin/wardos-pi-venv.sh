#!/usr/bin/env bash
# Kasa virtualenv preflight. Default is a plan and does not run pip.
# --preflight builds a venv and attempts the hashed offline install and import.
# It does not treat an environment phrase as proof, and it does not use the network.
set -euo pipefail
PREFIX="${WARDOS_PREFIX:-/opt/wardos}"
MODE="plan"
if [ -f "$PREFIX/etc/hub.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PREFIX/etc/hub.env"
  set +a
fi
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --preflight) MODE="preflight" ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done
LOCK="${KASA_LOCK:-$PREFIX/deps/kasa-aarch64-cp313.lock.txt}"
VENV="${KASA_VENV:-$PREFIX/venv}"
WHEELHOUSE="${KASA_WHEELHOUSE:-$PREFIX/deps/wheelhouse}"
RESULT="${KASA_PREFLIGHT_RESULT:-$PREFIX/deps/preflight-result.json}"
if [ "$MODE" = "plan" ]; then
  echo "PLAN preflight: python3 -m venv, then pip install --require-hashes --no-index --find-links, then import kasa, tplinkcloud"
  echo "PLAN an environment phrase is not proof and is not consulted"
  echo "ARM_IMPORT: NOT TESTED until preflight records a result"
  exit 0
fi
mkdir -p "$(dirname "$RESULT")"
if [ ! -d "$WHEELHOUSE" ] || [ ! -f "$LOCK" ]; then
  echo "REFUSE wheelhouse or lock is missing"
  exit 78
fi
rm -rf "$VENV"
python3 -m venv "$VENV"
set +e
"$VENV/bin/python" -m pip install --require-hashes --no-index --find-links "$WHEELHOUSE" --only-binary=:all: --disable-pip-version-check --no-input -r "$LOCK"
pip_rc=$?
"$VENV/bin/python" -c 'import kasa, tplinkcloud'
imp_rc=$?
set -e
python3 - "$RESULT" "$pip_rc" "$imp_rc" <<'PY'
import json, platform, sys
out, pip_rc, imp_rc = sys.argv[1:]
pip_rc = int(pip_rc)
imp_rc = int(imp_rc)
doc = {
    "schema": "wardos.pi-preflight.result/1",
    "host_arch": platform.machine(),
    "python": platform.python_version(),
    "pip_exit": pip_rc,
    "import_exit": imp_rc,
    "imported": imp_rc == 0,
    "phrase_is_proof": False,
    "aarch64_import_proven": False,
}
with open(out, "w", encoding="utf-8") as fh:
    json.dump(doc, fh)
print("PREFLIGHT imported %s arch %s" % (str(doc["imported"]).lower(), doc["host_arch"]))
PY
if [ "$imp_rc" -ne 0 ]; then
  echo "REFUSE import did not succeed; the result file records the attempt"
  exit 78
fi
echo "OK venv import"
