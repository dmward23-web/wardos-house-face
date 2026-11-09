/* Acer UT272 wall lock. Column is 130. 12*130 + 11*24 + 2*48 = 1920. Usable 1824x984. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  assert.match(css, /width: 1824px !important/);
  assert.match(css, /height: 96px !important/);
  assert.match(css, /width: 900px !important/);
  assert.match(css, /height: 864px !important/);
  assert.match(css, /width: 438px !important/);
  assert.match(css, /height: 420px !important/);
  assert.match(css, /left: 972px !important/);
  assert.match(css, /left: 1434px !important/);
  assert.match(css, /top: 612px !important/);
  assert.match(css, /object-fit: none !important/);
  assert.match(css, /background-size: auto !important/);
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
    const fullBleed = /\/wall-(?:dusk|morning|night)\.webp$/.test(name) || /bg-wall/.test(name) || /loop-.*wall\.webp$/.test(name);
    const windowArt = /hub-window-(?:dusk|night)-900x864\.webp$/.test(name);
    const kidTile = /kidtile-(?:ainsley|hayes|harris)-438x420\.webp$/.test(name);
    const required = fullBleed ? "1920x1080" : windowArt ? "900x864" : kidTile ? "438x420" : null;
    const want = required && /^(\d+)x(\d+)/.exec(required);
    assets.push({
      path: name,
      bytes: buf.length,
      width: d && d.w,
      height: d && d.h,
      required,
      offSpec: !!(want && d && (d.w !== Number(want[1]) || d.h !== Number(want[2])))
    });
  }
  const named = (fs.readFileSync(path.join(ROOT, "sheet-index.html"), "utf8").match(/data-asset="([^"]+)"/) || [, ""])[1].split("|").filter(Boolean);
  for (const rel of named) {
    if (!fs.existsSync(path.join(ROOT, rel))) assets.push({ path: rel, bytes: 0, width: null, height: null, required: "1920x1080", offSpec: true, missing: true });
  }
  const py = spawnSync("python3", ["scripts/qa/acer_wall_probe.py"], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  assert.equal(py.status, 0, py.stderr || py.stdout);
  const layout = JSON.parse(py.stdout.trim().split("\n").pop());
  const added = [
    "month-theme/hub/kidtile-ainsley-438x420.webp",
    "month-theme/hub/kidtile-hayes-438x420.webp",
    "month-theme/hub/kidtile-harris-438x420.webp",
    "month-theme/november/hub-window-dusk-900x864.webp",
    "month-theme/november/hub-window-night-900x864.webp",
    "assets/icons/home-key.svg",
    "assets/icons/home-key-dark.svg",
    "assets/icons/home-key-light.svg",
    "assets/icons/home-key-64.png",
    "assets/icons/home-key-dark-64.png",
    "assets/icons/home-key-light-64.png"
  ];
  const sha256 = added.map((rel) => {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    return crypto.createHash("sha256").update(buf).digest("hex") + "  " + rel;
  });
  const report = {
    commit: "see suite log",
    spec: { canvas: "1920x1080", margin: 48, gutter: 24, columns: 12, columnPx: 130, usable: "1824x984", spans: { 2: 284, 3: 438, 4: 592, 6: 900 } },
    layout,
    pendingArt: [{ slot: "roster-dad", rect: "438x420 at 1434,612", note: "no art yet; clean UI tile" }],
    sha256,
    assets,
    offSpecAssets: assets.filter((a) => a.offSpec).map((a) => a.path + " " + a.width + "x" + a.height + " required " + a.required)
  };
  fs.writeFileSync("/opt/cursor/artifacts/prism-slot-art-sha256.txt", sha256.join("\n") + "\n");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  assert.equal(layout.panel.w, 1920);
  assert.equal(layout.panel.h, 1080);
  assert.equal(layout.scroll, 1080);
  assert.equal(layout.bg, "auto");
  assert.ok(layout.icon.w >= 64 && layout.icon.h >= 64, JSON.stringify(layout.icon));
  const slot = (name, x, y, w, h) => {
    const b = layout.slots[name];
    assert.deepEqual(b, { x, y, w, h }, name + " " + JSON.stringify(b));
  };
  slot("header", 48, 48, 1824, 96);
  slot("window", 48, 168, 900, 864);
  slot("ainsley", 972, 168, 438, 420);
  slot("hayes", 1434, 168, 438, 420);
  slot("harris", 972, 612, 438, 420);
  slot("dad", 1434, 612, 438, 420);
  assert.equal(layout.tiles.length, 4, JSON.stringify(layout.tiles));
  assert.equal(layout.windowImg.naturalW, 900);
  assert.equal(layout.windowImg.naturalH, 864);
  assert.equal(layout.windowImg.cssW, 900);
  assert.equal(layout.windowImg.cssH, 864);
  assert.match(layout.kidArt, /kidtile-ainsley-438x420\.webp/);
  assert.equal(layout.dadArt, "none");
  assert.ok(report.pendingArt.length === 1);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "month-theme/month-overlay.js"), "utf8"), /40x40|leaf-[^"']*-40/);
});
