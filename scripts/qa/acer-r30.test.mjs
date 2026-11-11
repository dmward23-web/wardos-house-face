/* Round 30 gate. Synthetic tokens only. Clinical words are built from fragments so this file
   does not store a real session title. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const bit = (a, b) => a + b;

function bootLaw() {
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

const FIELDS = ["what", "kind", "description", "notes", "location", "hint"];
const BOYS = ["hayes", "harris"];

test("r30 clinical prose is dropped for both boys before a title is written", () => {
  const ctx = bootLaw();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  const token = bit("spe", "ech");
  for (const field of FIELDS) {
    for (const kid of BOYS) {
      const row = { what: "Homework", kind: "school", when: "Mon 10 · 4:00 PM", startIso: "2026-11-10T16:00:00-06:00" };
      row[field] = token;
      assert.equal(D.summarize(row, kid), null, field + " " + kid);
      const data = {
        kids: { [kid]: { today: [Object.assign({}, row)], hottest: Object.assign({}, row) } },
        boardStrip: { queue: [Object.assign({ kid }, row)] }
      };
      Law.cleanKidsWeek(data);
      const blob = JSON.stringify(data);
      assert.equal(data.kids[kid].today.length, 0, field + " stayed on " + kid);
      assert.equal(blob.includes(token), false, field + " still in the hub payload");
      assert.equal(/Homework/.test(JSON.stringify(data.kids[kid].today)), false);
    }
  }
});

test("r30 Ainsley and Dan keep their own future sessions", () => {
  const ctx = bootLaw();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  const swim = { what: "Swim", kind: "appointment", when: "Fri 20 · 4:25 PM", startIso: "2026-11-20T16:25:00-06:00" };
  const dad = { what: "Conference", kind: "session", when: "Fri 20 · 2:00 PM", startIso: "2026-11-20T14:00:00-06:00" };
  assert.equal(D.summarize(swim, "ainsley").title, "Swim");
  assert.equal(D.summarize(dad, "dan").title, "Conference");
  const data = {
    kids: {
      ainsley: { today: [Object.assign({}, swim)], hottest: Object.assign({}, swim) },
      dan: { today: [Object.assign({}, dad)], hottest: Object.assign({}, dad) }
    },
    boardStrip: { queue: [Object.assign({ kid: "ainsley" }, swim), Object.assign({ kid: "dan" }, dad)] }
  };
  Law.cleanKidsWeek(data);
  assert.equal(data.kids.ainsley.today[0].what, "Swim");
  assert.ok(data.kids.dan.today.length === 1 && /Conference|Calendar item/.test(data.kids.dan.today[0].what || data.kids.dan.today[0].summary || ""));
  const hub = JSON.stringify(data.boardStrip.queue);
  assert.match(hub, /Swim/);
  assert.match(hub, /Conference/);
});

test("r30 money names lose the whole money expression on add, read, and update", () => {
  const S = bootSaves().HouseSaves;
  for (const raw of ["allowance 50", "income 50", "jar 50"]) {
    assert.equal(S.add("hayes", raw, 0), null, raw);
    const kept = S.add("hayes", "Gem Jar", 3);
    S.update("hayes", kept.id, raw, 3);
    const names = S.list("hayes").map((x) => x.name);
    assert.equal(JSON.stringify(names), JSON.stringify(["Gem Jar"]), raw);
    S.remove("hayes", kept.id);
  }
  assert.equal(S.add("hayes", "$50 toy", 0).name, "toy");
  assert.equal(S.add("hayes", "Jar", 0).name, "Jar");
  assert.equal(S.add("hayes", "Gem Jar", 4).name, "Gem Jar");
});

test("r30 a stored priced toy loses the number on read", () => {
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
  store["house-saves:v1"] = JSON.stringify({
    hayes: [
      { id: "a", name: "allowance 50", need: 1 },
      { id: "b", name: "$50 toy", need: 1 },
      { id: "c", name: "Gem Jar", need: 2 }
    ]
  });
  const names = ctx.HouseSaves.list("hayes").map((x) => x.name);
  assert.equal(JSON.stringify(names), JSON.stringify(["toy", "Gem Jar"]));
});

test("r30 served data1 fixture has no session title, coach, or rate", () => {
  const raw = read("scripts/qa/fixtures/data1.events.json");
  assert.equal(/therap|clinical|provider|counsel/i.test(raw), false);
  assert.equal(/\$\s*\d/.test(raw), false);
  assert.equal(/Coach /.test(raw), false);
  assert.match(raw, /Ainsley swim/);
  assert.match(raw, /reading block/);
});

test("r30 missing feed copy is distinct from an empty next card", () => {
  const src = read("kid-world.js");
  assert.match(src, /Schedule not loaded · tap to retry/);
  assert.equal((src.match(/Schedule not loaded · tap to retry/g) || []).length >= 2, true);
  const kids = read("kids-data.js");
  assert.match(kids, /Nothing next/);
});

test("r30 today and month hide the stale leave-by anchor", () => {
  for (const f of ["sheet-today.html", "month.html"]) {
    assert.match(read(f), /a\.leaveby \{ display: none !important; \}/);
  }
});

test("r30 mercury home sits inside the inset and the visible type is 24px", () => {
  const css = read("mercury-run.css");
  assert.match(css, /\.hud \{[^}]*left: 64px/);
  assert.match(css, /\.hud \{[^}]*top: 64px/);
  assert.match(css, /font-size: 24px/);
  assert.match(css, /\.merc-home[\s\S]{0,240}min-width: 64px/);
  assert.match(read("mercury-run.html"), /house-hub\.js/);
});

test("r30 the save sheet has a Home control and the floor sizes", () => {
  const js = read("house-saves.js");
  assert.match(js, /class="saves-home wardos-home" href="sheet-index\.html"/);
  const css = read("house-engage.css");
  assert.match(css, /\.saves-home \{[\s\S]*min-height: 64px/);
  assert.match(css, /\.saves-add-name \{[\s\S]*min-height: 64px[\s\S]*font-size: 24px/);
  assert.match(css, /\.saves-add-save \{[\s\S]*min-height: 64px[\s\S]*font-size: 24px/);
  assert.match(css, /\.saves-list-del \{[\s\S]*width: 64px/);
  assert.match(css, /\.saves-sheet-title \{[\s\S]*font-size: 24px/);
});

test("r30 a kid subscene Home is not the hud rule at the origin", () => {
  const css = read("prism-face.css");
  assert.match(css, /html\.kw-root body\.kw-on \.kw-hud \.kw-home/);
  assert.match(css, /html\.kw-root body\.kw-on \.kw-scene \.kw-scene-home \{[\s\S]*left: 64px !important;[\s\S]*top: 64px !important;/);
  assert.doesNotMatch(css, /html\.kw-root body\.kw-on \.kw-home \{/);
});

test("r30 expanded chores keep the option D day strip", () => {
  const html = read("sheet-chores.html");
  assert.match(html, /var dayGap = 16/);
  assert.match(html, /daysW = zone \* 7 \+ dayGap \* 6/);
  assert.match(html, /overflow-y", "scroll"/);
  assert.match(read("prism-face.js"), /window\.fitChoreColumns/);
});

test("r30 kid rows keep a 16px gap and hub chips are 16px apart", () => {
  const kid = read("kid-world.js");
  const gap = kid.slice(kid.indexOf("function fitMustRows"), kid.indexOf("function paintPublicMusts"));
  assert.match(gap, /var gap = 16/);
  assert.match(read("prism-face.css"), /\.hub-lights-bulk \{[\s\S]*gap: 16px !important/);
  assert.match(read("sheet-index.html"), /\.hdr-right \{ display: flex; flex-direction: row; align-items: center; gap: 16px/);
});

test("r30 the night header glow is not painted on the stage", () => {
  assert.match(read("wardos-stage.css"), /html\[data-wardos-stage\] body \.panel::before[\s\S]*display: none !important/);
});

test("r30 month uses the pinned clock and a flat chip", () => {
  const html = read("month.html");
  assert.match(html, /function pinnedNow\(\)/);
  assert.match(html, /HouseScene\.now/);
  assert.doesNotMatch(html, /function ctToday\(\) \{[\s\S]{0,220}format\(new Date\(\)\)/);
  assert.match(html, /\.live-clock[\s\S]{0,180}text-shadow: none !important/);
});

test("r30 Ainsley has no jar add control", () => {
  const js = read("prism-face.js");
  assert.match(js, /data-kid"\) === "ainsley"\) \? "" : '<button type="button" class="prism-jar-plus"/);
});
