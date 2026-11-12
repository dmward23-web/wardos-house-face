/* Round 40. Synthetic names only. No clinical text. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const WHO = ["dan", "shared", "ainsley", "hub"];
const WHEN = "2026-11-12T22:30:00-06:00";

function boot() {
  const ctx = {
    window: null,
    Intl,
    Date,
    decodeURIComponent,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

const NEGC = "\u{1F157}\u{1F150}\u{1F168}\u{1F154}\u{1F162}";
const LEAKS = [
  "H&aacute;yes",
  "&Hscr;ayes",
  "Ha&ZeroWidthSpace;yes",
  "H&aacute;rris",
  "&Hscr;arris",
  "Ha&ZeroWidthSpace;rris",
  "Ha%E2%80%8Byes",
  "Ha%C2%ADyes",
  "%EF%BC%A8ayes",
  "Ha%E2%80%8Brris",
  "Ha%C2%ADrris",
  "%EF%BC%A8arris",
  "%26%2372%3Bayes",
  "Ha%26shy%3Byes",
  "%26%2372%3Barris",
  "Ha%26shy%3Brris",
  NEGC,
  "\u{1F157}ayes",
  "\u{1F157}\u{1F150}\u{1F161}\u{1F161}\u{1F158}\u{1F162}",
  "\u{1F157}arris",
  "Ha%26%23121%3Bes"
];

test("r40 in-scope disguised appointment names are dropped", () => {
  const D = boot().HouseEventDisplay;
  for (const nm of LEAKS) {
    for (const who of WHO) {
      const row = { what: "Appointment", notes: nm, startIso: WHEN };
      assert.equal(D.summarize(row, who), null, who + " " + nm);
    }
  }
});

test("r40 Hay 3S stays visible on a normal row and a nameless appointment drops", () => {
  const D = boot().HouseEventDisplay;
  for (const what of ["Appointment", "Session", "Dentist"]) {
    for (const field of ["notes", "where"]) {
      for (const who of WHO) {
        const row = { what: what, [field]: "Hay 3S", startIso: WHEN };
        assert.equal(D.summarize(row, who), null, who + " " + what + " " + field);
      }
    }
  }
  for (const who of WHO) {
    const view = D.summarize({ what: "Pack snacks", notes: "Hay 3S", startIso: WHEN }, who);
    assert.ok(view && view.title, who);
    assert.equal(/hayes|harris/i.test(view.title), false);
  }
  assert.equal(D.summarize({ what: "Hayes soccer", startIso: "2026-11-12T18:00:00-06:00" }, "ainsley").title, "Soccer");
  assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, "dan"), null);
  assert.equal(D.summarize({ what: "Appointment", notes: "4:30 PM", startIso: WHEN }, "hub"), null);
});
