/* Home pins M1-M9. Each mutation must fail the pins. The unmutated source passes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const homeSrc = fs.readFileSync(path.join(ROOT, "house-home.js"), "utf8");
const worldSrc = fs.readFileSync(path.join(ROOT, "kid-world.js"), "utf8");
const savesSrc = fs.readFileSync(path.join(ROOT, "house-saves.js"), "utf8");

function pins(home, world, saves) {
  const paint = home.slice(home.indexOf("function paint"), home.indexOf("function mount"));
  const box = paint.slice(paint.indexOf("var box = {"), paint.indexOf("};"));
  assert.match(box, /left: "48px"/);
  assert.match(box, /top: "48px"/);
  assert.match(box, /width: "96px"/);
  assert.match(box, /height: "96px"/);
  assert.equal(home.split("\n")[21].trim(), 'btn.classList.add("wardos-home");');
  assert.doesNotMatch(box, /2147483646/);
  assert.doesNotMatch(world, /kw-home wardos-home/);
  assert.match(world, /document\.write\('<script src="house-home\.js/);
  assert.doesNotMatch(saves, /saves-home/);
}

function boxSwap(src, key, value) {
  const start = src.indexOf("var box = {");
  const end = src.indexOf("};", start);
  const box = src.slice(start, end).replace(new RegExp("(^|[^\\w-])" + key + ': "\\d+px"'), "$1" + key + ': "' + value + '"');
  return src.slice(0, start) + box + src.slice(end);
}

const MUT = {
  M1: (h, w) => [h.replace('btn.classList.add("wardos-home");', 'btn.classList.add("hub-home");'), w],
  M2: (h, w) => [boxSwap(h, "left", "0px"), w],
  M3: (h, w) => [boxSwap(h, "top", "0px"), w],
  M4: (h, w) => [boxSwap(h, "width", "64px"), w],
  M5: (h, w) => [boxSwap(h, "height", "64px"), w],
  M6: (h, w) => [h, w.replace('src="house-home.js?v=R58HOME"', 'src="house-gone.js?v=R58HOME"')],
  M7: (h, w) => [h.replace('"z-index": "30000000000"', '"z-index": "2147483646"'), w],
  M8: (h, w) => [boxSwap(boxSwap(boxSwap(boxSwap(h, "left", "0px"), "top", "0px"), "width", "0px"), "height", "0px"), w],
  M9: (h, w) => {
    const lines = h.split("\n");
    lines.splice(21, 0, "    /* moved */");
    return [lines.join("\n"), w];
  },
};

test("unmutated home pins pass", () => {
  pins(homeSrc, worldSrc, savesSrc);
});

for (const id of Object.keys(MUT)) {
  test(id + " fails the home pins", () => {
    const [home, world] = MUT[id](homeSrc, worldSrc);
    assert.throws(() => pins(home, world, savesSrc), id);
  });
}
