#!/usr/bin/env bash
# Deterministic tar of the recovery package. Does not include this dist output.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
if find runtime-src -name 'sensi-control.mjs' | grep -q .; then
  echo "REFUSE sensi file in runtime-src"
  exit 1
fi
files=$(find runtime-src -type f | sort)
tar --sort=name --mtime='2026-11-06 00:00:00' --owner=0 --group=0 --numeric-owner \
  -cf dist/hub-recover-lights-v5.tar \
  hub-recover-lights.sh \
  lib/recover_check.py \
  reference/hub-supervise.sh \
  reference/kasa-requirements.lock.txt \
  reference/deps/package.json \
  reference/deps/package-lock.json \
  MANIFEST.json \
  ingress-review.json \
  REVIEW.md \
  EOD-ACCOUNT.md \
  PARENT-FILE-REQUEST.txt \
  PARENT-READONLY-CHECKS.md \
  CORRECTION-MAP.md \
  CORRECTION-MAP-V4.md \
  CORRECTION-MAP-V5.md \
  live-equality.json \
  qa/recover.test.mjs \
  qa/runtime-pin.test.mjs \
  qa/fake-cloudflared.c \
  $files
if tar -tf dist/hub-recover-lights-v5.tar | grep -q 'sensi-control.mjs'; then
  echo "REFUSE sensi file entered the tar"
  exit 1
fi
sha256sum dist/hub-recover-lights-v5.tar | tee dist/hub-recover-lights-v5.sha256
echo "OK v5 artifact"
if [ -f dist/hub-recover-lights-v4.tar ]; then
  now="$(sha256sum dist/hub-recover-lights-v4.tar | cut -c1-64)"
  if [ "$now" != "a53f8462d1f696c65d49249e80cf36bdec201ad2ac13f71ef27f295929f11696" ]; then
    echo "REFUSE v4 archive bytes changed"
    exit 1
  fi
fi
if [ -f dist/hub-recover-lights.tar ]; then
  now="$(sha256sum dist/hub-recover-lights.tar | cut -c1-64)"
  if [ "$now" != "989df41936b209963c0ddeb92603a4705261b556cf09afe8abb26d69be559463" ]; then
    echo "REFUSE v3 archive bytes changed"
    exit 1
  fi
fi
