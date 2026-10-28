/* ORI3 · SKINX extras QA fixtures, generated at test time into a temp dir (no image files in the repo, no Prism art
   copied). Shaped like Prism's extras/ drop (README layout): <dir><kid>/<s>x/<name>.png, <dir><kid>/anchors-extras.json,
   <dir>fx/<s>x/<name>.png, <dir>fx/fx.json, plus a stand-in base skin (<base><kid>/<s>x/<state>.png, eyes, anchors.json)
   so the extras sit on a worn hero. fx.json carries a cream-theme grow variant (grow.variants.cream, frames
   grow-cream-1..6), the shape ORI3 assumes until the r2 fx.json lands. opts.drop = [relative paths to leave out],
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
export const KIDLAYERS = [...STATES.flatMap((s) => [`shadow-${s}`, `shine-${s}`, `rim-${s}`]), "breathe-1", "breathe-2", "breathe-3", "breathe-4", ...[1, 2, 3, 4, 5, 6].map((i) => `sweep-${i}`)];
export const FXLAYERS = [
  ...[1, 2, 3, 4, 5, 6].map((i) => `grow-${i}`), ...[1, 2, 3, 4, 5, 6].map((i) => `grow-cream-${i}`), "grow-sheet",
  "pebble-empty", "pebble-filled", "pebble-today-1", "pebble-today-2", "pebble-today-3",
  ...[1, 2, 3, 4].map((i) => `drop-${i}`), ...[1, 2, 3, 4, 5, 6].map((i) => `splash-${i}`), "wings", ...[1, 2, 3, 4].map((i) => `motes-${i}`)
];
export const FXJSON = {
  grow: { frames: 6, canvas3x: 1024, pivot3x: [512, 512], sheet: "grow-sheet", variants: { cream: { prefix: "grow-cream", frames: 6 } } },
  pebble: { canvas3x: 384, pivot3x: [192, 198], states: ["pebble-empty", "pebble-filled", "pebble-today-1..3"] },
  drop: { canvas3x: 768, pivot3x: [384, 640], frames: 4 },
  splash: { canvas3x: 768, pivot3x: [384, 560], frames: 6 },
  wings: { canvas3x: 768, pivot3x: [384, 430] },
  motes: { canvas3x: 768, pivot3x: [384, 384], frames: 4 }
};
const ANX = {
  bodyR: 8,
  shine: Object.fromEntries(STATES.map((s) => [s, `shine-${s}`])),
  rim: Object.fromEntries(STATES.map((s) => [s, `rim-${s}`])),
  shadow: Object.fromEntries(STATES.map((s) => [s, { name: `shadow-${s}`, center3x: [30, 70], radius3x: [12, 3] }])),
  breathe: [1, 1.012, 1.022, 1.012].map((y, i) => ({ name: `breathe-${i + 1}`, scaleY: y, contact: [10, 24], eyes: [13, 8 - i * 0.2], accessory: [10, 4], feather: [9, 3] })),
  sweep: 6
};
export const BASE = "art/mercury/skins/qa-x3/";
export const EXTRAS = "art/mercury/skins/qa-x3/extras/";
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
      for (const n of KIDLAYERS) put(`${kid}/${s}x/${n}.png`, png(20 * s, 24 * s, [128, 128, 128, 200]));
    }
    fs.writeFileSync(path.join(d, "anchors.json"), JSON.stringify({ bodyR: 8, states: Object.fromEntries(STATES.map((st) => [st, { contact: [10, 24], eyes: [13, 8] }])) }));
    const ax = path.join(root, EXTRAS, kid, "anchors-extras.json");
    if (!drop.has(`${kid}/anchors-extras.json`)) { fs.mkdirSync(path.dirname(ax), { recursive: true }); fs.writeFileSync(ax, bad.has(`${kid}/anchors-extras.json`) ? "{ broken" : JSON.stringify(ANX)); }
  }
  for (const s of [1, 2, 3]) for (const n of FXLAYERS) put(`fx/${s}x/${n}.png`, png(12 * s, 12 * s, [190, 190, 190, 220]));
  const fj = opts.fxjson || FXJSON;
  if (!drop.has("fx/fx.json")) { const f = path.join(root, EXTRAS, "fx/fx.json"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bad.has("fx/fx.json") ? "{ broken" : JSON.stringify(fj)); }
  const book = { "2026-11": { id: "turkey", dir: BASE, extras: opts.noExtrasKey ? undefined : EXTRAS, from: { civil: "2026-11-01", hour: 6 } } };
  if (opts.noExtrasKey) delete book["2026-11"].extras;
  return { root, book, rm: () => fs.rmSync(root, { recursive: true, force: true }) };
}
