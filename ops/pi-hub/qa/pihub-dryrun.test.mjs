import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SH = path.join(ROOT, "ops/pi-hub/pi-hub-install.sh");
const ARM = path.join(ROOT, "ops/pi-hub/deps/kasa-aarch64-cp313.lock.txt");
const BOX = path.join(ROOT, "ops/box-recover/reference/kasa-requirements.lock.txt");

function hashes(file) {
  const out = new Map();
  let name = "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const s = line.trim().replace(/\\$/, "").trim();
    if (s.includes("==") && !s.startsWith("#") && !s.startsWith("--")) name = s.split("==")[0];
    if (s.startsWith("--hash=sha256:") && name) out.set(name, s.split("sha256:")[1]);
  }
  return out;
}

test("plan does not write and corrects the lock count", () => {
  const r = spawnSync("bash", [SH, "--plan"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NOT AN INSTALL/);
  assert.match(r.stdout, /21 package declarations and 21 hashes, not 22/);
  assert.match(r.stdout, /not imported on aarch64/);
  assert.match(r.stdout, /separate Pi is not required by the code/);
  assert.doesNotMatch(r.stdout, /SSH is on/);
});

test("aarch64 lock matches the box versions and splits pure hashes from compiled hashes", () => {
  const arm = hashes(ARM);
  const box = hashes(BOX);
  assert.equal(arm.size, 21);
  assert.equal(box.size, 21);
  assert.deepEqual([...arm.keys()], [...box.keys()]);
  for (const name of ["python-kasa", "tplink-cloud-api", "requests", "pycparser"]) {
    assert.equal(arm.get(name), box.get(name), name);
  }
  for (const name of ["aiohttp", "cffi", "cryptography", "frozenlist", "multidict", "propcache", "yarl", "charset-normalizer"]) {
    assert.notEqual(arm.get(name), box.get(name), name);
  }
});

test("offline verify does not install and refuses activation", () => {
  const r = spawnSync("bash", [SH, "--offline-verify"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /ARM_IMPORT: NOT TESTED/);
  assert.match(r.stdout, /WHEEL_HASH_IS_NOT_INSTALL: true/);
  assert.match(r.stdout, /SENSI: excluded/);
  const act = spawnSync("bash", [SH, "--activate"], { encoding: "utf8" });
  assert.equal(act.status, 78);
  assert.match(act.stdout, /REFUSE activation/);
});

test("install refuses live paths and the startup script does not listen", () => {
  for (const dest of ["/etc/systemd/system", "/home/dan/wardos", "/workspace/wardos-ops"]) {
    const r = spawnSync("bash", [SH, "--install", "--dest", dest], { encoding: "utf8" });
    assert.notEqual(r.status, 0, dest);
    assert.match(r.stdout + r.stderr, /REFUSE dest/);
  }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-install-"));
  const staged = spawnSync("bash", [SH, "--install", "--dest", dest], { encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr + staged.stdout);
  assert.equal(fs.existsSync(path.join(dest, "bin/sensi-control.mjs")), false);
  const plan = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
  assert.equal(plan.status, 0, plan.stderr + plan.stdout);
  assert.match(plan.stdout, /PLAN lights exec:/);
  const noGate = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate"], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
  assert.equal(noGate.status, 78);
  fs.rmSync(dest, { recursive: true, force: true });
});

test("stage and rollback stay inside the dest and do not define a camera or tunnel start", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-"));
  const neighbor = path.join(path.dirname(dest), "live-feed.json");
  fs.writeFileSync(neighbor, "{\"ok\":true}\n");
  const before = fs.readFileSync(neighbor);
  const staged = spawnSync("bash", [SH, "--stage", "--dest", dest], { encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr + staged.stdout);
  const unit = fs.readFileSync(path.join(dest, "lib/systemd/system/wardos-pi-lights.service"), "utf8");
  assert.match(unit, /\[Install\]/);
  assert.doesNotMatch(unit, /nest-webrtc|8787/);
  const rolled = spawnSync("bash", [SH, "--rollback", "--dest", dest], { encoding: "utf8" });
  assert.equal(rolled.status, 0, rolled.stderr + rolled.stdout);
  assert.equal(fs.existsSync(path.join(dest, "lib/systemd/system/wardos-pi-lights.service")), false);
  assert.equal(fs.existsSync(path.join(dest, "bin/hub")), false);
  assert.equal(fs.readFileSync(neighbor).equals(before), true);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.rmSync(neighbor, { force: true });
});

function listeners(port) {
  const r = spawnSync("ss", ["-ltnpH", `sport = :${port}`], { encoding: "utf8" });
  return [...r.stdout.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
}

test("gated startup binds lights and both connectors and never cameras", async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-bind-"));
  const cf = path.join(os.tmpdir(), "wardos-fake-cloudflared");
  if (!fs.existsSync(cf)) {
    const built = spawnSync("gcc", ["-O2", "-o", cf, path.join(ROOT, "ops/box-recover/qa/fake-cloudflared.c")]);
    assert.equal(built.status, 0, String(built.stderr));
  }
  const ports = [40111, 40121, 40122];
  const kids = [];
  try {
    assert.equal(spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8" }).status, 0);
    const run = path.join(dest, "run/scripts");
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, "lights-write-proxy.mjs"), "import http from 'node:http'; const i = process.argv.indexOf('--port'); const port = Number(process.argv[i+1]); http.createServer((q,s)=>s.end('{\"ok\":true}')).listen(port,'127.0.0.1');\n");
    fs.writeFileSync(path.join(dest, "secrets/lights-proxy.token"), "fixture-token-value-0123456789\n", { mode: 0o600 });
    fs.writeFileSync(path.join(dest, "etc/tunnel.yml"), "tunnel: wardos-test-hub\ningress:\n  - service: http_status:404\n");
    fs.appendFileSync(path.join(dest, "etc/hub.env"), `LIGHTS_PORT=${ports[0]}\nMETRICS_R1=${ports[1]}\nMETRICS_R2=${ports[2]}\nTUNNEL_NAME=wardos-test-hub\nRUN_TREE=${dest}/run\nWARDOS_CLOUDFLARED=${cf}\n`);
    const gate = path.join(dest, "gate.json");
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-activate.gate/1", activate: "lights-and-tunnel", cams: "start", ssh: "leave-off", secrets: "paths-only" }));
    const refused = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate", "--gate", gate], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
    assert.equal(refused.status, 78, refused.stdout + refused.stderr);
    const cfgSha = crypto.createHash("sha256").update(fs.readFileSync(path.join(dest, "etc/tunnel.yml"))).digest("hex");
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-activate.gate/1", activate: "lights-and-tunnel", cams: "parked", ssh: "leave-off", secrets: "paths-only", cached_stills: "allow-existing", privacy_consent: "full-8788-accepted", provisioning: "not-performed", exec_profile: "fixture-stub", cutover: "approved", tunnel_name: "wardos-test-hub", tunnel_config_sha256: cfgSha, arm_import: "unmet" }));
    const spawnOne = (args) => {
      const child = spawn(args[0], args.slice(1), { env: { ...process.env, WARDOS_PREFIX: dest }, stdio: "ignore" });
      kids.push(child);
      return child;
    };
    spawnOne([path.join(dest, "bin/wardos-pi-lights.sh"), "--activate", "--gate", gate]);
    spawnOne([path.join(dest, "bin/wardos-pi-tunnel.sh"), "--activate", "--connector", "r1", "--gate", gate]);
    spawnOne([path.join(dest, "bin/wardos-pi-tunnel.sh"), "--activate", "--connector", "r2", "--gate", gate]);
    for (let i = 0; i < 40 && (listeners(ports[0]).length === 0 || listeners(ports[1]).length === 0 || listeners(ports[2]).length === 0); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(listeners(ports[0]).length > 0, "lights");
    assert.ok(listeners(ports[1]).length > 0, "r1");
    assert.ok(listeners(ports[2]).length > 0, "r2");
    assert.equal(listeners(8787).length, 0);
    const venv = spawnSync(path.join(dest, "bin/wardos-pi-venv.sh"), ["--plan"], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest, PATH: "/no/such:" + process.env.PATH } });
    assert.equal(venv.status, 0, venv.stdout + venv.stderr);
    assert.match(venv.stdout, /not proof/);
    const venvText = fs.readFileSync(path.join(dest, "bin/wardos-pi-venv.sh"), "utf8");
    assert.match(venvText, /--require-hashes/);
    assert.doesNotMatch(venvText, /WARDOS_ARM_IMPORT/);
  } finally {
    for (const child of kids) { try { child.kill("SIGKILL"); } catch { /* gone */ } }
    for (const port of ports) for (const pid of listeners(port)) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

function gateFile(dir, extra) {
  const gate = path.join(dir, "gate.json");
  fs.writeFileSync(gate, JSON.stringify({
    schema: "wardos.pi-activate.gate/1",
    activate: "lights-and-tunnel",
    cams: "parked",
    ssh: "leave-off",
    secrets: "paths-only",
    privacy_consent: "full-8788-accepted",
    provisioning: "not-performed",
    exec_profile: "fixture-stub",
    ...extra,
  }));
  return gate;
}

test("staged real proxy refuses while Sensi is absent and a hold refuses a stub", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-sensi-"));
  const port = 40131;
  try {
    assert.equal(spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: "/bin/false" } }).status, 0);
    assert.equal(fs.existsSync(path.join(dest, "run/scripts/sensi-control.mjs")), false);
    assert.equal(fs.existsSync(path.join(dest, "run/scripts/lights-write-proxy.mjs")), true);
    fs.writeFileSync(path.join(dest, "secrets/lights-proxy.token"), "fixture-token-value-0123456789\n", { mode: 0o600 });
    fs.appendFileSync(path.join(dest, "etc/hub.env"), `LIGHTS_PORT=${port}\n`);
    const missing = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate", "--gate", gateFile(dest, { cached_stills: "allow-existing" })], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
    assert.equal(missing.status, 78, missing.stdout + missing.stderr);
    assert.match(missing.stdout, /presence is not approval/);
    assert.equal(listeners(port).length, 0);
    fs.writeFileSync(path.join(dest, "run/scripts/lights-write-proxy.mjs"), "import http from 'node:http';\n");
    const held = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate", "--gate", gateFile(dest, { cached_stills: "hold" })], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
    assert.equal(held.status, 78, held.stdout + held.stderr);
    assert.match(held.stdout, /cached stills/);
    assert.equal(listeners(port).length, 0);
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test("default tunnel name refuses without a separate cutover approval", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-cut-"));
  try {
    assert.equal(spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(dest, "etc/tunnel.yml"), "tunnel: wardos-hub\ningress:\n  - service: http_status:404\n");
    const refused = spawnSync(path.join(dest, "bin/wardos-pi-tunnel.sh"), ["--activate", "--connector", "r1", "--gate", gateFile(dest, {})], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest, WARDOS_CLOUDFLARED: "/bin/false" } });
    assert.equal(refused.status, 78, refused.stdout + refused.stderr);
    assert.match(refused.stdout, /cutover/);
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test("systemd modes stay off until a gate and refuse a camera unit", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-sd-"));
  const log = path.join(os.tmpdir(), "pi-systemctl-" + process.pid + ".log");
  const gate = path.join(os.tmpdir(), "pi-sd-" + process.pid + ".json");
  try {
    const ctl = path.join(os.tmpdir(), "pi-systemctl-" + process.pid);
    fs.writeFileSync(ctl, "#!/bin/sh\nif [ \"$1\" = show ]; then printf '%s\\n' \"$WARDOS_FAKE_FRAGMENT\"; exit 0; fi\nprintf '%s\\n' \"$*\" >> \"$WARDOS_SD_LOG\"\nexit 0\n", { mode: 0o755 });
    const installed = spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: "/bin/false" } });
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    assert.equal(fs.existsSync(log), false);
    const unit = path.join(dest, "lib/systemd/system/wardos-pi-lights.service");
    const digest = crypto.createHash("sha256").update(fs.readFileSync(unit)).digest("hex");
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-systemd.gate/1", units: [{ name: "wardos-pi-nest.service", fragment_path: unit, fragment_sha256: digest }] }));
    const bad = spawnSync("bash", [SH, "--enable", "--prefix", dest, "--gate", gate], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: ctl, WARDOS_SD_LOG: log, WARDOS_FAKE_FRAGMENT: unit } });
    assert.equal(bad.status, 78, bad.stdout + bad.stderr);
    assert.equal(fs.existsSync(log), false);
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-systemd.gate/1", units: [{ name: "wardos-pi-lights.service", fragment_path: "/lib/systemd/system/wardos-pi-lights.service", fragment_sha256: digest }] }));
    const globalName = spawnSync("bash", [SH, "--enable", "--prefix", dest, "--gate", gate], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: ctl, WARDOS_SD_LOG: log, WARDOS_FAKE_FRAGMENT: "/lib/systemd/system/wardos-pi-lights.service" } });
    assert.equal(globalName.status, 78, globalName.stdout + globalName.stderr);
    assert.equal(fs.existsSync(log), false);
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-systemd.gate/1", units: [{ name: "wardos-pi-lights.service", fragment_path: unit, fragment_sha256: digest }] }));
    const enabled = spawnSync("bash", [SH, "--enable", "--prefix", dest, "--gate", gate], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: ctl, WARDOS_SD_LOG: log, WARDOS_FAKE_FRAGMENT: unit } });
    assert.equal(enabled.status, 0, enabled.stdout + enabled.stderr);
    assert.match(fs.readFileSync(log, "utf8"), /enable wardos-pi-lights.service/);
    assert.doesNotMatch(fs.readFileSync(log, "utf8"), /start /);
    fs.appendFileSync(unit, "\n# changed\n");
    const changed = spawnSync("bash", [SH, "--start", "--prefix", dest, "--gate", gate], { encoding: "utf8", env: { ...process.env, SYSTEMCTL: ctl, WARDOS_SD_LOG: log, WARDOS_FAKE_FRAGMENT: unit } });
    assert.equal(changed.status, 78, changed.stdout + changed.stderr);
    assert.doesNotMatch(fs.readFileSync(log, "utf8"), /start /);
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test("/opt/wardos is refused without an install gate", () => {
  const existed = fs.existsSync("/opt/wardos");
  const gate = path.join(os.tmpdir(), "pi-opt-gate.json");
  fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-install.gate/1", root: "/opt/wardos", service_user: "fixture", service_home: "/opt/wardos/service-home" }));
  const denied = spawnSync("bash", [SH, "--install", "--prefix", "/opt/wardos"], { encoding: "utf8" });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stdout + denied.stderr, /REFUSE install/);
  if (existed) return;
  const made = spawnSync("sudo", ["mkdir", "-p", "/opt/wardos"]);
  const owned = spawnSync("sudo", ["chown", process.getuid() + ":" + process.getgid(), "/opt/wardos"]);
  assert.equal(made.status, 0, String(made.stderr));
  assert.equal(owned.status, 0, String(owned.stderr));
  try {
    const staged = spawnSync("bash", [SH, "--install", "--prefix", "/opt/wardos", "--gate", gate], { encoding: "utf8" });
    assert.equal(staged.status, 0, staged.stdout + staged.stderr);
    assert.equal(fs.existsSync("/opt/wardos/run/scripts/lights-write-proxy.mjs"), true);
    assert.equal(fs.existsSync("/opt/wardos/run/scripts/sensi-control.mjs"), false);
    const rolled = spawnSync("bash", [SH, "--rollback", "--prefix", "/opt/wardos", "--gate", gate], { encoding: "utf8" });
    assert.equal(rolled.status, 0, rolled.stdout + rolled.stderr);
    assert.equal(fs.existsSync("/opt/wardos/bin/hub"), false);
  } finally {
    spawnSync("sudo", ["rm", "-rf", "/opt/wardos"]);
    fs.rmSync(gate, { force: true });
  }
});

