/* Round 41. Appointment rows are an allow-list. Synthetic names only. */
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

const RI = { h: "\u{1F1ED}", a: "\u{1F1E6}", y: "\u{1F1FE}", e: "\u{1F1EA}", s: "\u{1F1F8}", r: "\u{1F1F7}", i: "\u{1F1EE}" };
const NEG = { h: "\u{1F177}", a: "\u{1F170}", y: "\u{1F188}", e: "\u{1F174}", s: "\u{1F182}", r: "\u{1F181}", i: "\u{1F178}" };
const SQ = { h: "\u{1F137}", a: "\u{1F130}", r: "\u{1F141}", i: "\u{1F138}", s: "\u{1F142}", y: "\u{1F148}", e: "\u{1F134}" };
const NEGC = "\u{1F157}\u{1F150}\u{1F168}\u{1F154}\u{1F162}";
const LEAKS = [
  "\u041D\u0430rris",
  "Harri\u015F",
  "hayes_ward",
  "\u0397\u03B1yes",
  "\uFF28\uFF41\uFF59\uFF45\uFF53",
  "H.a.y.e.s",
  "H a r r i s",
  "note \u10D0",
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
  "Ha%26%23121%3Bes",
  "&#72;ayes",
  "Harri&#115;",
  "&#x48;arris",
  "Har&shy;ris",
  "&amp;#72;ayes",
  "Har<wbr>ris",
  "<b>Hay</b>es",
  "Hay%65s",
  RI.h + RI.a + RI.y + RI.e + RI.s,
  NEG.h + NEG.a + NEG.y + NEG.e + NEG.s,
  SQ.h + SQ.a + SQ.r + SQ.r + SQ.i + SQ.s,
  "H4yes",
  "Harr1s",
  "Hay3s",
  "HAYE5",
  "H&#52;yes",
  "<b>Hay</b>%65s",
  "H4 yes",
  "H-4-yes",
  "H.4.y.e.s",
  "Harr 1s",
  "Ha y3s",
  "H4_yes",
  "Harr1-s",
  "\u202eseyaH"
];

test("r41 every leak on an appointment row drops", () => {
  const D = boot().HouseEventDisplay;
  for (const nm of LEAKS) {
    for (const who of WHO) {
      assert.equal(D.summarize({ what: "Appointment", notes: nm, startIso: WHEN }, who), null, who + " " + nm);
      assert.equal(D.summarize({ what: "d3ntist", notes: nm, startIso: WHEN }, who), null, who + " d3ntist " + nm);
    }
  }
});

test("r41 benign ampersand rows show and separator swaps stay on normal rows", () => {
  const D = boot().HouseEventDisplay;
  for (const what of ["Q&A; then lunch", "R&D; sync", "P&L; review", "&bogus;", "&amp;amp; team lunch"]) {
    for (const who of ["ainsley", "shared", "hub"]) {
      assert.equal(D.summarize({ what: what, startIso: WHEN }, who), null, who + " " + what);
    }
    const dad = D.summarize({ what: what, startIso: WHEN }, "dan");
    assert.equal(dad && dad.title, what.replace(/&amp;amp;/, "&"), what);
  }
  for (const note of ["H4 yes", "H-4-yes", "H.4.y.e.s", "Harr 1s", "Ha y3s", "H4_yes", "Harr1-s"]) {
    assert.equal(D.summarize({ what: "Pack snacks", notes: note, startIso: WHEN }, "ainsley"), null, note);
  }
});

test("r41 a name no longer shows an appointment; the private flag still does", () => {
  const D = boot().HouseEventDisplay;
  const show = { extendedProperties: { private: { "wardos.show": "1" } } };
  assert.equal(D.summarize({ what: "Hayes soccer", startIso: "2026-11-12T18:00:00-06:00" }, "ainsley").title, "Soccer");
  assert.equal(D.summarize({ what: "Ainsley dentist", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Dentist", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, "hub"), null);
  const flagged = D.summarize(Object.assign({ what: "Appointment", startIso: WHEN }, show), "ainsley");
  assert.equal(flagged.title, "Appointment");
  assert.match(flagged.time, /10:30/);
  assert.equal(D.summarize({ what: "Hayes appointment", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Ainsley Hayes dentist", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize(Object.assign({ what: "Hayes dentist", startIso: WHEN }, show), "hub"), null);
  assert.equal(D.summarize({ what: "Dan dentist", startIso: WHEN }, "dan"), null);
  assert.equal(D.summarize({ what: "Dad session", startIso: WHEN }, "dad"), null);
  assert.equal(D.summarize({ what: "Dan dentist", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "appoint ment", startIso: WHEN }, "shared"), null);
  assert.equal(D.summarize({ what: "Ainsley OT", notes: "speech", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Ainsley dentist", notes: "room 2", startIso: WHEN }, "hub"), null);
});
