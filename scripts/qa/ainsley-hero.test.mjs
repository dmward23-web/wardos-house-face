/* Round 10 · the performer is on the stage deck, the clock chip matches the boys, and the next card keeps its time. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("Ainsley stage sprite has paint inside its box, and her clock and next card keep a time", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/ainsley_hero.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, r.stderr.slice(-600) + r.stdout.slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.ok(o.painted > 40, "sprite bbox is background " + JSON.stringify(o));
  assert.match(o.clock, /Tue · 12:30 PM/);
  assert.match(o.next, /4:25 PM/);
  assert.match(o.next, /Swim/);
  assert.equal(o.jar, "Jar is empty");
  assert.ok(o.whatPx >= 24, "chore title " + o.whatPx);
  assert.equal(o.offlineOnCard, false, "unavailable note on a populated card");
});
