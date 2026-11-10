#!/usr/bin/env bash
# HUBSUP2 · WardOS hub supervisor. Keeps the cams proxy (:8787), the lights / Kasa / private-feed proxy (:8788), the two
# tunnel connectors (r1 metrics :20241, r2 :20242), the Kasa venv and the proxies' node deps alive.
#   hub-supervise.sh --status     strictly read-only (no mkdir, no log, no lock, no bytecode): one OK/DOWN line per
#                                 service + the healer loop. Exit 0 all OK · 1 a service DOWN · 4 no healer (services OK)
#                                 · 5 a service DOWN and no healer · 6 only the Nest grant is DOWN (re-consent; no restart
#                                 can fix it) · 3 test-profile isolation refused
#   hub-supervise.sh --adopt      read-only on processes: record live services the old watchdog started (exact listener
#                                 pid + command line + cwd + start time + port) so they are supervised, never restarted
#   hub-supervise.sh --ensure     one healing pass, then exit
#   hub-supervise.sh --boot       --ensure, start --loop fully detached if no healer runs, then --status (its exit code)
#   hub-supervise.sh --boot-once  for box start: like --boot but prints nothing (stdin/stdout/stderr → /dev/null at
#                                 once) and skips --status. Exit 0 a healer runs · 4 no healer could be started
#   hub-supervise.sh --loop       heal every 15s forever; single instance (flock)
#   hub-supervise.sh --loop --cams-only   r3c release mode (HUBSWAP1 D4, P1): heal cams, the connectors and public health
#                                 ONLY. The lights proxy and :8788 are never started, restarted or signalled, and the
#                                 Kasa venv and node deps (lights-only) are not touched. It needs $ST/lights.pin
#                                 ("pid start", written by step G); every pass checks that the :8788 holder is still that
#                                 pid with that start time and is healthy. Any change or an unhealthy lights proxy: log a
#                                 STOP line, write alerts/cams-only-stop.json, leave the loop, exit 7. No restart.
#   hub-supervise.sh --argv cams  read-only: print the cams launch argv (paths only, never token values)
#   hub-supervise.sh --stop-own   stop ONLY processes this supervisor started or adopted, re-proven by pid + start time +
#                                 cwd + command-line hash recorded at launch/adopt. r3: the loop gets up to 60s to finish
#                                 its pass (so every start is recorded) before KILL; any listener left on a supervised
#                                 port afterwards is reported (never signalled) and the exit code is 1
#   hub-supervise.sh --roll-connector <name>   TUNNELA1: under the healer lock, stop_ours + start ONE connector named in
#                                 CONNECTORS, wait <=120s for /ready. Exit 0 ready · 1 lock held · 2 bad name · 3 not ready · 4 not ours / port held
# Laws: never pkill / pattern-kill. A pid is signalled only when /proc still shows the exact process that was recorded
# (same start time, cwd and command line), so a recycled pid is never hit. A foreign process is reported, never touched.
# Restarts back off 15s → 30s → … → 10 min. A started proxy is recorded as ours the moment it owns its port (before the
# health wait), so a proxy that never turns healthy can still be restarted. Nest grant: the proxy's /health grant word
# wins (PROXYHEALTH1: 503 {"grant":"invalid"} = a live proxy with a dead grant); a proxy with no grant word falls back to
# invalid_grant / oauth 400|401 in the cams log since its last start. While the grant is invalid, cams restarts and
# connector rolls are suspended (a restart cannot fix a grant).
# Public health: down 4 passes → roll connector 1; rolls back off 60s → 120s → 240s, cap 3; then PARK and write a scrubbed
# alert to $ST/alerts/heal-public.json (state "parked"; rewritten "resolved" when public health is 200 again).
# SUPFIX1/r2: the cams proxy is launched with ONLY nest-device.token ($NEST_DEVICE_TOKEN_FILE); the retired cams key is
# never passed. Logs carry service names, ports, PIDs and HTTP codes only; every log this script writes (its own, the
# venv build, cloudflared) passes through scrub (no query strings, long tokens, UUIDs, IPs).
# Kasa venv: venvs live in $VROOT/venv-<stamp>; "current" and "last-good" are symlinks. A rebuild builds a NEW venv
# dir from the hash-pinned lock (pip --require-hashes), verifies it, then swaps "current" with one atomic mv -T. A failed
# build is removed; the venv in use and last-good are never moved or deleted. Prod adopts the existing plates venv as
# its first "current" (no rebuild, nothing moved).
# r3 · D1: TERM/INT/HUP to --loop only set STOP=1. The current pass finishes its step: a service that was being started
# is always recorded in $ST/<svc>.own before the loop exits (health waits end early, no new start begins), and the
# 15s sleep is cut short. D2: --status names a stale loop.own record as stale (never as the legacy watchdog). D3:
# --status WARNs when the run tree's nest clients predate patch 03 (device-token-only cams breaks their old key path).
# HUBSUP_PROFILE=test runs a fully isolated copy under $HUBSUP_TEST_ROOT (default $OPS/test; OPS = $HUBSUP_TEST_OPS,
# default /workspace/wardos-ops): dummy tunnel config + creds, fake cloudflared, dummy run tree, dummy tokens, ports
# $HUBSUP_TEST_PORTS ("cams lights metrics1 metrics2", default "18787 18788 20251 20252"), a loopback fake public
# health. It refuses (exit 3) if any path resolves to a real one (checked against both $HOME and the account's real
# home) or a port is a live port. Any HUBSUP_TEST_* variable outside the test profile is refused too.
set -u
umask 077
MODE="${1:---ensure}"
CAMS_ONLY=0; [ "$MODE" = --loop ] && [ "${2:-}" = --cams-only ] && CAMS_ONLY=1   # r3c · default modes unchanged
LSTOP=0
PROFILE="${HUBSUP_PROFILE:-prod}"
SELF="$(readlink -f "$0")"
REAL_OPS=/workspace/wardos-ops
REAL_HOME="$(getent passwd "$(id -u)" 2>/dev/null | cut -d: -f6)"; REAL_HOME="${REAL_HOME:-$HOME}"
case "$PROFILE" in
  test) OPS="$(readlink -m "${HUBSUP_TEST_OPS:-$REAL_OPS}")" ;;
  prod) OPS="$REAL_OPS"
        if [ -n "$(compgen -v HUBSUP_TEST_)" ]; then echo "REFUSE HUBSUP_TEST_* is set but HUBSUP_PROFILE is not test"; exit 3; fi ;;
  *) echo "REFUSE unknown HUBSUP_PROFILE"; exit 3 ;;
