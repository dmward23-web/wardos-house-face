/* Round 37. Synthetic names only. No clinical text. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

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
  return ctx.HouseEventDisplay;
}

const WHEN = "2026-11-10T22:30:00-06:00";

test("r37 an appointment is dropped when a boy name is in any field", () => {
  const D = boot();
  const cases = [
    { what: "Appointment", notes: "Harris", startIso: WHEN },
    { what: "Session", hint: "Hayes", startIso: WHEN },
    { what: "Dentist", who: "Hayes", startIso: WHEN },
    { what: "Appointment", with: "Harris", startIso: WHEN },
    { what: "Session", attendees: ["Harris"], startIso: WHEN },
    { what: "Appointment", attendees: [{ name: "Hayes" }], startIso: WHEN },
    { what: "Dentist", kidName: "Harris", startIso: WHEN },
    { what: "Session", extra: { place: { label: "Hayes" } }, startIso: WHEN },
    { what: "Har\u200Bris appointment", startIso: WHEN }
  ];
  for (const row of cases) {
    for (const who of ["dan", "shared", "ainsley"]) {
      assert.equal(D.summarize(row, who), null, who + " " + JSON.stringify(row));
    }
  }
});

test("r37 Hayes soccer still renders", () => {
  const D = boot();
  const row = { what: "Hayes soccer", startIso: "2026-11-10T18:00:00-06:00" };
  const view = D.summarize(row, "ainsley");
  assert.equal(view.title, "Soccer");
  assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, "ainsley").title, "Appointment");
});
