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
  case "$1" in
    /opt/wardos|/opt/wardos/*|/tmp/*|/var/tmp/*|/opt/cursor/artifacts/*) ;;
    *) echo "REFUSE dest is not the Pi install root or a test prefix"; exit 2 ;;
  esac
  case "$1" in
    /|/etc|/etc/*|/usr|/usr/*|/lib|/lib/*|/bin|/bin/*|/home|/home/dan|/home/dan/*|/workspace|/workspace/*|"$REPO"|"$REPO"/*)
      echo "REFUSE dest is a live or checkout path"
      exit 2
      ;;
  esac
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

if [ "$MODE" = "enable" ] || [ "$MODE" = "start" ] || [ "$MODE" = "activate" ]; then
  [ -n "$GATE" ] || { echo "REFUSE activation gate absent"; exit 78; }
  python3 "$HERE/lib/pi_gate.py" --systemd "$GATE"
  [ -n "$PREFIX" ] || PREFIX=/opt/wardos
  allow_prefix "$PREFIX"
  ctl="${SYSTEMCTL:-systemctl}"
  mapfile -t units < <(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["units"]))' "$GATE")
  for unit in "${units[@]}"; do
    [ -n "$unit" ] || continue
    case "$unit" in
      wardos-pi-lights.service|wardos-pi-tunnel@r1.service|wardos-pi-tunnel@r2.service) ;;
      *) echo "REFUSE systemd unit"; exit 78 ;;
    esac
    if [ "$MODE" = "start" ]; then
      "$ctl" start "$unit"
    elif [ "$MODE" = "enable" ]; then
      "$ctl" enable "$unit"
    else
      "$ctl" enable "$unit"
      "$ctl" start "$unit"
    fi
  done
  echo "OK systemd $MODE"
  exit 0
fi

[ -n "$PREFIX" ] || { echo "REFUSE dest required"; exit 2; }
allow_prefix "$PREFIX"
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
        rm -f "$target"
        ;;
      file)
        [ -f "$target" ] || { echo "REFUSE missing $rel"; exit 2; }
        have="$(sha256sum "$target" | cut -c1-64)"
        [ "$have" = "$extra" ] || { echo "REFUSE hash changed $rel"; exit 2; }
        rm -f "$target"
        ;;
      *) echo "REFUSE receipt kind"; exit 2 ;;
    esac
  done <"$receipt"
  rm -f "$receipt"
  echo "OK rollback"
  exit 0
fi

mkdir -p "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/lib/systemd/system" "$PREFIX/etc" "$PREFIX/deps" "$PREFIX/runbook" "$PREFIX/secrets"
install -m 0755 "$HERE/bin/wardos-pi-lights.sh" "$PREFIX/bin/wardos-pi-lights.sh"
install -m 0755 "$HERE/bin/wardos-pi-tunnel.sh" "$PREFIX/bin/wardos-pi-tunnel.sh"
install -m 0755 "$HERE/bin/wardos-pi-venv.sh" "$PREFIX/bin/wardos-pi-venv.sh"
install -m 0644 "$HERE/lib/pi_gate.py" "$PREFIX/lib/pi_gate.py"
sed "s#@PREFIX@#$PREFIX#g" "$HERE/units/wardos-pi-lights.service" >"$PREFIX/lib/systemd/system/wardos-pi-lights.service"
sed "s#@PREFIX@#$PREFIX#g" "$HERE/units/wardos-pi-tunnel@.service" >"$PREFIX/lib/systemd/system/wardos-pi-tunnel@.service"
cp "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$PREFIX/deps/kasa-aarch64-cp313.lock.txt"
cp "$HERE/deps/kasa-aarch64-cp313.wheelhouse.txt" "$PREFIX/deps/kasa-aarch64-cp313.wheelhouse.txt"
cp "$HERE/RUNBOOK.md" "$PREFIX/runbook/RUNBOOK.md"
cat >"$PREFIX/etc/hub.env" <<EOF
WARDOS_PREFIX=$PREFIX
LIGHTS_HOST=127.0.0.1
LIGHTS_PORT=8788
METRICS_R1=20241
METRICS_R2=20242
TUNNEL_NAME=wardos-hub
TUNNEL_CONFIG=$PREFIX/etc/tunnel.yml
RUN_TREE=$PREFIX/run
KASA_VENV=$PREFIX/venv
KASA_LOCK=$PREFIX/deps/kasa-aarch64-cp313.lock.txt
LIGHTS_TOKEN_FILE=$PREFIX/secrets/lights-proxy.token
HOUSE_ORIGINS=https://dmward23-web.github.io,https://cams.wardhousehub.com
EOF
cat >"$PREFIX/etc/secrets.refs" <<EOF
# path mode. Install does not create these files and does not read values.
$PREFIX/secrets/lights-proxy.token 0600
$PREFIX/secrets/kasa.user 0600
$PREFIX/secrets/kasa.password 0600
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
runtime="$REPO/ops/box-recover/runtime-src"
mkdir -p "$PREFIX/run/scripts"
for name in house-proc.sh lights-write-proxy.mjs private-dir.mjs kasa-write.py private-feed.mjs kasa-daemon.py spotify-control.mjs access-log.mjs lights-fetch.mjs kasa-probe.py; do
  case "$name" in
    *sensi*) echo "REFUSE Sensi is not staged"; exit 2 ;;
  esac
  [ -f "$runtime/$name" ] || { echo "REFUSE runtime source missing"; exit 2; }
  install -m 0644 "$runtime/$name" "$PREFIX/run/scripts/$name"
  record_file "run/scripts/$name"
done
if [ -e "$PREFIX/run/scripts/sensi-control.mjs" ]; then
  echo "REFUSE Sensi file was staged"
  exit 2
fi
echo "OK install"
