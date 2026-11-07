#!/usr/bin/env bash
# Lights recovery entry point for the existing BOX supervisor.
# Default is a read-only plan. Nothing is downloaded or started unless an
# explicit mode and a gate file say so. This file does not launch the camera
# proxy, a healer loop, or a public-cams health roll.
# The :8788 process, if a later gated execute starts it, is the existing
# lights-write-proxy: private feed, pairing, taps, Sensi, and Spotify stay as
# they are. Cached camera stills are a separate gate decision. This script does
# not add or remove routes.
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="$HERE/lib/recover_check.py"
DEFAULT_MANIFEST="$HERE/MANIFEST.json"
DEFAULT_REVIEW="$HERE/ingress-review.json"
DEFAULT_SUPERVISOR="$HERE/reference/hub-supervise.sh"
LIVE_SUPERVISOR="/workspace/wardos-ops/hub-supervise.sh"
SUPERVISOR_SHA="8a5b4d5549cefc0a9da714870574151c353e2c29c13239feecb0e3f1a96ef13c"
ALLOW_PROD="hold-release-lights-recover-1"
MODE="plan"
FIXTURE=""
GATE=""
MANIFEST="$DEFAULT_MANIFEST"
REVIEW="$DEFAULT_REVIEW"
SUPERVISOR=""
INGRESS_CONFIG=""
PORTS=""
TOKEN_FILE=""
RUN_ID_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --plan) MODE="plan" ;;
    --execute) MODE="execute" ;;
    --execute-deps) MODE="deps" ;;
    --rollback) MODE="rollback" ;;
    --fixture) FIXTURE="${2:-}"; shift ;;
    --gate) GATE="${2:-}"; shift ;;
    --manifest) MANIFEST="${2:-}"; shift ;;
    --ingress-review) REVIEW="${2:-}"; shift ;;
    --ingress-config) INGRESS_CONFIG="${2:-}"; shift ;;
    --supervisor) SUPERVISOR="${2:-}"; shift ;;
    --ports) PORTS="${2:-}"; shift ;;
    --token-file) TOKEN_FILE="${2:-}"; shift ;;
    --run-id) RUN_ID_ARG="${2:-}"; shift ;;
    -h|--help) MODE="help" ;;
    *) echo "REFUSE unknown argument"; exit 2 ;;
  esac
  shift
done

# Inherited supervisor test variables must not leak into a prod-shaped run.
if [ -z "$FIXTURE" ]; then
  unset HUBSUP_PROFILE HUBSUP_TEST_OPS HUBSUP_TEST_ROOT HUBSUP_TEST_PORTS HUBSUP_TEST_LOCK HUBSUP_ONLY || true
fi

print_exposure() {
  cat <<'EOF'
EXPOSURE: starting the existing :8788 process is not a lights-only or calendar-only start and does not start camera capture.
Unauthenticated on that process: GET /health and /api/health return only ok and the service name; OPTIONS is public.
POST /api/pair is the pairing redeem: a rate-limited single-use code returns the shared device key. POST /api/spotify/exchange runs on the pending PKCE state before the general key check. Neither exception is a separate role.
The same device key then covers pair mint, taps, Sensi read/set, the other Spotify routes, and lights read/set/refresh. A comment that mint is Dad-only is not a second authorization check.
Private feed, same key, serves calendar, months, kids-week, device JSON, school-filtered names, and cached camera stills at nest/<slug>.jpg. Parked capture does not stop that. Cached stills stay a privacy hold: allow-existing would accept this sharing model; hold or an absent decision refuses execute. This package does not add a route block.
POST /api/lights/refresh and a successful lights write can run the existing lights-fetch path and write private lights-live.json. The start itself does not call that path.
:8787 stays empty. Public cams health failure is not a reason to start the camera proxy.
Starting the two connectors restores both hostnames. The lights hostname exposes this whole :8788 surface. The local ingress check is not remote Cloudflare policy, and it does not prove there is no other host.
EOF
}

