#!/usr/bin/env bash
# HUBDOG1 · every 60s: make sure the named tunnel wardos-hub actually serves
# (a connector can stay "registered" yet answer 502 after an edge drop).
# Single instance via flock. Log: ~/.cache/wardos/hub-watchdog.log
exec 9>"$HOME/.cache/wardos/hub-watchdog.lock"; flock -n 9 || exit 0
while true; do
  r="$("$HOME/.local/bin/wardos-hub-tunnel.sh" 2>&1)"
  [[ "$r" == RESTARTED ]] && echo "[$(date '+%F %T %Z')] tunnel restarted (was not serving)" >>"$HOME/.cache/wardos/hub-watchdog.log"
  sleep 60
done
