# Sourced by pi-hub-install.sh. Removes only registered files and links.
# A receipt path outside the prefix, a symlink, or changed bytes stays in place.
cleanup_partial() {
  [ "${CLEANUP_ON_EXIT:-0}" = "1" ] || return 0
  [ -f "$receipt" ] || return 0
  set +e
  local failed=0 kind rel extra target have
  while IFS=$'\t' read -r kind rel extra; do
    [ "$kind" = file ] || [ "$kind" = link ] || continue
    case "$rel" in
      ""|/*|*..*|*[!A-Za-z0-9._/+-]*) echo "REFUSE cleanup path" >&2; failed=1; continue ;;
    esac
    target="$PREFIX/$rel"
    if [ "$kind" = link ]; then
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$(dirname "$target")" || { failed=1; continue; }
      if [ ! -L "$target" ] || [ "$(readlink "$target")" != "$extra" ]; then
        if [ -e "$target" ] || [ -L "$target" ]; then echo "RESIDUE $rel" >&2; fi
        failed=1
        continue
      fi
    else
      if [ -L "$target" ]; then
        echo "RESIDUE $rel" >&2
        failed=1
        continue
      fi
      python3 "$HERE/lib/pi_gate.py" --contained "$PREFIX" "$target" || { failed=1; continue; }
      if [ ! -f "$target" ]; then
        if [ -e "$target" ] || [ -L "$target" ]; then echo "RESIDUE $rel" >&2; fi
        failed=1
        continue
      fi
      have="$(sha256sum "$target" | cut -c1-64)"
      if [ "$have" != "$extra" ]; then
        echo "RESIDUE $rel" >&2
        failed=1
        continue
      fi
    fi
    rm -f "$target" || failed=1
    if [ -e "$target" ] || [ -L "$target" ]; then
      echo "RESIDUE $rel" >&2
      failed=1
    fi
  done <"$receipt"
  if [ -n "${env_tmp:-}" ]; then
    rm -f "$env_tmp" || failed=1
    if [ -e "$env_tmp" ]; then echo "RESIDUE temp env" >&2; failed=1; fi
  fi
  if [ -n "${payload_tmp:-}" ]; then
    rm -rf "$payload_tmp" || failed=1
    if [ -e "$payload_tmp" ]; then echo "RESIDUE temp payload" >&2; failed=1; fi
  fi
  if [ "$failed" = 1 ]; then echo "REFUSE cleanup incomplete" >&2; fi
}