print_plan() {
  cat <<'EOF'
PLAN lights-recover: NOT AN EXECUTION
READY FOR INDEPENDENT REVIEW. NOT GATE-READY TO EXECUTE.
Ten runtime source pins are filled. scripts/sensi-control.mjs remains an opaque hash an independent gate may accept. This package does not lift that security review. Cached stills are undecided.
NOT APPROVED. This package contains no hold release and does not ask for one.
Cached stills: UNDECIDED. Execute stays refused until a gate file sets cached_stills to allow-existing. hold also refuses. Routes are left as they are.
Dirty run tree: 54 tracked modifications and 3 untracked files. HEAD b79bf2270b47294b8e75f76d9b227df924fa3941 is not a full pin and is not in origin/main. Pre-reboot b71 source is uncertain.
No required source hash is null. Execute still refuses without opaque Sensi acceptance and a cached-stills decision. The 17:43 binary pin is a fail-closed box check, not a hermetic proof. ws was absent at that capture.
Kasa lock: 21 package declarations and 21 hash entries. It is not an arm64 lock. Recovery reuses the current venv and does not rebuild it.
Node dependency install is a separate explicit mode and is not run by plan or by service start. It runs the checked absolute node on the checked absolute npm: npm ci --ignore-scripts --no-audit --no-fund --prefix <DEPS>.
Bootstrap python3 is a trusted prerequisite for the gate and checker. It is captured once before that use and is not a pinned interpreter.
No healer loop, boot enable, cron, or feed rewrite is part of this package.
No other hub host is proven or disproven.
EOF
  print_exposure
}

if [ "$MODE" = "help" ] || [ "$MODE" = "plan" ]; then
  print_plan
  exit 0
fi

