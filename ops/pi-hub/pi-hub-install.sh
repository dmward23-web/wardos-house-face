#!/usr/bin/env bash
# Pi hub install for Raspberry Pi OS Trixie arm64 Desktop.
# Default is a plan. Install writes /opt/wardos (or --prefix) and does not
# enable units. Activation is a separate command with a gate at the boundary.
set -euo pipefail
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MODE="plan"
PREFIX=""
GATE=""
INSTALL_PROFILE="target"
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --offline-verify) MODE="verify" ;;
    --install) MODE="install"; INSTALL_PROFILE="target" ;;
    --stage|--fixture-install) MODE="install"; INSTALL_PROFILE="fixture" ;;
    --rollback) MODE="rollback" ;;
    --rollback-services) MODE="rollback-services" ;;
    --enable) MODE="enable" ;;
    --start) MODE="start" ;;
    --activate) MODE="activate" ;;
    --prefix|--dest) PREFIX="${2:-}"; shift ;;
    --gate) GATE="${2:-}"; shift ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done

allow_prefix() {
  local resolved
  if ! resolved="$(python3 "$HERE/lib/pi_gate.py" --canonical "$1")"; then
    printf '%s\n' "$resolved" >&2
    return 78
  fi
  PREFIX="$resolved"
}

if [ "$MODE" = "plan" ]; then
  cat <<'EOF'
PLAN pi-hub: NOT AN INSTALL AND NOT AN ACTIVATION
Default install root is /opt/wardos. Units are installed disabled until a separate activation gate. This plan does not enable SSH and does not join a tunnel.
The Pi is the intended always-on hub host. The Elo/Beelink is the wall client. A separate Pi is not required by the code if the Beelink is kept always on and is an approved hub host. That choice is not made here.
The box Kasa lock has 21 package declarations and 21 hashes, not 22. ARM import: NOT TESTED. The wheels were not imported on aarch64. Wheel hashes are not a successful install. The venv command exists and refuses on this side of that hardware gate.
Sensi is not copied. A Pi install needs a secret-free Sensi integration or it leaves Sensi out. Either choice needs an independent gate.
Preflight runs pip and the import and records the result. An environment phrase is not that result. This host has not imported the aarch64 wheels.
EOF
  exit 0
fi

if [ "$MODE" = "verify" ]; then
  python3 - "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$HERE/deps/kasa-aarch64-cp313.wheelhouse.txt" <<'PY'
import sys
lock, house = sys.argv[1:]
hashes = []
for line in open(lock):
    s = line.strip().rstrip("\\").strip()
    if s.startswith("--hash=sha256:"):
        hashes.append(s.split("sha256:", 1)[1])
names = {}
for line in open(house):
    if line.startswith("#") or not line.strip():
        continue
    name, digest = line.split()
    names[digest] = name
if len(hashes) != 21 or len(names) != 21:
    raise SystemExit("REFUSE lock count")
for digest in hashes:
    if digest not in names:
        raise SystemExit("REFUSE wheelhouse missing a lock hash")
print("VERIFY lock 21 hashes listed in the wheelhouse")
PY
  echo "ARM_IMPORT: NOT TESTED"
  echo "WHEEL_HASH_IS_NOT_INSTALL: true"
  echo "SENSI: excluded"
  echo "ACTIVATION: gated"
  echo "TOKENS: absent"
  exit 0
fi

if [ "$MODE" = "enable" ] || [ "$MODE" = "start" ] || [ "$MODE" = "activate" ] || [ "$MODE" = "rollback-services" ]; then
  [ -n "$GATE" ] || { echo "REFUSE activation gate absent"; exit 78; }
  [ -n "$PREFIX" ] || PREFIX=/opt/wardos
  allow_prefix "$PREFIX" || exit 78
  python3 "$HERE/lib/pi_gate.py" --systemd "$GATE" "$PREFIX"
  ctl="${SYSTEMCTL:-systemctl}"
  python3 - "$GATE" "$ctl" "$MODE" "$PREFIX" <<'PY'
