/* JARTAP1-DELTA1 (Alfred 2:58 AM CT, Atlas GO) · node --test scripts/qa/jartap1delta1.test.mjs
   (1) house-fresh.js MIDNIGHT1: a setTimeout to the next local midnight + 1 s runs the same check(), re-armed after each fire,
       the 30 s poll stays as backstop, no double roll. Real file, fake clock with a time-ordered timer queue (TZ=America/Chicago).
   (2) kids-data.js bankMetaText: the text written into [data-bank-meta] can never carry a '$'. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

process.env.TZ = "America/Chicago";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "house-fresh.js"), "utf8");
const KD = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/qa/fixtures/jartap1delta1-bankmeta.json"), "utf8"));

function page(startUtc, pathname = "/kid-hayes.html") {
  const clock = { t: Date.parse(startUtc) };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  let id = 0; const q = new Map(), replaced = [], ss = {}, listeners = {};
  const add = (fn, ms, every) => { id++; q.set(id, { at: clock.t + ms, fn, every: every ? ms : 0 }); return id; };
  const ctx = vm.createContext({
    Intl, Date: FakeDate, console,
    fetch: () => new Promise(() => {}),
    setTimeout: (fn, ms) => add(fn, ms || 0, false), setInterval: (fn, ms) => add(fn, ms, true),
    clearTimeout: (i) => q.delete(i),
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); } },
    location: { pathname, search: "", hash: "", replace: (u) => replaced.push({ u, t: clock.t }) },
    document: { readyState: "complete", hidden: false, addEventListener(e, f) { (listeners[e] ||= []).push(f); }, querySelectorAll: () => [] },
  });
  ctx.window = ctx; ctx.window.addEventListener = (e, f) => { (listeners[e] ||= []).push(f); };
  vm.runInContext(SRC, ctx, { filename: "house-fresh.js" });
  function runTo(utc, opts = {}) {
    const end = Date.parse(utc);
    for (;;) {
      let best = null;
      for (const [k, v] of q) if (!(opts.noPoll && v.every) && v.at <= end && (!best || v.at < best[1].at)) best = [k, v];
      if (!best) break;
      const [k, v] = best; clock.t = v.at;
      if (v.every) v.at += v.every; else q.delete(k);
      v.fn();
    }
    clock.t = end; return replaced.length;
  }
  return { runTo, replaced, q, listeners };
}

test("source: midnight + 1 s timer built DST-safe, re-armed, 30 s poll kept", () => {
  assert.match(SRC, /new Date\(n\.getFullYear\(\), n\.getMonth\(\), n\.getDate\(\) \+ 1, 0, 0, 1\)/);
  assert.match(SRC, /midT = setTimeout\(function \(\) \{ midT = 0; check\(\); armMidnight\(\); \}, msToMidnight\(\)\)/);
  assert.match(SRC, /setInterval\(check, 30 \* 1000\)/);
  assert.match(SRC, /Math\.max\(1000, Math\.min\(ms, 25 \* 3600 \* 1000\)\)/);
});

for (const kid of ["harris", "hayes", "ainsley"]) {
  test("kid-" + kid + ": with the 30 s poll switched off, the midnight timer alone reloads at 00:00:01 CT", () => {
    const p = page("2026-10-26T04:59:15.300Z", "/kid-" + kid + ".html");   /* Sun 23:59:15.3 CT, worst case for the poll */
    assert.equal(p.runTo("2026-10-26T04:59:59Z", { noPoll: true }), 0, "never before midnight");
    assert.equal(p.runTo("2026-10-26T05:00:05Z", { noPoll: true }), 1);
    assert.equal(p.replaced[0].t, Date.parse("2026-10-26T05:00:01Z"));
  });
}

test("timer plus poll together: exactly one roll at 00:00:01 CT, the poll tick right after does not roll again", () => {
  const p = page("2026-10-26T04:59:15.300Z");                 /* the fake page never really navigates, so look inside the 45 s guard window */
  assert.equal(p.runTo("2026-10-26T05:00:45Z"), 1);
  assert.equal(p.replaced[0].t, Date.parse("2026-10-26T05:00:01Z"));
});

test("re-armed after each fire: a second midnight timer is queued for the next night", () => {
  const p = page("2026-10-26T04:59:00Z");
  p.runTo("2026-10-26T05:00:02Z", { noPoll: true });
  const pending = [...p.q.values()].filter((v) => !v.every && v.at > Date.parse("2026-10-26T05:00:02Z"));
  assert.ok(pending.some((v) => v.at === Date.parse("2026-10-27T05:00:01Z")), "Tue 00:00:01 CT armed");
});

test("DST fall-back night (Sun Nov 1 2026): timer lands on 00:00:01 local of Nov 2", () => {
  const p = page("2026-11-01T12:00:00Z");
  const t = [...p.q.values()].filter((v) => !v.every).map((v) => v.at);
  assert.ok(t.includes(Date.parse("2026-11-02T06:00:01Z")), "Nov 2 00:00:01 CST");
});

test("return to the page re-arms without stacking timers", () => {
  const p = page("2026-10-26T02:00:00Z");
  const n0 = [...p.q.values()].filter((v) => !v.every && v.at > Date.parse("2026-10-26T04:00:00Z")).length;
  for (let i = 0; i < 3; i++) (p.listeners.visibilitychange || []).forEach((f) => f());
  const n1 = [...p.q.values()].filter((v) => !v.every && v.at > Date.parse("2026-10-26T04:00:00Z")).length;
  assert.equal(n0, 1); assert.equal(n1, 1);
});

test("kids-data.js: the [data-bank-meta] text is dollar-free for every bankMetaText branch", () => {
  const line = KD.split("\n").find((l) => /var metaTxt = bankMetaText\(\)/.test(l));
  assert.ok(line, "metaTxt line present");
  assert.match(line, /\.replace\(\/\\\$\/g, ""\)/, "final strip of every '$'");
  const expr = line.trim().replace(/^var metaTxt = /, "").replace(/;\s*\/\*.*$/, "").replace("bankMetaText()", "s");
  const f = new Function("s", "return " + expr);
  for (const s of FX.inputs) {
    assert.doesNotMatch(f(s), /\$/, s);
  }
  assert.equal(f(FX.expect.in), FX.expect.out);
});