if [ -n "$FIXTURE" ]; then
  case "$FIXTURE" in
    /tmp/*|/var/tmp/*) ;;
    *) echo "REFUSE fixture must be under /tmp"; exit 10 ;;
  esac
  export HUBSUP_PROFILE=test
  export HUBSUP_TEST_OPS="$FIXTURE"
  export HUBSUP_TEST_ROOT="$FIXTURE/test"
  if [ -n "$PORTS" ]; then export HUBSUP_TEST_PORTS="$PORTS"; fi
else
  export HUBSUP_PROFILE=prod
  if [ "${WARDOS_RECOVERY_ALLOW_PROD:-}" != "$ALLOW_PROD" ]; then
    echo "REFUSE prod execution is not allowed on this invocation"
    exit 10
  fi
  if [ ! -f "$LIVE_SUPERVISOR" ]; then
    echo "REFUSE live supervisor is not on this machine; not creating it"
    exit 10
  fi
fi

if [ -z "$GATE" ] || [ ! -f "$GATE" ]; then
  echo "REFUSE gate file absent"
  exit 10
fi

NEED_STILLS=()
INGRESS_ARG=()
if [ "$MODE" = "execute" ]; then
  NEED_STILLS=(--need-stills)
  INGRESS_ARG=(--ingress "$REVIEW")
fi
BOOTSTRAP_PYTHON="$(command -v python3 || true)"
if [ -z "$BOOTSTRAP_PYTHON" ]; then
  echo "REFUSE bootstrap python3 is absent. It is a trusted prerequisite, not a pinned interpreter."
  exit 10
fi
BOOTSTRAP_PYTHON="$(readlink -f "$BOOTSTRAP_PYTHON")"
if [ ! -x "$BOOTSTRAP_PYTHON" ]; then
  echo "REFUSE bootstrap python3 is not executable. It is a trusted prerequisite, not a pinned interpreter."
  exit 10
fi
"$BOOTSTRAP_PYTHON" "$CHECK" gate --gate "$GATE" --script "$0" --manifest "$MANIFEST" "${INGRESS_ARG[@]}" "${NEED_STILLS[@]}"

if [ -z "$SUPERVISOR" ]; then
  if [ -n "$FIXTURE" ]; then SUPERVISOR="$DEFAULT_SUPERVISOR"; else SUPERVISOR="$LIVE_SUPERVISOR"; fi
fi
have="$(sha256sum "$SUPERVISOR" | cut -c1-64)"
if [ "$have" != "$SUPERVISOR_SHA" ]; then
  echo "REFUSE supervisor hash mismatch"
  exit 11
fi

SLICE="$(mktemp)"
trap 'rm -f "$SLICE"' EXIT
awk 'BEGIN{ok=1} /^case "\$MODE" in/{ok=0} ok' "$SUPERVISOR" >"$SLICE"
if grep -q '^case "\$MODE" in' "$SLICE"; then
  echo "REFUSE supervisor slice still contains its dispatcher"
  exit 11
fi
saved_mode="$MODE"
set --
# shellcheck disable=SC1090
source "$SLICE"
MODE="$saved_mode"
if [ "$PROFILE" = "prod" ] && [ -n "$FIXTURE" ]; then
  echo "REFUSE fixture did not select the test profile"
  exit 10
fi

PROD_PATH="/usr/local/bin:/usr/bin:/bin:/home/box/.local/bin"
BOUND_NODE=""
BOUND_CF=""
BOUND_NPM=""

final_bind_path() {
  if [ "$PROFILE" = prod ]; then
    printf '%s\n' "$PROD_PATH"
  elif [ -n "${WARDOS_RECOVERY_TEST_FINAL_PATH:-}" ]; then
    printf '%s\n' "$WARDOS_RECOVERY_TEST_FINAL_PATH"
  else
    printf '%s\n' "$PATH"
  fi
}

bind_exec() {
  local role="$1" out rc line
  local -a args
  # The PATH used for name lookup is the PATH that stays in effect. Production
  # replaces the inherited PATH before any which(). It is not rewritten after.
  export PATH
  PATH="$(final_bind_path)"
  args=(bind-exec --profile "$PROFILE" --role "$role" --gate "$GATE")
  if [ "$PROFILE" = prod ]; then
    args+=(--venv-python "$VENV/bin/python")
  else
    args+=(--cf "$CF" --venv-python "$VENV/bin/python" --test-root "$T")
    [ -n "${WARDOS_EXPECT_NODE_SHA:-}" ] && args+=(--expect-node-sha "$WARDOS_EXPECT_NODE_SHA")
    [ -n "${WARDOS_EXPECT_CF_SHA:-}" ] && args+=(--expect-cf-sha "$WARDOS_EXPECT_CF_SHA")
    [ -n "${WARDOS_EXPECT_PYTHON_SHA:-}" ] && args+=(--expect-python-sha "$WARDOS_EXPECT_PYTHON_SHA")
    [ -n "${WARDOS_EXPECT_NPM_SHA:-}" ] && args+=(--expect-npm-sha "$WARDOS_EXPECT_NPM_SHA")
  fi
  set +e
  out="$("$BOOTSTRAP_PYTHON" "$CHECK" "${args[@]}")"
  rc=$?
  set -e
  printf '%s\n' "$out"
  [ "$rc" -eq 0 ] || return 21
  BOUND_NODE=""
  BOUND_CF=""
  if [ "$role" = deps ]; then BOUND_NPM=""; fi
  while IFS= read -r line; do
    case "$line" in
      NODE\ *) BOUND_NODE="${line#NODE }" ;;
      CF\ *) BOUND_CF="${line#CF }" ;;
      NPM\ *) BOUND_NPM="${line#NPM }" ;;
    esac
  done <<<"$out"
  if [ -z "$BOUND_NODE" ] || [ -z "$BOUND_CF" ]; then
    echo "REFUSE bind did not return the checked executables"
    return 21
  fi
  if [ "$role" = deps ] && [ -z "$BOUND_NPM" ]; then
    echo "REFUSE bind did not return the checked npm"
    return 21
  fi
  export CF="$BOUND_CF"
  return 0
}

trace() {
  [ -n "${WARDOS_RECOVERY_TRACE:-}" ] && printf '%s\n' "$1" >>"$WARDOS_RECOVERY_TRACE"
  if [ -d "${ST:-}" ]; then printf '%s\n' "$1" >>"$ST/recover.trace"; fi
}

scope_file() { echo "$ST/lights-recover.scope"; }
live_identity() { # pid start cmdsha cwd: 0 only when /proc is still that recorded process
  local p="$1"
  [ -d "/proc/$p" ] || return 1
  [ "$(p_start "$p")" = "$2" ] && [ "$(p_cmdsha "$p")" = "$3" ] && [ "$(p_cwd "$p")" = "$4" ]
}

append_scope() {
  local svc="$1" line
  line="$(cat "$ST/$svc.own")"
  printf '%s %s\n' "$svc" "$line" >>"$(scope_file)"
}

metric_ports() {
  local c r m e
  for c in $CONNECTORS; do
    IFS=: read -r r m e <<<"$c"
    printf '%s\n' "$m"
  done
}

prove_empty() {
  local p held
  for p in "$CAMS_PORT" "$LIGHTS_PORT" $(metric_ports); do
    held="$(listener "$p" || true)"
    if [ -n "$held" ]; then
      echo "REFUSE :$p is held by pid $held; not signalling"
      return 12
    fi
  done
}
lock_free() {
  if [ -e "$LOCK" ] && lock_holder "$LOCK" >/dev/null 2>&1; then
    echo "REFUSE healer lock is held; not starting"
    return 19
  fi
}

token_meta() {
  local f
  if [ "$PROFILE" = "test" ]; then
    f="${TOKEN_FILE:-}"
    [ -n "$f" ] || { echo "REFUSE fixture token path missing"; return 14; }
  else
    f="$HOME/.config/wardos/lights-proxy.token"
  fi
  if [ -L "$f" ] || [ ! -f "$f" ]; then
    echo "REFUSE device token file is missing or is a symlink"
    return 14
  fi
  if [ "$(stat -c %a "$f")" != "600" ]; then
    echo "REFUSE device token file mode is not 600"
    return 14
  fi
  if [ "$(stat -c %s "$f")" -le 0 ]; then
    echo "REFUSE device token file is empty"
    return 14
  fi
  echo "OK token metadata mode 600 non-empty"
}

start_recorded_lights() {
  local p i
  start_lights || true
  p=""
  for i in 1 2 3 4 5 6 7 8 9 10; do
    p="$(listener "$LIGHTS_PORT" || true)"
    [ -n "$p" ] && break
    sleep 0.5
  done
  if [ -z "$p" ] || ! lights_match "$p"; then
    echo "REFUSE lights start produced no matching listener; not signalling a foreign pid"
    return 16
  fi
  record_own lights "$p" started
  append_scope lights
  trace "start-lights"
  if ! wait_for lights_ok 20; then
    echo "REFUSE lights listener was recorded but did not become healthy"
    return 16
  fi
}

start_recorded_connector() {
  local name="$1" port="$2" edge="$3" held
  held="$(listener "$port" || true)"
  if [ -n "$held" ]; then
    echo "REFUSE connector $name port :$port is held by pid $held; not signalling"
    return 17
  fi
  start_connector "$name" "$port" "$edge"
  if ! pid_ours "$name" >/dev/null; then
    echo "REFUSE connector $name did not record an identity"
    return 17
  fi
  append_scope "$name"
  trace "start-connector $name"
  if ! wait_for ready 25 "$port"; then
    echo "REFUSE connector $name recorded but not ready"
    return 17
  fi
}

public_lights() {
  local url code
  url="${WARDOS_LIGHTS_PUBLIC_HEALTH:-https://lights.wardhousehub.com/health}"
  case "$url" in
    *cams.wardhousehub.com*) echo "REFUSE public probe must not target the cams hostname"; return 18 ;;
  esac
  if [ "$PROFILE" = "test" ]; then
    case "$url" in
      http://127.0.0.1:*|http://localhost:*) ;;
      *) echo "REFUSE fixture public probe must be loopback"; return 18 ;;
    esac
  fi
  code="$(curl -s -m 8 -o /dev/null -w '%{http_code}' "$url" || true)"
  echo "public lights health ${code:-000}"
  trace "public-lights ${code:-000}"
  [ "$code" = "200" ]
}

run_deps() {
  local pj pl
  pj="$DEPS/package.json"
  pl="$DEPS/package-lock.json"
  [ -f "$pj" ] && [ -f "$pl" ] || { echo "REFUSE deps manifest missing"; return 14; }
  "$BOOTSTRAP_PYTHON" - "$MANIFEST" "$pj" "$pl" <<'PY'
import hashlib, json, sys
man, pj, pl = sys.argv[1:]
m = json.load(open(man))
def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()
d = m["node_deps"]
if sha(pj) != d["package_json_sha256"] or sha(pl) != d["package_lock_sha256"]:
    raise SystemExit("REFUSE deps hash mismatch")
print("OK deps hashes")
PY
  if [ -z "${BOUND_NODE:-}" ] || [ -z "${BOUND_NPM:-}" ]; then
    echo "REFUSE npm invoke has no checked absolute path"
    return 21
  fi
  trace "npm-ci"
  # The shebang is not consulted. A later PATH lookup cannot select another npm or node.
  "$BOUND_NODE" "$BOUND_NPM" ci --ignore-scripts --no-audit --no-fund --prefix "$DEPS"
  if ! deps_ok; then
    echo "REFUSE ws@$WS_VERSION not present after npm ci"
    return 14
  fi
  echo "OK deps ws@$WS_VERSION"
}

rollback() {
  local scope line svc pid start hash how cwd own rc=0
  scope="$(scope_file)"
  if [ ! -f "$scope" ]; then
    echo "REFUSE no recovery scope; not signalling"
    return 20
  fi
  prep_dirs
  if ! take_lock; then
    echo "REFUSE healer lock is held; rollback not signalling"
    return 19
  fi
  local file_run gate_run
  file_run="$(awk '/^run / { print $2; exit }' "$scope")"
  gate_run="$("$BOOTSTRAP_PYTHON" -c 'import json,sys; print(json.load(open(sys.argv[1])).get("rollback_run_id") or "")' "$GATE")"
  if [ -z "$RUN_ID_ARG" ] || [ -z "$gate_run" ] || [ -z "$file_run" ] || [ "$RUN_ID_ARG" != "$file_run" ] || [ "$gate_run" != "$file_run" ]; then
    echo "REFUSE rollback run id does not match this scope; not signalling"
    drop_lock || true
    return 20
  fi
  while read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      schema\ *|run\ *) continue ;;
    esac
    read -r svc pid start hash how cwd <<<"$line"
    case "$svc" in
      lights|r1|r2|t1|t2) ;;
      *) echo "REFUSE scope names $svc; not signalling"; rc=20; break ;;
    esac
    if [ ! -f "$ST/$svc.own" ]; then
      echo "ROLLBACK $svc: no own record; not signalling"
      rc=20
      continue
    fi
    own="$(cat "$ST/$svc.own")"
    if [ "$own" != "$pid $start $hash $how $cwd" ]; then
      echo "REFUSE $svc own record does not match scope; not signalling"
      rc=20
      continue
    fi
    if ! stop_ours "$svc"; then
      echo "REFUSE $svc: recorded identity was not confirmed stopped; not signalling a replacement"
      if live_identity "$pid" "$start" "$hash" "$cwd"; then
        echo "REFUSE $svc: intended identity is still live"
      else
        echo "ROLLBACK $svc: intended identity is not the live process"
      fi
      rc=20
      continue
    fi
    if live_identity "$pid" "$start" "$hash" "$cwd"; then
      echo "REFUSE $svc: intended identity still live after stop"
      rc=20
      continue
    fi
    trace "rollback $svc"
  done <"$scope"
  drop_lock || true
  return $rc
}

if [ "$MODE" = "rollback" ]; then
  rollback
  exit $?
fi

print_exposure

if [ "$MODE" = "deps" ]; then
  bind_exec deps || exit 21
  prep_dirs
  if ! take_lock; then echo "REFUSE healer lock is held"; exit 19; fi
  set +e
  run_deps
  rc=$?
  set -e
  drop_lock || true
  exit $rc
fi

# Refuse on provenance, venv, deps, ingress, token, or a taken port
# before creating state or starting anything.
sensi_flag=()
if "$BOOTSTRAP_PYTHON" -c 'import json,sys; g=json.load(open(sys.argv[1])); raise SystemExit(0 if g.get("sensi_opaque")=="accept-existing-hash" else 1)' "$GATE"; then
  sensi_flag=(--accept-sensi-opaque)
fi
"$BOOTSTRAP_PYTHON" "$CHECK" transitive --root "$RT" --manifest "$MANIFEST" "${sensi_flag[@]}"
trace "provenance"
bind_exec execute || exit 21
if ! venv_ok; then
  echo "REFUSE current Kasa venv is not importable; not rebuilding"
  exit 13
fi
trace "venv-ok"
if ! deps_ok; then
  echo "REFUSE ws is not installed; dependency install is a separate explicit mode"
  exit 14
fi
trace "deps-ok"
launch="$(readlink -f "$CFG" 2>/dev/null || true)"
if [ -z "$launch" ] || [ ! -f "$launch" ]; then echo "REFUSE launched tunnel config is missing"; exit 15; fi
if [ -n "$INGRESS_CONFIG" ]; then
  other="$(readlink -f "$INGRESS_CONFIG" 2>/dev/null || true)"
  if [ "$other" != "$launch" ]; then echo "REFUSE ingress-config is not the launched CFG"; exit 15; fi
fi
launch_sha="$(sha256sum "$launch" | cut -c1-64)"
gate_sha="$("$BOOTSTRAP_PYTHON" -c 'import json,sys; print(json.load(open(sys.argv[1])).get("ingress_config_sha256") or "")' "$GATE")"
if [ "$gate_sha" != "$launch_sha" ]; then echo "REFUSE gate does not bind the launched CFG bytes"; exit 15; fi
"$BOOTSTRAP_PYTHON" "$CHECK" ingress --config "$launch" --review "$REVIEW"
trace "ingress-ok"
token_meta
trace "token-meta"
prove_empty
lock_free
trace "ports-empty"
prep_dirs
if [ "$PROFILE" = test ] && [ -n "${WARDOS_RECOVERY_LOCK_PAUSE:-}" ]; then
  sleep "$WARDOS_RECOVERY_LOCK_PAUSE"
fi
if ! take_lock; then echo "REFUSE healer lock is held"; exit 19; fi
trace "lock"
run_id="$$-$(date +%s%N)"
scope_tmp="$ST/lights-recover.scope.$run_id"
printf 'schema wardos.lights-recover.scope/1\nrun %s\n' "$run_id" >"$scope_tmp"
mv -f "$scope_tmp" "$(scope_file)"
set +e
(
  set -e
  prove_empty
  start_recorded_lights
  c_rc=0
  for c in $CONNECTORS; do
    IFS=: read -r r m e <<<"$c"
    start_recorded_connector "$r" "$m" "$e" || c_rc=17
  done
  held="$(listener "$CAMS_PORT" || true)"
  if [ -n "$held" ]; then
    echo "REFUSE :$CAMS_PORT is held by pid $held after start; not signalling"
    exit 18
  fi
  trace "cams-still-empty"
  if ! public_lights; then
    [ "$c_rc" -eq 0 ] && c_rc=17
  fi
  exit $c_rc
)
rc=$?
set -e
drop_lock || true
exit $rc
