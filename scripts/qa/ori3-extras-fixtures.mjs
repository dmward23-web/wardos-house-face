/* ORI3 · SKINX extras QA fixtures, generated at test time into a temp dir (no image files in the repo, no Prism art
   copied). Shaped like Prism's extras/ drop (README layout): <dir><kid>/<s>x/<name>.png, <dir><kid>/anchors-extras.json,
   <dir>fx/<s>x/<name>.png, <dir>fx/fx.json, plus a stand-in base skin (<base><kid>/<s>x/<state>.png, eyes, anchors.json)
   so the extras sit on a worn hero. ORIX2 · shaped like the r3 drop: body layers are cropped (anchors-extras.json
   layers.<name>.offset1x, shine / rim per state as { name, offset1x, size1x }), sweep-happy-1..6 for the happy pose, and
   fx.json lists notWired (pebble-today, drop, grow-cream) with an unwired grow-cream entry, all present as files so the
   tests prove they are never requested. opts.drop = [relative paths to leave out],
   opts.bad = [relative paths written as a non-PNG], opts.baseDrop = base skin files to leave out. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

export const STATES = ["idle", "squash", "stretch", "fall", "roll-1", "roll-2", "happy", "sleep", "peek", "full"];
const EYES = ["open", "half", "closed", "happy"];
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(t, d) { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
export function png(w, h, rgba) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4).fill(Buffer.from(rgba))]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}
export const KIDLAYERS = [...STATES.flatMap((s) => [`shadow-${s}`, `shine-${s}`, `rim-${s}`]), "breathe-1", "breathe-2", "breathe-3", "breathe-4", ...[1, 2, 3, 4, 5, 6].map((i) => `sweep-${i}`), ...[1, 2, 3, 4, 5, 6].map((i) => `sweep-happy-${i}`)];
export const OFF = [3, 5]; /* ORIX2 · every fixture body layer is cropped and sits at offset1x [3, 5] in the 20 x 24 body canvas */
export const FXLAYERS = [
  ...[1, 2, 3, 4, 5, 6].map((i) => `grow-${i}`), ...[1, 2, 3, 4, 5, 6].map((i) => `grow-cream-${i}`), "grow-sheet",
  "pebble-empty", "pebble-filled", "pebble-today-1", "pebble-today-2", "pebble-today-3",
  ...[1, 2, 3, 4].map((i) => `drop-${i}`), ...[1, 2, 3, 4, 5, 6].map((i) => `splash-${i}`), "wings", ...[1, 2, 3, 4].map((i) => `motes-${i}`)
];
export const FXJSON = {
  notWired: ["pebble-today-1", "pebble-today-2", "pebble-today-3", "drop-1", "drop-2", "drop-3", "drop-4", "grow-cream-1", "grow-cream-2", "grow-cream-3", "grow-cream-4", "grow-cream-5", "grow-cream-6", "grow-cream-sheet"],
  grow: { frames: 6, canvas3x: 1024, pivot3x: [512, 512], sheet: "grow-sheet", variants: { cream: { prefix: "grow-cream-", frames: 6, blend: "normal" } } },
  pebble: { canvas3x: 384, pivot3x: [192, 198], states: ["pebble-empty", "pebble-filled", "pebble-today-1..3"] },
  drop: { canvas3x: 768, pivot3x: [384, 640], frames: 4 },
  splash: { canvas3x: 768, pivot3x: [384, 560], frames: 6 },
  wings: { canvas3x: 768, pivot3x: [384, 430] },
  motes: { canvas3x: 768, pivot3x: [384, 384], frames: 4 }
};
const ANX = {
  bodyR: 8,
  crop: "every layer here is cropped to its alpha bounding box; draw it at offset1x inside the body canvas",
  shine: Object.fromEntries(STATES.map((s) => [s, { name: `shine-${s}`, offset1x: OFF, size1x: [14, 16] }])),
  rim: Object.fromEntries(STATES.map((s) => [s, { name: `rim-${s}`, offset1x: OFF, size1x: [14, 16] }])),
  shadow: Object.fromEntries(STATES.map((s) => [s, { name: `shadow-${s}`, center3x: [30, 70], radius3x: [12, 3], offset1x: OFF, size1x: [14, 16] }])),
  breathe: [1, 1.012, 1.022, 1.012].map((y, i) => ({ name: `breathe-${i + 1}`, scaleY: y, contact: [10, 24], eyes: [13, 8 - i * 0.2], accessory: [10, 4], feather: [9, 3], offset1x: OFF, size1x: [14, 16] })),
  sweep: { idle: { prefix: "sweep-", frames: 6, pose: "idle" }, happy: { prefix: "sweep-happy-", frames: 6, pose: "happy" } },
  layers: Object.fromEntries(KIDLAYERS.map((n) => [n, { offset1x: OFF, size1x: [14, 16] }]))
};
export const BASE = "art/mercury/skins/qa-x3/";
export const EXTRAS = "art/mercury/skins/qa-x3/extras/";
export { ANX };
export function makeExtras(opts = {}) {
  const drop = new Set(opts.drop || []), bad = new Set(opts.bad || []), baseDrop = new Set(opts.baseDrop || []);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ori3-extras-"));
  const put = (rel, buf) => { if (drop.has(rel)) return; const f = path.join(root, EXTRAS, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bad.has(rel) ? "not a png" : buf); };
  for (const kid of ["hayes", "harris", "ainsley"]) {
    const d = path.join(root, BASE, kid);
    for (const s of [1, 2, 3]) {
      fs.mkdirSync(path.join(d, `${s}x`), { recursive: true });
      for (const st of STATES) if (!baseDrop.has(`${kid}/${s}x/${st}.png`)) fs.writeFileSync(path.join(d, `${s}x`, `${st}.png`), png(20 * s, 24 * s, [200, 120, 60, 255]));
      for (const e of EYES) fs.writeFileSync(path.join(d, `${s}x`, `eyes-${e}.png`), png(6 * s, 3 * s, [20, 20, 20, 255]));
      for (const n of KIDLAYERS) put(`${kid}/${s}x/${n}.png`, png(14 * s, 16 * s, [128, 128, 128, 200]));
    }
    fs.writeFileSync(path.join(d, "anchors.json"), JSON.stringify({ bodyR: 8, states: Object.fromEntries(STATES.map((st) => [st, { contact: [10, 24], eyes: [13, 8] }])) }));
    const ax = path.join(root, EXTRAS, kid, "anchors-extras.json");
    if (!drop.has(`${kid}/anchors-extras.json`)) { fs.mkdirSync(path.dirname(ax), { recursive: true }); fs.writeFileSync(ax, bad.has(`${kid}/anchors-extras.json`) ? "{ broken" : JSON.stringify(ANX)); }
  }
  for (const s of [1, 2, 3]) for (const n of FXLAYERS) put(`fx/${s}x/${n}.png`, png(12 * s, 12 * s, [190, 190, 190, 220]));
  const fj = opts.fxjson || FXJSON;
  if (opts.anx) for (const kid of ["hayes", "harris", "ainsley"]) { const ax = path.join(root, EXTRAS, kid, "anchors-extras.json"); fs.writeFileSync(ax, JSON.stringify(opts.anx)); }
  if (!drop.has("fx/fx.json")) { const f = path.join(root, EXTRAS, "fx/fx.json"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bad.has("fx/fx.json") ? "{ broken" : JSON.stringify(fj)); }
  const book = { "2026-11": { id: "turkey", dir: BASE, extras: opts.noExtrasKey ? undefined : EXTRAS, from: { civil: "2026-11-01", hour: 6 } } };
  if (opts.noExtrasKey) delete book["2026-11"].extras;
  return { root, book, rm: () => fs.rmSync(root, { recursive: true, force: true }) };
}
