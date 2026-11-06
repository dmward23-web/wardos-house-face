/* Mocked lights recovery. Nothing here joins a tunnel or touches a live hub.
   node --test --test-concurrency=1 ops/box-recover/qa/recover.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OPS = path.join(ROOT, "ops/box-recover");
const SH = path.join(OPS, "hub-recover-lights.sh");
const MANIFEST = path.join(OPS, "MANIFEST.json");
const REVIEW = path.join(OPS, "ingress-review.json");
const HOUSE = path.join(ROOT, "scripts/house-proc.sh");
const SECRET = "SUPERSECRETTOKENVALUE1234567890";
const LIVE = new Set([8787, 8788, 20241, 20242]);
const bin = path.join(os.tmpdir(), "wardos-fake-cloudflared");

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });
}
async function ports() {
  const out = [];
  while (out.length < 4) {
    const p = await freePort();
    if (!LIVE.has(p) && !out.includes(p)) out.push(p);
  }
  return out;
}
function run(args, env = {}, cwd = OPS) {
  return spawnSync("bash", [SH, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, ...env },
    timeout: 120000,
  });
}
function writeGate(file, extra) {
  const gate = {
    schema: "wardos.lights-recover.gate/1",
    artifact_sha256: sha(SH),
    hold_release: "lights-recover-1",
    dirty_tree: "accept-pinned-bytes",
    manifest_sha256: extra.manifest_sha256,
    ingress_review_sha256: extra.ingress_review_sha256,
    cached_stills: extra.cached_stills,
  };
  if (extra.ingress_config_sha256) gate.ingress_config_sha256 = extra.ingress_config_sha256;
  fs.writeFileSync(file, JSON.stringify(gate));
}
function pidsOn(port) {
  const r = spawnSync("ss", ["-ltnpH", `sport = :${port}`], { encoding: "utf8" });
  return [...r.stdout.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function killPid(pid) {
  try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
}
function textUnder(dir) {
  if (!fs.existsSync(dir)) return "";
  let out = "";
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out += textUnder(p);
    else if (st.size < 2_000_000 && !name.includes("cloudflared") || name.endsWith(".log") || name.endsWith(".own") || name.endsWith(".scope") || name.endsWith(".trace")) {
      if (name === "cloudflared" || name.endsWith(".log") || name.endsWith(".scope") || name.endsWith(".own") || name.endsWith("trace") || name.endsWith(".json") || name.endsWith(".yml")) {
        try { out += fs.readFileSync(p, "utf8"); } catch { /* binary */ }
      }
    }
  }
  return out;
}