import json, subprocess, sys
gate, ctl, mode, prefix = sys.argv[1:]
doc = json.load(open(gate))

def show(name):
    run = subprocess.run([ctl, "show", "-p", "FragmentPath", "-p", "DropInPaths", "-p", "User", "-p", "ExecStart", "-p", "MainPID", name], text=True, capture_output=True)
    if run.returncode != 0:
        print("REFUSE systemd show")
        raise SystemExit(78)
    info = {}
    for line in (run.stdout or "").splitlines():
        if "=" in line:
            key, val = line.split("=", 1)
            info[key] = val.strip()
    return info

checked = []
for unit in doc["units"]:
    name = unit["name"]
    frag = unit["fragment_path"]
    info = show(name)
    if info.get("FragmentPath") != frag or not frag.startswith(prefix + "/"):
        print("REFUSE systemd name is not the staged unit")
        raise SystemExit(78)
    if info.get("DropInPaths", "") not in ("", "-"):
        print("REFUSE systemd drop-in")
        raise SystemExit(78)
    if info.get("MainPID", "0") not in ("0", ""):
        print("REFUSE systemd foreign run")
        raise SystemExit(78)
    text = open(frag, encoding="utf-8").read().splitlines()
    file_user = next(line.split("=", 1)[1].strip() for line in text if line.startswith("User="))
    file_exec = next(line.split("=", 1)[1].strip() for line in text if line.startswith("ExecStart="))
    if info.get("User", "") != file_user or file_exec not in info.get("ExecStart", ""):
        print("REFUSE systemd effective unit")
        raise SystemExit(78)
    checked.append(name)
done = []
try:
    for name in checked:
        if mode == "rollback-services":
            args = ["disable", "--now", name]
        elif mode == "start":
            args = ["start", name]
        elif mode == "enable":
            args = ["enable", name]
        else:
            subprocess.run([ctl, "enable", name], check=True)
            done.append(name)
            args = ["start", name]
        subprocess.run([ctl, *args], check=True)
        if mode != "activate":
            done.append(name)
except subprocess.CalledProcessError:
    for name in reversed(done):
        subprocess.run([ctl, "disable", "--now", name])
    print("REFUSE systemd partial action reversed")
    raise SystemExit(78)
print("OK systemd " + mode)
PY
  exit 0
fi

