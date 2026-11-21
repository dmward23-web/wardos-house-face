#!/usr/bin/env bash
# HUBPIN1 · start / check / stop the house proxies with a pid file that is ALWAYS the node process that owns the port.
# Source it (functions only: no `exit`, nothing runs on load):   . /workspace/wt-house-run-<sha>/scripts/house-proc.sh
#   hp_start <name> <port> <dir> <node args...>   refuses if the port is taken; launches node in <dir> with every
#                                                 token / keyless variable unset; pid file = the node that owns <port>
#   hp_check <name> <port>                        pid file is node, owns the port, clean environment; prints its tree
#   hp_stop  <name> <port>                        TERM (then KILL) ONLY the port's listener, and only if it is node running
#                                                 scripts/<name>.mjs; never a stale pid; proves the port is empty
# No setsid: in an interactive shell a background job leads its own process group, so setsid would fork and $! would
# be a wrapper. nohup + disown keeps node alive after the shell closes; the pid is read back from the port anyway.
# Logs and pid files: ${HP_LOG_DIR:-~/.cache/wardos}/<name>.{log,pid}
HP_LOG_DIR="${HP_LOG_DIR:-$HOME/.cache/wardos}"
HP_BAD_ENV='HOUSE_NOKEY_ORIGIN|LIGHTS_PROXY_TOKEN|NEST_PROXY_TOKEN'

hp_listener() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; }
hp_port_free() { [ -z "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]; }
hp_is_node() { [ -n "$1" ] && [ "$(cat "/proc/$1/comm" 2>/dev/null)" = node ]; }

hp_check() {
  local name=$1 port=$2 pid
  pid=$(cat "$HP_LOG_DIR/$name.pid" 2>/dev/null)
  [ -n "$pid" ] || { echo "FAIL $name: no pid file"; return 1; }
  hp_is_node "$pid" || { echo "FAIL $name: pid $pid is not a running node"; return 1; }
  [ "$(hp_listener "$port")" = "$pid" ] || { echo "FAIL $name: pid $pid does not own :$port (owner: $(hp_listener "$port"))"; return 1; }
  if tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -qE "^($HP_BAD_ENV)="; then echo "FAIL $name: pid $pid environment carries a token/keyless variable"; return 1; fi
  echo "OK $name: :$port pid $pid node, owns port, clean env, tree $(readlink "/proc/$pid/cwd")"
}

hp_start() {
  local name=$1 port=$2 dir=$3; shift 3
  [ -d "$dir" ] || { echo "FAIL $name: no directory $dir"; return 1; }
  hp_port_free "$port" || { echo "FAIL $name: :$port already in use by pid $(hp_listener "$port")"; return 1; }
  mkdir -p "$HP_LOG_DIR"
  ( cd "$dir" || exit 1; exec env -u LIGHTS_PROXY_TOKEN -u HOUSE_NOKEY_ORIGIN -u NEST_PROXY_TOKEN nohup node "$@" >>"$HP_LOG_DIR/$name.log" 2>&1 </dev/null ) &
  local bg=$! i pid=""
  disown "$bg" 2>/dev/null || true
  for i in $(seq 1 60); do pid=$(hp_listener "$port"); [ -n "$pid" ] && break; kill -0 "$bg" 2>/dev/null || break; sleep 0.25; done
  [ -n "$pid" ] || { echo "FAIL $name: nothing listening on :$port (see $HP_LOG_DIR/$name.log)"; return 1; }
  [ "$pid" = "$bg" ] || { echo "FAIL $name: :$port is owned by $pid, not the node just started ($bg)"; return 1; }
  [ "$(readlink "/proc/$pid/cwd")" = "$(cd "$dir" && pwd -P)" ] || { echo "FAIL $name: pid $pid runs from $(readlink "/proc/$pid/cwd"), not $dir"; return 1; }
  echo "$pid" > "$HP_LOG_DIR/$name.pid"
  hp_check "$name" "$port"
}

hp_ours() { # $1 pid, $2 name: a node whose command line runs scripts/<name>.mjs
  hp_is_node "$1" && tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null | grep -q "scripts/$2\.mjs"
}
hp_stop() {
  # STRICT: the only process ever signalled is the CURRENT listener on <port>, and only if it is node running
  # scripts/<name>.mjs. A recorded pid that no longer owns the port is never signalled (it may be a recycled pid that
  # now belongs to someone else). A non-node or foreign listener is refused, not killed.
  local name=$1 port=$2 pid owner i
  pid=$(cat "$HP_LOG_DIR/$name.pid" 2>/dev/null)
  owner=$(hp_listener "$port")
  if [ -z "$owner" ]; then rm -f "$HP_LOG_DIR/$name.pid"; echo "OK $name: :$port free (nothing was listening)"; return 0; fi
  if ! hp_ours "$owner" "$name"; then
    echo "FAIL $name: :$port is held by pid $owner ($(cat "/proc/$owner/comm" 2>/dev/null)), not node scripts/$name.mjs; not touching it"; return 1
  fi
  [ -n "$pid" ] && [ "$pid" != "$owner" ] && echo "$name: pid file said $pid but :$port is owned by $owner; stopping the owner only"
  kill -TERM "$owner" 2>/dev/null
  for i in $(seq 1 20); do hp_port_free "$port" && break; sleep 0.25; done
  if ! hp_port_free "$port"; then
    if [ "$(hp_listener "$port")" = "$owner" ] && hp_ours "$owner" "$name"; then
      echo "$name: :$port still held by node $owner after TERM, sending KILL"; kill -KILL "$owner"; sleep 0.5
    fi
  fi
  if hp_port_free "$port"; then rm -f "$HP_LOG_DIR/$name.pid"; echo "OK $name: :$port free"; return 0; fi
  echo "FAIL $name: :$port still in use by pid $(hp_listener "$port") ($(cat "/proc/$(hp_listener "$port")/comm" 2>/dev/null)); not touching it"; return 1
}