esac
WS_VERSION=8.22.0
EDGES_A="198.41.192.7 198.41.200.37 198.41.192.37 198.41.200.7"   # box DNS sinkholes *.argotunnel.com: edges stay pinned
EDGES_B="198.41.192.107 198.41.192.167 198.41.200.113 198.41.200.13"   # TUNNELA1: disjoint from EDGES_A (2 region1 + 2 region2, DoH-sourced 2026-10-28)
LIVE_PORTS="8787 8788 20241 20242"
if [ "$PROFILE" = test ]; then
  T="$(readlink -m "${HUBSUP_TEST_ROOT:-$OPS/test}")"
  read -r CAMS_PORT LIGHTS_PORT M1 M2 <<<"${HUBSUP_TEST_PORTS:-18787 18788 20251 20252}"
  ST="$T/state"; LOGD="$T/log"; CONNECTORS="t1:$M1:A t2:$M2:B"
  RT="$T/run-tree"; CFG="$T/cloudflared/test-hub.yml"; CREDS="$T/cloudflared/test-creds.json"; CF="$T/bin/cloudflared"
  NEST_DEVICE_TOKEN_FILE="$T/config/nest-device.token"; TUNNEL=wardos-test-hub
  VROOT="$T/kasa-venvs"; LEGACY_VENV="${HUBSUP_TEST_LEGACY_VENV:-}"; DEPS="$T/deps"; KASA_LOCK="${HUBSUP_TEST_LOCK:-$T/kasa-requirements.lock.txt}"
  PUBLIC_HEALTH="http://127.0.0.1:$M1/public"; HOUSE_ORIGINS_VAL="http://127.0.0.1"
  PUB_BACKOFF="${HUBSUP_TEST_PUB_BACKOFF:-60 120 240}"
  export HP_LOG_DIR="$T/proc"; LEGACY_LOCK="${HUBSUP_TEST_LEGACY_LOCK:-}"   # r3 · test-only fake legacy lock (must be under $T)
  REAL_RT=""   # never read the real run-tree pointer from the test profile; every /workspace/wt-* tree is denied instead
else
  REAL_RT="$(cat "$HOME/.config/wardos/house-run-tree" 2>/dev/null || echo /workspace/wt-house-run-b71d40d7)"
  ST="$OPS/state"; LOGD="$OPS/log"; CAMS_PORT=8787; LIGHTS_PORT=8788; CONNECTORS="r1:20241:A r2:20242:B"
  RT="$REAL_RT"; CFG="$HOME/.cloudflared/wardos-hub.yml"; CREDS=""; CF="$(command -v cloudflared 2>/dev/null || echo "$HOME/.local/bin/cloudflared")"
  NEST_DEVICE_TOKEN_FILE="$HOME/.config/wardos/nest-device.token"; TUNNEL=wardos-hub
  VROOT="$OPS/kasa-venvs"; LEGACY_VENV=/workspace/plates/2026-09-28/kasa-live/.venv; DEPS="$OPS/deps"; KASA_LOCK="$OPS/kasa-requirements.lock.txt"
  PUBLIC_HEALTH="https://cams.wardhousehub.com/health"; HOUSE_ORIGINS_VAL="https://dmward23-web.github.io,https://cams.wardhousehub.com"
  PUB_BACKOFF="60 120 240"
  export HP_LOG_DIR="$HOME/.cache/wardos"; LEGACY_LOCK="$HOME/.cache/wardos/hub-watchdog.lock"
fi
VENV="$VROOT/current"
ROLL_CAP=3
RETIRED_TOKEN_RE='(^|/)nest-proxy\.token$'   # the retired cams key: refused as a launch argument, reported if loaded
LOG="$LOGD/hub-supervise.log"; LOCK="$ST/healer.lock"; ALERTS="$ST/alerts"; LPIN="$ST/lights.pin"

# ── test isolation: refuse before touching anything ─────────────────────────────────────────────────────────────────
real_dirs() { # every real place the test profile must never resolve into (both $HOME and the account's real home)
  local h; for h in "$HOME" "$REAL_HOME"; do
    echo "$h/.cloudflared" "$h/.config/wardos" "$h/.local/share/wardos-private" "$h/.cache/wardos" "$h/.cache/wardos-deps" "$h/.local/bin"
  done
  echo "$REAL_OPS/state" "$REAL_OPS/log" "$REAL_OPS/deps" "$REAL_OPS/kasa-venvs" "$REAL_OPS/hub-supervise.sh" /workspace/plates
}
isolation_check() {
  local p r d bad=0 q real_cf
  case "$T" in "$OPS"/test|"$OPS"/test.*|"$OPS"/test-*) ;; *) echo "REFUSE test root $T is not $OPS/test*"; return 1;; esac
  case "$T/" in /workspace/wt-*) echo "REFUSE test root is inside a real run tree"; return 1;; esac
  real_cf="$(command -v cloudflared 2>/dev/null || echo "$REAL_HOME/.local/bin/cloudflared")"
  for p in "$ST" "$LOGD" "$RT" "$CFG" "$CREDS" "$CF" "$NEST_DEVICE_TOKEN_FILE" "$VROOT" "$DEPS" "$KASA_LOCK" "$HP_LOG_DIR" ${LEGACY_VENV:+"$LEGACY_VENV"} ${LEGACY_LOCK:+"$LEGACY_LOCK"}; do
    r="$(readlink -m "$p")"
    case "$r" in "$T"/*) ;; *) echo "REFUSE $p resolves outside the test root ($r)"; bad=1; continue;; esac
    case "$r/" in /workspace/wt-*) echo "REFUSE $p resolves into a real run tree"; bad=1;; esac
    for d in $(real_dirs) "$real_cf"; do
      d="$(readlink -m "$d")"
      if [ "$r" = "$d" ] || case "$r/" in "$d"/*) true;; *) false;; esac; then echo "REFUSE $p resolves to a real path"; bad=1; fi
    done
  done
  # the fake cloudflared must not be (or link to) the real binary, and the dummy config must not name the real tunnel
  [ -e "$real_cf" ] && [ -e "$CF" ] && [ "$(readlink -f "$CF")" = "$(readlink -f "$real_cf")" ] && { echo "REFUSE cloudflared is the real binary"; bad=1; }
  [ -f "$CFG" ] && grep -qE '^\s*tunnel:\s*wardos-hub\s*$|wardhousehub' "$CFG" && { echo "REFUSE test tunnel config names the real tunnel"; bad=1; }
  for q in "$CAMS_PORT" "$LIGHTS_PORT" "$M1" "$M2"; do
    case "$q" in ''|*[!0-9]*) echo "REFUSE test port '$q' is not a number"; bad=1; continue;; esac
    { [ "$q" -ge 1024 ] && [ "$q" -le 65535 ]; } || { echo "REFUSE test port $q out of range"; bad=1; }
    case " $LIVE_PORTS " in *" $q "*) echo "REFUSE live port $q"; bad=1;; esac
  done
  [ "$(printf '%s\n' "$CAMS_PORT" "$LIGHTS_PORT" "$M1" "$M2" | sort -u | wc -l)" = 4 ] || { echo "REFUSE test ports are not distinct"; bad=1; }
  case "$PUBLIC_HEALTH" in "http://127.0.0.1:$M1/"*) ;; *) echo "REFUSE test public health is not loopback"; bad=1;; esac
  return $bad
}
if [ "$PROFILE" = test ]; then isolation_check || exit 3; fi
prep_dirs() { mkdir -p "$ST" "$LOGD" "$HP_LOG_DIR"; }   # write modes only; --status / --argv never create anything

# ── log (rotating, scrubbed) ────────────────────────────────────────────────────────────────────────────────────────
rotate() {
  local s i; s=$(stat -c %s "$LOG" 2>/dev/null || echo 0); [ "$s" -lt 524288 ] && return 0
  for i in 3 2 1; do [ -f "$LOG.$i" ] && mv -f "$LOG.$i" "$LOG.$((i + 1))"; done
  mv -f "$LOG" "$LOG.1"
}
SCRUB_RE='s/\?[^ ]*//g; s/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/<uuid>/g; s/[A-Za-z0-9_+=-]{24,}/<redacted>/g; s/(^|[^0-9.])127\.0\.0\.1([^0-9]|$)/\1LOOPBACK4\2/g; s/[0-9]{1,3}(\.[0-9]{1,3}){3}/<ip>/g; s/LOOPBACK4/127.0.0.1/g; s/((token|secret|password|key|auth)[A-Za-z_]*["'\'']?[=: ]+)[^ ,"'\'']+/\1<redacted>/Ig'
scrub() { sed -uE "$SCRUB_RE"; }
log() { rotate; printf '[%s] %s %s\n' "$(date '+%F %T %Z')" "$PROFILE" "$*" | scrub >>"$LOG"; }

# ── probes (fds 7-9 never leak into children) ───────────────────────────────────────────────────────────────────────
cams_h()    { curl -s -m 4 "http://127.0.0.1:$CAMS_PORT/health" 7>&- 8>&- 9>&- 2>/dev/null || true; }
# a 503 {"grant":"invalid"} is a live proxy with a dead Nest grant: alive (a restart cannot fix the grant)
cams_ok()   { local b; b=$(cams_h); case "$b" in *'"ok":true'*|*'"grant":"invalid"'*) return 0;; esac; return 1; }
lights_ok() { curl -s -m 4 "http://127.0.0.1:$LIGHTS_PORT/health" 7>&- 8>&- 9>&- 2>/dev/null | grep -q '"ok":true'; }
ready()     { curl -s -m 3 "http://127.0.0.1:$1/ready" 7>&- 8>&- 9>&- 2>/dev/null | grep -q '"status":200'; }
# "<code> <grant word|->" from public health; a 503 that carries "grant":"invalid" proves the tunnel is serving
pub_probe() { local o c b g=-; o=$(curl -s -m 8 -w '\n%{http_code}' "$PUBLIC_HEALTH" 7>&- 8>&- 9>&- 2>/dev/null || true)
  c=${o##*$'\n'}; b=${o%$'\n'*}; c=${c//[^0-9]/}
  case "$b" in *'"grant":"invalid"'*) g=invalid;; *'"grant":"ok"'*) g=ok;; *'"grant":"unknown"'*) g=unknown;; esac
  echo "${c:-000} $g"; }
