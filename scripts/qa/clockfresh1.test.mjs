/* CLOCKFRESH1 · Alfred staleness check. ?now and freeze are off.
   Advance fake timers across a minute, across Chicago midnight, and a 10-minute hidden-tab suspend.
   Hub, three kid chips and Chores must match America/Chicago within the displayed minute, and the weekday flips at midnight.
   Dan, Nov 10 2026, 6:08 PM CT: one live chip, including Ainsley. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "house-clock.js"), "utf8");

function expectAt(ms) {
  const p = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
  }).formatToParts(new Date(ms)).forEach((x) => { if (x.type !== "literal") p[x.type] = x.value; });
  return { time: p.hour + ":" + p.minute + " " + p.dayPeriod, dow: p.weekday };
}

function boot(start) {
  let now = start;
  const timers = [];
  const listeners = {};
  const nodes = [];
  const on = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const fire = (type) => (listeners[type] || []).forEach((fn) => fn());
  function el(tag, attrs, parent) {
    const node = {
      tagName: tag, attrs: { ...attrs }, parent, textContent: "", className: attrs.class || "", kids: [],
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      closest(sel) {
        let n = this;
        while (n) {
          const hit = sel.split(",").some((s) => {
            s = s.trim();
            if (s[0] === ".") return (n.className || "").split(/\s+/).includes(s.slice(1));
            if (s === "header") return n.tagName === "HEADER";
            return false;
          });
          if (hit) return n;
          n = n.parent;
        }
        return null;
      }
    };
    if (parent) parent.kids.push(node);
    nodes.push(node);
    return node;
  }
  function matchOne(n, sel) {
    sel = sel.trim();
    if (sel === "[data-live-clock]") return "data-live-clock" in n.attrs;
    if (sel === "[data-kw-clock]") return "data-kw-clock" in n.attrs;
    if (sel === "[data-live='time']") return n.attrs["data-live"] === "time";
    if (sel === "[data-live='clock-time']") return n.attrs["data-live"] === "clock-time";
    if (sel === "[data-live='dow']") return n.attrs["data-live"] === "dow";
    if (sel === "[data-live='date-long']") return n.attrs["data-live"] === "date-long";
    if (sel === "[data-live='date-short']") return n.attrs["data-live"] === "date-short";
    return false;
  }
  function match(n, sel) { return sel.split(",").some((part) => matchOne(n, part)); }
  const header = el("HEADER", { class: "hdr-date" }, null);
  const hub = el("DIV", { "data-live": "time", "data-board": "hub" }, header);
  const dow = el("DIV", { "data-live": "dow", class: "hdr-date" }, header);
  const dateLong = el("DIV", { "data-live": "date-long", class: "hdr-date" }, header);
  const chores = el("DIV", { "data-live-clock": "", "data-board": "chores" }, null);
  const ainsley = el("DIV", { "data-kw-clock": "", "data-board": "ainsley" }, null);
  const hayes = el("DIV", { "data-kw-clock": "", "data-board": "hayes" }, null);
  const harris = el("DIV", { "data-kw-clock": "", "data-board": "harris" }, null);
  const chips = [hub, chores, ainsley, hayes, harris];
  const document = {
    readyState: "complete",
    hidden: false,
    addEventListener: on,
    querySelector(sel) { return nodes.find((n) => match(n, sel)) || null; },
    querySelectorAll(sel) { return nodes.filter((n) => match(n, sel)); }
  };
  const window = { addEventListener: on };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [now])); }
    static now() { return now; }
  }
  const g = {
    Intl, Date: FakeDate, document, window, setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval() {},
    console
  };
  g.global = g;
  vm.runInNewContext(SRC, g, { filename: "house-clock.js" });
  return {
    chips, dow, dateLong,
    advance(ms) { now += ms; timers.forEach((fn) => fn()); },
    suspend(ms) { document.hidden = true; now += ms; document.hidden = false; fire("visibilitychange"); }
  };
}

test("clock chips follow Chicago time across a minute, midnight, and a hidden 10-minute suspend", () => {
  const noon = Date.parse("2026-11-10T18:30:00Z"); /* 12:30 PM CST */
  const page = boot(noon);
  const face = (el, stamp) => el.getAttribute("data-kw-clock") != null ? stamp.dow + " \u00b7 " + stamp.time : stamp.time;
  const read = () => page.chips.map((c) => c.textContent);
  assert.deepEqual(read(), page.chips.map((c) => face(c, expectAt(noon))));
  assert.equal(page.dow.textContent, "Tue");

  page.advance(61 * 1000);
  const min = noon + 61 * 1000;
  assert.deepEqual(read(), page.chips.map((c) => face(c, expectAt(min))));
  assert.equal(read()[0], "12:31 PM");

  const before = Date.parse("2026-11-11T05:59:30Z"); /* 11:59 PM CST Nov 10 */
  const night = boot(before);
  assert.equal(night.chips[2].textContent, "Tue \u00b7 11:59 PM");
  assert.equal(night.dow.textContent, "Tue");
  night.advance(40 * 1000);
  const after = before + 40 * 1000;
  const want = expectAt(after);
  assert.equal(want.time, "12:00 AM");
  assert.equal(want.dow, "Wed");
  night.chips.forEach((c) => {
    assert.equal(c.textContent, c.getAttribute("data-kw-clock") != null ? "Wed \u00b7 " + want.time : want.time);
    assert.equal(c.getAttribute("data-dow"), "Wed");
  });
  assert.equal(night.dow.textContent, "Wed");

  const held = boot(noon);
  held.suspend(10 * 60 * 1000);
  const later = expectAt(noon + 10 * 60 * 1000);
  assert.equal(later.time, "12:40 PM");
  held.chips.forEach((c) => assert.equal(c.textContent, c.getAttribute("data-kw-clock") != null ? "Tue \u00b7 " + later.time : later.time));
});
