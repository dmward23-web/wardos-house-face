/* DATA1 P2-11 · the builder writes no custody wording: not in detail lines, hottest cards, today / week rows, bag
   hints, the fallback strip, homeWeek.throughLabel, or cal-from-events' Dad today. Phrase list mirrors nocustody.test.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, texts } from "./data1-lib.mjs";
const PHRASES = /kids with (?:dad|mom|dan)\b|\b(?:dad|mom)(?:'?s)? weeks?\b|home week|away week|\bcustody\b|\bkids away\b|\btheir week\b|your base with dad|with dad at home|\bdad week\b/i;
test("no custody phrase anywhere in the built week", () => {
  const w = W();
  const hits = texts({ kids: w.kids, boardStrip: w.boardStrip, throughLabel: w.homeWeek.throughLabel }).filter((s) => PHRASES.test(s.replace(/<[^>]*>/g, "")));
  assert.deepEqual(hits, []);
  for (const k of ["harris", "hayes", "ainsley"]) assert.equal(w.kids[k].bag.hint, "Pack the night before");
});
