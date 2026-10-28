/* KIDCRIT DAYROLL1 (Atlas R4) · node --test scripts/qa/dayroll1.test.mjs
   A kid board left open overnight on the desk PC read the day once at load, so Monday morning still showed Sunday (Sunday's
   chores done) and a tap landed on Sunday. house-fresh.js now reloads when the America/Chicago date changes. Real file, faked clock. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "house-fresh.js"), "utf8");

function page(startUtc, pathname = "/kid-hayes.html") {
  const clock = { t: Date.parse(startUtc) };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  const timers = [], replaced = [], ss = {};
  const ctx = vm.createContext({
    Intl, Date: FakeDate, console, clock, replaced,
    fetch: () => new Promise(() => {}),                       /* the stamp fetch never matters here */
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, setInterval: (fn) => { timers.push(fn); return timers.length; },
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); } },
    location: { pathname, search: "", hash: "", replace: (u) => replaced.push(u) },
    document: { readyState: "complete", hidden: false, addEventListener() {}, querySelectorAll: () => [] },
  });
  ctx.window = ctx; ctx.window.addEventListener = () => {};
  vm.runInContext(SRC, ctx, { filename: "house-fresh.js" });
  return { at(utc) { clock.t = Date.parse(utc); timers.forEach((f) => f()); return replaced.length; }, replaced };
}

test("a board loaded Sunday evening reloads itself once the Chicago date is Monday", () => {
  const p = page("2026-10-26T02:00:00Z");                    /* Sun Oct 25 21:00 CT */
  assert.equal(p.at("2026-10-26T04:58:00Z"), 0, "still Sunday 23:58 CT: no reload");
  assert.equal(p.at("2026-10-26T05:01:00Z"), 1, "Mon 00:01 CT: reload onto the new day");
  assert.match(p.replaced[0], /^\/kid-hayes\.html\?fresh=\d+$/);
});

test("the day check is Chicago time, not UTC: 7pm CT (00:00 UTC) is still the same day", () => {
  const p = page("2026-10-25T22:00:00Z");                    /* Sun 17:00 CT */
  assert.equal(p.at("2026-10-26T00:30:00Z"), 0);
});

test("the reload loop guard holds (once per 45s)", () => {
  const p = page("2026-10-26T04:00:00Z");
  p.at("2026-10-26T05:01:00Z");
  assert.equal(p.at("2026-10-26T05:01:20Z"), 1, "no second reload inside 45s");
});

test("the check runs every 30 s so the day flips within 30 s of midnight (JARTAP1, Atlas 11:51 PM)", () => {
  assert.match(SRC, /setInterval\(check, 30 \* 1000\)/);
  assert.doesNotMatch(SRC, /setInterval\(check, 60 \* 1000\)/);
});

for (const kid of ["harris", "hayes", "ainsley"]) {
  test("fake-clock midnight proof, kid-" + kid + ": 30 s ticks from 23:59:00 CT, reload on the first tick after 00:00 CT, never before", () => {
    const p = page("2026-10-26T04:30:00Z", "/kid-" + kid + ".html");   /* Sun Oct 25 23:30 CT, page loaded */
    const t0 = Date.parse("2026-10-26T04:59:00Z");                      /* 23:59:00 CT */
    let flippedAt = null;
    for (let k = 0; k <= 6 && flippedAt === null; k++) {
      const t = t0 + k * 30 * 1000;
      if (p.at(new Date(t).toISOString()) > 0) flippedAt = t;
    }
    const mid = Date.parse("2026-10-26T05:00:00Z");
    assert.ok(flippedAt !== null, "reloaded");
    assert.ok(flippedAt >= mid, "not before midnight CT");
    assert.ok(flippedAt - mid <= 30 * 1000, "within 30 s of midnight CT");
    assert.equal(p.replaced.length, 1);
    assert.match(p.replaced[0], new RegExp("^/kid-" + kid + "\\.html\\?fresh=\\d+$"));
  });
}
