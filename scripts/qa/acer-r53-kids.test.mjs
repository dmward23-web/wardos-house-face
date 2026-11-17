/* N2. The three kid boards keep prism: Home at 48,48, nothing past y1080, saves and schedule visible, chore text legible. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r53 kid boards render inside the wall with prism", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r53_kids.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-500) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  for (const name of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) {
    const row = o[name];
    assert.equal(row.prism, true, name + " prism");
    assert.ok(row.bottom <= 1080, name + " bottom " + row.bottom);
    assert.ok(row.home && Math.abs(row.home.x - 48) <= 2 && Math.abs(row.home.y - 48) <= 2, name + " home " + JSON.stringify(row.home));
    assert.equal(row.saves, true, name + " saves");
    assert.equal(row.schedule, true, name + " schedule " + row.scheduleText);
    assert.ok(row.contrast >= 4.5, name + " contrast " + row.contrast);
    assert.ok(row.rows > 0, name + " rendered no activity rows");
  }
});
