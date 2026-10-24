/* DATA1 P0-1 · "<kid> — LKMS raffle / donation / due" and "<kid> — <school> <notice>" are school rows, and an all-day
   item that overlaps Dad's span (starts at midnight, span starts 3:00) is kept, not dropped by a start-only check. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
test("all-day raffle note on the span's first day is a school row for that kid and Dad", () => {
  const w = W();
  assert.ok(rows(w, "ainsley", "school").some((r) => /raffle donation due/.test(r.what) && /All day/.test(r.when)), JSON.stringify(rows(w, "ainsley", "school")));
  assert.ok(rows(w, "dan", "week").some((r) => /Ainsley school raffle/.test(r.what)), "Dad week has the raffle");
  assert.ok(!rows(w, "dan", "week").some((r) => /LKMS/.test(r.what)), "school word law");
});
test("'<kid> — <school> <notice>' is a school row", () => {
  assert.ok(rows(W(), "hayes", "school").some((r) => /book order due/.test(r.what)));
});
