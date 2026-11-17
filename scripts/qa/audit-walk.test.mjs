/* Audit mode stays on from the hub through every linked route, and no non-GET leaves the browser. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function run() {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/audit-walk.py")]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 180000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error("exit " + code + " " + err.slice(-500)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); }
      catch (e) { reject(new Error("bad json " + out.slice(-400))); }
    });
  });
}

test("audit=1 on the hub blocks writes on every route it reaches, including the game", SKIP, async () => {
  const r = await run();
  assert.ok(r.count >= 4, "routes " + r.count);
  assert.deepEqual(r.writes, [], "non-GET " + JSON.stringify(r.writes));
  for (const [name, page] of Object.entries(r.pages)) {
    assert.equal(page.err || "", "", name + " " + page.err);
    assert.equal(page.active, true, name + " audit off " + JSON.stringify(page));
    assert.equal(page.attr, "1", name);
    assert.equal(page.status, 204, name + " POST was not stubbed");
    assert.equal(page.header, "blocked", name);
  }
  assert.ok(r.pages["mercury-run.html"], "game was not in the walk");
});