listener()  { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; }
# r2 · read-only import check: -I (isolated: no user site, no cwd on sys.path, PYTHON* env ignored) + -B and
# PYTHONDONTWRITEBYTECODE=1 (no __pycache__ writes into the venv)
py_ok()     { [ -x "$1/bin/python" ] && PYTHONDONTWRITEBYTECODE=1 "$1/bin/python" -I -B -c "import kasa, tplinkcloud" >/dev/null 2>&1 7>&- 8>&- 9>&-; }
venv_ok()   { py_ok "$VENV"; }
deps_ok()   { grep -q "\"version\": \"$WS_VERSION\"" "$DEPS/node_modules/ws/package.json" 2>/dev/null; }
# r3 · D1: STOP is set ONLY by the --loop signal trap; a requested stop ends a health wait early (after the start was
# recorded) and keeps a pass from beginning anything new
STOP=0
stop_req()  { [ "$STOP" = 1 ]; }
wait_for()  { local i; for i in $(seq 1 "$2"); do "$1" "${@:3}" && return 0; stop_req && return 1; sleep 1; done; return 1; }

# ── process identity: pid + start time + cwd + command-line hash ────────────────────────────────────────────────────
p_start()   { awk '{ sub(/^.*\) /, ""); print $20 }' "/proc/$1/stat" 2>/dev/null; }   # field 22, after "(comm) "
p_cwd()     { readlink "/proc/$1/cwd" 2>/dev/null; }
p_cmdsha()  { sha256sum <"/proc/$1/cmdline" 2>/dev/null | cut -c1-64; }
p_cmd()     { tr '\0' ' ' <"/proc/$1/cmdline" 2>/dev/null; }
record_own() { # <svc> <pid> <how: started|adopted> → $ST/<svc>.own = "pid start cmdsha how cwd"
  local s c h; s=$(p_start "$2"); c=$(p_cwd "$2"); h=$(p_cmdsha "$2")
  [ -n "$s" ] && [ -n "$c" ] && [ -n "$h" ] || { log "$1: pid $2 vanished before it could be recorded"; return 1; }
  printf '%s %s %s %s %s\n' "$2" "$s" "$h" "$3" "$c" >"$ST/$1.own.tmp" && mv -f "$ST/$1.own.tmp" "$ST/$1.own"
}
pid_ours() { # <svc> → prints the pid only if /proc still shows exactly the recorded process
  local p s h how c; [ -f "$ST/$1.own" ] || return 1
  read -r p s h how c <"$ST/$1.own" || return 1
  [ -n "$p" ] && kill -0 "$p" 2>/dev/null || return 1
  [ "$(p_start "$p")" = "$s" ] && [ "$(p_cmdsha "$p")" = "$h" ] && [ "$(p_cwd "$p")" = "$c" ] || return 1
  echo "$p"
}
own_how() { awk '{ print $4 }' "$ST/$1.own" 2>/dev/null; }
stop_ours() { # <svc> [quarter-second ticks to wait before KILL, default 20 = 5s]
  local p i n=${2:-20}; p=$(pid_ours "$1") || { [ -f "$ST/$1.own" ] && log "$1: recorded pid no longer matches (start time / cwd / command line); not signalling"; rm -f "$ST/$1.own"; return 1; }
  kill -TERM "$p" 2>/dev/null
  for i in $(seq 1 "$n"); do kill -0 "$p" 2>/dev/null || break; sleep 0.25; done
  if [ "$(pid_ours "$1")" = "$p" ]; then log "$1: own pid $p still running after $((n / 4))s → KILL"; kill -KILL "$p" 2>/dev/null; fi
  rm -f "$ST/$1.own"; log "$1: stopped own pid $p"
}
lock_holder() { # <lock file> → pid holding it, read passively (never takes the lock)
  # r3 · a lock taken by bash `exec 9>>f; flock -n 9` is recorded under the pid of the short-lived flock(1) process, so
  # /proc/locks hides it once that pid is gone. So: (1) a process with the file open that is this script's --loop,
  # (2) the pid /proc/locks names, (3) any other process with the file open.
  local ino f pids q; [ -e "$1" ] || return 1; ino=$(stat -c %i "$1" 2>/dev/null) || return 1; f=$(readlink -f "$1")
  pids=$(find /proc/[0-9]*/fd -maxdepth 1 -lname "$f" 2>/dev/null | cut -d/ -f3 | sort -un)
  for q in $pids; do is_our_loop "$q" && { echo "$q"; return 0; }; done
  q=$(awk -v i=":$ino" '$2 == "FLOCK" && substr($6, length($6) - length(i) + 1) == i { print $5; exit }' /proc/locks 2>/dev/null)
  [ -n "$q" ] && { echo "$q"; return 0; }
  for q in $pids; do [ "$q" != "$$" ] && { echo "$q"; return 0; }; done
  return 1
}

# ── backoff: 15s doubling to 10 min per service ─────────────────────────────────────────────────────────────────────
bo_wait() { local n t; [ -f "$ST/$1.backoff" ] || return 1; read -r n t <"$ST/$1.backoff"; [ "$(date +%s)" -lt "${t:-0}" ]; }
bo_fail() {
  local n=0 t=0 d; [ -f "$ST/$1.backoff" ] && read -r n t <"$ST/$1.backoff"
  n=$((n + 1)); d=$((15 << (n > 6 ? 6 : n - 1))); [ "$d" -gt 600 ] && d=600
  echo "$n $(($(date +%s) + d))" >"$ST/$1.backoff"; log "$1: attempt $n did not come up healthy; next try in ${d}s"
}
bo_ok() { [ -f "$ST/$1.backoff" ] && log "$1: healthy again"; rm -f "$ST/$1.backoff"; }

