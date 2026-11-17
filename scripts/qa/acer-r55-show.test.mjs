/* r55 · Rule B show rows stay, rejected rows do not, and strip type is at least 24px. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function boot() {
  const box = { document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }, Intl, Date, WeakSet, decodeURIComponent };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read("house-face-law.js"), box, { filename: "house-face-law.js" });
  vm.runInContext(read("house-event-display.js"), box, { filename: "house-event-display.js" });
  return box;
}

const WEEK = {
  kids: {
    hayes: { name: "Hayes", today: [
      { what: "Skate City Night", when: "Mon · 6:00" },
      { what: "Hayes costume parade", when: "Thu · All day" },
      { what: "Hayes dentist", when: "Wed · 7:40" }
    ], school: [{ what: "Friends Club" }], sports: [{ what: "basketball" }] },
    ainsley: { name: "Ainsley", today: [{ what: "Picture day" }, { what: "partner dinner" }], school: [{ what: "Soccer" }, { what: "Art club" }] },
    harris: { name: "Harris", today: [{ what: "Art club" }, { what: "Harris doctor" }] }
  }
};

function texts(rows) {
  return (rows || []).map((r) => String(r.what || r.summary || r.title || "")).join("\n");
}

test("r55 synthetic kids feed shows activities and hides the Hayes dentist row", () => {
  const box = boot();
  const week = box.HouseFaceLaw.cleanFeed("kids-week", JSON.parse(JSON.stringify(WEEK)));
  for (const id of ["hayes", "ainsley", "harris"]) {
    const kid = week.kids[id];
    assert.ok(kid && (kid.today || kid.school || kid.sports), id + " was deleted");
    const blob = [texts(kid.today), texts(kid.school), texts(kid.sports)].join("\n");
    assert.ok(blob.trim().length > 0, id + " has no activity rows");
    assert.doesNotMatch(blob, /dentist|doctor|therap/i, id + " " + blob);
  }
  const hayes = texts(week.kids.hayes.today) + "\n" + texts(week.kids.hayes.school) + "\n" + texts(week.kids.hayes.sports);
  assert.match(hayes, /Skate City Night/);
  assert.match(hayes, /costume parade/);
  assert.match(hayes, /Friends Club/);
  assert.match(hayes, /basketball/);
  const ainsley = texts(week.kids.ainsley.today) + "\n" + texts(week.kids.ainsley.school);
  assert.match(ainsley, /Picture day/);
  assert.match(ainsley, /partner dinner/);
  assert.match(ainsley, /Soccer/);
  assert.match(ainsley, /Art club/);
  assert.match(texts(week.kids.harris.today), /Art club/);
});

test("r55 the hub shows allowed rows and hides dentist, doctor, therapy, legal and mediation", () => {
  const D = boot().HouseEventDisplay;
  for (const title of ["Skate City Night", "Hayes costume parade", "Friends Club", "basketball", "partner dinner", "Picture day", "Soccer", "Art club"]) {
    const view = D.summarize({ what: title, summary: title, title: title }, "shared");
    assert.ok(view && view.title, title + " hidden");
    assert.doesNotMatch(view.title, /dentist|doctor|therap|legal|mediation/i);
  }
  for (const title of ["Hayes dentist", "Harris doctor", "Smith therapy", "mediation legal", "Court date"]) {
    assert.equal(D.summarize({ what: title, summary: title, title: title }, "shared"), null, title);
    assert.equal(D.summarize({ what: title, summary: title, title: title }, "hayes"), null, title + " kid");
  }
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r55 hub and kid strips are at least 24px with one event per line", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r55_type.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  for (const name of Object.keys(o)) {
    const row = o[name];
    for (const sample of row.fonts) assert.ok(sample.px >= 24, name + " " + sample.sel + " " + sample.px);
    assert.equal(row.sharedLine, false, name + " two events share a line " + JSON.stringify(row.lines));
  }
});
