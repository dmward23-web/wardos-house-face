#!/usr/bin/env bash
# Pi hub staging kit. Default is a plan. It does not enable SSH, join a tunnel,
# start a camera proxy, or write a live feed.
set -euo pipefail
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"
MODE="plan"
DEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --stage) MODE="stage" ;;
    --rollback) MODE="rollback" ;;
    --dest) DEST="${2:-}"; shift ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done

if [ "$MODE" = "plan" ]; then
  cat <<'EOF'
PLAN pi-hub: NOT AN INSTALL
The Pi is the intended always-on hub host. The Elo/Beelink is the wall client. A separate Pi is not required by the code if the Beelink is kept always on and is an approved hub host. That choice is not made here.
SSH is off. This plan does not enable it and does not join a tunnel.
The box Kasa lock has 21 package declarations and 21 hashes, not 22. It is an x86_64 cp313 lock. ops/pi-hub/deps/kasa-aarch64-cp313.lock.txt pins the same 21 versions with aarch64 or pure-Python wheel hashes. Those wheels were downloaded and hashed on x86_64. They were not imported on aarch64.
Node: the matching lights process uses node: imports and base64url, which meet at Node 14.18.0, and Sensi/Spotify call global fetch, which is unflagged in Node 18.0.0. ws@8.22.0 declares engines node >= 10. The box binary is Node v24.22.1. No Pi node package version was read.
Cached stills, camera capture, and tunnel cutover are out of this plan.
EOF
  exit 0
fi

case "$DEST" in
  /tmp/*|/var/tmp/*) ;;
  *) echo "REFUSE dest must be under /tmp"; exit 2 ;;
esac

receipt="$DEST/receipt.tsv"
if [ "$MODE" = "rollback" ]; then
  [ -f "$receipt" ] || { echo "REFUSE no receipt"; exit 2; }
  while IFS=$'\t' read -r rel digest; do
    [ -n "$rel" ] || continue
    target="$DEST/$rel"
    case "$target" in
      "$DEST"/*) ;;
      *) echo "REFUSE receipt path escapes"; exit 2 ;;
    esac
    if [ ! -f "$target" ]; then echo "REFUSE missing $rel"; exit 2; fi
    have="$(sha256sum "$target" | cut -c1-64)"
    if [ "$have" != "$digest" ]; then echo "REFUSE hash changed $rel"; exit 2; fi
    rm -f "$target"
  done <"$receipt"
  rm -f "$receipt"
  echo "OK rollback"
  exit 0
fi

mkdir -p "$DEST/units" "$DEST/deps"
unit="$DEST/units/wardos-pi-lights.service"
# No [Install] section, so this file cannot be enabled as a boot unit by itself.
cat >"$unit" <<'EOF'
[Unit]
Description=WardOS Pi lights process template. Not enabled. Does not start cameras or a tunnel.
[Service]
Type=simple
ExecStart=/bin/true
EOF
cp "$HERE/deps/kasa-aarch64-cp313.lock.txt" "$DEST/deps/kasa-aarch64-cp313.lock.txt"
note="$DEST/NOT-ACTIVATED.txt"
cat >"$note" <<'EOF'
Staged files only. No service was enabled. No tunnel was joined. No camera process is defined.
The lights unit template has no install section. Do not copy it into a systemd directory from this plan.
EOF
: >"$receipt"
for f in units/wardos-pi-lights.service deps/kasa-aarch64-cp313.lock.txt NOT-ACTIVATED.txt; do
  printf '%s\t%s\n' "$f" "$(sha256sum "$DEST/$f" | cut -c1-64)" >>"$receipt"
done
echo "OK stage"