[ -n "$PREFIX" ] || { echo "REFUSE dest required"; exit 2; }
allow_prefix "$PREFIX" || exit 78
case "$PREFIX" in
  /opt/wardos|/opt/wardos/*)
    python3 "$HERE/lib/pi_gate.py" --install "${GATE:-}" "$PREFIX"
    ;;
esac
receipt="$PREFIX/receipt.tsv"

if [ "$MODE" = "rollback" ]; then
  [ -f "$receipt" ] || { echo "REFUSE no receipt"; exit 2; }
  while IFS=$'\t' read -r kind rel extra; do
    [ -n "${rel:-}" ] || continue
    [ "$kind" = schema ] && continue
    case "$rel" in
      /*|*..*) echo "REFUSE receipt path escapes"; exit 2 ;;
    esac
    target="$PREFIX/$rel"
    if [ "$kind" = link ]; then
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$(dirname "$target")"
    else
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$target"
    fi
    case "$kind" in
      link)
        [ -L "$target" ] || { echo "REFUSE missing link $rel"; exit 2; }
        [ "$(readlink "$target")" = "$extra" ] || { echo "REFUSE link changed $rel"; exit 2; }
        ;;
      file)
        [ -f "$target" ] && [ ! -L "$target" ] || { echo "REFUSE missing $rel"; exit 2; }
        have="$(sha256sum "$target" | cut -c1-64)"
        [ "$have" = "$extra" ] || { echo "REFUSE hash changed $rel"; exit 2; }
        ;;
      *) echo "REFUSE receipt kind"; exit 2 ;;
    esac
  done <"$receipt"
  while IFS=$'\t' read -r kind rel extra; do
    [ "$kind" = file ] || [ "$kind" = link ] || continue
    rm -f "$PREFIX/$rel"
  done <"$receipt"
  rm -f "$receipt"
  echo "OK rollback"
  exit 0
fi

if [ -n "$(find "$PREFIX" -mindepth 1 -print -quit 2>/dev/null)" ]; then
  echo "REFUSE prefix is not a fresh empty directory"
  exit 78
fi
SERVICE_USER="${WARDOS_SERVICE_USER:-fixture}"
SERVICE_HOME="${WARDOS_SERVICE_HOME:-$PREFIX/service-home}"
if [ -n "$GATE" ]; then
  eval "$(python3 - "$GATE" <<'PY'
import json, shlex, sys
g = json.load(open(sys.argv[1]))
print("SERVICE_USER=" + shlex.quote(str(g.get("service_user") or "fixture")))
print("SERVICE_HOME=" + shlex.quote(str(g.get("service_home") or "")))
PY
)"
fi
if [ -z "$SERVICE_HOME" ]; then SERVICE_HOME="$PREFIX/service-home"; fi
if [ "$INSTALL_PROFILE" = "target" ]; then
  [ -n "${WARDOS_PI_PAYLOAD:-}" ] || { echo "REFUSE target payload required"; exit 78; }
  if ! id -u "$SERVICE_USER" >/dev/null 2>&1 || [ "$(id -u "$SERVICE_USER")" = "0" ]; then
    echo "REFUSE service account is absent or root"
    exit 78
  fi
fi
mkdir -p "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/lib/systemd/system" "$PREFIX/etc" "$PREFIX/deps/wheelhouse" "$PREFIX/runbook" "$PREFIX/secrets" "$PREFIX/vendor"
chmod 0755 "$PREFIX" "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/lib/systemd" "$PREFIX/lib/systemd/system" "$PREFIX/etc" "$PREFIX/deps" "$PREFIX/deps/wheelhouse" "$PREFIX/runbook" "$PREFIX/secrets" "$PREFIX/vendor"
: >"$receipt"
printf 'schema\twardos.pi-install.receipt/1\tplan\n' >>"$receipt"
cleanup_partial() {
  [ -f "$receipt" ] || return 0
  while IFS=$'\t' read -r kind rel extra; do
    [ "$kind" = file ] || [ "$kind" = link ] || continue
    python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$PREFIX/$rel" || continue
    rm -f "$PREFIX/$rel"
  done <"$receipt"
}
trap cleanup_partial ERR
install -m 0755 "$HERE/bin/wardos-pi-lights.sh" "$PREFIX/bin/wardos-pi-lights.sh"
install -m 0755 "$HERE/bin/wardos-pi-tunnel.sh" "$PREFIX/bin/wardos-pi-tunnel.sh"
install -m 0755 "$HERE/bin/wardos-pi-venv.sh" "$PREFIX/bin/wardos-pi-venv.sh"
install -m 0644 "$HERE/lib/pi_gate.py" "$PREFIX/lib/pi_gate.py"
sed -e "s#@PREFIX@#$PREFIX#g" -e "s#@USER@#$SERVICE_USER#g" -e "s#@HOME@#$SERVICE_HOME#g" "$HERE/units/wardos-pi-lights.service" >"$PREFIX/lib/systemd/system/wardos-pi-lights.service"
sed -e "s#@PREFIX@#$PREFIX#g" -e "s#@USER@#$SERVICE_USER#g" -e "s#@HOME@#$SERVICE_HOME#g" "$HERE/units/wardos-pi-tunnel@.service" >"$PREFIX/lib/systemd/system/wardos-pi-tunnel@.service"
chmod 0644 "$PREFIX/lib/systemd/system/wardos-pi-lights.service" "$PREFIX/lib/systemd/system/wardos-pi-tunnel@.service"
cp "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$PREFIX/deps/kasa-aarch64-cp313.lock.txt"
cp "$HERE/deps/kasa-aarch64-cp313.wheelhouse.txt" "$PREFIX/deps/kasa-aarch64-cp313.wheelhouse.txt"
cp "$HERE/RUNBOOK.md" "$PREFIX/runbook/RUNBOOK.md"
chmod 0644 "$PREFIX/runbook/RUNBOOK.md" "$PREFIX/deps/kasa-aarch64-cp313.lock.txt" "$PREFIX/deps/kasa-aarch64-cp313.wheelhouse.txt"
cat >"$PREFIX/etc/hub.env" <<EOF
WARDOS_PREFIX=$PREFIX
SERVICE_USER=$SERVICE_USER
SERVICE_HOME=$SERVICE_HOME
LIGHTS_HOST=127.0.0.1
LIGHTS_PORT=8788
METRICS_R1=20241
METRICS_R2=20242
TUNNEL_NAME=wardos-hub
TUNNEL_CONFIG=$PREFIX/etc/tunnel.yml
RUN_TREE=$PREFIX/run
NODE_PATH=$PREFIX/vendor
KASA_LOCK=$PREFIX/deps/kasa-aarch64-cp313.lock.txt
KASA_WHEELHOUSE=$PREFIX/deps/wheelhouse
LIGHTS_TOKEN_FILE=$PREFIX/secrets/lights-proxy.token
KASA_USER_FILE=$SERVICE_HOME/.config/wardos/kasa.user
KASA_PASSWORD_FILE=$SERVICE_HOME/.config/wardos/kasa.password
HOUSE_ORIGINS=https://dmward23-web.github.io,https://cams.wardhousehub.com
EOF
cat >"$PREFIX/etc/secrets.refs" <<EOF
# path mode. Install does not create these files and does not read values.
$PREFIX/secrets/lights-proxy.token 0600
$SERVICE_HOME/.config/wardos/kasa.user 0600
$SERVICE_HOME/.config/wardos/kasa.password 0600
$PREFIX/etc/tunnel.yml 0640
EOF
if [ -n "${WARDOS_PI_PAYLOAD:-}" ]; then
  python3 - "$HERE/OFFLINE-MANIFEST.json" "$WARDOS_PI_PAYLOAD" <<'PY'
import hashlib, json, sys
from pathlib import Path
manifest, root = sys.argv[1:]
doc = json.load(open(manifest))
need = {"node-v24.22.1-linux-arm64.tar.xz", "cloudflared-linux-arm64"}
seen = set()
rootp = Path(root)
for row in doc["files"]:
    if row["name"] not in need:
        continue
    target = rootp / row["name"]
    data = target.read_bytes()
    if len(data) != row["bytes"] or hashlib.sha256(data).hexdigest() != row["sha256"]:
        raise SystemExit("REFUSE payload hash " + row["name"])
    seen.add(row["name"])
if seen != need:
    raise SystemExit("REFUSE payload missing node or cloudflared")
wheels = doc.get("wheels") or []
if len(wheels) != 21:
    raise SystemExit("REFUSE payload wheel count")
for row in wheels:
    target = rootp / "wheels" / row["name"]
    data = target.read_bytes()
    if len(data) != row["bytes"] or hashlib.sha256(data).hexdigest() != row["sha256"]:
        raise SystemExit("REFUSE payload wheel " + row["name"])
print("OK payload hashes")
PY
  install -m 0755 "$WARDOS_PI_PAYLOAD/cloudflared-linux-arm64" "$PREFIX/bin/cloudflared"
  payload_tmp="$(mktemp -d)"
  tar -xJf "$WARDOS_PI_PAYLOAD/node-v24.22.1-linux-arm64.tar.xz" -C "$payload_tmp" --wildcards '*/bin/node'
  payload_node="$(find "$payload_tmp" -type f -name node -print -quit)"
  [ -n "$payload_node" ] || { echo "REFUSE payload node member missing"; exit 2; }
  install -m 0755 "$payload_node" "$PREFIX/bin/node"
  rm -rf "$payload_tmp"
  printf 'WARDOS_NODE=%s\nWARDOS_CLOUDFLARED=%s\n' "$PREFIX/bin/node" "$PREFIX/bin/cloudflared" >>"$PREFIX/etc/hub.env"
  while IFS= read -r wheel; do
    [ -n "$wheel" ] || continue
    install -m 0644 "$WARDOS_PI_PAYLOAD/wheels/$wheel" "$PREFIX/deps/wheelhouse/$wheel"
  done < <(python3 -c 'import json,sys; print("\n".join(r["name"] for r in json.load(open(sys.argv[1]))["wheels"]))' "$HERE/OFFLINE-MANIFEST.json")