# ── Kasa venv: new dir per build, atomic symlink swap, last-good kept ───────────────────────────────────────────────
lock_sha() { sha256sum "$KASA_LOCK" 2>/dev/null | cut -c1-64; }
swap_link() { # <link name> <target dir> : ln to a temp name, then one atomic rename over the old link
  ln -sfn "$2" "$VROOT/.$1.new" && mv -T "$VROOT/.$1.new" "$VROOT/$1"
}
venv_wanted() { # 0 when current is fine: imports work and (if it was built here) it was built from this lock
  venv_ok || return 1
  [ -f "$VENV/.hubsup-lock-sha" ] || return 0             # adopted (prod plates venv): imports are the only bar
  [ "$(cat "$VENV/.hubsup-lock-sha")" = "$(lock_sha)" ]
}
ensure_venv() { # fd 7 exists only for this call: closed on every return path
  mkdir -p "$VROOT"
  if [ ! -e "$VENV" ] && [ -n "$LEGACY_VENV" ] && py_ok "$LEGACY_VENV"; then
    swap_link current "$LEGACY_VENV"; [ -e "$VROOT/last-good" ] || swap_link last-good "$LEGACY_VENV"
    log "venv: adopted the existing venv as current and last-good (nothing moved, no rebuild)"
  fi
  venv_wanted && { bo_ok venv; return 0; }
  ensure_venv_locked 7>"$ST/venv.lock"
}
ensure_venv_locked() {
  flock -n 7 || { log "venv: another rebuild is running; skipping this pass"; return 1; }
  venv_wanted && { bo_ok venv; return 0; }   # someone else just finished
  if ! venv_ok && [ -e "$VROOT/last-good" ] && py_ok "$VROOT/last-good" && [ "$(readlink -f "$VROOT/last-good")" != "$(readlink -f "$VENV")" ]; then
    swap_link current "$(readlink "$VROOT/last-good")"; log "venv: current broken → switched back to last-good"
    venv_wanted && { bo_ok venv; return 0; }
  fi
  bo_wait venv && { log "venv: rebuild backing off"; return 1; }
  local stamp new rc t0=$SECONDS prev
  stamp=$(date +%y%m%d.%H%M%S).$$   # dots: short runs, so the log scrub never mistakes the name for a token
  new="$VROOT/venv-$stamp"
  log "venv: $(venv_ok && echo 'lock changed' || echo 'missing or broken') → building venv-$stamp from $(basename "$KASA_LOCK") (--require-hashes)"
  { python3 -m venv "$new" && "$new/bin/python" -m pip install -q --disable-pip-version-check --no-input --require-hashes -r "$KASA_LOCK" \
      && "$new/bin/python" -m pip check; } </dev/null 2>&1 7>&- 8>&- 9>&- | scrub >"$LOGD/venv-build.log"
  rc=${PIPESTATUS[0]}
  if [ "$rc" -eq 0 ] && py_ok "$new"; then
    lock_sha >"$new/.hubsup-lock-sha"
    prev="$(readlink "$VENV" 2>/dev/null || true)"
    if [ -n "$prev" ] && py_ok "$prev"; then swap_link last-good "$prev"; fi
    swap_link current "$new"
    [ -e "$VROOT/last-good" ] || swap_link last-good "$new"
    log "venv: venv-$stamp built in $((SECONDS - t0))s, $("$new/bin/python" -m pip freeze 2>/dev/null 7>&- | wc -l) packages, imports OK → current (last-good: $(basename "$(readlink "$VROOT/last-good")"))"
    bo_ok venv; return 0
  fi
  case "$new" in "$VROOT"/venv-*) rm -rf -- "$new";; esac     # only the failed build dir; current and last-good untouched
  log "venv: build venv-$stamp failed (rc $rc, see venv-build.log); current stays $(basename "$(readlink "$VENV" 2>/dev/null || echo none)"), last-good kept"
  bo_fail venv; return 1
}
ensure_deps() {
  deps_ok && return 0
  mkdir -p "$DEPS"
  if [ "$PROFILE" = prod ] && grep -qs "\"version\": \"$WS_VERSION\"" "$HOME/.cache/wardos-deps/node_modules/ws/package.json"; then
    mkdir -p "$DEPS/node_modules"; cp -a "$HOME/.cache/wardos-deps/node_modules/ws" "$DEPS/node_modules/" 2>/dev/null
  fi
  deps_ok || (cd "$DEPS" && npm install --no-audit --no-fund --silent --prefix "$DEPS" "ws@$WS_VERSION") </dev/null 2>&1 7>&- 8>&- 9>&- | scrub >"$LOGD/deps-build.log"
  if deps_ok; then log "deps: ws@$WS_VERSION ready"; return 0; fi
  log "deps: ws@$WS_VERSION install failed (see deps-build.log)"; return 1
}

