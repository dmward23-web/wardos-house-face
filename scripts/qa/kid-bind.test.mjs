/* A kid board may not render another kid's name, asset, or stage marker.
   Fresh profile, then the same profile after the other boards. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
const MARK = { ainsley: "record", hayes: "chest", harris: "ore" };

function run() {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/kid_bind.py")]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 180000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error("exit " + code + " " + err.slice(-600)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); }
      catch (e) { reject(new Error("bad json " + out.slice(-400))); }
    });
  });
}

function check(label, kid, row) {
  assert.equal(row.kid, kid, label + " data-kid " + JSON.stringify(row));
  assert.equal(row.theme, kid, label + " theme " + JSON.stringify(row));
  assert.equal(row.marker, MARK[kid], label + " marker " + JSON.stringify(row));
  assert.equal(row.bad.length, 0, label + " foreign kid " + JSON.stringify(row.bad));
}

test("each kid board stays that kid in a fresh profile and after the others", SKIP, async () => {
  const r = await run();
  for (const kid of ["ainsley", "hayes", "harris"]) {
    check("fresh " + kid, kid, r.fresh[kid]);
    check("after the others " + kid, kid, r.stale[kid]);
  }
  const px = r.pixels || {};
  const orange = (p) => p && p.n > 20 && p.r > p.g + 12 && p.r > p.b + 12;
  assert.ok(px.hayesFirst && px.hayesFirst.n > 20, "Hayes-only canvas sample " + JSON.stringify(px.hayesFirst));
  assert.ok(px.ainsley && px.ainsley.n > 20, "Ainsley canvas sample " + JSON.stringify(px.ainsley));
  assert.ok(px.hayesAfter && px.hayesAfter.n > 20, "Hayes after Ainsley canvas sample " + JSON.stringify(px.hayesAfter));
  assert.equal(orange(px.hayesAfter), false, "Hayes canvas still carries the lantern " + JSON.stringify(px));
  assert.ok(Math.abs(px.hayesAfter.r - px.hayesFirst.r) < 40 && Math.abs(px.hayesAfter.g - px.hayesFirst.g) < 40, "Hayes pixels changed after Ainsley " + JSON.stringify(px));
});
