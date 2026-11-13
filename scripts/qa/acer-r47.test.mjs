/* Round 47. Money strip with the law alone, and a type signal is the row type. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { boot } from "./acer-r42.test.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const S = String.fromCharCode(36);
const FW = "\uFF04";
const SM = "\uFE69";
const bit = (...p) => p.join("");
const WHEN = "2026-11-12T13:00:00-06:00";
const MARK = "#wardos-show";

function lawOnly() {
  const ctx = {
    Intl, Date, decodeURIComponent, WeakSet,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} }, addEventListener() {} },
    location: { pathname: "/kid-ainsley.html" }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-face-law.js"), ctx, { filename: "house-face-law.js" });
  return ctx.HouseFaceLaw;
}

test("r47 cleanFeed strips every money form with the law alone", () => {
  const L = lawOnly();
  assert.equal(L.HouseEventDisplay, undefined);
  const live = L.cleanFeed("cal-live", {
    upcomingLeaves: [{ id: "row-1", summary: "Field trip (bring " + S + "5)", location: "Book fair " + S + "1,256, Main", start: "2026-10-29T09:00:00-05:00", end: "2026-10-29T10:00:00-05:00" }],
    nextLeave: { summary: "Gift jar 613 " + S, what: "Fair " + FW + "5 ride" },
    boardStrip: { queue: [{ what: "Bake " + SM + "5 sale", hint: "Gala " + S + "2.5m goal" }] }
  });
  const months = L.cleanFeed("cal-months", { days: { "2026-10-01": { items: [{ c: "shr", l: "Snack " + S + ".77 each" }, { c: "hay", l: "Fee " + S + " 193 due" }, { c: "har", l: "5km run" }] } } });
  const kids = L.cleanFeed("kids-week", { kids: { ainsley: { today: [{ what: "Bus " + S + "5k raffle", when: "3:15 pm" }] } } });
  for (const [n, d] of [["cal-live", live], ["cal-months", months], ["kids-week", kids]]) {
    const txt = JSON.stringify(d);
    assert.doesNotMatch(txt, /[\x24\uFF04\uFE69]/, n + " " + txt);
  }
  assert.equal(live.upcomingLeaves[0].summary, "Field trip (bring)");
  assert.equal(live.upcomingLeaves[0].id, "row-1");
  assert.equal(live.upcomingLeaves[0].start, "2026-10-29T09:00:00-05:00");
  assert.equal(months.days["2026-10-01"].items[2].l, "5km run");
  assert.equal(kids.kids.ainsley.today[0].when, "3:15 pm");
  assert.equal(kids.kids.ainsley.today[0].what, "Bus raffle");
});

test("r47 a type signal is the row type, so Pickup does not become School pickup", () => {
  const D = boot();
  const word = bit("appoint", "ment");
  const fields = ["kind", "type", "category", "eventType"];
  const slots = [
    ["ainsley", "ainsley", true],
    ["dad", "dan", true],
    ["none", "shared", true],
    ["hayes", "hayes", false],
    ["harris", "harris", false]
  ];
  for (const field of fields) {
    for (const [name, who, show] of slots) {
      const unmarked = { what: "Pickup", startIso: WHEN };
      unmarked[field] = word;
      const dropped = D.summarize(unmarked, who);
      assert.equal(dropped, null, "unmarked " + field + " " + name);
      const marked = { what: "Pickup", description: MARK, startIso: WHEN };
      marked[field] = "\u200B" + word.toUpperCase();
      const view = D.summarize(marked, who);
      if (show) {
        assert.equal(view && view.title, "Appointment", "marked " + field + " " + name);
        assert.notEqual(view && view.title, "School pickup");
        assert.ok(view.time, "time " + field + " " + name);
      } else {
        assert.equal(view, null, "boy slot " + field + " " + name);
      }
    }
  }
  assert.equal(D.summarize({ what: "Swim", kind: word, startIso: WHEN }, "ainsley"), null);
});
