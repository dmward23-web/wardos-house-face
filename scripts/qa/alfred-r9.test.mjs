/* Alfred interim re-check probes: clinical deny, money deny, day-tap floor, feed-note order. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function bootDisplay() {
  const ctx = {
    window: null,
    Intl,
    Date,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

const CLINICAL = [
  "OT · homework",
  "speech · homework",
  "Dr. · homework",
  "appointment · homework",
  "telehealth · homework",
  "session · homework",
  "THERAPY homework",
  "Psychology check",
  "OT · HOMEWORK",
  "ＯＴ · homework",
  "Speech · Homework",
  "session · HOMEWORK"
];

test("AP0-2 a clinical source item is dropped whole, never renamed Homework", () => {
  const ctx = bootDisplay();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  for (const title of CLINICAL) {
    for (const kid of ["hayes", "harris"]) {
      const row = { summary: title, title, what: title };
      assert.equal(D.isDenied(row), true, title + " " + kid);
      assert.equal(D.summarize(row, kid), null, title + " summarize " + kid);
      const data = { kids: { [kid]: { today: [{ summary: title, what: title }] } } };
      Law.cleanKidsWeek(data);
      assert.equal(data.kids[kid].today.length, 0, title + " still on " + kid + " " + JSON.stringify(data.kids[kid].today));
    }
  }
  assert.equal(D.summarize({ summary: "Homework" }, "hayes").title, "Homework");
  assert.equal(D.summarize({ summary: "Swim" }, "harris").title, "Swim");
});

function bootSaves() {
  const store = {};
  const ctx = {
    window: null,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    document: { readyState: "complete" },
    Date,
    Math
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-saves.js"), ctx);
  return ctx;
}

test("money words and compatibility digits are denied on a save name", () => {
  const ctx = bootSaves();
  const S = ctx.HouseSaves;
  const cases = [
    ["Lego $50", "Lego 50"],
    ["salary toy", "toy"],
    ["balance toy", "toy"],
    ["budget toy", "toy"],
    ["payment toy", "toy"],
    ["pennies toy", "toy"],
    ["USD50 toy", "toy"],
    ["€50 game", "game"],
    ["£50 toy", "toy"],
    ["＄５０ toy", "toy"]
  ];
  for (const [raw, want] of cases) {
    const item = S.add("hayes", raw, 0);
    const got = item ? item.name : "";
    assert.equal(got, want, raw + " -> " + got);
  }
});

test("day-tap floor beats the later min-width 0 rule", () => {
  const css = read("kid-world.css");
  const late = css.lastIndexOf(".quest-days .day-tap");
  const rule = css.slice(late, css.indexOf("}", late));
  assert.match(rule, /min-width:\s*88px\s*!important/);
  assert.match(rule, /min-height:\s*88px\s*!important/);
  assert.doesNotMatch(rule, /min-width:\s*0/);
});

test("the unavailable note is cleared by the wrapped data-ready listener", () => {
  const src = read("kid-world.js");
  const wrap = src.indexOf("hideRest = function () { hideRestBound(); weekNote(false); }");
  const listen = src.indexOf('addEventListener("house:kids-data-ready", hideRest)');
  assert.ok(wrap > 0 && listen > wrap, "data-ready must see the wrapper that removes the note");
  const css = read("kid-world.css");
  const hide = css.indexOf("html.kw-root body.kw-on .kw-week-empty");
  const feedHide = css.slice(hide, css.indexOf("{", hide));
  assert.equal(feedHide.includes(".kw-feed"), false, "the wall hide list still contains .kw-feed");
});

test("audit flag is appended to hub, home, and HouseLinks targets", () => {
  for (const f of ["house-audit.js", "hub-compose.js", "kid-world.js", "wardos-stage.js", "house-links.js"]) {
    assert.match(read(f), /HouseAudit\.href|function href/, f);
  }
  assert.match(read("mercury-run.html"), /house-audit\.js\?v=AUDIT1/);
  assert.match(read("house-face-law.js"), /house-event-display\.js\?v=ACERFIX1/);
});
