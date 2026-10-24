/* DATA1 P2-10 · the builder strips Ainsley's stars, star counts, dollar amounts, rates and streak. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
test("no star, dollar, rate or streak on Ainsley's feed", () => {
  const a = W().kids.ainsley;
  assert.equal(a.streakLabel, undefined);
  const all = texts(a).join("\n");
  assert.doesNotMatch(all, /[\u2605\u2606\u2b50]|\$\s*\d|\/hr\b|\bstreak|\bstars?\b/i, all);
  assert.ok(rows(W(), "ainsley", "upcoming").some((r) => /swim/.test(r.what)), "swim row kept");
});
