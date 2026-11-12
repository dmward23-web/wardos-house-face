/* Round 38. Synthetic names only. No clinical text. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const WHO = ["dan", "shared", "ainsley", "hub"];
const WHEN = "2026-11-10T22:30:00-06:00";

function boot() {
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

test("r38 appointment rows with a disguised boy name are dropped", () => {
  const ctx = boot();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  const rows = [
    { what: "Appointment", notes: "\u041D\u0430rris", startIso: WHEN },
    { what: "Session", notes: "Harri\u015B", startIso: WHEN },
    { what: "Appointment", notes: "hayes_ward", startIso: WHEN },
    { what: "HarrisWard appointment", startIso: WHEN },
    { what: "Appointment", attendees: { hayes: 1 }, startIso: WHEN },
    { what: "Appointment", notes: "\u0397\u03B1yes", startIso: WHEN },
    { what: "Appointment", notes: "\uFF28\uFF41\uFF59\uFF45\uFF53", startIso: WHEN },
    { what: "Appointment", notes: "H.a.y.e.s", startIso: WHEN },
    { what: "Appointment", notes: "H a r r i s", startIso: WHEN },
    { what: "Appointment", notes: "note \u10D0", startIso: WHEN }
  ];
  for (const row of rows) {
    for (const who of WHO) {
      assert.equal(D.summarize(row, who), null, who + " " + JSON.stringify(row));
    }
    const data = { kids: { ainsley: { today: [Object.assign({}, row)] } } };
    Law.cleanKidsWeek(data);
    assert.equal(data.kids.ainsley.today.length, 0, JSON.stringify(row));
  }
});

test("r38 a nameless appointment and Hayes soccer still render", () => {
  const D = boot().HouseEventDisplay;
  for (const who of WHO) {
    assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, who).title, "Appointment", who);
  }
  const soccer = D.summarize({ what: "Hayes soccer", startIso: "2026-11-10T18:00:00-06:00" }, "ainsley");
  assert.equal(soccer.title, "Soccer");
});
