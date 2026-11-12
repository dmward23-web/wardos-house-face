/* Round 43. Kid, shared, and calendar views are allowlist-only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boot, runMatrix } from "./acer-r42.test.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WHEN = "2026-11-12T22:30:00-06:00";
const LOCKED = ["ainsley", "hayes", "harris", "shared", "hub"];
const HEALTH = ["H4 yes checkup", "Harr 1s checkup", "H@yes checkup", "checkup", "physical", "eye exam", "clinic", "psych eval", "ABA", "flu shot", "labs", "urgent care", "ER", "Mtg w/ Randy", "tutoring w/ Ms. B", "checkup drop off"];
const ADULT = ["Venmo Erin", "Mortgage due", "Lawyer call", "Bar with Mike", "Date night", "Pay child support", "Wells transfer 2000 dollars"];
const FIELDS = ["location", "notes", "description", "eventType"];

function lawBoot() {
  const ctx = {
    Intl, Date, decodeURIComponent, WeakSet,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-event-display.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8"), ctx);
  return ctx;
}

test("r43 the r42 matrix still leaks nothing", () => {
  const out = runMatrix(boot());
  assert.equal(out.total.leaks, 0, "leaks " + out.total.leaks);
});

test("r43 health, money, and adult titles stay off the locked views", () => {
  const D = boot();
  for (const what of HEALTH) {
    for (const who of LOCKED.concat(["dan"])) {
      assert.equal(D.summarize({ what, startIso: WHEN }, who), null, who + " " + what);
    }
  }
  for (const what of ADULT) {
    for (const who of LOCKED) assert.equal(D.summarize({ what, startIso: WHEN }, who), null, who + " " + what);
    const dad = D.summarize({ what, startIso: WHEN }, "dan");
    assert.equal(dad && dad.title, what, "dad " + what);
  }
  assert.equal(D.summarize({ what: "Soccer", location: "checkup", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Swim", attendees: [{ displayName: "dentist-token" }], startIso: WHEN }, "hub"), null);
  assert.equal(D.summarize({ what: "Homework", organizer: { displayName: "therapy-token" }, startIso: WHEN }, "shared"), null);
  assert.equal(D.summarize({ what: "Choir", extendedProperties: { shared: { note: "clinic" } }, startIso: WHEN }, "hayes"), null);
  assert.equal(D.summarize({ what: "Raffle", conferenceData: { notes: "ER visit" }, startIso: WHEN }, "harris"), null);
  for (const field of FIELDS) {
    const row = { what: "Art club", startIso: WHEN };
    row[field] = "flu shot";
    assert.equal(D.summarize(row, "ainsley"), null, field);
  }
  const marked = D.summarize({ what: "Hayes dentist", notes: "Harris", description: "#wardos-show", startIso: WHEN }, "hub");
  assert.equal(marked && marked.title, "Appointment");
  assert.equal(D.summarize({ what: "Hayes soccer", startIso: WHEN }, "ainsley").title, "Soccer");
  for (const label of ["Swim", "Homework", "Conference", "Field trip", "Art club", "Choir", "Raffle", "Book order", "Donation", "HOA", "Picture day", "No school"]) {
    assert.equal(D.summarize({ what: label, startIso: WHEN }, "shared").title, label);
  }
  assert.equal(D.summarize({ what: "school pickup", startIso: WHEN }, "ainsley").title, "School pickup");
  assert.equal(D.summarize({ what: "school drop", startIso: WHEN }, "hayes").title, "School drop");
});

test("r43 a scrubbed payload keeps only allowlisted labels", () => {
  const ctx = lawBoot();
  const D = ctx.HouseEventDisplay;
  const data = {
    kids: {
      ainsley: { today: [
        { what: "H4 yes checkup", who: "Hayes Ward", kidName: "Harris Ward", htmlLink: "https://example.test/secret-link-token", startIso: WHEN },
        { what: "Venmo Erin", startIso: WHEN },
        { what: "Hayes soccer", startIso: WHEN },
        { what: "Hayes therapy", description: "#wardos-show", who: "Hayes Ward", startIso: WHEN }
      ] },
      dan: { today: [{ what: "Pay child support", startIso: WHEN }, { what: "Mortgage due", startIso: WHEN }] }
    }
  };
  ctx.HouseFaceLaw.cleanKidsWeek(data);
  const blob = JSON.stringify(data);
  for (const banned of ["H4", "checkup", "Venmo", "Hayes", "Harris", "therapy", "Pay child", "Mortgage", "secret-link-token", "kidName", "htmlLink"]) {
    assert.equal(blob.includes(banned), false, banned);
  }
  assert.match(blob, /Soccer/);
  assert.match(blob, /Appointment/);
  const labels = new Set(D.LABELS);
  for (const row of data.kids.ainsley.today) assert.equal(labels.has(row.what), true, row.what);
  for (const row of data.kids.dan.today) assert.equal(labels.has(row.what), true, row.what);
});
