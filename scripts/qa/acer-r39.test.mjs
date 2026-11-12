/* Round 39. Synthetic names only. No clinical text. */
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

const RI = {
  h: "\u{1F1ED}", a: "\u{1F1E6}", y: "\u{1F1FE}", e: "\u{1F1EA}", s: "\u{1F1F8}", r: "\u{1F1F7}", i: "\u{1F1EE}"
};
const NEG = {
  h: "\u{1F177}", a: "\u{1F170}", y: "\u{1F188}", e: "\u{1F174}", s: "\u{1F182}", r: "\u{1F181}", i: "\u{1F178}"
};
const SQ = {
  h: "\u{1F137}", a: "\u{1F130}", r: "\u{1F141}", i: "\u{1F138}", s: "\u{1F142}", y: "\u{1F148}", e: "\u{1F134}"
};

test("r39 disguised appointment names are dropped", () => {
  const ctx = boot();
  const D = ctx.HouseEventDisplay;
  const Law = ctx.HouseFaceLaw;
  const rows = [
    { what: "Appointment", notes: "&#72;ayes", startIso: WHEN },
    { what: "Appointment", notes: "Harri&#115;", startIso: WHEN },
    { what: "Appointment", notes: "&#x48;arris", startIso: WHEN },
    { what: "Appointment", notes: "Har&shy;ris", startIso: WHEN },
    { what: "Appointment", notes: "&amp;#72;ayes", startIso: WHEN },
    { what: "Appointment", notes: "Har<wbr>ris", startIso: WHEN },
    { what: "Appointment", notes: "<b>Hay</b>es", startIso: WHEN },
    { what: "Appointment", notes: "Hay%65s", startIso: WHEN },
    { what: "Appointment", htmlLink: "https://example.test/Harri%73", startIso: WHEN },
    { what: "Appointment", notes: RI.h + RI.a + RI.y + RI.e + RI.s, startIso: WHEN },
    { what: "Appointment", notes: NEG.h + NEG.a + NEG.y + NEG.e + NEG.s, startIso: WHEN },
    { what: "Appointment", notes: SQ.h + SQ.a + SQ.r + SQ.r + SQ.i + SQ.s, startIso: WHEN },
    { what: "Appointment", notes: "H4yes", startIso: WHEN },
    { what: "Appointment", notes: "Harr1s", startIso: WHEN },
    { what: "Appointment", notes: "Hay3s", startIso: WHEN },
    { what: "Appointment", notes: "HAYE5", startIso: WHEN },
    { what: "Appointment", notes: "H&#52;yes", startIso: WHEN },
    { what: "Appointment", notes: "<b>Hay</b>%65s", startIso: WHEN },
    { what: "Session", hint: "Har<wbr>ri&#115;", startIso: WHEN },
    { what: "Appointment", who: RI.h + "arris", startIso: WHEN },
    { what: "Appointment", with: "Hay%65s", startIso: WHEN },
    { what: "Appointment", attendees: { "H4yes": 1 }, startIso: WHEN },
    { what: "Appointment", kidName: NEG.h + "arris", startIso: WHEN }
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

test("r39 soccer, a plain appointment, and ordinary digits still render", () => {
  const D = boot().HouseEventDisplay;
  for (const who of WHO) {
    assert.equal(D.summarize({ what: "Appointment", startIso: WHEN }, who).title, "Appointment", who);
    assert.equal(D.summarize({ what: "Appointment", notes: "4:30 PM", room: "4", startIso: WHEN }, who).title, "Appointment", who);
    assert.equal(D.summarize({ what: "Dentist", notes: "room 15", startIso: WHEN }, who).title, "Appointment", who);
  }
  const soccer = D.summarize({ what: "Hayes soccer", startIso: "2026-11-10T18:00:00-06:00" }, "ainsley");
  assert.equal(soccer.title, "Soccer");
  const dated = D.summarize({ what: "Appointment", notes: "2026-11-10", startIso: WHEN }, "dan");
  assert.equal(dated.title, "Appointment");
});
