#!/usr/bin/env bash
# Offline preflight. Default is a plan. --preflight creates a new venv under
# the prefix and does not delete an existing one. Both pip and import must
# succeed. An x86 result is not an aarch64 result.
set -euo pipefail
PREFIX="${WARDOS_PREFIX:-/opt/wardos}"
MODE="plan"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$HERE/lib/pi_gate.py" ]; then GATE_PY="$HERE/lib/pi_gate.py"
else GATE_PY="$PREFIX/lib/pi_gate.py"; fi
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
WHEELHOUSE="${KASA_WHEELHOUSE:-$PREFIX/deps/wheelhouse}"
RESULT="${KASA_PREFLIGHT_RESULT:-$PREFIX/deps/preflight-result.json}"
if [ "$MODE" = "plan" ]; then
  echo "PLAN preflight creates a new contained venv. It does not delete an existing venv."
  echo "PLAN both pip and import must exit 0. An environment phrase is not proof."
  echo "ARM_IMPORT: NOT TESTED until a result is recorded on aarch64"
  exit 0
fi
canon="$(python3 "$GATE_PY" --canonical "$PREFIX")" || { echo "$canon"; exit 78; }
PREFIX="$canon"
parent="$PREFIX/preflight-venvs"
python3 "$GATE_PY" --contained "$PREFIX" "$parent"
python3 "$GATE_PY" --contained "$PREFIX" "$RESULT"
mkdir -p "$parent"
chmod 0755 "$PREFIX" "$parent"
venv="$parent/venv-$$"
if [ -e "$venv" ]; then echo "REFUSE preflight venv path already exists"; exit 78; fi
python3 "$GATE_PY" --contained "$PREFIX" "$venv"
mkdir "$venv"
chmod 0755 "$venv"
python3 -m venv --copies "$venv/env"
if [ -L "$venv/env/bin/python" ]; then
  echo "REFUSE venv launcher is a symlink; the copied interpreter is not contained"
  exit 78
fi
set +e
"$venv/env/bin/python" -m pip install --require-hashes --no-index --find-links "$WHEELHOUSE" --only-binary=:all: --disable-pip-version-check --no-input -r "$LOCK"
pip_rc=$?
"$venv/env/bin/python" -I -c 'import kasa, tplinkcloud'
imp_rc=$?
set -e
mkdir -p "$(dirname "$RESULT")"
python3 - "$RESULT" "$pip_rc" "$imp_rc" "$LOCK" "$WHEELHOUSE" "$venv/env" <<'PY'
import hashlib, json, os, platform, sys
from pathlib import Path
out, pip_rc, imp_rc, lock, house, venv = sys.argv[1:]
pip_rc = int(pip_rc)
imp_rc = int(imp_rc)
arch = platform.machine()
files = sorted(p for p in Path(house).glob("*.whl")) if Path(house).is_dir() else []
blob = "".join(hashlib.sha256(p.read_bytes()).hexdigest() for p in files)
py = str(Path(venv) / "bin" / "python")
doc = {
    "schema": "wardos.pi-preflight.result/1",
    "host_arch": arch,
    "python": platform.python_version(),
    "pip_exit": pip_rc,
    "import_exit": imp_rc,
    "imported": pip_rc == 0 and imp_rc == 0,
    "phrase_is_proof": False,
    "record_is_authentication": False,
    "arm_execution_approved": False,
    "aarch64_import_proven": arch == "aarch64" and pip_rc == 0 and imp_rc == 0,
    "lock_sha256": hashlib.sha256(Path(lock).read_bytes()).hexdigest() if Path(lock).is_file() else "",
    "wheelhouse_sha256": hashlib.sha256(blob.encode()).hexdigest(),
    "venv_path": os.path.realpath(venv),
    "venv_python": py,
    "base_interpreter": os.path.realpath(py) if Path(py).exists() else "",
}
Path(out).write_text(json.dumps(doc), encoding="utf-8")
print("PREFLIGHT pip %s import %s arch %s proven %s" % (pip_rc, imp_rc, arch, str(doc["aarch64_import_proven"]).lower()))
PY
chmod -R u+rX "$venv/env"
find "$venv/env" -type d -exec chmod 0755 {} +
find "$venv/env" -type f -exec chmod 0644 {} +
find "$venv/env/bin" -type f -exec chmod 0755 {} +
if [ "$pip_rc" -ne 0 ] || [ "$imp_rc" -ne 0 ]; then
  echo "REFUSE preflight pip and import must both succeed"
  exit 78
fi
echo "OK venv import"
