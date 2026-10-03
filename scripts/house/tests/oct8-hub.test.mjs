/* OCT8 · hub dead ends: the key box never opens by itself, the preview never fakes a save,
   All On / All Off without a key open the key box, the hub jar tile opens the jar explainer. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
test("OCT8-1: hub-key-entry has no load-time open (no timer opens the box, no DOMContentLoaded opener)", () => {
  const s = read("hub-key-entry.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(s, /setTimeout\(\s*openBox/);
  assert.doesNotMatch(s, /autoOpen/);
  assert.match(s, /addEventListener\("click"[\s\S]*openBox\(\)/, "opens on a tap that needs the key");
});
test("OCT8-3c: in the preview the key box says read only and Save does nothing", () => {
  const s = read("hub-key-entry.js");
  assert.match(s, /WARDOS_PREVIEW/); assert.match(s, /read only/);
  assert.match(s, /if \(ro\) return;/);
});
test("OCT8-3a: All On / All Off with no key open the key box", () => {
  const s = read("house-lights.js");
  assert.match(s, /function needKeyBox\(\)[\s\S]*WardHubKeyEntry\.open\(\)/);
  assert.equal((s.match(/if \(needKeyBox\(\)\) return;/g) || []).length, 2);
});
test("OCT8-3b: the hub jar tile opens #jar-rules", () => {
  const s = read("sheet-index.html");
  assert.match(s, /closest\("\[data-house-jar\]"\)[\s\S]*location\.hash = "jar-rules"/);
  assert.match(s, /id="jar-rules"/);
});
