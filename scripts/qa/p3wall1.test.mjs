/* P3WALL1 · wall.html never shows an empty black middle: the in-git still poster is the plate whenever the loop video is held or missing (LHVID1 parity with night/scene.html) */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const W = fs.readFileSync(path.join(ROOT, "wall.html"), "utf8");
test("wall.html has the poster fallback and the poster files exist in git", () => {
  assert.match(W, /function poster\(n\)/); assert.match(W, /function imOk\(i\)/);
  assert.match(W, /const base=vR\?V:PN/, "bgCompose draws the poster when the video is not ready");
  assert.match(W, /pi\.addEventListener\('load',ok/, "the poster starts the scene");
  for (const m of ["wall", "phone"]) assert.ok(fs.existsSync(path.join(ROOT, `night/media/poster/v52-loop-${m}.webp`)), m);
});
test("wall.html still sets no mp4 src until caps.json says video:true", () => { assert.match(W, /if\(j&&j\.video===true\)\{WOK=true/); });