# ── proxies ─────────────────────────────────────────────────────────────────────────────────────────────────────────
token_args() { # launch with the device token only; an empty result means "do not start" (an older proxy would
  # otherwise fall back to its default files, which include the retired cams key)
  printf '%s\n' "$NEST_DEVICE_TOKEN_FILE" | grep -qE "$RETIRED_TOKEN_RE" && return 0
  [ -s "$NEST_DEVICE_TOKEN_FILE" ] && echo " --auth-token-file $NEST_DEVICE_TOKEN_FILE"
  return 0
}
cams_argv() { echo "node scripts/nest-webrtc-proxy.mjs --host 127.0.0.1 --port $CAMS_PORT$(token_args)"; }
# ── Nest grant state: the proxy's /health grant word wins (PROXYHEALTH1); only when /health gives no grant word (proxy
#    down, or an older proxy) fall back to invalid_grant / oauth 400|401 in the cams log after its last "listening" line.
CAMS_PLOG() { echo "$HP_LOG_DIR/nest-webrtc-proxy.log"; }
grant_word() { case "$(cams_h)" in *'"grant":"invalid"'*) echo invalid;; *'"grant":"ok"'*) echo ok;; *'"grant":"unknown"'*) echo unknown;; *) echo none;; esac; }
grant_src=log
grant_invalid() {
  local f g; g=$(grant_word)
  case "$g" in invalid) grant_src=health; return 0;; ok|unknown) grant_src=health; return 1;; esac
  grant_src=log; f=$(CAMS_PLOG); [ -f "$f" ] || return 1
  tail -n 2000 "$f" 2>/dev/null | awk '/nest-webrtc-proxy listening/ { bad = 0 } /invalid_grant|oauth HTTP 40[01]/ { bad = 1 } END { exit bad ? 0 : 1 }'
}
grant_note() { # log once per state change, never every pass
  if grant_invalid; then [ -f "$ST/nest.grant_invalid" ] || { date +%s >"$ST/nest.grant_invalid"; log "nest grant invalid (source: $grant_src): cams restarts and connector rolls suspended until re-consent"; }; return 0; fi
  [ -f "$ST/nest.grant_invalid" ] && { rm -f "$ST/nest.grant_invalid"; log "nest grant no longer reported invalid"; }; return 1
}
start_cams() {
  local ta; ta=$(token_args)
  [ -n "$ta" ] || { log "cams: no device token file to launch with (retired cams key refused); not starting"; return 1; }
  ( . "$RT/scripts/house-proc.sh"
    # shellcheck disable=SC2086
    hp_start nest-webrtc-proxy "$CAMS_PORT" "$RT" scripts/nest-webrtc-proxy.mjs --host 127.0.0.1 --port "$CAMS_PORT" $ta
  ) </dev/null 2>&1 7>&- 8>&- 9>&- | scrub >>"$LOG"
}
start_lights() {
  ( . "$RT/scripts/house-proc.sh"
    export NODE_PATH="$DEPS/node_modules" HOUSE_ORIGINS="$HOUSE_ORIGINS_VAL" KASA_VENV_PYTHON="$VENV/bin/python"
    hp_start lights-write-proxy "$LIGHTS_PORT" "$RT" scripts/lights-write-proxy.mjs --host 127.0.0.1 --port "$LIGHTS_PORT"
  ) </dev/null 2>&1 7>&- 8>&- 9>&- | scrub >>"$LOG"
}
heal_proxy() { # <svc> <script name> <port> <okfn> <startfn> <matchfn>
  local svc=$1 name=$2 port=$3 ok=$4 start=$5 match=$6 owner p i
  if $ok || { sleep 1; $ok; }; then bo_ok "$svc"; return 0; fi
  owner=$(listener "$port")
  if [ -n "$owner" ]; then
    p=$(pid_ours "$svc")
    if [ "$p" != "$owner" ]; then log "$svc: :$port unhealthy, held by pid $owner (not started or adopted by this supervisor); not touching it"; return 1; fi
    [ "$svc" = cams ] && grant_note && { log "$svc: own pid $p unhealthy but the Nest grant is invalid; not restarting"; return 1; }
    bo_wait "$svc" && { log "$svc: own pid $p unhealthy, backing off"; return 1; }
    log "$svc: own pid $p on :$port unhealthy → restart"; stop_ours "$svc"
  fi
  bo_wait "$svc" && { log "$svc: :$port down, backing off"; return 1; }
  stop_req && { log "$svc: :$port down; loop stop requested, not starting"; return 1; }
  if [ "$svc" = cams ] && grant_note && [ -f "$ST/cams.grant_tries" ]; then
    log "$svc: :$port down and the Nest grant is invalid; one start was already tried, not retrying until re-consent"; return 1
  fi
  log "$svc: :$port down → start"
  [ "$svc" = cams ] && grant_invalid && : >"$ST/cams.grant_tries"
  $start
  # r2 · record ownership the moment the started process owns the port, BEFORE the health wait: a proxy that binds but
  # never turns healthy is still ours, so the next pass can restart it (with backoff) instead of calling it foreign
  p=""; for i in 1 2 3 4 5 6 7 8 9 10; do p=$(listener "$port"); [ -n "$p" ] && break; sleep 0.5; done
  if [ -z "$p" ] || ! $match "$p"; then log "$svc: start produced no matching listener on :$port${p:+ (held by pid $p)}"; bo_fail "$svc"; return 1; fi
  record_own "$svc" "$p" started || { bo_fail "$svc"; return 1; }
  if wait_for "$ok" 20; then
    log "$svc: up on :$port pid $p"; bo_ok "$svc"; [ "$svc" = cams ] && ! grant_invalid && rm -f "$ST/cams.grant_tries"; return 0
  fi
  if stop_req; then log "$svc: own pid $p on :$port recorded as ours; loop stop requested, health wait ended early"; return 1; fi
  log "$svc: own pid $p on :$port not healthy within 20s (recorded as ours; the next try restarts it after backoff)"
  bo_fail "$svc"; return 1
}

