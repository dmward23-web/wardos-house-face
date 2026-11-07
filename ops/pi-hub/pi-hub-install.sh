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
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --offline-verify) MODE="verify" ;;
    --install|--stage) MODE="install" ;;
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
  python3 "$HERE/lib/pi_gate.py" --systemd "$GATE"
  [ -n "$PREFIX" ] || PREFIX=/opt/wardos
  allow_prefix "$PREFIX" || exit 78
  ctl="${SYSTEMCTL:-systemctl}"
  python3 - "$GATE" "$ctl" "$MODE" <<'PY'
import json, subprocess, sys
gate, ctl, mode = sys.argv[1:]
doc = json.load(open(gate))
for unit in doc["units"]:
    name = unit["name"]
    frag = unit["fragment_path"]
    show = subprocess.run([ctl, "show", "-p", "FragmentPath", "--value", name], text=True, capture_output=True)
    got = (show.stdout or "").strip()
    if show.returncode != 0 or got != frag:
        print("REFUSE systemd name is not the staged unit")
        raise SystemExit(78)
    if mode == "rollback-services":
        stop = subprocess.run([ctl, "disable", "--now", name])
        if stop.returncode != 0:
            raise SystemExit(stop.returncode)
    elif mode == "start":
        subprocess.run([ctl, "start", name], check=True)
    elif mode == "enable":
        subprocess.run([ctl, "enable", name], check=True)
    else:
        subprocess.run([ctl, "enable", name], check=True)
        subprocess.run([ctl, "start", name], check=True)
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
    case "$rel" in
      /*|*..*) echo "REFUSE receipt path escapes"; exit 2 ;;
    esac
    target="$PREFIX/$rel"
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
    [ -n "${rel:-}" ] || continue
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
mkdir -p "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/lib/systemd/system" "$PREFIX/etc" "$PREFIX/deps" "$PREFIX/runbook" "$PREFIX/secrets"
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
KASA_VENV=$PREFIX/venv
KASA_VENV_PYTHON=$PREFIX/venv/bin/python
KASA_LOCK=$PREFIX/deps/kasa-aarch64-cp313.lock.txt
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
printf '%s\n' "no" >"$PREFIX/etc/units-enabled"
printf '%s\n' "ARM_IMPORT: NOT TESTED" "WHEEL_HASH_IS_NOT_INSTALL: true" >"$PREFIX/deps/ARM-IMPORT-NOT-TESTED"
ln -sfn wardos-pi-lights.sh "$PREFIX/bin/hub"
ln -sfn . "$PREFIX/current"
: >"$receipt"
record_file() {
  printf 'file\t%s\t%s\n' "$1" "$(sha256sum "$PREFIX/$1" | cut -c1-64)" >>"$receipt"
}
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
echo "OK install"
