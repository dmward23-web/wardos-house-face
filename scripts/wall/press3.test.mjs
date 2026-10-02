// PRESS3 + NOAGENT1 + JARX1 + HUBQUIET1 · node scripts/wall/press3.test.mjs (Atlas 10/2)
// The wall's agent-name display filter (house-noagent.js clean()), the jar explainer view (rules only: no balance,
// no money, no totals), the hub lights quiet override (sheet-index only; house-lights.js unchanged), and the
// wall's seat markup (name opens the kid board, I'm here chip carries the check-in wiring).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const N = require(path.join(ROOT, "house-noagent.js"));
const X = require(path.join(ROOT, "house-jar-explainer.js"));
let n = 0;
function t(name, fn) { fn(); n++; }
const AGENT = /\b(Ledger|Harbor(?!\s+Cove)|Vita|Atlas|Alfred|Prism|Wright|Grok|Daystaff|Plumb)\b/i;
t("routing arrows to a helper are stripped (unicode and ascii)", () => {
  assert.equal(N.clean("REMIND · donation receipts → Ledger (Erin list + Goodwill) · 2:30"), "REMIND · donation receipts (Erin list + Goodwill) · 2:30");
  assert.equal(N.clean("Pickup -> Harbor"), "Pickup");
  assert.equal(N.clean("Call the school => Atlas"), "Call the school");
  assert.equal(N.clean("Meet → Ledger / Atlas"), "Meet");
});
t("bracketed tags are stripped", () => {
  assert.equal(N.clean("Dentist (Atlas)"), "Dentist");
  assert.equal(N.clean("Swim [Vita]"), "Swim");
  assert.equal(N.clean("Fix it (via Prism)"), "Fix it");
  assert.equal(N.clean("Book it {Alfred}"), "Book it");
});
t("leading and trailing tags are stripped; a bare name draws nothing", () => {
  assert.equal(N.clean("Ledger: groceries"), "groceries");
  assert.equal(N.clean("Call school · Alfred"), "Call school");
  assert.equal(N.clean("Bring forms - Daystaff"), "Bring forms");
  assert.equal(N.clean("Grok"), "");
});
t("the street Harbor Cove and ordinary words stay", () => {
  assert.equal(N.clean("Leave Harbor Cove 9:00"), "Leave Harbor Cove 9:00");
  assert.equal(N.clean("Drive → Harbor Cove"), "Drive → Harbor Cove");
  assert.equal(N.clean("Dan · Nashville DRIVE"), "Dan · Nashville DRIVE");
  assert.equal(N.clean("Hayes flag vs Ridley"), "Hayes flag vs Ridley");
});
t("every agent name in the real month feed comes out of the drawn title", () => {
  const months = read("data/cal-months.json");
  const titles = []; for (const m of months.matchAll(/"l":"([^"]*)"/g)) titles.push(m[1]);
  assert.ok(titles.length > 10);
  for (const s of titles) assert.ok(!AGENT.test(N.clean(s)), s);
});
t("jar explainer: the locked rule lines and jar names only, never money or numbers", () => {
  const seed = JSON.parse(read("data/house-jar.json"));
  const v = X.view(seed), h = X.html(v);
  assert.ok(v.lines.length >= 1 && v.jars.length >= 1);
  assert.ok(/How the jar works/.test(h));
  assert.ok(!/[$\u00a2\u00a3\u20ac]|[0-9]/.test(h.replace(/<[^>]+>/g, "")), h);
  assert.ok(!AGENT.test(h), "no agent names");
  /* pending earning rules are not shown as law */
  if (/pending/i.test(String(seed.earningRules && seed.earningRules.status))) assert.equal(v.fills.length, 0);
  assert.deepEqual(X.view({ ruleText: "Costs $5", ruleLine2: "balance 3", jars: [{ name: "total 9" }] }), { lines: [], jars: [], fills: [] });
  assert.equal(X.html(X.view(null)), "");
});
t("hub quiet override is linked on sheet-index only; house-lights.js still says NEED KEY for other pages", () => {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const users = files.filter((f) => read(f).includes("house-hub-lights-quiet.js"));
  assert.deepEqual(users, ["sheet-index.html"]);
  assert.ok(read("house-lights.js").includes('return "NEED KEY"'));
  const si = read("sheet-index.html");
  assert.ok(si.indexOf("house-hub-lights-quiet.js") > si.indexOf('src="house-lights.js"'), "loads after house-lights.js");
});
t("wall seats: name opens the kid's board, I'm here chip keeps data-kid-checkin; jar opens the explainer", () => {
  const w = read("wall.html");
  for (const k of ["harris", "hayes", "ainsley"]) {
    assert.ok(w.includes(`data-go="kid-${k}.html#kid-board" data-kid-board="${k}"`), k + " name");
    assert.ok(new RegExp(`class="here-chip" data-kid-checkin="${k}"[^>]*>(<b>)?I'm here`).test(w), k + " chip");
    assert.ok(!new RegExp(`class="kid-name" data-kid-checkin="${k}"`).test(w), k + " name no longer checks in");
  }
  assert.ok(/id="w-jar"[^>]*data-go="sheet-index.html#jar-rules"/.test(w));
  assert.ok(w.includes('src="house-noagent.js"'));
  for (const k of ["hayes", "harris", "ainsley"]) assert.ok(read(`kid-${k}.html`).includes('src="house-noagent.js"'), k + " board filter");
});
t("rows with no data source collapse (no placeholder): load day and dinner vote badges", () => {
  const w = read("wall.html");
  for (const id of ["rail-dinner-vote", "rail-load-day"]) assert.ok(new RegExp(`data-tile-id="${id}" data-no-source class="badge " hidden`).test(w), id);
  assert.ok(/id="w-dinner" hidden/.test(w));
  assert.ok(/\$\("w-pack"\)\.hidden = !flags\.length/.test(w));
});
console.log(`press3: ${n} tests PASS`);