# ── tunnel connectors ───────────────────────────────────────────────────────────────────────────────────────────────
start_connector() { # <name> <metrics port> <A|B>
  local edges args=() ip p i pidf="$ST/$1.launch"
  [ "$3" = A ] && edges=$EDGES_A || edges=$EDGES_B
  for ip in $edges; do args+=(--edge "$ip:7844"); done
  rm -f "$pidf"
  # one detached session: cloudflared (pid written before exec) | scrub → log, so its log is scrubbed as it is written
  HUBSUP_SCRUB_RE="$SCRUB_RE" setsid nohup bash -c '
    pidf=$1 logf=$2; shift 2
    ( echo "$BASHPID" >"$pidf"; exec "$@" ) 2>&1 </dev/null | sed -uE "$HUBSUP_SCRUB_RE" >>"$logf"
  ' hubsup-cf "$pidf" "$HP_LOG_DIR/cloudflared-$1.log" \
    "$CF" tunnel --config "$CFG" --protocol http2 "${args[@]}" --metrics "127.0.0.1:$2" \
    --heartbeat-interval 5s --heartbeat-count 3 --retries 10 run "$TUNNEL" </dev/null >/dev/null 2>&1 7>&- 8>&- 9>&- &
  disown $! 2>/dev/null || true
  for i in $(seq 1 20); do [ -s "$pidf" ] && [ "$(cat "/proc/$(cat "$pidf")/comm" 2>/dev/null)" = cloudflared ] && break; sleep 0.25; done
  p=$(cat "$pidf" 2>/dev/null); rm -f "$pidf"
  if [ -n "$p" ] && [ "$(cat "/proc/$p/comm" 2>/dev/null)" = cloudflared ]; then record_own "$1" "$p" started; log "connector $1: started pid $p (metrics :$2)"
  else log "connector $1: launch did not produce a cloudflared process"; fi
}
connector_cmd_ok() { # <pid> <metrics port> → it is our tunnel's cloudflared on that metrics port with our config
  local c; c=" $(p_cmd "$1")"
  [ "$(cat "/proc/$1/comm" 2>/dev/null)" = cloudflared ] && case "$c" in *" --config $CFG "*"--metrics 127.0.0.1:$2 "*" run $TUNNEL "*) true;; *) false;; esac
}
heal_connector() { # <name> <metrics port> <A|B>
  local r=$1 m=$2 now since p held
  if ready "$m"; then rm -f "$ST/$r.notready"; bo_ok "$r"; return 0; fi
  now=$(date +%s); p=$(pid_ours "$r"); held=$(listener "$m")
  if [ -n "$p" ] || [ -n "$held" ]; then
    [ -f "$ST/$r.notready" ] || echo "$now" >"$ST/$r.notready"
    since=$(cat "$ST/$r.notready")
    if [ $((now - since)) -lt 30 ]; then log "connector $r: not ready for $((now - since))s, in grace"; return 1; fi
    if [ -z "$p" ]; then log "connector $r: not ready, held by pid ${held} (not started or adopted by this supervisor); not touching it"; return 1; fi
    bo_wait "$r" && { log "connector $r: own pid $p not ready, backing off"; return 1; }
    log "connector $r: own pid $p not ready for $((now - since))s → restart"; stop_ours "$r"
  fi
  bo_wait "$r" && { log "connector $r: down, backing off"; return 1; }
  stop_req && { log "connector $r: down; loop stop requested, not starting"; return 1; }
  start_connector "$r" "$m" "$3"; rm -f "$ST/$r.notready"
  if wait_for ready 25 "$m"; then log "connector $r: ready"; bo_ok "$r"; return 0; fi
  bo_fail "$r"; return 1
}
# ── public health: roll connector 1, back off 60 → 120 → 240s between rolls, cap 3, then park + alert ─────────────────
pub_delay() { set -- $PUB_BACKOFF; local k=$(( ${ROLL_N:-1} )); [ "$k" -gt $# ] && k=$#; eval "echo \${$k}"; }
write_alert() { # <state parked|resolved> <rolls> <last http> <connector> : atomic, fixed fields only, then scrubbed
  local f="$ALERTS/heal-public.json" since now
  mkdir -p "$ALERTS"; now=$(date '+%F %T %Z')
  since=$(cat "$ST/public.parked" 2>/dev/null || echo "$now")
  printf '{"schema":"wardos.hubsup.alert/1","alert":"heal-public","state":"%s","profile":"%s","since_ct":"%s","updated_ct":"%s","rolls":%d,"roll_cap":%d,"backoff_s":"%s","last_http":"%s","connector":"%s","note":"%s"}\n' \
    "$1" "$PROFILE" "$since" "$now" "${2:-0}" "$ROLL_CAP" "${PUB_BACKOFF// //}" "${3//[^0-9]/}" "${4//[^a-z0-9]/}" \
    "$( [ "$1" = parked ] && echo "public cams health still down after the capped connector rolls; public rolls parked until it is 200 again; look at the tunnel or the edge" || echo "public cams health is 200 again; rolls re-armed" )" \
    | scrub >"$f.tmp" && mv -f "$f.tmp" "$f"
}
heal_public() { # public health down 4 passes (~60s) while the connectors say ready → roll the first connector
  local c g n first r m e p rolls d t
  read -r c g <<<"$(pub_probe)"
  first=${CONNECTORS%% *}; IFS=: read -r r m e <<<"$first"
  if [ "$c" = 200 ] || { [ "$c" = 503 ] && [ "$g" = invalid ]; }; then   # 503 + grant invalid = the tunnel serves
    if [ -f "$ST/public.parked" ]; then write_alert resolved "$(cat "$ST/public.rolls" 2>/dev/null || echo 0)" "$c" "$r"; log "public cams health $c again; public rolls re-armed (alert resolved)"; fi
    rm -f "$ST/public.fail" "$ST/public.rolls" "$ST/public.parked" "$ST/public.backoff"; bo_ok public
    [ "$g" = invalid ] && grant_note >/dev/null
    return 0
  fi
  n=$(($(cat "$ST/public.fail" 2>/dev/null || echo 0) + 1)); echo "$n" >"$ST/public.fail"
  log "public cams health HTTP ${c:-000} (x$n)"
  [ "$n" -lt 4 ] && return 1
  echo 0 >"$ST/public.fail"
  if grant_note; then log "public down 60s but the Nest grant is invalid; not rolling connectors (a roll cannot fix it)"; return 1; fi
  [ -f "$ST/public.parked" ] && { log "public down; parked (alert written; no more rolls until public health is 200)"; return 1; }
  if [ -f "$ST/public.backoff" ]; then read -r d t <"$ST/public.backoff"; [ "$(date +%s)" -lt "${t:-0}" ] && { log "public down; connector roll backing off ($((t - $(date +%s)))s left)"; return 1; }; fi
  rolls=$(cat "$ST/public.rolls" 2>/dev/null || echo 0)
  if [ "$rolls" -ge "$ROLL_CAP" ]; then
    date '+%F %T %Z' >"$ST/public.parked"; write_alert parked "$rolls" "$c" "$r"
    log "public down after $rolls rolls (backoff $PUB_BACKOFF s); parked, alert written to alerts/heal-public.json"; return 1
  fi
  stop_req && { log "public down; loop stop requested, not rolling"; return 1; }
  p=$(pid_ours "$r") || { log "public down 60s; connector $r is not started or adopted by this supervisor (run --adopt); not rolling it"; return 1; }
  rolls=$((rolls + 1)); echo "$rolls" >"$ST/public.rolls"
  d=$(ROLL_N=$rolls pub_delay); echo "$rolls $(($(date +%s) + d))" >"$ST/public.backoff"
  log "public down 60s → rolling restart $rolls/$ROLL_CAP of own connector $r (pid $p, $(own_how "$r")); next roll no sooner than ${d}s"
  stop_ours "$r"; start_connector "$r" "$m" "$e"
  wait_for ready 25 "$m" && log "connector $r: ready after roll"
  return 0
}

# ── adopt: supervise what the old watchdog started, without restarting it ───────────────────────────────────────────
adopt_one() { # <svc> <port> <check fn> <args>
  local svc=$1 port=$2 fn=$3 p; shift 3
  p=$(listener "$port")
  if [ -z "$p" ]; then echo "ADOPT $svc: nothing listening on :$port (the healer will start it)"; return 0; fi
  if [ "$(pid_ours "$svc")" = "$p" ]; then echo "ADOPT $svc: pid $p already ours ($(own_how "$svc"))"; return 0; fi
  if $fn "$p" "$@"; then record_own "$svc" "$p" adopted && { echo "ADOPT $svc: pid $p on :$port adopted (cmdline, cwd, start time recorded)"; log "adopt: $svc pid $p on :$port"; return 0; }; fi
  echo "ADOPT $svc: :$port held by pid $p, which is not the expected process (command line / cwd); left alone"; log "adopt: $svc :$port pid $p does not match; left alone"; return 1
}
proxy_cmd_ok() { # <pid> <script> <port> → node running scripts/<script> from the run tree, with --port <port> or (as
  # the old watchdog launched lights) no --port at all; the pid was already proven to be the listener on <port>
  local c; c=" $(p_cmd "$1")"
  [ "$(cat "/proc/$1/comm" 2>/dev/null)" = node ] && [ "$(p_cwd "$1")" = "$(readlink -f "$RT")" ] || return 1
  case "$c" in *"node scripts/$2 "*) ;; *) return 1;; esac
  case "$c" in *" --port $3 "*) return 0;; *" --port "*|*" --port="*) return 1;; *) return 0;; esac
}
retired_note() { # report (never fix by restart) a live cams proxy that loads the retired cams key
  local p c; p=$(listener "$CAMS_PORT"); [ -n "$p" ] || return 0; c=" $(p_cmd "$p")"
  case "$c" in *" --auth-token-file "*) printf '%s\n' $c | grep -qE "$RETIRED_TOKEN_RE" || return 0;; esac
  echo "WARN cams pid $p loads the retired nest-proxy.token (explicitly or via the proxy's default files); it drops only on a planned restart"
}
# r3 · D3: a run tree whose nest still/fetch clients predate patch 03 (no NEST_DEVICE_TOKEN_FILE; they read only the
# retired key) breaks when cams runs device-token-only. Read-only note; run tree b71d40d7 is such a tree.
old_clients() { local f o=""; for f in nest-fetch.mjs nest-webrtc-still.mjs; do
    [ -f "$RT/scripts/$f" ] && ! grep -q NEST_DEVICE_TOKEN_FILE "$RT/scripts/$f" 2>/dev/null && o="$o $f"; done; echo "${o# }"; }
old_clients_note() { local o; o=$(old_clients); [ -n "$o" ] || return 0
  echo "WARN run tree $(basename "$RT") nest clients predate patch 03 ($o): device-token-only cams breaks their still/fetch path; a tree carrying patch 03 must be live first"; }
is_our_loop() { # <pid> → this very script running --loop
  case " $(p_cmd "$1")" in *" $SELF --loop "*) return 0;; esac; return 1; }
cams_match()   { proxy_cmd_ok "$1" nest-webrtc-proxy.mjs "$CAMS_PORT"; }
lights_match() { proxy_cmd_ok "$1" lights-write-proxy.mjs "$LIGHTS_PORT"; }
adopt() {
  local c r m e bad=0
  adopt_one cams "$CAMS_PORT" cams_match || bad=1
  retired_note
  adopt_one lights "$LIGHTS_PORT" lights_match || bad=1
  for c in $CONNECTORS; do IFS=: read -r r m e <<<"$c"; adopt_one "$r" "$m" connector_cmd_ok "$m" || bad=1; done
  return $bad
}

