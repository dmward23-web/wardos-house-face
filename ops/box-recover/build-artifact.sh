#!/usr/bin/env bash
# Deterministic tar of the recovery package. Does not include this dist output.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
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
  qa/recover.test.mjs \
  qa/fake-cloudflared.c
sha256sum dist/hub-recover-lights.tar | tee dist/SHA256SUMS
tar -tf dist/hub-recover-lights.tar >/dev/null
echo "OK artifact"
