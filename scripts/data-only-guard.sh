#!/usr/bin/env bash
# DATAGUARD1 · refuse to push anything but data from a routine.
# Usage: scripts/data-only-guard.sh [remote/branch]   (default origin/main)
# Exit 0 = every outgoing commit touches only allowlisted data paths.
# Exit 3 = outgoing commits touch code → do NOT push (prints the paths).
# Also installed as .git/hooks/pre-push for routine clones (only enforces on
# commits whose subject looks like a routine: data-only / LIGHTS-live /
# SENSIFRESH / NESTSTILL), so human PR merges are unaffected.
set -uo pipefail
BASE="${1:-origin/main}"
ALLOW_RE='^(data/|kids-week\.json$|kids-data\.js$|cal-live\.json$)'
git fetch -q origin 2>/dev/null || true
BAD="$(git diff --name-only "$BASE"...HEAD 2>/dev/null | grep -Ev "$ALLOW_RE" || true)"
if [[ -n "$BAD" ]]; then
  echo "DATAGUARD1 BLOCK: outgoing commits touch non-data files:" >&2
  echo "$BAD" | sed 's/^/  /' >&2
  exit 3
fi
exit 0