# ── r3c · cams-only lights guard: read-only on lights (probe + /proc), never a signal or a start ───────────────────────
lights_guard() { # 0 = the pinned lights proxy is still the :8788 holder, same start time, healthy; else STOP (no restart)
  local pp ps h hs why=""
  { read -r pp ps _ <"$LPIN"; } 2>/dev/null || { pp=""; ps=""; }   # r3c P4: fd 2 redirected before the < (no stderr line)
  h=$(listener "$LIGHTS_PORT"); hs=$(p_start "${pp:-0}")
  if [ -z "$pp" ] || [ -z "$ps" ]; then why="no lights pin"
  elif [ "$h" != "$pp" ]; then why=":$LIGHTS_PORT holder is ${h:-none}, not pinned pid $pp"
  elif [ "$hs" != "$ps" ]; then why="pinned pid $pp start time changed"
  elif ! { lights_ok || { sleep 1; lights_ok; }; }; then why="pinned pid $pp on :$LIGHTS_PORT unhealthy"
  fi
  [ -z "$why" ] && return 0
  LSTOP=1; STOP=1
  log "STOP cams-only: lights $why; no lights start, restart or signal; loop leaving with exit 7 (report)"
  mkdir -p "$ALERTS"
  printf '{"schema":"wardos.hubsup.alert/1","alert":"cams-only-stop","state":"stopped","profile":"%s","at_ct":"%s","loop_pid":%d,"reason":"%s","note":"cams-only healer stopped; lights was not started, restarted or signalled; report to Atlas"}\n' \
    "$PROFILE" "$(date '+%F %T %Z')" "$$" "${why//\"/}" | scrub >"$ALERTS/cams-only-stop.json.tmp" && mv -f "$ALERTS/cams-only-stop.json.tmp" "$ALERTS/cams-only-stop.json"
  return 1
}
pass_cams_only() {
  local c r m e
  lights_guard || return 0
  heal_proxy cams nest-webrtc-proxy "$CAMS_PORT" cams_ok start_cams cams_match
  stop_req && return 0; lights_guard || return 0
  for c in $CONNECTORS; do stop_req && return 0; IFS=: read -r r m e <<<"$c"; heal_connector "$r" "$m" "$e"; done
  stop_req && return 0; lights_guard || return 0
  heal_public
  return 0
}

# ── one pass ────────────────────────────────────────────────────────────────────────────────────────────────────────
pass() {
  local c r m e
  [ "$CAMS_ONLY" = 1 ] && { pass_cams_only; return 0; }
  if [ "$PROFILE" = test ] && [ -n "${HUBSUP_ONLY:-}" ]; then   # test profile only: exercise one healer
    case "$HUBSUP_ONLY" in cams) heal_proxy cams nest-webrtc-proxy "$CAMS_PORT" cams_ok start_cams cams_match;; public) heal_public;; esac; return 0
  fi
  ensure_deps
  stop_req && return 0
  ensure_venv
  stop_req && return 0
  heal_proxy cams nest-webrtc-proxy "$CAMS_PORT" cams_ok start_cams cams_match
  stop_req && return 0
  heal_proxy lights lights-write-proxy "$LIGHTS_PORT" lights_ok start_lights lights_match
  for c in $CONNECTORS; do stop_req && return 0; IFS=: read -r r m e <<<"$c"; heal_connector "$r" "$m" "$e"; done
  stop_req && return 0
  heal_public
  return 0
}
take_lock() { # one healer at a time: our lock, plus the legacy watchdog's lock in prod
  exec 9>"$LOCK"; flock -n 9 || { HELD=supervisor; exec 9>&-; return 1; }
  if [ -n "$LEGACY_LOCK" ]; then exec 8>>"$LEGACY_LOCK"; flock -n 8 || { HELD=legacy; exec 8>&-; exec 9>&-; return 1; }; fi
  return 0
}
drop_lock() { exec 9>&-; [ -n "$LEGACY_LOCK" ] && exec 8>&-; return 0; }
who() { local p; p=$(pid_ours "$1") && [ "$p" = "$2" ] && echo "($(own_how "$1"))" || echo "(not ours)"; }
status() { # strictly read-only
  local c r m e svc_bad=0 healer_bad=0 grant_bad=0 code p g lp stale hl
  if cams_ok; then p=$(listener "$CAMS_PORT"); echo "OK   cams proxy :$CAMS_PORT pid $p $(who cams "$p") grant=$(grant_word)"; else echo "DOWN cams proxy :$CAMS_PORT"; svc_bad=1; fi
  if lights_ok; then p=$(listener "$LIGHTS_PORT"); echo "OK   lights proxy :$LIGHTS_PORT pid $p $(who lights "$p")"; else echo "DOWN lights proxy :$LIGHTS_PORT"; svc_bad=1; fi
  if venv_ok; then echo "OK   kasa venv current=$(basename "$(readlink "$VENV")") last-good=$(basename "$(readlink "$VROOT/last-good" 2>/dev/null || echo none)")"
  elif [ ! -e "$VENV" ] && [ -n "$LEGACY_VENV" ] && py_ok "$LEGACY_VENV"; then echo "OK   kasa venv (existing, not yet adopted)"
  else echo "DOWN kasa venv"; svc_bad=1; fi
  for c in $CONNECTORS; do IFS=: read -r r m e <<<"$c"
    if ready "$m"; then p=$(listener "$m"); echo "OK   connector $r metrics :$m pid $p $(who "$r" "$p")"; else echo "DOWN connector $r"; svc_bad=1; fi; done
  read -r code g <<<"$(pub_probe)"
  if [ "$code" = 200 ]; then echo "OK   public cams health 200"
  elif [ "$code" = 503 ] && [ "$g" = invalid ]; then echo "OK   public cams health 503 (tunnel serving; Nest grant invalid)"
  else echo "DOWN public cams health ${code:-000}"; svc_bad=1; fi
  [ -f "$ST/public.parked" ] && echo "WARN public rolls parked since $(cat "$ST/public.parked") (alerts/heal-public.json)"
  if grant_invalid; then
    if [ "$grant_src" = health ]; then echo "DOWN cams grant invalid (source: health; re-consent needed, a restart cannot fix it; cams restarts and connector rolls suspended)"; grant_bad=1
    else echo "WARN nest grant invalid (source: log; cams restarts and connector rolls suspended)"; fi
  fi
  retired_note
  old_clients_note
  if p=$(pid_ours loop); then echo "OK   healer loop pid $p"
  else
    # r3 · D2: a loop.own that no longer matches /proc is a STALE RECORD; it is named as such, never as the legacy watchdog
    stale=$(awk '{ print $1 }' "$ST/loop.own" 2>/dev/null); hl=$(lock_holder "$LOCK" 2>/dev/null) || hl=""
    [ -z "$hl" ] && [ -n "$LEGACY_LOCK" ] && { hl=$(lock_holder "$LEGACY_LOCK" 2>/dev/null) || hl=""; }
    if [ -n "$hl" ] && is_our_loop "$hl"; then
      if [ -n "$stale" ]; then echo "OK   healer loop pid $hl (unrecorded: stale loop.own record names pid $stale; --stop-own cannot signal it)"
      else echo "OK   healer loop pid $hl (unrecorded: no loop.own record; --stop-own cannot signal it)"; fi
      [ -n "$stale" ] && echo "WARN stale loop record: loop.own names pid $stale, which is not running as recorded"
    elif [ -n "$LEGACY_LOCK" ] && lp=$(lock_holder "$LEGACY_LOCK" 2>/dev/null) && ! is_our_loop "$lp"; then
      echo "OK   healer legacy watchdog pid $lp (holds hub-watchdog.lock)"
      [ -n "$stale" ] && echo "WARN stale loop record: loop.own names pid $stale, which is not running as recorded"
    elif [ -n "$stale" ]; then echo "DOWN healer loop (stale record: loop.own names pid $stale, which is not running as recorded)"; healer_bad=1
    else echo "DOWN healer loop"; healer_bad=1; fi
  fi
  if [ $svc_bad = 1 ] && [ $healer_bad = 1 ]; then return 5; fi
  [ $svc_bad = 1 ] && return 1
  [ $healer_bad = 1 ] && return 4
  [ $grant_bad = 1 ] && return 6
  return 0
}
start_loop() { # r2 · fully detached: the subshell's own stdio is /dev/null BEFORE it forks, so no caller pipe is held
  local i
  # r3c · D5: no env binary; HUBSUP_ONLY= (empty) is ignored by pass() exactly like unset; bash "$SELF" gives the same
  # "bash $SELF --loop " command line the shebang gave
  ( cd / && HUBSUP_ONLY= HUBSUP_PROFILE="$PROFILE" exec setsid nohup bash "$SELF" --loop ) </dev/null >/dev/null 2>&1 7>&- 8>&- 9>&- &
  disown $! 2>/dev/null || true
  for i in $(seq 1 20); do pid_ours loop >/dev/null && break; sleep 0.25; done
  if pid_ours loop >/dev/null; then log "boot: loop started pid $(pid_ours loop)"; return 0; fi
  log "boot: loop did not start (no healer)"; return 4
}
boot() { # → 0 a healer runs, 4 none
  HELD=""
  if take_lock; then log "ensure pass ($MODE)"; pass; drop_lock
  else log "ensure: healer already running ($HELD); venv/deps check only"; ensure_deps; ensure_venv; fi
  if pid_ours loop >/dev/null; then log "boot: loop already running pid $(pid_ours loop)"; return 0; fi
  if [ "$HELD" = legacy ]; then log "boot: legacy watchdog holds the healer lock; not starting a second healer"; return 0; fi
  start_loop
}

