/* Round 46. Rule B, every nested field, page data, Month, early taps, clock pill. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { boot } from "./acer-r42.test.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WHEN = "2026-11-12T13:00:00-06:00";
const bit = (...p) => p.join("");
const MARK = { description: "#wardos-show", startIso: WHEN };
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("r46 Rule B matrix: slot, marker, and where the boy name sits", () => {
  const D = boot();
  const health = bit("speech", " therapy");
  const slots = ["ainsley", "dan", "shared", "hayes", "harris"];
  const places = {
    title: (extra) => Object.assign({ what: bit("Hay", "es ", "dent", "ist"), startIso: WHEN }, extra),
    other: (extra) => Object.assign({ what: health, notes: bit("Harr", "is"), startIso: WHEN }, extra),
    nested: (extra) => Object.assign({ what: health, attachments: [{ title: bit("H4", " yes") }], startIso: WHEN }, extra),
    zw: (extra) => Object.assign({ what: "Har\u200Bris " + health, startIso: WHEN }, extra)
  };
  for (const slot of slots) {
    for (const [where, build] of Object.entries(places)) {
      const locked = D.summarize(build(MARK), slot === "dan" ? "shared" : slot);
      assert.equal(locked, null, "marked " + slot + " " + where);
      const plain = D.summarize(build({}), slot === "dan" ? "dad" : slot);
      if (slot === "dan" && where === "title") assert.equal(plain, null, "unmarked dad title");
      else if (slot === "dan" && where === "zw") assert.equal(plain, null, "zw dad");
      else assert.equal(plain, null, "unmarked " + slot + " " + where);
    }
    const named = D.summarize(Object.assign({ what: health }, MARK), slot);
    if (slot === "hayes" || slot === "harris") assert.equal(named, null, "boy slot " + slot);
    else assert.equal(named && named.title, "Appointment", "open slot " + slot);
  }
  assert.equal(D.summarize({ what: "Raffle", attachments: [{ title: bit("tele", "health") }], startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Raffle", source: { title: bit("tele", "health") }, startIso: WHEN }, "shared"), null);
  const month = D.summarize(Object.assign({ what: "Dentist", c: "ain" }, MARK), "shared");
  assert.equal(month && month.title, "Appointment");
});

test("r46 the Home control is fixed at 64px in the first HTML, unlike dec6441a", () => {
  const html = fs.readFileSync(path.join(ROOT, "sheet-google-home.html"), "utf8");
  assert.match(html, /left:48px;top:48px;width:64px;height:64px/);
  const head = html.slice(0, html.indexOf("house-hub.js"));
  assert.equal(head.includes("preventDefault("), false);
  assert.equal(html.includes("location.href = a.href"), false);
});

test("r46 real fetch, Month, early taps, and the clock pill", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r46_real.py")], { encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-700) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  for (const [name, page] of Object.entries(o.pages)) {
    assert.equal(page.banned, 0, name + " banned " + page.banned);
    assert.equal(page.off, 0, name + " off " + page.off);
    assert.equal(page.boyRows, 0, name + " boy rows " + page.boyRows);
  }
  assert.equal(o.pages["month.html"].domAppointment, true, "month appointment");
  assert.equal(o.pages["kid-ainsley.html"].domAppointment, true);
  assert.equal(o.pages["kid-hayes.html"].domAppointment, false);
  assert.equal(o.pages["kid-harris.html"].domAppointment, false);
  assert.equal(o.home.overlap.length, 0, JSON.stringify(o.home));
  assert.equal(o.tap.runs.length, 3);
  for (const run of o.tap.runs) {
    assert.equal(run.ok, 15, JSON.stringify(run));
    assert.ok(run.p95 <= 300, JSON.stringify(run));
  }
  console.log("r46 taps " + JSON.stringify(o.tap.runs));
  console.log("r46 page-data " + JSON.stringify(o.pages));
});
