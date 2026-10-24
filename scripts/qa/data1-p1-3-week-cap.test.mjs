/* DATA1 P1-3 · Dad's week has no 24-row cap (Fri 10/30 was cut off) and always ends with one neutral closing row. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
test("Dad week reaches Fri 30 afternoon and ends with a closing row", () => {
  const wk = rows(W(), "dan", "week");
  assert.ok(wk.length > 24, "more than 24 rows: " + wk.length);
  assert.ok(wk.some((r) => /^Fri 30/.test(r.when) && /Halloween parade/.test(r.what)), "Fri 30 parade present");
  assert.equal(wk.filter((r) => r.closing).length, 1);
  assert.ok(wk[wk.length - 1].closing, "closing row is last");
});
