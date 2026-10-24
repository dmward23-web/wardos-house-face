#!/usr/bin/env node
/* CRITTERS2 + LIVEWX2 (shared with the ambient line: ONE list file, one format) · builds <night-media>/art-halloween-allow.json (the private folder next to art/, never git: PIIGUARD2), the EXACT list (relative path + content sha256) of the
   Prism art the proxy may serve from costumes/, critters/, critters/snd/, overlays/, kidboards/ the REALMOON1 props/moon-* files and the BATCH8 moon/moonphase.js. Never realdata/ (location identifiers) and never demo.html. Input is Prism's own
   SHA256SUMS files (never the art). Only the files and types the pages use are picked; anything else stays unlisted (404).
   Usage: node scripts/art-halloween-allow-gen.mjs <SHA256SUMS.txt> [<more SHA256SUMS> ...] > ~/.local/share/wardos-private/night-media/art-halloween-allow.json */
import fs from "node:fs";
export const USED = [
  /* LIVEWX2 · the halloween1 line: every Prism plate, sign, window, prop and overlay the boards name, exact path + sha256 (Alfred: no shape-only serving) */
  /^(?:backgrounds|signs|signs\/hardware|kidboards|overlays|props|windows|windows\/bgplate|windows\/wall1920|composite|posters)\/[a-z0-9-]+(?:@[23]x)?(?:-[0-9]+x[0-9]+)?(?:-phone@3x)?\.(?:png|webp)$/,
  /^overlays\/[a-z0-9-]+\.(?:mp4|webm)$/,                     /* WGVID3 loops (private folder, behind caps video) */
  /^(?:backgrounds\/porchlight-flicker-curve|props\/porch-lantern-position)\.json$/,
  /^critters\/[a-z0-9-]+@[23]x\.webp$/,                       /* sprites: density by devicePixelRatio, webp only */
  /^critters\/(?:crows|crow-react|witch|owl|bats|cat|sound-cues|sprites)\.json$/,   /* cue specs + manifest */
  /^critters\/snd\/[a-z0-9-]+\.(?:ogg|mp3)$/,                 /* one-shots (ogg, mp3 for Safari) */
  /^overlays\/bats-scatter-(?:wall-1280x720|phone-440x956)(?:\.webm|-poster\.webp)$/,   /* bat scare clip */
  /^overlays\/(?:bats-alpha|fog-alpha|owl-alpha|moths-(?:wall-1280x720|phone-440x956)|fireflies-(?:wall-1280x720|phone-440x956))-poster\.webp$/,
  /^kidboards\/(?:harris|hayes|ainsley)-(?:wall|phone)\.png$/,  /* the plain plates the boards already name */
  /^kidboards\/(?:harris|hayes|ainsley)-(?:wall|phone)-costume\.webp$/,   /* drop-in costume plates */
  /^props\/moon-(?:phase-mask-[0-9]+-[0-9]+|real-disc-[0-9]+|face-1024)\.(?:png|webp)$/,   /* REALMOON1 disc, phase masks, face fallback */
  /^moon\/moonphase\.js$/,                                     /* BATCH8: Prism's phase helper, listed by exact path + sha only (pages never import it; RealMoon stays the source) */
  /^costumes\/(?:harris-raven-banana|hayes-cat-ghostmask-robe|ainsley-owl-scarf-pumpkin)-(?:wall|phone)-overlay\.png$/
];
export const NEXT = "#-- next SUMS file --";
export function build(text) {
  const files = {}; let seen = new Set();   /* LIVEWX2 · several SUMS files: a later file (Prism's newer batch) overrides an earlier one; one file with two hashes for a path still throws */
  for (const line of text.split(/\r?\n/)) { if (line === NEXT) { seen = new Set(); continue; } const m = /^([0-9a-f]{64}) [ *]?(\S+)$/.exec(line.trim()); if (!m) continue;
    if (USED.some((r) => r.test(m[2]))) { if (seen.has(m[2]) && files[m[2]] !== m[1]) throw new Error("two hashes for one path"); seen.add(m[2]); files[m[2]] = m[1]; } }
  const sorted = {}, counts = {};
  for (const k of Object.keys(files).sort()) { sorted[k] = files[k]; const sub = k.startsWith("critters/snd/") ? "critters/snd" : k.startsWith("props/moon-") ? "props/moon" : k.split("/")[0]; counts[sub] = (counts[sub] || 0) + 1; }
  return { _: "CRITTERS2 + LIVEWX2 exact allow-list (one shared file): relative path -> sha256 of the file bytes, generated from Prism's SHA256SUMS by scripts/art-halloween-allow-gen.mjs. The proxy serves a Halloween art file only when its path is here AND its bytes hash to this value. No art in git.", counts, files: sorted };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const text = process.argv.slice(2).map((f) => fs.readFileSync(f, "utf8")).join("\n" + NEXT + "\n");
  process.stdout.write(JSON.stringify(build(text), null, 1) + "\n");
}
