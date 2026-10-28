// JARTAP1-DELTA2 test-only: kid pages never write '$' on the cited writers; Atlas 3:10 + 4:32 copy rulings; ?v=JARTAP1D2 bumps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => readFileSync(path.join(ROOT, f), "utf8");
const lines = (f) => rd(f).split("\n");
const FX = JSON.parse(rd("scripts/qa/fixtures/jartap1delta2-strings.json"));
const KID = /\/kid-[a-z]+\.html$/;
const kidsData = lines("kids-data.js");
const line = (arr, needle) => { const l = arr.find((x) => x.includes(needle)); assert.ok(l, "missing: " + needle); return l; };
// evaluate a ternary expression line with a fake location
function evalExpr(expr, pathname, vars) {
  const fn = new Function("location", ...Object.keys(vars), "return (" + expr + ");");
  return fn({ pathname }, ...Object.values(vars));
}
const PAGES = ["/kid-hayes.html", "/kid-harris.html", "/kid-ainsley.html"];

test("unlock-cta: JAR FULL · show Dad on all 3 kid pages, desk unchanged", () => {
  const l = line(kidsData, "data-unlock-cta") && line(kidsData, "JAR FULL · show Dad");
  const expr = l.split("el.textContent = ")[1].split("; /*")[0];
  for (const p of PAGES) assert.equal(evalExpr(expr, p, { bank: { need: 10 } }), "JAR FULL · show Dad");
  assert.match(evalExpr(expr, "/sheet-allowance.html", { bank: { need: 10 } }), /saved \$10/);
});

test("paid stamp (DAYPKG1 v2d, Atlas Oct 28 12:15 AM CT A): the stored Paid / Jar reset tick on kid pages and on the desk", () => {
  const l = line(kidsData, "el.textContent = paid; }");
  const expr = l.split("el.textContent = ")[1].split("; }")[0];
  for (const p of [...PAGES, "/sheet-allowance.html"]) {
    assert.equal(evalExpr(expr, p, { paid: FX.storedPaid }), FX.storedPaid);
    assert.equal(evalExpr(expr, p, { paid: FX.storedReset }), FX.storedReset);
  }
});

test("kid guards 1053/1054/1196/1205/1208: no '$' on kid pages; Ainsley no star/count", () => {
  const vars = { bank: { need: 10 }, bal: 3, left: 7, toward: 5, we: 4, el: { closest: () => null } };
  const pick = (needle) => line(kidsData, needle).split("el.textContent = ")[1].split("; /*")[0];
  const exprs = ["Jar full · $", "left on jar", "String(toward) : (\"$\" + toward)", "(\"$\" + bal)", "(\"$\" + we)"].map(pick);
  for (const e of exprs) for (const p of PAGES) {
    const out = String(evalExpr(e, p, vars));
    assert.ok(!out.includes("$"), p + " -> " + out);
    if (p.includes("ainsley")) assert.ok(!/[\u2605\d]/.test(out), "ainsley star/count: " + out);
  }
  assert.ok(String(evalExpr(exprs[3], "/sheet-allowance.html", vars)).includes("$"));
});

test("hire row: kid pages read Hire job, never the rate", () => {
  const l648 = line(kidsData, "var rate = (q.rateLabel");
  const rexpr = l648.split("var rate = ")[1].split("; /*")[0];
  for (const p of PAGES) assert.equal(evalExpr(rexpr, p, { q: { rateLabel: FX.rate } }), "");
  assert.equal(evalExpr(rexpr, "/sheet-chores.html", { q: { rateLabel: FX.rate } }), FX.rate);
  const l741 = line(kidsData, "earnOpt.textContent =");
  const e741 = l741.split("earnOpt.textContent = ")[1].split("; /*")[0];
  for (const p of PAGES) assert.equal(evalExpr(e741, p, { meta: { rateLabel: FX.rate } }), "Hire job");
  assert.match(line(kidsData, "star-earn addon-tag\">' + esc("), /"Hire job" : rate/);
  const mb = line(lines("house-money-bind.js"), "[data-money='babysit']");
  assert.match(mb, /\? "Hire job" : \(state\.ready \? state\.babysit : ""\)/);
});

test("chore pop: Ainsley check, boys +N, never $ or star on kid pages; desk unchanged", () => {
  const sfx = lines("house-sfx.js");
  const l = line(sfx, "function moneyText(stars)");
  const expr = l.split("return ")[1].split("; }")[0];
  const run = (p, v) => evalExpr(expr, p, { stars: 3, v });
  assert.equal(run("/kid-ainsley.html", 2), "\u2713");
  for (const p of ["/kid-hayes.html", "/kid-harris.html"]) assert.equal(run(p, 2), "+3");
  assert.equal(run("/sheet-chores.html", 2), "+$6");
  assert.match(line(sfx, "if (n > 0) {"), /floatPopup\(el, moneyText\(n\)\); else floatDollar\(el, n\)/);
});

test("saves face/list route through money->star and strip '$'", () => {
  const sv = lines("house-saves.js");
  assert.match(line(sv, "label = (\"Saves · \""), /\.replace\(\/\\\$\/g, ""\)/);
  assert.match(line(sv, "Math.min(toward, it.need)"), /\.replace\(\/\\\$\/g, ""\)/);
});

test("cache tokens: kid pages load all 5 changed files at ?v=JARTAP1D2", () => {
  for (const k of ["hayes", "harris", "ainsley"]) {
    const h = rd("kid-" + k + ".html");
    for (const f of ["house-fresh", "kids-data", "house-saves", "house-sfx", "house-money-bind"])
      assert.match(h, new RegExp(f + (["kids-data", "house-sfx", "house-money-bind", "house-saves"].includes(f) ? "\\.js\\?v=DAYPKG1" : "\\.js\\?v=JARTAP1D2")), k + " " + f); /* DAYPKG1 re-bumped kids-data.js (was HAYESJAR1D, 1C, 1B), house-sfx.js and house-money-bind.js (token only); DAYPKG1 v2d re-bumped house-saves.js */
  }
});

test("no em dash or arrow added on DELTA2 lines", () => {
  for (const f of ["kids-data.js", "house-sfx.js", "house-saves.js", "house-money-bind.js"])
    for (const l of lines(f)) if (/DELTA2/.test(l)) assert.ok(!/[\u2014\u2192\u2190\u2191\u2193]/.test(l), f + ": " + l);
});