test("preflight records a pure-python import and the real aarch64 failure", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-pre-"));
  const house = path.join(dest, "wheels");
  fs.mkdirSync(house);
  const built = spawnSync("python3", ["-c", `
import hashlib, pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
specs = [("python-kasa", "0.0.0", "kasa"), ("tplink-cloud-api", "0.0.0", "tplinkcloud")]
for dist, version, top in specs:
    info = dist.replace("-", "_") + "-" + version + ".dist-info"
    payload = {
        top + "/__init__.py": b"",
        info + "/METADATA": ("Metadata-Version: 2.1\\nName: " + dist + "\\nVersion: " + version + "\\n").encode(),
        info + "/WHEEL": b"Wheel-Version: 1.0\\nGenerator: wardos-fixture\\nRoot-Is-Purelib: true\\nTag: py3-none-any\\n",
    }
    lines = [name + ",sha256=" + hashlib.sha256(data).hexdigest() + "," + str(len(data)) for name, data in payload.items()]
    payload[info + "/RECORD"] = ("\\n".join(lines) + "\\n" + info + "/RECORD,,\\n").encode()
    whl = root / (dist.replace("-", "_") + "-" + version + "-py3-none-any.whl")
    with zipfile.ZipFile(whl, "w") as z:
        for name, data in payload.items():
            z.writestr(name, data)
    print(whl.name, hashlib.sha256(whl.read_bytes()).hexdigest())
`, house], { encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr + built.stdout);
  const lock = ["# fixture"];
  for (const line of built.stdout.trim().split("\n")) {
    const [name, digest] = line.split(" ");
    const dist = name.startsWith("python_kasa") ? "python-kasa" : "tplink-cloud-api";
    lock.push(dist + "==0.0.0 \\", "    --hash=sha256:" + digest);
  }
  const lockPath = path.join(dest, "lock.txt");
  fs.writeFileSync(lockPath, lock.join("\n") + "\n");
  const env = {
    ...process.env,
    WARDOS_PREFIX: dest,
    KASA_LOCK: lockPath,
    KASA_WHEELHOUSE: house,
    KASA_VENV: path.join(dest, "venv"),
    KASA_PREFLIGHT_RESULT: path.join(dest, "result.json"),
  };
  const ok = spawnSync("bash", [path.join(ROOT, "ops/pi-hub/bin/wardos-pi-venv.sh"), "--preflight"], { encoding: "utf8", env });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const recorded = JSON.parse(fs.readFileSync(path.join(dest, "result.json"), "utf8"));
  assert.equal(recorded.imported, true);
  assert.equal(recorded.aarch64_import_proven, false);
  assert.equal(recorded.phrase_is_proof, false);
  const wheels = "/opt/cursor/artifacts/pi-offline/wheels";
  if (fs.existsSync(wheels)) {
    const real = spawnSync("bash", [path.join(ROOT, "ops/pi-hub/bin/wardos-pi-venv.sh"), "--preflight"], {
      encoding: "utf8",
      env: {
        ...process.env,
        WARDOS_PREFIX: dest,
        KASA_LOCK: ARM,
        KASA_WHEELHOUSE: wheels,
        KASA_VENV: path.join(dest, "venv-arm"),
        KASA_PREFLIGHT_RESULT: path.join(dest, "arm.json"),
      },
    });
    assert.equal(real.status, 78, real.stdout + real.stderr);
    const arm = JSON.parse(fs.readFileSync(path.join(dest, "arm.json"), "utf8"));
    assert.equal(arm.imported, false);
    assert.notEqual(arm.pip_exit, 0);
    assert.equal(arm.aarch64_import_proven, false);
    assert.doesNotMatch(JSON.stringify(arm), /passed-on-trixie/);
  }
  fs.rmSync(dest, { recursive: true, force: true });
});

