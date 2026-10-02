#!/usr/bin/env bash
# LIVEDATA1 · regenerate the 8 wall feeds from the calendar dump (read-only) at the current clock.
#   data/house-mode.json data/next-up.json data/kid-seats.json data/unlocks.json data/pickup-chain.json
#   data/school-night.json data/who-home.json data/logistics-taps.json
# Called by scripts/house-board-calendar-refresh.sh after cal-live (same 10-minute routine, same data-only commit),
# and on its own at 3:00 AM CT (house-day reset) by the same routine: scripts/house-feeds-refresh.sh --events <dump>.
# No network, no git, never touches HTML/CSS, sensi/nest JSON, house-jar.json or grocery files.
# Usage: scripts/house-feeds-refresh.sh [--events <dump.json>] [--now ISO]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENTS="/workspace/cal-dmward23-week.json"; NOW=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --events) EVENTS="${2:?}"; shift 2 ;;
    --now) NOW="${2:?}"; shift 2 ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
N=(); [[ -n "$NOW" ]] && N=(--now "$NOW")
E=(--events "$EVENTS")
cd "$ROOT"
node scripts/house-mode.mjs "${E[@]}" "${N[@]}"
node scripts/next-up.mjs "${E[@]}" "${N[@]}"
node scripts/kid-layer.mjs "${E[@]}" "${N[@]}"
node scripts/pickup-chain.mjs "${E[@]}" "${N[@]}"
node scripts/school-night.mjs "${E[@]}" "${N[@]}"
node scripts/who-home.mjs "${N[@]}"
node scripts/logistics-taps.mjs "${N[@]}"
echo "house-feeds-refresh: OK $(TZ=America/Chicago date '+%a %b %-d %-I:%M %p CT')"
