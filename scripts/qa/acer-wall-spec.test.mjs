/* Acer UT272 wall lock. Reports asset sizes. Does not resize art.
   Column math: 12*130 + 11*24 + 2*48 = 1920. The spec line "column = 133" does not fit. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = "/opt/cursor/artifacts/acer-wall-spec.json";

function dims(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: "png" };
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const four = buf.toString("ascii", 12, 16);
    if (four === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), kind: "webp" };
    if (four === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, kind: "webp" };
    if (four === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, kind: "webp" };
    }
  }
  return null;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(png|webp)$/i.test(e.name)) out.push(p);
  }
  return out;
}

test("Acer wall lock stylesheet is one 1920x1080 canvas and does not crop full-bleed art", () => {
  const css = fs.readFileSync(path.join(ROOT, "wall-acer-lock.css"), "utf8");
  const hub = fs.readFileSync(path.join(ROOT, "sheet-index.html"), "utf8");
  assert.match(hub, /wall-acer-lock\.css\?v=ACER1/);
  assert.match(css, /width: 1920px !important/);
  assert.match(css, /height: 1080px !important/);
  assert.match(css, /repeat\(12, 130px\)/);
  assert.match(css, /padding: 48px !important/);
  assert.match(css, /column-gap: 24px !important/);
  assert.match(css, /object-fit: none/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.doesNotMatch(css, /@media/);
});

test("Acer wall spec report lists asset dimensions and does not resize them", { skip: process.env.QA_NO_BROWSER === "1" ? "SKIP QA_NO_BROWSER=1" : false }, async () => {
  const assets = [];
  const dirs = ["month-theme", "backgrounds", "night/media/poster", "assets"].map((d) => path.join(ROOT, d));
  for (const rel of dirs.flatMap((d) => walk(d))) {
    const buf = fs.readFileSync(rel);
    const d = dims(buf);
    const name = path.relative(ROOT, rel);
    const fullBleed = /wall\.webp$/.test(name) || /bg-wall/.test(name);
    const windowArt = /hub-window-/.test(name);
    const required = fullBleed ? "1920x1080" : (windowArt ? "1920x1080 full-bleed or exact slot, not scaled" : null);
    assets.push({
      path: name,
      bytes: buf.length,
      width: d && d.w,
      height: d && d.h,
      required,
      offSpec: !!(d && required && (d.w !== 1920 || d.h !== 1080))
    });
  }
  const named = (fs.readFileSync(path.join(ROOT, "sheet-index.html"), "utf8").match(/data-asset="([^"]+)"/) || [, ""])[1].split("|").filter(Boolean);
  for (const rel of named) {
    if (!fs.existsSync(path.join(ROOT, rel))) assets.push({ path: rel, bytes: 0, width: null, height: null, required: "1920x1080", offSpec: true, missing: true });
  }
  const py = spawnSync("python3", ["scripts/qa/acer_wall_probe.py"], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  assert.equal(py.status, 0, py.stderr || py.stdout);
  const layout = JSON.parse(py.stdout.trim().split("\n").pop());
  const report = {
    commit: "see suite log",
    spec: { canvas: "1920x1080", margin: 48, gutter: 24, columns: 12, columnPx: 130, columnNote: "spec text says 133; 133 does not fit 1920 with 48px margins and 24px gutters" },
    layout,
    assets,
    offSpecAssets: assets.filter((a) => a.offSpec).map((a) => a.path + " " + a.width + "x" + a.height + " required " + a.required)
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  assert.equal(layout.panel.w, 1920);
  assert.equal(layout.panel.h, 1080);
  assert.equal(layout.scroll, 1080);
  assert.equal(layout.panel.pad, "48px");
  assert.equal(layout.panel.colGap, "24px");
  assert.equal(layout.bg, "auto");
  assert.equal(layout.icon.w, 64);
  assert.equal(layout.icon.h, 64);
  assert.ok(layout.tiles.length >= 9);
  assert.ok(layout.tiles.every((t) => t.w === 592 && t.h === 120 && t.font >= 24), JSON.stringify(layout.tiles));
  assert.deepEqual(layout.smallText, []);
  assert.deepEqual(layout.safe, []);
  assert.deepEqual(layout.smallHit, []);
});
