/* r53b · one clock. Hero, background and every person/feed tile report the same WardSunPhase.
   Night is sunset to sunrise. Dusk is the 20 minutes before sunset. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = process.env.WARDOS_ROOT
  ? path.resolve(process.env.WARDOS_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function boot(iso) {
  const props = {}, attrs = {};
  const img = { src: "", alt: "", getAttribute: (k) => (k === "src" ? img.src : ""), setAttribute(k, v) { if (k === "src") img.src = v; } };
  const hero = { attrs: {}, querySelector: (s) => (s === "img" ? img : null), appendChild() {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } };
  const tiles = ["ainsley", "hayes", "harris", "dan", "wx", "music", "sensi"].map((name) => ({
    name, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }
  }));
  const html = {
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k],
    style: { setProperty(k, v) { props[k] = v; } }
  };
  const body = { hasAttribute: () => false, firstChild: null, insertBefore() {}, appendChild() {} };
  const mk = () => ({ id: "", className: "", style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, querySelector: () => null });
  const document = {
    documentElement: html, body, readyState: "complete",
    currentScript: { src: "http://hub.local/month-theme/month-overlay.js?v=SUNCLOCK1" },
    createElement: mk,
    querySelector: (s) => (s === ".hub-window" ? hero : null),
    querySelectorAll: (s) => (s.indexOf(".tile") >= 0 ? tiles : []),
    getElementById: () => null,
    addEventListener() {}
  };
  const fixed = Date.parse(iso);
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  }
  const ctx = vm.createContext({
    document, Date: FakeDate, Intl, URLSearchParams, console,
    location: { search: "?now=" + encodeURIComponent(iso), pathname: "/sheet-index.html", href: "http://hub.local/sheet-index.html", origin: "http://hub.local" },
    innerWidth: 1920, innerHeight: 1080,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, addEventListener() {}
  });
  ctx.window = ctx;
  vm.runInContext(rd("month-theme/season-math.js") + "\n" + rd("month-theme/month-overlay.js"), ctx, { filename: "month-overlay.js" });
  const reported = [hero.getAttribute("data-sun-phase"), html.getAttribute("data-sun-phase")].concat(tiles.map((t) => t.getAttribute("data-sun-phase")));
  return { phase: attrs["data-nov-phase"], reported };
}

test("r53b hero, background and tiles share one phase at dusk, night and the next sunrise", () => {
  const cases = [
    ["2026-11-15T16:55:00-06:00", "dusk"],
    ["2026-11-15T17:10:00-06:00", "night"],
    ["2026-11-15T19:30:00-06:00", "night"],
    ["2026-11-16T07:05:00-06:00", "morning"]
  ];
  for (const [iso, want] of cases) {
    const r = boot(iso);
    assert.equal(r.phase, want, iso);
    assert.ok(r.reported.length >= 6, iso);
    assert.ok(r.reported.every((p) => p === want), iso + " " + JSON.stringify(r.reported));
  }
});
