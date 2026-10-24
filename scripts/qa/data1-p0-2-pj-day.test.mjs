/* DATA1 P0-2 · PJ / costume / spirit days show and are school; colour days stay markers with no wear prompt. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
test("PJ day is a school row (Ainsley, Dad week)", () => {
  const w = W();
  assert.ok(rows(w, "ainsley", "school").some((r) => /PJ day/.test(r.what)), JSON.stringify(rows(w, "ainsley", "school")));
  assert.ok(rows(w, "dan", "week").some((r) => /PJ day/.test(r.what)));
});
test("costume day is a school row for its kid", () => {
  assert.ok(rows(W(), "hayes", "school").some((r) => /costume parade/.test(r.what)));
});
test("colour day: no board row and no wear prompt anywhere", () => {
  const all = texts(W().kids).join("\n");
  assert.doesNotMatch(all, /Orange Day|wear orange/i);
});