fi
printf '%s\n' "no" >"$PREFIX/etc/units-enabled"
printf '%s\n' "ARM_IMPORT: NOT TESTED" "WHEEL_HASH_IS_NOT_INSTALL: true" >"$PREFIX/deps/ARM-IMPORT-NOT-TESTED"
ln -sfn wardos-pi-lights.sh "$PREFIX/bin/hub"
ln -sfn . "$PREFIX/current"
record_file() {
  printf 'file\t%s\t%s\n' "$1" "$(sha256sum "$PREFIX/$1" | cut -c1-64)" >>"$receipt"
}
if [ -f "$PREFIX/bin/node" ]; then record_file bin/node; fi
if [ -f "$PREFIX/bin/cloudflared" ]; then record_file bin/cloudflared; fi
if [ -d "$PREFIX/deps/wheelhouse" ]; then
  for wheel in "$PREFIX/deps/wheelhouse"/*.whl; do
    [ -f "$wheel" ] || continue
    record_file "deps/wheelhouse/$(basename "$wheel")"
  done
fi
record_file bin/wardos-pi-lights.sh
record_file bin/wardos-pi-tunnel.sh
record_file bin/wardos-pi-venv.sh
record_file lib/pi_gate.py
record_file lib/systemd/system/wardos-pi-lights.service
record_file lib/systemd/system/wardos-pi-tunnel@.service
record_file deps/kasa-aarch64-cp313.lock.txt
record_file deps/kasa-aarch64-cp313.wheelhouse.txt
record_file deps/ARM-IMPORT-NOT-TESTED
record_file runbook/RUNBOOK.md
record_file etc/hub.env
record_file etc/secrets.refs
record_file etc/units-enabled
printf 'link\t%s\t%s\n' bin/hub wardos-pi-lights.sh >>"$receipt"
printf 'link\t%s\t%s\n' current . >>"$receipt"
runtime="$HERE/runtime"
mkdir -p "$PREFIX/run/scripts" "$PREFIX/vendor"
while read -r digest name; do
  [ -n "${name:-}" ] || continue
  case "$name" in
    *sensi*) echo "REFUSE Sensi is not staged"; exit 2 ;;
    */*|*..*) echo "REFUSE runtime name escapes"; exit 2 ;;
  esac
  src="$runtime/$name"
  have="$(sha256sum "$src" | cut -c1-64)"
  [ "$have" = "$digest" ] || { echo "REFUSE runtime hash before copy $name"; exit 2; }
  install -m 0644 "$src" "$PREFIX/run/scripts/$name"
  record_file "run/scripts/$name"
done <"$runtime/SHA256SUMS"
if [ -e "$PREFIX/run/scripts/sensi-control.mjs" ]; then
  echo "REFUSE Sensi file was staged"
  exit 2
fi
mkdir -p "$PREFIX/vendor/ws"
while read -r digest name; do
  [ -n "${name:-}" ] || continue
  case "$name" in
    /*|*..*) echo "REFUSE ws path escapes"; exit 2 ;;
  esac
  src="$HERE/vendor/ws/$name"
  have="$(sha256sum "$src" | cut -c1-64)"
  [ "$have" = "$digest" ] || { echo "REFUSE ws hash before copy $name"; exit 2; }
  mkdir -p "$PREFIX/vendor/ws/$(dirname "$name")"
  install -m 0644 "$src" "$PREFIX/vendor/ws/$name"
  record_file "vendor/ws/$name"
done <"$HERE/vendor/ws.SHA256SUMS"
trap - ERR
echo "OK install"