function fixture(portList) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lights-recover-"));
  const t = path.join(root, "test");
  const rt = path.join(t, "run-tree");
  const scripts = path.join(rt, "scripts");
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(path.join(t, "cloudflared"), { recursive: true });
  fs.mkdirSync(path.join(t, "bin"), { recursive: true });
  fs.mkdirSync(path.join(t, "deps/node_modules/ws"), { recursive: true });
  const venv = path.join(t, "kasa-venvs/venv-fixture");
  fs.mkdirSync(path.join(venv, "bin"), { recursive: true });
  fs.writeFileSync(path.join(venv, "bin/python"), `#!/bin/sh
log="$WARDOS_PY_LOG"
for a in "$@"; do
  case "$a" in
    *venv*|*pip*) printf 'REBUILD %s\\n' "$a" >>"$log"; exit 99 ;;
  esac
done
exit 0
`, { mode: 0o755 });
  fs.symlinkSync(venv, path.join(t, "kasa-venvs/current"));
  fs.writeFileSync(path.join(t, "deps/node_modules/ws/package.json"), '{"version": "8.22.0"}\n');
  fs.copyFileSync(bin, path.join(t, "bin/cloudflared"));
  fs.chmodSync(path.join(t, "bin/cloudflared"), 0o755);
  fs.copyFileSync(HOUSE, path.join(scripts, "house-proc.sh"));
  fs.writeFileSync(path.join(scripts, "lights-write-proxy.mjs"), `import http from 'node:http';
const i = process.argv.indexOf('--port');
const port = Number(process.argv[i + 1]);
http.createServer((q, s) => { s.end(JSON.stringify({ ok: true, service: 'lights-write-proxy' })); }).listen(port, '127.0.0.1');
`);
  fs.writeFileSync(path.join(scripts, "nest-webrtc-proxy.mjs"), `import fs from 'node:fs';
fs.writeFileSync(process.env.CAM_SENTINEL, 'started\\n');
`);
  const cfg = path.join(t, "cloudflared/test-hub.yml");
  fs.writeFileSync(cfg, [
    "tunnel: wardos-test-hub",
    "ingress:",
    "  - hostname: cams.fixture.example",
    "    service: http://127.0.0.1:18787",
    "  - hostname: lights.fixture.example",
    "    service: http://127.0.0.1:18788",
    "  - service: http_status:404",
    "",
  ].join("\n"));
  const reviewPath = path.join(root, "review.json");
  fs.writeFileSync(reviewPath, JSON.stringify({
    schema: "wardos.hub.ingress-review/1",
    rules: [
      { hostname: "cams.fixture.example", service: "http://127.0.0.1:18787" },
      { hostname: "lights.fixture.example", service: "http://127.0.0.1:18788" },
      { hostname: null, service: "http_status:404" },
    ],
  }));
  const token = path.join(root, "device.token");
  fs.writeFileSync(token, SECRET + "\n", { mode: 0o600 });
  const manifest = {
    schema: "wardos.lights-recover.manifest/1",
    files: ["scripts/house-proc.sh", "scripts/lights-write-proxy.mjs"].map((rel) => ({
      path: rel,
      sha256: sha(path.join(rt, rel)),
      required_before_execute: true,
    })),
  };
  const manifestPath = path.join(root, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const gate = path.join(root, "gate.json");
  writeGate(gate, {
    manifest_sha256: sha(manifestPath),
    ingress_review_sha256: sha(reviewPath),
    ingress_config_sha256: sha(cfg),
    cached_stills: "allow-existing",
  });
  const sentinel = path.join(root, "cam-started");
  const trace = path.join(root, "trace");
  const pylog = path.join(root, "python.log");
  return { root, t, rt, ports: portList, cfg, review: reviewPath, token, manifestPath, gate, sentinel, trace, pylog };
}
function argsOf(fx, mode) {
  return [mode, "--fixture", fx.root, "--gate", fx.gate, "--manifest", fx.manifestPath,
    "--ingress-review", fx.review, "--ingress-config", fx.cfg, "--ports", fx.ports.join(" "),
    "--token-file", fx.token];
}
function envOf(fx, extra = {}) {
  return {
    WARDOS_RECOVERY_TRACE: fx.trace,
    WARDOS_PY_LOG: fx.pylog,
    WARDOS_LIGHTS_PUBLIC_HEALTH: `http://127.0.0.1:${fx.ports[1]}/health`,
    CAM_SENTINEL: fx.sentinel,
    ...extra,
  };
}
function cleanup(fx, extraPids = []) {
  if (!fx) return;
  const scope = path.join(fx.t, "state/lights-recover.scope");
  const pids = [...extraPids];
  if (fs.existsSync(scope)) {
    for (const line of fs.readFileSync(scope, "utf8").split("\n")) {
      const pid = Number(line.split(" ")[1]);
      if (pid) pids.push(pid);
    }
  }
  for (const port of fx.ports) pids.push(...pidsOn(port));
  for (const pid of pids) killPid(pid);
  fs.rmSync(fx.root, { recursive: true, force: true });
}