test("traversal, symlink ancestors, and a changed receipt file do not delete", () => {
  const escaped = spawnSync("bash", [SH, "--install", "--prefix", "/opt/wardos/../../etc"], { encoding: "utf8" });
  assert.notEqual(escaped.status, 0);
  assert.match(escaped.stdout + escaped.stderr, /REFUSE dest/);
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "pi-link-"));
  const real = path.join(parent, "real");
  const link = path.join(parent, "link");
  fs.mkdirSync(real);
  fs.symlinkSync(real, link);
  const via = spawnSync("bash", [SH, "--install", "--prefix", path.join(link, "prefix")], { encoding: "utf8" });
  assert.notEqual(via.status, 0, via.stdout + via.stderr);
  assert.match(via.stdout + via.stderr, /symlink/);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-roll-"));
  assert.equal(spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8" }).status, 0);
  const marker = path.join(dest, "bin/wardos-pi-lights.sh");
  fs.appendFileSync(marker, "\n# changed\n");
  const rolled = spawnSync("bash", [SH, "--rollback", "--prefix", dest], { encoding: "utf8" });
  assert.notEqual(rolled.status, 0, rolled.stdout + rolled.stderr);
  assert.match(rolled.stdout, /hash changed/);
  assert.equal(fs.existsSync(path.join(dest, "bin/wardos-pi-venv.sh")), true);
  fs.rmSync(parent, { recursive: true, force: true });
  fs.rmSync(dest, { recursive: true, force: true });
});

