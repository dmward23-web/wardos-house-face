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
  -cf dist/hub-recover-lights.tar \
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
  live-equality.json \
  qa/recover.test.mjs \
  qa/runtime-pin.test.mjs \
  qa/fake-cloudflared.c \
  $files
if tar -tf dist/hub-recover-lights.tar | grep -q 'sensi-control.mjs'; then
  echo "REFUSE sensi file entered the tar"
  exit 1
fi
sha256sum dist/hub-recover-lights.tar | tee dist/SHA256SUMS
echo "OK artifact"