test("ingress parser accepts the reviewed rules and rejects a non-loopback origin", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ingress-"));
  const good = path.join(dir, "good.yml");
  const bad = path.join(dir, "bad.yml");
  fs.writeFileSync(good, "other: hidden\ningress:\n  - hostname: cams.wardhousehub.com\n    service: http://127.0.0.1:8787\n  - hostname: lights.wardhousehub.com\n    service: http://127.0.0.1:8788\n  - service: http_status:404\n");
  fs.writeFileSync(bad, "ingress:\n  - hostname: lights.wardhousehub.com\n    service: http://10.1.1.1:8788\n  - service: http_status:404\n");
  const ok = spawnSync("python3", [path.join(OPS, "lib/recover_check.py"), "ingress", "--config", good, "--review", REVIEW], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.match(ok.stdout, /^OK ingress 3/);
  assert.doesNotMatch(ok.stdout + ok.stderr, /hidden|creds/);
  const no = spawnSync("python3", [path.join(OPS, "lib/recover_check.py"), "ingress", "--config", bad, "--review", REVIEW], { encoding: "utf8" });
  assert.notEqual(no.status, 0);
  assert.match(no.stdout, /REFUSE ingress/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("plan is not an execution and names the real exposure", () => {
  const r = run(["--plan"]);
  assert.equal(r.status, 0, r.stderr);
  const text = r.stdout;
  assert.match(text, /NOT AN EXECUTION/);
  assert.match(text, /NOT GATE-READY/);
  assert.match(text, /NOT APPROVED/);
  assert.match(text, /not a lights-only or calendar-only/);
  assert.match(text, /does not start camera capture/);
  assert.match(text, /Cached stills: UNDECIDED/);
  assert.match(text, /Sensi/);
  assert.match(text, /Spotify/);
  assert.match(text, /pairing/);
  assert.match(text, /cached camera stills/);
  assert.match(text, /does not add a route block/);
  assert.match(text, /21 package declarations and 21 hash entries/);
  assert.match(text, /54 tracked/);
  assert.match(text, /b71 source is uncertain/);
  assert.match(text, /No other hub host is proven or disproven/);
  assert.match(text, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.equal(fs.existsSync("/workspace/wardos-ops"), false);
});

test("shipped manifest still refuses execute because runtime hashes are missing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lights-recover-gap-"));
  const gate = path.join(root, "gate.json");
  writeGate(gate, { manifest_sha256: sha(MANIFEST), ingress_review_sha256: sha(REVIEW), cached_stills: "allow-existing" });
  const r = run(["--execute", "--fixture", root, "--gate", gate, "--ports", "18787 18788 20251 20252"]);
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stdout + r.stderr, /sensi-opaque-approval-required/);
  assert.match(r.stdout, /sensi-control\.mjs/);
  const shipped = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const sensi = shipped.files.find((row) => row.path === "scripts/sensi-control.mjs");
  assert.equal(sensi.security_review, "open");
  assert.doesNotMatch(r.stdout + r.stderr, /CLIENT_SECRET\s*[:=]\s*['"]/);
  assert.equal(fs.existsSync(path.join(root, "test/state")), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("cached-stills hold refuses and does not modify routes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lights-recover-hold-"));
  const gate = path.join(root, "gate.json");
  writeGate(gate, { manifest_sha256: sha(MANIFEST), ingress_review_sha256: sha(REVIEW), cached_stills: "hold" });
  const r = run(["--execute", "--fixture", root, "--gate", gate]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /cached stills/);
  assert.doesNotMatch(fs.readFileSync(SH, "utf8"), /nest-snaps|unlink|rm -rf/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("execute without a gate refuses before creating state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lights-recover-nogate-"));
  const r = run(["--execute", "--fixture", root]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /gate file absent/);
  assert.equal(fs.existsSync(path.join(root, "test/state")), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("full mock start, scrub, rollback, and a foreign process left alive", async () => {
  const fx = fixture(await ports());
  const bystander = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  try {
    fs.mkdirSync(path.join(fx.t, "state"), { recursive: true });
    fs.writeFileSync(path.join(fx.t, "state/loop.own"), "2812139 1 stale started /nowhere\n");
    fs.writeFileSync(path.join(fx.t, "state/cams.own"), `${bystander.pid} 1 nope started /tmp\n`);
    const started = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(started.status, 0, started.stdout + started.stderr);
    assert.equal(pidsOn(fx.ports[0]).length, 0, "cams port");
    assert.ok(pidsOn(fx.ports[1]).length > 0, "lights port");
    assert.ok(pidsOn(fx.ports[2]).length > 0, "first connector");
    assert.ok(pidsOn(fx.ports[3]).length > 0, "second connector");
    assert.equal(fs.existsSync(fx.sentinel), false);
    const trace = fs.readFileSync(fx.trace, "utf8");
    assert.match(trace, /start-lights/);
    assert.match(trace, /start-connector t1/);
    assert.match(trace, /start-connector t2/);
    assert.match(trace, /cams-still-empty/);
    assert.doesNotMatch(trace, /start-cams|heal-public|npm-ci/);
    assert.match(started.stdout, /not a lights-only or calendar-only/);
    assert.match(started.stdout, /cached camera stills/);
    const logs = textUnder(fx.t) + started.stdout + started.stderr;
    assert.doesNotMatch(logs, new RegExp(SECRET));
    assert.doesNotMatch(logs, /203\.0\.113\.10/);
    assert.doesNotMatch(logs, /12345678-1234-1234-1234-123456789abc/);
    assert.match(logs, /<redacted>/);
    assert.equal(fs.existsSync(fx.pylog) && fs.readFileSync(fx.pylog, "utf8").includes("REBUILD"), false);
    assert.match(fs.readFileSync(path.join(fx.t, "state/loop.own"), "utf8"), /2812139/);
    assert.equal(alive(bystander.pid), true);
    const rolled = run(argsOf(fx, "--rollback"), envOf(fx));
    assert.equal(rolled.status, 0, rolled.stdout + rolled.stderr);
    assert.equal(pidsOn(fx.ports[1]).length, 0);
    assert.equal(pidsOn(fx.ports[2]).length, 0);
    assert.equal(pidsOn(fx.ports[3]).length, 0);
    assert.equal(alive(bystander.pid), true);
    assert.match(fs.readFileSync(fx.trace, "utf8"), /rollback lights/);
    assert.doesNotMatch(fs.readFileSync(fx.trace, "utf8"), /rollback cams/);
  } finally {
    killPid(bystander.pid);
    cleanup(fx);
  }
});

test("foreign listener is refused and not signalled", async () => {
  const fx = fixture(await ports());
  const foreign = spawn("python3", ["-m", "http.server", String(fx.ports[1]), "--bind", "127.0.0.1"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 30 && pidsOn(fx.ports[1]).length === 0; i++) await new Promise((r) => setTimeout(r, 50));
    const r = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(r.status, 12, r.stdout + r.stderr);
    assert.match(r.stdout, /not signalling/);
    assert.equal(foreign.exitCode, null);
    assert.equal(fs.existsSync(fx.sentinel), false);
    assert.equal(pidsOn(fx.ports[2]).length, 0);
    assert.equal(fs.existsSync(path.join(fx.t, "state/lights-recover.scope")), false);
  } finally {
    killPid(foreign.pid);
    cleanup(fx);
  }
});

test("stale own record is not a licence to signal that pid", async () => {
  const fx = fixture(await ports());
  const bystander = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  try {
    fs.mkdirSync(path.join(fx.t, "state"), { recursive: true });
    fs.writeFileSync(path.join(fx.t, "state/lights.own"), `${bystander.pid} 1 not-the-command-hash started /tmp\n`);
    const r = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(alive(bystander.pid), true);
    const own = fs.readFileSync(path.join(fx.t, "state/lights.own"), "utf8");
    assert.doesNotMatch(own, new RegExp(`^${bystander.pid} `));
  } finally {
    killPid(bystander.pid);
    cleanup(fx);
  }
});

test("connector partial failure is reversible without pattern kills", async () => {
  const fx = fixture(await ports());
  const side = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  try {
    const started = run(argsOf(fx, "--execute"), envOf(fx, { WARDOS_FAKE_CF_FAIL_PORT: String(fx.ports[3]) }));
    assert.equal(started.status, 17, started.stdout + started.stderr);
    assert.ok(pidsOn(fx.ports[1]).length > 0);
    assert.ok(pidsOn(fx.ports[2]).length > 0);
    assert.equal(pidsOn(fx.ports[3]).length, 0);
    assert.equal(pidsOn(fx.ports[0]).length, 0);
    const scope = fs.readFileSync(path.join(fx.t, "state/lights-recover.scope"), "utf8");
    assert.match(scope, /^lights /m);
    assert.match(scope, /^t1 /m);
    assert.doesNotMatch(scope, /^t2 /m);
    const rolled = run(argsOf(fx, "--rollback"), envOf(fx));
    assert.equal(rolled.status, 0, rolled.stdout + rolled.stderr);
    assert.equal(pidsOn(fx.ports[1]).length, 0);
    assert.equal(pidsOn(fx.ports[2]).length, 0);
    assert.equal(alive(side.pid), true);
    assert.doesNotMatch(fs.readFileSync(SH, "utf8"), /\bpkill\b|\bkillall\b/);
  } finally {
    killPid(side.pid);
    cleanup(fx);
  }
});

test("rollback will not signal a replaced identity", async () => {
  const fx = fixture(await ports());
  const bystander = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", cwd: "/tmp" });
  try {
    const started = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(started.status, 0, started.stdout + started.stderr);
    const lightsPid = pidsOn(fx.ports[1])[0];
    const stat = fs.readFileSync(`/proc/${bystander.pid}/stat`, "utf8");
    const start = stat.replace(/^.*\) /, "").split(" ")[19];
    const cmdsha = crypto.createHash("sha256").update(fs.readFileSync(`/proc/${bystander.pid}/cmdline`)).digest("hex");
    const cwd = fs.readlinkSync(`/proc/${bystander.pid}/cwd`);
    fs.writeFileSync(path.join(fx.t, "state/lights.own"), `${bystander.pid} ${start} ${cmdsha} started ${cwd}\n`);
    const rolled = run(argsOf(fx, "--rollback"), envOf(fx));
    assert.notEqual(rolled.status, 0);
    assert.match(rolled.stdout, /does not match scope; not signalling/);
    assert.equal(alive(bystander.pid), true);
    assert.equal(alive(lightsPid), true);
  } finally {
    killPid(bystander.pid);
    cleanup(fx);
  }
});

test("an ingress file that is not the launched config is refused", async () => {
  const fx = fixture(await ports());
  try {
    const other = path.join(fx.root, "other.yml");
    fs.copyFileSync(fx.cfg, other);
    const args = argsOf(fx, "--execute").flatMap((a) => a === fx.cfg ? [other] : [a]);
    const r = run(args, envOf(fx));
    assert.equal(r.status, 15, r.stdout + r.stderr);
    assert.match(r.stdout, /not the launched CFG/);
    assert.equal(pidsOn(fx.ports[1]).length, 0);
    assert.equal(pidsOn(fx.ports[2]).length, 0);
  } finally {
    cleanup(fx);
  }
});

test("a lock taken during the pre-lock pause does not replace scope provenance", async () => {
  const fx = fixture(await ports());
  const state = path.join(fx.t, "state");
  fs.mkdirSync(state, { recursive: true });
  const scope = path.join(state, "lights-recover.scope");
  const sentinel = "schema sentinel-do-not-replace\n";
  fs.writeFileSync(scope, sentinel);
  const lock = path.join(state, "healer.lock");
  const child = spawn("bash", [SH, ...argsOf(fx, "--execute")], {
    env: envOf(fx, { WARDOS_RECOVERY_LOCK_PAUSE: "2" }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (b) => { out += b; });
  child.stderr.on("data", (b) => { out += b; });
  await new Promise((r) => setTimeout(r, 400));
  const holder = spawn("bash", ["-c", "exec 9>>\"$1\"; flock 9; sleep 3", "hold", lock], { stdio: "ignore" });
  const code = await new Promise((resolve) => child.on("close", resolve));
  try { holder.kill("SIGKILL"); } catch { /* gone */ }
  assert.equal(code, 19, out);
  assert.equal(fs.readFileSync(scope, "utf8"), sentinel);
  cleanup(fx);
});

test("rollback refuses when the own record matches scope but the live identity does not", async () => {
  const fx = fixture(await ports());
  const bystander = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", cwd: "/tmp" });
  try {
    const started = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(started.status, 0, started.stdout + started.stderr);
    const stat = fs.readFileSync(`/proc/${bystander.pid}/stat`, "utf8");
    const start = stat.replace(/^.*\) /, "").split(" ")[19];
    const cwd = fs.readlinkSync(`/proc/${bystander.pid}/cwd`);
    const fake = "f".repeat(64);
    const record = `${bystander.pid} ${start} ${fake} started ${cwd}`;
    fs.writeFileSync(path.join(fx.t, "state/lights.own"), record + "\n");
    const scope = path.join(fx.t, "state/lights-recover.scope");
    const lines = fs.readFileSync(scope, "utf8").split("\n").map((line) => line.startsWith("lights ") ? "lights " + record : line);
    fs.writeFileSync(scope, lines.join("\n"));
    const rolled = run(argsOf(fx, "--rollback"), envOf(fx));
    assert.notEqual(rolled.status, 0, rolled.stdout + rolled.stderr);
    assert.match(rolled.stdout, /not signalling a replacement/);
    assert.match(rolled.stdout, /intended identity is not the live process/);
    assert.equal(alive(bystander.pid), true);
  } finally {
    killPid(bystander.pid);
    cleanup(fx);
  }
});

test("a tampered run-tree file refuses before any listener", async () => {
  const fx = fixture(await ports());
  try {
    fs.appendFileSync(path.join(fx.rt, "scripts/house-proc.sh"), "\n# tamper\n");
    const r = run(argsOf(fx, "--execute"), envOf(fx));
    assert.equal(r.status, 11, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /hash mismatch/);
    assert.equal(pidsOn(fx.ports[1]).length, 0);
    assert.equal(fs.existsSync(fx.sentinel), false);
  } finally {
    cleanup(fx);
  }
});

test("point-in-time binary equality fail-closes off the box and does not close Sensi", () => {
  const r = spawnSync("python3", [path.join(OPS, "lib/recover_check.py"), "equality"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /REFUSE equality/);
  assert.doesNotMatch(r.stdout + r.stderr, /hermetic|security review closed|independent review pass/i);
  const shipped = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  assert.equal(shipped.files.find((row) => row.path === "scripts/sensi-control.mjs").security_review, "open");
});

test("dependency mode is explicit npm ci and does not start listeners", async () => {
  const fx = fixture(await ports());
  try {
    fs.copyFileSync(path.join(OPS, "reference/deps/package.json"), path.join(fx.t, "deps/package.json"));
    fs.copyFileSync(path.join(OPS, "reference/deps/package-lock.json"), path.join(fx.t, "deps/package-lock.json"));
    fs.rmSync(path.join(fx.t, "deps/node_modules"), { recursive: true, force: true });
    const gate = JSON.parse(fs.readFileSync(fx.gate, "utf8"));
    delete gate.cached_stills;
    gate.manifest_sha256 = sha(MANIFEST);
    fs.writeFileSync(fx.gate, JSON.stringify(gate));
    const r = run(["--execute-deps", "--fixture", fx.root, "--gate", fx.gate, "--manifest", MANIFEST, "--ports", fx.ports.join(" ")], envOf(fx));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const installed = JSON.parse(fs.readFileSync(path.join(fx.t, "deps/node_modules/ws/package.json"), "utf8"));
    assert.equal(installed.version, "8.22.0");
    assert.match(fs.readFileSync(fx.trace, "utf8"), /npm-ci/);
    assert.doesNotMatch(fs.readFileSync(fx.trace, "utf8"), /start-lights|start-connector/);
    for (const port of fx.ports) assert.equal(pidsOn(port).length, 0);
  } finally {
    cleanup(fx);
  }
});
