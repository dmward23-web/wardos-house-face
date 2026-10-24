/* DATA1 P1-4 · any kid's appointment, generic and Dad items on Dad's week, Dad flights as travel leaves, and every
   kid gets an upcoming list. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts, refresh } from "./data1-lib.mjs";
test("Dad week carries dentist, party, tutor, pack night, HOA, grocery and the flight", () => {
  const wk = rows(W(), "dan", "week").map((r) => r.when + " | " + r.what).join("\n");
  for (const re of [/Wed 28 · 7:40 \| Hayes dentist/, /Sat 24 · 3:15 \| Hayes Smith's 9th birthday party/, /Ainsley & Mrs\. Jones/, /Thu 29 · 7:40 \| pack sports/, /Large Item Pickup/, /Grocery curbside/, /Fri 30 · 9:00 \| .*flight MCI/])
    assert.match(wk, re);
});
test("Hayes dentist is an appointment on his board", () => {
  assert.ok(rows(W(), "hayes", "appointments").some((r) => /dentist/.test(r.what)));
});
test("the flight is a leave-by in Next Up", () => {
  const q = refresh(null, "2026-10-30T08:30:00-05:00").boardStrip.queue;
  assert.ok(q.some((x) => /flight MCI/.test(x.place) && x.leaveBy && x.kind === "leave"), JSON.stringify(q.map((x) => x.place)));
  assert.ok(!q.some((x) => /Grocery|pack sports/.test(x.place)), "household items stay off Next Up");
});
test("each kid has an upcoming list with his own rows", () => {
  const w = W();
  assert.ok(rows(w, "hayes", "upcoming").some((r) => /dentist/.test(r.what)));
  assert.ok(rows(w, "hayes", "upcoming").some((r) => /birthday party/.test(r.what)));
  assert.ok(rows(w, "harris", "upcoming").some((r) => /Halloween parade/.test(r.what)));
  assert.ok(rows(w, "ainsley", "upcoming").some((r) => /Mrs\. Jones/.test(r.what)));
  assert.ok(!rows(w, "hayes", "upcoming").some((r) => /flight MCI|Large Item/.test(r.what)), "no Dad-only rows");
});
