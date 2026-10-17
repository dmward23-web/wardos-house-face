#!/usr/bin/env bash
# QA1 · the ONE command for the house-face test suite:   scripts/qa/run-tests.sh
#   - finds the ws module (WARDOS_DEPS, default ~/.cache/wardos-deps/node_modules) and fails loudly if it is missing:
#       npm install --no-save --prefix ~/.cache/wardos-deps ws@8
#     (the proxy tests need ws; without it they would skip, and a skip is not a pass)
#   - runs every scripts/qa/*.test.mjs in parallel (node's default concurrency); each test isolates its own ports,
#     temp HOME and private dir, so parallel runs are safe. Pass --serial to force --test-concurrency=1.
#   - fails if ANY test skipped. The one allowed skip is the browser viewport check when QA_NO_BROWSER=1
#     (CI without chromium); everything else must run.
set -euo pipefail
cd "$(dirname "$0")/../.."
DEPS="${WARDOS_DEPS:-$HOME/.cache/wardos-deps/node_modules}"
if [ ! -f "$DEPS/ws/package.json" ]; then
  echo "QA1: ws not found in $DEPS. Install it once:  npm install --no-save --prefix \"$(dirname "$DEPS")\" ws@8" >&2
  exit 2
fi
conc=()
[ "${1:-}" = "--serial" ] && conc=(--test-concurrency=1)
out="$(mktemp -t wardos-qa-XXXXXX)"
trap 'rm -f "$out"' EXIT
set +e
NODE_PATH="$DEPS" node --test "${conc[@]}" scripts/qa/*.test.mjs 2>&1 | tee "$out"
rc=${PIPESTATUS[0]}
set -e
skipped="$(sed -n 's/^# skipped \([0-9]*\)$/\1/p' "$out" | tail -1)"
allowed=0
[ "${QA_NO_BROWSER:-}" = "1" ] && allowed="$(grep -c 'SKIP.*QA_NO_BROWSER' "$out" || true)"
if [ "$rc" -ne 0 ]; then echo "QA1: FAIL (node --test exit $rc)" >&2; exit "$rc"; fi
if [ "${skipped:-0}" -gt "$allowed" ]; then echo "QA1: FAIL: $skipped skipped test(s); a skip is not a pass" >&2; exit 3; fi
echo "QA1: PASS"
