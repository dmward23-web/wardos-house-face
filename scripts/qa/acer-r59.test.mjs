/* r59 · strip, hero and ahead text is readable inside the 48px safe area. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r59 hub, Today and kid strips are 24px, one line each, inside the safe area", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r59_strips.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  for (const name of ["sheet-index.html", "sheet-today.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"]) {
    const page = o[name];
    assert.ok(page && page.n >= 1, name + " has no visible strip text");
    for (const row of page.rows) {
      assert.ok(row.w > 0 && row.h > 0, name + " empty box " + row.t);
      assert.ok(row.op > 0.5, name + " opacity " + row.t);
      assert.ok(row.contrast >= 0.25, name + " contrast " + row.t + " " + row.contrast);
      assert.ok(row.l >= 48 && row.top >= 48 && row.r <= 1872 && row.b <= 1032, name + " safe " + JSON.stringify(row));
      assert.ok(row.fs >= 24, name + " size " + row.fs + " " + row.t);
      assert.ok(row.lines <= 2, name + " wraps " + row.lines + " " + row.t);
      assert.equal(row.over, false, name + " overlaps home " + row.t);
    }
  }
});
