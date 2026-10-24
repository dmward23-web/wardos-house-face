import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const s = fs.readFileSync(new URL("../lh.js", import.meta.url), "utf8");
test("MOON1: wall clock moon is pinned over the plate's painted moon (one moon)", () => {
  assert.match(s, /else \{ var a = P\(260, 91\);\s+\/\* MOON1/);
  assert.doesNotMatch(s, /P\(320 \+ 280 \* t/);
});
