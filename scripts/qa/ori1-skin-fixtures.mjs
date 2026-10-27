/* ORI1 · SKIN1 QA fixtures, generated at test time into a temp dir (no image files in the repo; the privacy hook
   rightly refuses unlisted images). Solid-colour stand-in PNGs in the Prism p2 skin layout:
     <dir><kid>/<state>@<s>x.png, eyes-<e>@<s>x.png, anchors.json, optional finale@<s>x.png
   hayes = complete with finale; harris = complete, no finale; ainsley = missing "sleep" (must fall back to the blob).
   Never served to kids: the harness resolves these only inside the vm. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

export const SKIN_STATES = ["idle", "squash", "stretch", "fall", "roll-1", "roll-2", "happy", "sleep", "peek", "full"];
export const SKIN_EYES = ["open", "half", "closed", "happy"];
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(t, d) { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function png(w, h, rgba) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4).fill(Buffer.from(rgba))]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}
export const FIXDIR = "qa-skins/2026-11/";
export function makeSkinFixtures() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ori1-skin-"));
  const col = { hayes: [200, 120, 60, 255], harris: [110, 130, 50, 255], ainsley: [220, 100, 130, 255] };
  for (const kid of Object.keys(col)) {
    const d = path.join(root, FIXDIR, kid); fs.mkdirSync(d, { recursive: true });
    for (const s of [1, 2, 3]) {
      for (const st of SKIN_STATES) if (!(kid === "ainsley" && st === "sleep")) fs.writeFileSync(path.join(d, `${st}@${s}x.png`), png(20 * s, 24 * s, col[kid]));
      for (const e of SKIN_EYES) fs.writeFileSync(path.join(d, `eyes-${e}@${s}x.png`), png(6 * s, 3 * s, [20, 20, 20, 255]));
      if (kid === "hayes") fs.writeFileSync(path.join(d, `finale@${s}x.png`), png(64 * s, 36 * s, [250, 220, 150, 255]));
    }
    fs.writeFileSync(path.join(d, "anchors.json"), JSON.stringify({ bodyR: 8, states: Object.fromEntries(SKIN_STATES.map((st) => [st, { contact: [10, 24], eyes: [13, 8] }])) }));
  }
  return root;
}
