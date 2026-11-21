#!/usr/bin/env bash
# Isolated fixture for install cleanup. The installer has no tamper hook.
# This file is not used by a target install.
set -euo pipefail
if [ "${WARDOS_PI_FIXTURE:-}" != "isolated" ]; then
  echo "REFUSE cleanup harness is not available in production"
  exit 78
fi
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
. "$HERE/lib/pi-cleanup.sh"
mode="${1:-}"
prefix="${2:-}"
outside="${3:-}"
if [ -z "$prefix" ] || [ "$prefix" = "/opt/wardos" ] || [[ "$prefix" == /opt/wardos/* ]]; then
  echo "REFUSE cleanup harness prefix"
  exit 78
fi
case "$mode" in
  residue|symlink|escape) ;;
  *) echo "REFUSE cleanup harness mode"; exit 2 ;;
esac
mkdir -p "$prefix/bin"
PREFIX="$prefix"
receipt="$prefix/receipt.tsv"
CLEANUP_ON_EXIT=1
env_tmp=""
payload_tmp=""
if [ "$mode" = "residue" ]; then
  printf 'owned\n' >"$prefix/bin/owned.txt"
  hash="$(sha256sum "$prefix/bin/owned.txt" | cut -c1-64)"
  printf 'file\tbin/owned.txt\t%s\n' "$hash" >"$receipt"
  printf '\n' >>"$prefix/bin/owned.txt"
  cleanup_partial
  exit 0
fi
if [ "$mode" = "symlink" ]; then
  printf 'outside\n' >"$outside"
  ln -s "$outside" "$prefix/bin/owned.txt"
  printf 'file\tbin/owned.txt\t%s\n' "0000000000000000000000000000000000000000000000000000000000000000" >"$receipt"
  cleanup_partial
  exit 0
fi
printf 'outside\n' >"$outside"
name="$(basename "$outside")"
printf 'file\t../%s\tdead\n' "$name" >"$receipt"
cleanup_partial
exit 0