test("a forged ARM result and a pip failure with a successful import are refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-arm-"));
  const forged = path.join(dir, "forged.json");
  fs.writeFileSync(forged, JSON.stringify({ schema: "wardos.pi-preflight.result/1", host_arch: "aarch64", python: "3.13.0", pip_exit: 0, import_exit: 0, imported: true, phrase_is_proof: false, aarch64_import_proven: true }));
  const arm = spawnSync("python3", [path.join(ROOT, "ops/pi-hub/lib/pi_gate.py"), "--preflight-ok", forged], { encoding: "utf8" });
  assert.equal(arm.status, 78, arm.stdout + arm.stderr);
  assert.match(arm.stdout, /not this machine|ARM flag/);
  const split = path.join(dir, "split.json");
  const arch = spawnSync("uname", ["-m"], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(split, JSON.stringify({ schema: "wardos.pi-preflight.result/1", host_arch: arch, pip_exit: 1, import_exit: 0, imported: true, phrase_is_proof: false, aarch64_import_proven: false }));
  const both = spawnSync("python3", [path.join(ROOT, "ops/pi-hub/lib/pi_gate.py"), "--preflight-ok", split], { encoding: "utf8" });
  assert.equal(both.status, 78, both.stdout + both.stderr);
  assert.match(both.stdout, /both be 0/);
  fs.rmSync(dir, { recursive: true, force: true });
});
