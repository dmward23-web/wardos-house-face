/* Round 45. Real fetch path, locked-view drops, Google Home boxes, 1x taps. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

test("r45 a marked folded boy row drops on locked views and shows Appointment only on Dad", () => {
  const D = boot();
  const marked = { what: bit("H4", " yes ", "check", "up"), description: "\n#wardos-show\n", startIso: WHEN };
  for (const who of LOCKED) assert.equal(D.summarize(marked, who), null, who);
  assert.equal(D.summarize(marked, "dan").title, "Appointment");
  const zw = { what: "Har\u200Bris appointment", startIso: WHEN };
  for (const who of LOCKED.concat(["dan"])) assert.equal(D.summarize(zw, who), null, "zw " + who);
  assert.equal(D.summarize({ what: bit("Mort", "gage due"), startIso: WHEN }, "dan").title, bit("Mort", "gage due"));
  assert.equal(D.summarize({ what: bit("Mort", "gage due"), startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Dentist", startIso: WHEN }, "shared"), null);
  const shown = D.summarize({ what: "Dentist", description: "#wardos-show", startIso: WHEN }, "hub");
  assert.equal(shown && shown.title, "Appointment");
});

test("r45 the Home control is in the first HTML and the handler does not cancel the tap", () => {
  const html = fs.readFileSync(path.join(ROOT, "sheet-google-home.html"), "utf8");
  const head = html.slice(0, html.indexOf("house-hub.js"));
  assert.match(html, /<a class="wardos-home" href="sheet-index\.html"/);
  assert.equal(head.includes("preventDefault("), false);
  assert.equal(html.includes("location.href = a.href"), false);
});

test("r45 the real kids-week fetch drops every single-field probe", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r45_real.py")], { encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-500));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  const health = bit("clin", "ical");
  const money = bit("Mort", "gage due");
  for (const [name, page] of Object.entries(o.pages)) {
    assert.equal(page.ok, true, name + " " + JSON.stringify(page).slice(0, 240));
    assert.equal(page.hits[health], false, name + " health");
    assert.equal(page.hits.H4, false, name + " folded");
    assert.equal(page.hits.Raffle, false, name + " raffle");
    if (name !== "sheet-dan.html") assert.equal(page.hits[money], false, name + " money");
  }
  assert.equal(o.pages["kid-hayes.html"].soccer, true, "soccer");
  assert.equal(o.pages["sheet-today.html"].hits.Raffle, false);
  assert.ok(o.pages["sheet-today.html"].rows > 0, "sheet-today empty");
  assert.equal(o.pages["sheet-today.html"].todaySoccer, true, "sheet-today soccer " + JSON.stringify(o.pages["sheet-today.html"].titles));
  for (const name of ["kid-hayes.html", "sheet-today.html", "sheet-dan.html"]) {
    const page = o.pages[name];
    const populated = name === "sheet-today.html" ? page.rows : (name === "sheet-dan.html" ? (page.appointment ? 1 : 0) : (page.soccer ? 1 : 0));
    assert.ok(populated > 0, name + " rendered 0 fixture rows");
  }
  assert.equal(o.pages["sheet-dan.html"].appointment, true, "dad appointment");
  assert.equal(o.pages["sheet-dan.html"].money, true, "dad raw");
  assert.equal(o.pages["sheet-index.html"].appointment, false, "dad tile");
  assert.equal(o.home.hit, true, JSON.stringify(o.home.nodes));
  assert.deepEqual(o.home.overlap, [], JSON.stringify(o.home.nodes));
  assert.match(o.home.clock, /12:30 PM/);
  assert.equal(o.tap.ok, 15, JSON.stringify(o.tap));
  assert.ok(o.tap.p95 <= 300, "p95 " + o.tap.p95 + " " + JSON.stringify(o.tap.values));
  console.log("r45 taps " + o.tap.values.join(", ") + " p95 " + o.tap.p95);
});
