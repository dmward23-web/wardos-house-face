/* HUBPIN1 · house-proc.sh: the pid file is the node that owns the port, start refuses a taken port, the token /
   keyless variables never reach node, stop proves the port empty and never signals a non-node listener;
   keepalive refuses without the pinned run tree.   node --test scripts/qa/houseproc.test.mjs (needs ss) */
import { freePortSync } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HP = path.join(ROOT, "scripts/house-proc.sh");
const hasSs = spawnSync("ss", ["-V"]).status === 0;
const port = freePortSync();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "houseproc-"));
const SRV = "import http from 'node:http'; http.createServer((q,s)=>s.end('ok')).listen(+process.argv[2],'127.0.0.1');";
fs.mkdirSync(path.join(tmp, "scripts"));
for (const n of ["t", "other"]) fs.writeFileSync(path.join(tmp, "scripts", n + ".mjs"), SRV);
const sh = (script, env = {}) => spawnSync("bash", ["-c", "set -m; . " + JSON.stringify(HP) + "; " + script], { encoding: "utf8", env: { ...process.env, HP_LOG_DIR: tmp, ...env } });

test("start: pid file is node owning the port; clean env; refuses a taken port; stop frees it", { skip: !hasSs && "ss missing" }, () => {
  const a = sh(`hp_start t ${port} ${tmp} scripts/t.mjs ${port}`, { LIGHTS_PROXY_TOKEN: "x", HOUSE_NOKEY_ORIGIN: "y", NEST_PROXY_TOKEN: "z" });
  assert.match(a.stdout, /^OK t: .* node, owns port, clean env/m, a.stdout + a.stderr);
  const pid = fs.readFileSync(path.join(tmp, "t.pid"), "utf8").trim();
  assert.equal(fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim(), "node");
  assert.doesNotMatch(fs.readFileSync(`/proc/${pid}/environ`, "utf8"), /(LIGHTS_PROXY_TOKEN|HOUSE_NOKEY_ORIGIN|NEST_PROXY_TOKEN)=/);
  assert.match(sh(`hp_check t ${port}`).stdout, /^OK t:/m, "survives the starting shell");
  assert.match(sh(`hp_start t2 ${port} ${tmp} scripts/t.mjs ${port}`).stdout, /FAIL t2: :\d+ already in use/);
  assert.match(sh(`hp_stop t ${port}`).stdout, /OK t: :\d+ free/);
  assert.equal(spawnSync("ss", ["-ltnH", `sport = :${port}`], { encoding: "utf8" }).stdout.trim(), "");
  assert.ok(!fs.existsSync(path.join(tmp, "t.pid")));
});

test("stop never signals a non-node listener", { skip: !hasSs && "ss missing" }, async () => {
  const p2 = freePortSync();
  const py = spawn("python3", ["-m", "http.server", String(p2), "--bind", "127.0.0.1"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 40 && !spawnSync("ss", ["-ltnH", `sport = :${p2}`], { encoding: "utf8" }).stdout.trim(); i++) await new Promise((r) => setTimeout(r, 100));
    const r = sh(`hp_stop x ${p2}`);
    assert.match(r.stdout, /FAIL x: .*not node scripts\/x\.mjs; not touching it/);
    assert.equal(py.exitCode, null, "python still running");
  } finally { py.kill(); }
});

test("stop is strict: a stale pid file naming an unrelated node is never signalled; a foreign node listener is refused", { skip: !hasSs && "ss missing" }, async () => {
  const p3 = freePortSync();
  /* an unrelated node process (the recycled-pid case) and a node listener that is not scripts/t.mjs */
  const bystander = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  const foreign = spawn(process.execPath, [path.join(tmp, "scripts", "other.mjs"), String(p3)], { stdio: "ignore", cwd: tmp });
  try {
    for (let i = 0; i < 40 && !spawnSync("ss", ["-ltnH", `sport = :${p3}`], { encoding: "utf8" }).stdout.trim(); i++) await new Promise((r) => setTimeout(r, 100));
    fs.writeFileSync(path.join(tmp, "t.pid"), String(bystander.pid) + "\n");
    const r = sh(`hp_stop t ${p3}`);
    assert.match(r.stdout, /FAIL t: :\d+ is held by pid \d+ \(node\), not node scripts\/t\.mjs; not touching it/, r.stdout);
    await new Promise((res) => setTimeout(res, 300));
    assert.equal(bystander.exitCode, null, "stale-pid bystander still running");
    assert.equal(foreign.exitCode, null, "foreign node listener still running");
    /* nothing listening + stale pid file: OK, and still nobody signalled */
    const p4 = freePortSync();
    const r2 = sh(`hp_stop t ${p4}`);
    assert.match(r2.stdout, /OK t: :\d+ free \(nothing was listening\)/);
    await new Promise((res) => setTimeout(res, 300));
    assert.equal(bystander.exitCode, null, "stale-pid bystander still running after a free-port stop");
  } finally { bystander.kill(); foreign.kill(); }
});

test("keepalive and lights-refresh launch through house-proc and refuse without the pinned run tree", () => {
  const ka = fs.readFileSync(path.join(ROOT, "scripts/house-keepalive.sh"), "utf8");
  assert.match(ka, /hp_start nest-webrtc-proxy 8787 "\$RUN_TREE"/);
  assert.match(ka, /lights refresh loop NOT started/);
  assert.doesNotMatch(ka, /LOOP_ROOT="\$ROOT"/);
  const lr = fs.readFileSync(path.join(ROOT, "scripts/lights-refresh.sh"), "utf8");
  assert.match(lr, /hp_start lights-write-proxy 8788 "\$RUN_TREE"/);
  assert.match(lr, /lights proxy NOT started/);
  for (const s of [ka, lr]) assert.doesNotMatch(s, /setsid nohup node/, "no setsid wrapper around node");
});
