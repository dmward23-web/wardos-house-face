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
  ctl="${SYSTEMCTL:-systemctl}"
  python3 "$HERE/lib/pi_gate.py" --systemd-apply "$GATE" "$PREFIX" "$ctl" "$MODE"
  exit $?
fi

[ -n "$PREFIX" ] || { echo "REFUSE dest required"; exit 2; }
allow_prefix "$PREFIX" || exit 78
case "$PREFIX" in
  /opt/wardos|/opt/wardos/*)
    python3 "$HERE/lib/pi_gate.py" --install "${GATE:-}" "$PREFIX"
    ;;
esac
if [ "$INSTALL_PROFILE" = "fixture" ]; then
  case "$PREFIX" in
    /opt/wardos|/opt/wardos/*) echo "REFUSE fixture profile is not the production prefix"; exit 78 ;;
  esac
fi
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
CLEANUP_ON_EXIT=1
cleanup_partial() {
  [ "${CLEANUP_ON_EXIT:-0}" = "1" ] || return 0
  [ -f "$receipt" ] || return 0
  set +e
  local failed=0 kind rel extra target have
  while IFS=$'\t' read -r kind rel extra; do
    [ "$kind" = file ] || [ "$kind" = link ] || continue
    target="$PREFIX/$rel"
    if [ "$kind" = link ]; then
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$(dirname "$target")" || { failed=1; continue; }
      if [ ! -L "$target" ] || [ "$(readlink "$target")" != "$extra" ]; then
        echo "REFUSE cleanup link $rel" >&2
        failed=1
        continue
      fi
    else
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$target" || { failed=1; continue; }
      if [ -L "$target" ] || [ ! -f "$target" ]; then failed=1; continue; fi
      have="$(sha256sum "$target" | cut -c1-64)"
      if [ "$have" != "$extra" ]; then
        echo "REFUSE cleanup bytes $rel" >&2
        failed=1
        continue
      fi
    fi
    rm -f "$target" || failed=1
  done <"$receipt"
  if [ "$failed" = 1 ]; then echo "REFUSE cleanup incomplete" >&2; fi
}
trap cleanup_partial EXIT
own_file() {
  chmod "$2" "$PREFIX/$1"
  printf 'file\t%s\t%s\n' "$1" "$(sha256sum "$PREFIX/$1" | cut -c1-64)" >>"$receipt"
}
own_link() {
  printf 'link\t%s\t%s\n' "$1" "$(readlink "$PREFIX/$1")" >>"$receipt"
}
publish_tree() {
  local root="$1" f
  [ -d "$root" ] || return 0
  find "$root" -type d -exec chmod 0755 {} +
  while IFS= read -r f; do
    case "$f" in
      */secrets/*|*.token|*kasa.user|*kasa.password) chmod 0600 "$f" ;;
      *) if [ -x "$f" ]; then chmod 0755 "$f"; else chmod 0644 "$f"; fi ;;
    esac
  done < <(find "$root" -type f)
}
install -m 0755 "$HERE/bin/wardos-pi-lights.sh" "$PREFIX/bin/wardos-pi-lights.sh"
own_file bin/wardos-pi-lights.sh 0755
install -m 0755 "$HERE/bin/wardos-pi-tunnel.sh" "$PREFIX/bin/wardos-pi-tunnel.sh"
own_file bin/wardos-pi-tunnel.sh 0755
install -m 0755 "$HERE/bin/wardos-pi-venv.sh" "$PREFIX/bin/wardos-pi-venv.sh"
own_file bin/wardos-pi-venv.sh 0755
install -m 0644 "$HERE/lib/pi_gate.py" "$PREFIX/lib/pi_gate.py"
own_file lib/pi_gate.py 0644
sed -e "s#@PREFIX@#$PREFIX#g" -e "s#@USER@#$SERVICE_USER#g" -e "s#@HOME@#$SERVICE_HOME#g" "$HERE/units/wardos-pi-lights.service" >"$PREFIX/lib/systemd/system/wardos-pi-lights.service"
own_file lib/systemd/system/wardos-pi-lights.service 0644
sed -e "s#@PREFIX@#$PREFIX#g" -e "s#@USER@#$SERVICE_USER#g" -e "s#@HOME@#$SERVICE_HOME#g" "$HERE/units/wardos-pi-tunnel@.service" >"$PREFIX/lib/systemd/system/wardos-pi-tunnel@.service"
own_file lib/systemd/system/wardos-pi-tunnel@.service 0644
cp "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$PREFIX/deps/kasa-aarch64-cp313.lock.txt"
own_file deps/kasa-aarch64-cp313.lock.txt 0644
cp "$HERE/deps/kasa-aarch64-cp313.wheelhouse.txt" "$PREFIX/deps/kasa-aarch64-cp313.wheelhouse.txt"
own_file deps/kasa-aarch64-cp313.wheelhouse.txt 0644
cp "$HERE/RUNBOOK.md" "$PREFIX/runbook/RUNBOOK.md"
own_file runbook/RUNBOOK.md 0644
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
own_file etc/secrets.refs 0644
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
  own_file bin/cloudflared 0755
  payload_tmp="$(mktemp -d)"
  tar -xJf "$WARDOS_PI_PAYLOAD/node-v24.22.1-linux-arm64.tar.xz" -C "$payload_tmp" --wildcards '*/bin/node'
  payload_node="$(find "$payload_tmp" -type f -name node -print -quit)"
  if [ -z "$payload_node" ]; then echo "REFUSE payload node member missing"; exit 2; fi
  install -m 0755 "$payload_node" "$PREFIX/bin/node"
  own_file bin/node 0755
  rm -rf "$payload_tmp"
  printf 'WARDOS_NODE=%s\nWARDOS_CLOUDFLARED=%s\n' "$PREFIX/bin/node" "$PREFIX/bin/cloudflared" >>"$PREFIX/etc/hub.env"
  while IFS= read -r wheel; do
    [ -n "$wheel" ] || continue
    install -m 0644 "$WARDOS_PI_PAYLOAD/wheels/$wheel" "$PREFIX/deps/wheelhouse/$wheel"
    own_file "deps/wheelhouse/$wheel" 0644
  done < <(python3 -c 'import json,sys; print("\n".join(r["name"] for r in json.load(open(sys.argv[1]))["wheels"]))' "$HERE/OFFLINE-MANIFEST.json")
fi
own_file etc/hub.env 0644
printf '%s\n' "no" >"$PREFIX/etc/units-enabled"
own_file etc/units-enabled 0644
printf '%s\n' "ARM_IMPORT: NOT TESTED" "WHEEL_HASH_IS_NOT_INSTALL: true" >"$PREFIX/deps/ARM-IMPORT-NOT-TESTED"
own_file deps/ARM-IMPORT-NOT-TESTED 0644
ln -sfn wardos-pi-lights.sh "$PREFIX/bin/hub"
own_link bin/hub
ln -sfn . "$PREFIX/current"
own_link current
if [ "${WARDOS_PI_INSTALL_FAIL_POINT:-}" = "after-links" ]; then
  echo "REFUSE install fail point after links"
  exit 2
fi
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
  own_file "run/scripts/$name" 0644
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
  own_file "vendor/ws/$name" 0644
done <"$HERE/vendor/ws.SHA256SUMS"
publish_tree "$PREFIX"
CLEANUP_ON_EXIT=0
echo "OK install"
