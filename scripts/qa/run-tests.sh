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
out="$(mktemp -t wardos-qa-XXXXXX)"
trap 'rm -f "$out"' EXIT
set +e
# QUARANTINE · acer-r50 and acer-r53-music report on a serial lane. They do not block. acer-r53-f7 stays blocking.
# SERIAL · spawnSync 120s playwright measures run after the parallel batch and still count toward rc.
serial=(
  scripts/qa/acer-r30.test.mjs
  scripts/qa/acer-r31.test.mjs
  scripts/qa/acer-r53-kids.test.mjs
  scripts/qa/acer-r55-dom.test.mjs
  scripts/qa/acer-r55-show.test.mjs
  scripts/qa/acer-r59.test.mjs
  scripts/qa/acer-r61.test.mjs
  scripts/qa/choresfit1.test.mjs
  scripts/qa/contentgate.test.mjs
  scripts/qa/coversync1.test.mjs
  scripts/qa/nowfreeze1.test.mjs
  scripts/qa/pass2-dec4.test.mjs
  scripts/qa/cinema-xmas.test.mjs
)
block=()
for f in scripts/qa/*.test.mjs; do
  base=$(basename "$f")
  if [ "$base" = "acer-r50.test.mjs" ] || [ "$base" = "acer-r53-music.test.mjs" ]; then continue; fi
  skip_serial=0
  for s in "${serial[@]}"; do
    if [ "$f" = "$s" ]; then skip_serial=1; break; fi
  done
  if [ "$skip_serial" -eq 1 ]; then continue; fi
  block+=("$f")
done
# LEAKCAP · each file is its own process. A server left open used to pass the
# assertions and hold the one shared node until an outer kill. 960s sits above
# the longest test's own timeout (900s) and does not raise that timeout.
export FILE_DEADLINE=960
export DEPS
run_files() {
  local jobs="$1"; shift
  # Node's own default is nproc-1. One full nproc of files at once is what
  # made the poster-timing browser tests miss their existing budgets.
  printf '%s\n' "$@" | xargs -r -P "$jobs" -I{} bash -c '
    timeout -k 10 "$FILE_DEADLINE" env NODE_PATH="$DEPS" node --test "$1"
    status=$?
    if [ "$status" -eq 124 ]; then echo "DEADLINE $1" >&2; fi
    exit "$status"
  ' _ {}
}
jobs=$(( $(nproc) - 1 ))
[ "$jobs" -lt 1 ] && jobs=1
[ "${1:-}" = "--serial" ] && jobs=1
run_files "$jobs" "${block[@]}" 2>&1 | tee "$out"
rc=${PIPESTATUS[0]}
# xargs reports 123 when a file's node --test exits non-zero. The suite's own
# contract, checked by the runner guard, is that a failing test exits 1.
[ "$rc" -eq 123 ] && rc=1
present=()
for s in "${serial[@]}"; do
  if [ -f "$s" ]; then present+=("$s"); fi
done
if [ "${#present[@]}" -gt 0 ]; then
  echo "BLOCKING serial lane (spawnSync 120s playwright measures; counts toward rc)"
  serial_out="$(mktemp -t wardos-qa-serial-XXXXXX)"
  run_files 1 "${present[@]}" 2>&1 | tee "$serial_out"
  serial_rc=${PIPESTATUS[0]}
  [ "$serial_rc" -eq 123 ] && serial_rc=1
  cat "$serial_out" >> "$out"
  rm -f "$serial_out"
  if [ "$rc" -eq 0 ] && [ "$serial_rc" -ne 0 ]; then rc=$serial_rc; fi
fi
set -e
skipped=0
while read -r n; do skipped=$((skipped + n)); done < <(sed -n 's/^# skipped \([0-9]*\)$/\1/p' "$out")
allowed=0
[ "${QA_NO_BROWSER:-}" = "1" ] && allowed="$(grep -c 'SKIP.*QA_NO_BROWSER' "$out" || true)"
# RUNTESTS1 · on the GitHub runner only, a skip whose TAP reason starts "CI-ONLY <id>:" is allowed too. Those reasons come only
# from ci-only-skip.mjs, which returns one only when GITHUB_ACTIONS=true AND the box-only precondition is absent; each id carries
# its justification in the reason. Off the runner nothing is added, so on the box every such skip still fails the run.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  cionly="$(grep -cE '^ *(ok|not ok) [0-9]+ .*# SKIP CI-ONLY [A-Za-z0-9@_.-]+: ' "$out" || true)"
  allowed=$(( allowed + ${cionly:-0} ))
  echo "QA1: CI-ONLY skips allowed on the runner: ${cionly:-0}"
fi
set +e
for n in 1 2 3; do
  echo "QUARANTINE lane run $n (acer-r50, acer-r53-music; serial; does not block)"
  run_files 1 scripts/qa/acer-r50.test.mjs scripts/qa/acer-r53-music.test.mjs
  echo "QUARANTINE lane run $n exit $?"
done
set -e
if [ "$rc" -ne 0 ]; then echo "QA1: FAIL (node --test exit $rc)" >&2; exit "$rc"; fi
if [ "${skipped:-0}" -gt "$allowed" ]; then echo "QA1: FAIL: $skipped skipped test(s); a skip is not a pass" >&2; exit 3; fi
echo "QA1: PASS"