case "$MODE" in
  --ensure)
    prep_dirs; HELD=""
    if take_lock; then log "ensure pass ($MODE)"; pass; drop_lock
    else log "ensure: healer already running ($HELD); venv/deps check only"; ensure_deps; ensure_venv; fi
    status ;;
  --boot)
    prep_dirs; boot; status ;;
  --boot-once)
    exec </dev/null >/dev/null 2>&1
    prep_dirs; boot; exit $? ;;
  --loop)
    prep_dirs
    if [ "$CAMS_ONLY" = 1 ]; then   # r3c · refuse before the lock unless the pinned lights proxy is live and healthy
      lights_guard || { echo "REFUSE cams-only: lights pin check failed (see log); not starting"; exit 7; }
    fi
    take_lock || { echo "healer already running ($HELD)"; exit 0; }
    record_own loop $$ started; log "OK   loop start pid $$$( [ "$CAMS_ONLY" = 1 ] && echo ' (cams-only: lights never started, restarted or signalled)')"
    # r3 · D1: the trap only sets the flag; the loop leaves after the current pass step or the sleep, so a service it was
    # starting is recorded in its .own first and --stop-own can stop it. The sleep child is reaped by its exact pid.
    trap 'STOP=1' TERM INT HUP
    while ! stop_req; do
      pass; stop_req && break
      sleep 15 7>&- 8>&- 9>&- & SLP=$!
      stop_req || wait "$SLP"
      stop_req && kill -TERM "$SLP" 2>/dev/null; wait "$SLP" 2>/dev/null
    done
    [ "$LSTOP" = 1 ] && { log "DOWN loop stop pid $$ (cams-only lights STOP; exit 7)"; rm -f "$ST/loop.own"; exit 7; }
    log "DOWN loop stop pid $$ (stop requested; records: $(for s in cams lights $(for c in $CONNECTORS; do echo "${c%%:*}"; done); do printf '%s=%s ' "$s" "$(pid_ours "$s" || echo none)"; done))"
    rm -f "$ST/loop.own"; exit 0 ;;
  --adopt)
    prep_dirs
    exec 9>"$LOCK"; flock -n 9 || { echo "a supervisor pass is running; try again"; exit 1; }
    adopt; rc=$?; exec 9>&-; status; exit $rc ;;
  --status) status ;;
  --argv) [ "${2:-}" = cams ] && cams_argv || { echo "usage: --argv cams"; exit 2; } ;;
  --stop-own)
    prep_dirs
    src=0
    if ! stop_ours loop 240; then   # r3 · up to 60s so the loop records whatever it was starting
      hl=$(lock_holder "$LOCK" 2>/dev/null) && is_our_loop "$hl" && { echo "WARN healer loop pid $hl runs unrecorded (stale loop.own); not signalled"; log "stop-own: loop pid $hl unrecorded; not signalled"; src=1; }
    fi
    stop_ours cams; stop_ours lights
    for c in $CONNECTORS; do IFS=: read -r r m e <<<"$c"; stop_ours "$r"; done
    for q in "$CAMS_PORT" "$LIGHTS_PORT" $(for c in $CONNECTORS; do IFS=: read -r r m e <<<"$c"; echo "$m"; done); do
      hl=$(listener "$q"); [ -n "$hl" ] || continue
      echo "WARN :$q still held by pid $hl, not recorded by this supervisor; not signalled"; log "stop-own: :$q still held by unrecorded pid $hl; not signalled"; src=1
    done
    log "stop-own done (rc $src)"; exit $src ;;
  --roll-connector)   # TUNNELA1 r2 · one connector only: no other service, no loop, no heal pass, no retry
    rn="${2:-}"; rline=""
    for c in $CONNECTORS; do [ -n "$rn" ] && [ "${c%%:*}" = "$rn" ] && rline=$c; done
    [ -n "$rline" ] || { echo "usage: --roll-connector <name>  (name one of: $(for c in $CONNECTORS; do printf '%s ' "${c%%:*}"; done))"; exit 2; }
    IFS=: read -r r m e <<<"$rline"
    prep_dirs
    exec 9>"$LOCK"; flock -n 9 || { echo "a supervisor pass is running (healer lock held); not rolling $r"; exit 1; }
    p=$(pid_ours "$r") || { echo "connector $r is not started or adopted by this supervisor as recorded; not rolling it"; log "roll-connector $r: no matching own record; nothing signalled"; exec 9>&-; exit 4; }
    log "roll-connector $r: rolling own pid $p ($(own_how "$r")) metrics :$m edges $e"
    stop_ours "$r"
    held=$(listener "$m"); [ -z "$held" ] || { echo "connector $r: :$m still held by pid $held after stop; not starting"; log "roll-connector $r: :$m still held by pid $held after stop; not starting"; exec 9>&-; exit 4; }
    start_connector "$r" "$m" "$e"
    RDL=$((SECONDS + 120))   # wait_for counts tries (curl -m 3 + sleep 1 each); this deadline holds it to ~120s wall
    roll_ready() { ready "$1" && return 0; [ "$SECONDS" -ge "$RDL" ] && STOP=1; return 1; }
    if wait_for roll_ready 120 "$m"; then log "roll-connector $r: ready on :$m pid $(pid_ours "$r" || echo none)"; echo "connector $r: ready"; exec 9>&-; exit 0; fi
    log "roll-connector $r: not ready within 120s; left as is (no retry)"; echo "connector $r: NOT ready within 120s; left as is"; exec 9>&-; exit 3 ;;
  *) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$SELF"; exit 2 ;;
esac
