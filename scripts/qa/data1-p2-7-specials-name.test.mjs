/* DATA1 P2-7 · Dad's specials rows say whose they are. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
test("one-kid specials rows on Dad's week carry the kid name", () => {
  const sp = rows(W(), "dan", "week").filter((r) => /specials/.test(r.what));
  assert.ok(sp.length >= 10);
  for (const r of sp) assert.match(r.what, /^(Harris|Hayes) /, r.what);
});
