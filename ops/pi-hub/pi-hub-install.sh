#!/usr/bin/env bash
# Pi hub kit for Raspberry Pi OS Trixie arm64 Desktop on Ward Wi-Fi.
# Modes are separate: plan, offline-verify, install, rollback, activate.
# Activate is refused. This script does not enable SSH, join a tunnel,
# copy tokens, or import aarch64 wheels.
set -euo pipefail
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MODE="plan"
DEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --offline-verify) MODE="verify" ;;
    --install|--stage) MODE="install" ;;
    --rollback) MODE="rollback" ;;
    --activate) MODE="activate" ;;
    --dest) DEST="${2:-}"; shift ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done

allow_dest() {
  case "$1" in
    /tmp/*|/var/tmp/*|/opt/cursor/artifacts/*) ;;
    *) echo "REFUSE dest is not a staging path"; exit 2 ;;
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
Target reported for a later install: Raspberry Pi OS Trixie arm64 Desktop, hostname wardos-pi, user dan, Ward Wi-Fi, SSH off. This plan does not enable SSH and does not join a tunnel.
The Pi is the intended always-on hub host. The Elo/Beelink is the wall client. A separate Pi is not required by the code if the Beelink is kept always on and is an approved hub host. That choice is not made here.
The box Kasa lock has 21 package declarations and 21 hashes, not 22. ARM import: NOT TESTED. The wheels were not imported on aarch64. Wheel hashes are not a successful install.
Sensi: excluded. The current lights process imports it, and that file has an open security review. This kit does not carry it. A Pi install needs a secret-free Sensi integration or it leaves Sensi out. Either choice needs an independent gate.
Cached stills and camera capture are out of this plan.
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
  echo "ACTIVATION: refused"
  echo "TOKENS: absent"
  exit 0
fi

if [ "$MODE" = "activate" ]; then
  echo "REFUSE activation. ARM import is not tested. Wheel hashes are not an install. Sensi is excluded. No tunnel. No SSH. No tokens."
  exit 78
fi

[ -n "$DEST" ] || { echo "REFUSE dest required"; exit 2; }
allow_dest "$DEST"
receipt="$DEST/receipt.tsv"

if [ "$MODE" = "rollback" ]; then
  [ -f "$receipt" ] || { echo "REFUSE no receipt"; exit 2; }
  while IFS=$'\t' read -r rel digest; do
    [ -n "$rel" ] || continue
    case "$rel" in
      /*|*..*) echo "REFUSE receipt path escapes"; exit 2 ;;
    esac
    target="$DEST/$rel"
    if [ ! -f "$target" ]; then echo "REFUSE missing $rel"; exit 2; fi
    have="$(sha256sum "$target" | cut -c1-64)"
    if [ "$have" != "$digest" ]; then echo "REFUSE hash changed $rel"; exit 2; fi
    rm -f "$target"
  done <"$receipt"
  rm -f "$receipt"
  echo "OK rollback"
  exit 0
fi

mkdir -p "$DEST/bin" "$DEST/units" "$DEST/deps" "$DEST/runbook"
cat >"$DEST/bin/wardos-pi-lights.sh" <<'EOF'
#!/bin/sh
# Startup entry for a later Pi host. Activation is a separate refused step.
echo "REFUSE activation. ARM import is not tested. Wheel hashes are not an install. Sensi is excluded. No tunnel. No SSH. No tokens."
exit 78
EOF
chmod 755 "$DEST/bin/wardos-pi-lights.sh"
cat >"$DEST/units/wardos-pi-lights.service" <<EOF
[Unit]
Description=WardOS Pi lights template. Not enabled. Activation is refused by the startup script.
[Service]
Type=oneshot
ExecStart=$DEST/bin/wardos-pi-lights.sh
EOF
cp "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$DEST/deps/kasa-aarch64-cp313.lock.txt"
cp "$HERE/deps/kasa-aarch64-cp313.wheelhouse.txt" "$DEST/deps/kasa-aarch64-cp313.wheelhouse.txt"
cp "$HERE/RUNBOOK.md" "$DEST/runbook/RUNBOOK.md"
printf '%s\n' "ARM_IMPORT: NOT TESTED" "WHEEL_HASH_IS_NOT_INSTALL: true" >"$DEST/deps/ARM-IMPORT-NOT-TESTED"
printf '%s\n' "Installed files only. No service enabled. No tokens. Sensi file not included." >"$DEST/NOT-ACTIVATED.txt"
: >"$receipt"
while IFS= read -r f; do
  printf '%s\t%s\n' "$f" "$(sha256sum "$DEST/$f" | cut -c1-64)" >>"$receipt"
done <<'EOF'
bin/wardos-pi-lights.sh
units/wardos-pi-lights.service
deps/kasa-aarch64-cp313.lock.txt
deps/kasa-aarch64-cp313.wheelhouse.txt
deps/ARM-IMPORT-NOT-TESTED
runbook/RUNBOOK.md
NOT-ACTIVATED.txt
EOF
echo "OK install"
