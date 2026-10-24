/* LDAWAY1 (ported from main for livinghouse-base, QAFIX2) · node --test scripts/qa/ldaway.test.mjs
   Load day: kid items on sheet-load-day follow away-filter.js on an away day, like every other board. The static pack
   strip carries no clock time, and a missing feed (no month data) is the normal awake board. Synthetic fixtures only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PHRASES = new RegExp(...(() => { const m = /export const PHRASES = \/(.*)\/i;/.exec(read("scripts/qa/nocustody.test.mjs")); return [m[1], "i"]; })());
const KID = /\b(?:Hayes|Harris|Ainsley)\b/;
const CLOCK = /\b\d{1,2}:\d{2}\b/;

function packStrip() {
  const h = read("sheet-load-day.html"), i = h.indexOf("data-ld-pack");
  assert.ok(i > 0, "pack strip marked data-ld-pack");
  return h.slice(i, h.indexOf("</section>", i));
}

test("load day markup: the pack strip has no clock time, and every kid item is an away item", () => {
  const s = packStrip();
  assert.equal(CLOCK.test(s.replace(/<[^>]+>/g, " ")), false, "a clock time in the static pack strip");
  const items = s.split('<div class="pack-item').slice(1);
  assert.ok(items.length >= 5);
  for (const it of items) if (KID.test(it.replace(/<[^>]+>/g, " "))) assert.match(it, /^[^>]*data-away-kid/, it.slice(0, 80));
  assert.equal(PHRASES.test(read("sheet-load-day.html")), false, "no custody phrase");
  assert.match(read("sheet-load-day.html"), /packDay\(iso\);var dd=day\(iso\)/, "the shown load day drives the away check");
});

test("away filter: no month data means nothing is away (missing feed is the normal board)", () => {
  const ctx = vm.createContext({ Intl, Date, URLSearchParams });
  ctx.globalThis = ctx;
  vm.runInContext(read("away-filter.js"), ctx);
  const A = ctx.AwayFilter;
  assert.equal(A.hasMonths(), false);
  for (const t of ["2026-10-20T07:30:00-05:00", "2026-10-20T16:00:00-05:00", "2026-10-20T18:15:00-05:00"]) assert.equal(A.isAwayAt(Date.parse(t)), false, t);
  assert.equal(A.isAwayDay("2026-10-20"), false);
  assert.equal(A.keepItem({ c: "kids", l: "Hayes BB gear", _day: "2026-10-20", when: "" }), true);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = { skip: !browser && "QA_NO_BROWSER=1 or python playwright missing" };
const run = (page, mode, w, h, env = {}) => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/ldjar_viewport.py"), page, mode, String(w), String(h)], { encoding: "utf8", timeout: 150000, env: { ...process.env, ...env } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").pop());
};

test("LDAWAY1 (real browser): load day hides kid items and kid times on an away day, at 440 and 390", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844]]) {
    const r = run("load-day", "feed", w, h);
    assert.ok(r.hub_hits > 0, JSON.stringify(r));
    assert.equal(r.state.hasMonths, true);
    assert.equal(r.state.kidsAway, true);
    assert.ok(r.state.kidItems >= 5, "kid pack items are marked [data-away-kid] (QAFIX2) " + JSON.stringify(r.state));
    assert.equal(r.state.kidItemsShown, 0, "kid pack items shown on an away day " + JSON.stringify(r));
    assert.deepEqual(r.state.kidTimes, []);
    assert.deepEqual(r.errors, []);
  }
});

test("LDAWAY1 (real browser): a home day with the feed shows the kid items", SKIP, () => {
  const r = run("load-day", "feed", 440, 956, { LDNOW: "2026-10-17T10:00:00-05:00" });
  assert.equal(r.state.hasMonths, true);
  assert.equal(r.state.kidsAway, false);
  assert.equal(r.state.kidItemsShown, r.state.kidItems);
  assert.deepEqual(r.state.kidTimes, []);
});

test("LDAWAY1 (real browser): a missing feed never computes an away day; the normal awake board shows", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844]]) {
    const r = run("load-day", "nofeed", w, h);
    assert.equal(r.hub_hits, 0);
    assert.equal(r.state.hasMonths, false);
    assert.equal(r.state.kidsAway, false, "away computed with no feed");
    assert.equal(r.state.hidden, 0, "something hidden with no feed");
    assert.equal(r.state.kidItemsShown, r.state.kidItems);
    assert.deepEqual(r.state.kidTimes, []);
    assert.deepEqual(r.errors, []);
  }
});
