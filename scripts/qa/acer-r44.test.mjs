/* Round 44. Month uses the allowlist, health fields are classified before they are stripped. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { boot } from "./acer-r42.test.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WHEN = "2026-11-12T18:45:00-06:00";
const bit = (...p) => p.join("");
const LOCKED = ["ainsley", "hayes", "harris", "shared", "hub"];
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("r44 a boy name plus a health word is Appointment everywhere, and a hidden field drops Homework", () => {
  const D = boot();
  const folded = [bit("H4", " yes", " check", "up"), bit("H@", "yes", " allerg", "ist"), bit("Harr", "i$") + " " + bit("dent", "al")];
  for (const what of folded) {
    for (const who of LOCKED) assert.equal(D.summarize({ what, startIso: WHEN }, who), null, who + " " + what);
    const dad = D.summarize({ what, startIso: WHEN }, "dan");
    assert.equal(dad && dad.title, "Appointment", "dan " + what);
  }
  assert.equal(D.summarize({ what: bit("Mort", "gage", " due"), startIso: WHEN }, "dan").title, bit("Mort", "gage", " due"));
  assert.equal(D.summarize({ what: bit("Mort", "gage", " due"), startIso: WHEN }, "ainsley"), null);
  const health = bit("clin", "ic");
  const fields = [
    ["organizer", { displayName: health }],
    ["location", health],
    ["attendees", [{ displayName: health }]],
    ["conferenceData", { notes: health }],
    ["eventType", health],
    ["extendedProperties", { shared: { note: health } }],
    ["extendedProperties", { private: { note: health } }]
  ];
  for (const [key, value] of fields) {
    const row = { what: "Homework", startIso: WHEN };
    row[key] = value;
    for (const who of LOCKED.concat(["dan"])) {
      assert.equal(D.summarize(row, who), null, key + " " + who);
    }
  }
  assert.equal(D.summarize({ what: bit("Hay", "es", " soccer"), startIso: WHEN }, "shared").title, "Soccer");
});

test("r44 Month drops a raw probe and shows Soccer", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r44_month.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-500) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(o.soccer, true, JSON.stringify(o));
  assert.equal(o.raw, false, JSON.stringify(o));
});

test("r44 locked views keep only allowlisted text and every field probe drops", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r44_views.py")], { encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  const labels = ["Soccer", "Swim", "School pickup", "School drop", "Baseball", "Flag", "School specials", "No school", "Field trip", "Art club", "Conference", "Picture day", "Homework", "Choir", "Raffle", "Book order", "Donation", "HOA", "Appointment"];
  const month = o.pages.month;
  assert.equal(month.ok, true, JSON.stringify(month).slice(0, 500));
  for (const label of labels) assert.equal(month.has[label], true, "month missing " + label);
  for (const [token, hit] of Object.entries(month.hits)) assert.equal(hit, false, "month " + token);
  const locked = ["kid-ainsley", "kid-hayes", "kid-harris", "hub", "index", "sheet-today", "allowance"];
  for (const name of locked) {
    const page = o.pages[name];
    assert.equal(page.ok, true, name + " " + JSON.stringify(page).slice(0, 300));
    for (const [token, hit] of Object.entries(page.hits)) assert.equal(hit, false, name + " " + token);
  }
  const dad = o.pages.dad;
  assert.equal(dad.ok, true, JSON.stringify(dad).slice(0, 300));
  assert.equal(dad.has.Appointment, true, "dad appointment");
  assert.equal(dad.hits[bit("clin", "ic")], false, "dad health");
  assert.equal(dad.has[bit("Mort", "gage due")], true, "dad raw title " + JSON.stringify(dad.has));
  const home = o.home;
  assert.ok(home.panelW >= 1800 && home.panelW <= 1840, "panel " + home.panelW);
  assert.ok(home.panelX >= 40 && home.panelX <= 56, "panel x " + home.panelX);
  assert.equal(home.full, true, JSON.stringify(home));
});

test("r44 Google Home home tap navigates 15 times under 4x CPU", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r44_tap.py")], { encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(o.ok, 15, JSON.stringify(o));
  console.log("r44 tap median " + o.median + " max " + o.max);
});
