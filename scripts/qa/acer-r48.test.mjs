/* Round 48. A type signal is the row type on every locked view. Neutral titles only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const bit = (...p) => p.join("");
const WHEN = "2026-11-12T13:00:00-06:00";
const MARK = "#wardos-show";

function bootBoth() {
  const ctx = {
    Intl, Date, console, WeakSet, decodeURIComponent,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } },
    location: { pathname: "/sheet-index.html" }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

const TITLES = ["Swim", "Conference", "Pickup", "Soccer", "Piano"];
const FIELDS = ["kind", "type", "category", "eventType"];
const VALUES = [bit("appoint", "ment"), bit("ses", "sion"), bit("appoint", "ment_", "med", "ical")];
const VIEWS = [
  ["kid-ainsley", "ainsley"],
  ["kid-hayes", "hayes"],
  ["kid-harris", "harris"],
  ["hub", "shared"],
  ["index", "shared"],
  ["dad-tile", "shared"],
  ["sheet-today", "shared"],
  ["allowance", "shared"],
  ["month", "shared"]
];
const SLOTS = [
  ["ainsley", "ainsley"],
  ["dad", "dan"],
  ["none", ""],
  ["hayes", "hayes"],
  ["harris", "harris"]
];

function twist(v) {
  const mixed = v.split("").map((c, i) => (i % 2 ? c.toUpperCase() : c)).join("");
  const zw = v.slice(0, 3) + "\u200B" + v.slice(3);
  return [v, mixed, zw];
}

function showOn(view, slot, marked) {
  if (!marked) return false;
  if (view === "kid-hayes" || view === "kid-harris") return false;
  if (slot === "hayes" || slot === "harris") return false;
  return true;
}

test("r48 type signals follow Rule B on every locked view", () => {
  const ctx = bootBoth();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  let cells = 0;
  for (const title of TITLES) {
    for (const field of FIELDS) {
      for (const base of VALUES) {
        for (const value of twist(base)) {
          for (const [slot, kid] of SLOTS) {
            for (const marked of [false, true]) {
              for (const [view, who] of VIEWS) {
                const ev = { what: title, startIso: WHEN };
                ev[field] = value;
                if (kid) ev.kid = kid;
                if (marked) ev.description = MARK;
                const got = D.summarize(ev, who);
                const label = got && got.title;
                assert.notEqual(label, "School pickup", title + " " + field + " " + slot + " " + view);
                assert.notEqual(label, title, title + " kept its activity title");
                if (showOn(view, slot, marked)) {
                  assert.equal(label, "Appointment", [title, field, slot, view, marked].join(" "));
                  assert.ok(got.time, "time");
                } else {
                  assert.equal(got, null, [title, field, slot, view, marked].join(" "));
                }
                cells++;
              }
            }
          }
        }
      }
    }
  }
  assert.equal(cells, TITLES.length * FIELDS.length * VALUES.length * 3 * SLOTS.length * 2 * VIEWS.length);

  const priv = { what: "Pickup", type: bit("ses", "sion").toUpperCase(), startIso: WHEN, extendedProperties: { private: { "wardos.show": "1" } } };
  assert.equal(D.summarize(priv, "ainsley").title, "Appointment");
  assert.equal(D.summarize(Object.assign({ class: bit("appoint", "ment_", "med", "ical") }, { what: "Piano", startIso: WHEN }), "shared"), null);

  const marked = { what: "Swim", kind: bit("appoint", "ment"), description: MARK, startIso: WHEN, c: "ain" };
  const month = Law.cleanFeed("cal-months", { days: { "2026-11-12": { items: [Object.assign({}, marked), { what: "Pickup", kind: bit("ses", "sion"), l: "Pickup", c: "hay", startIso: WHEN }] } } });
  const items = month.days["2026-11-12"].items;
  assert.equal(items.length, 1);
  assert.equal(items[0].l, "Appointment");
  assert.equal(JSON.stringify(items).includes("Swim"), false);
  assert.equal(JSON.stringify(items).includes("School pickup"), false);

  const week = Law.cleanFeed("kids-week", { kids: { ainsley: { today: [{ what: "Soccer", type: bit("appoint", "ment_", "med", "ical"), startIso: WHEN }] }, hayes: { today: [{ what: "Piano", category: bit("ses", "sion"), description: MARK, startIso: WHEN }] } } });
  assert.equal(week.kids.ainsley.today.length, 0);
  assert.equal(week.kids.hayes.today.length, 0);
});
