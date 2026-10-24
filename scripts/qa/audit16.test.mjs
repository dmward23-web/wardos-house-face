/* AUDIT16 · every client-side weather/moon location is the coarse metro cell (one decimal), never a precise point */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
/* LIVEWX2 · the client carries no location at all: the hub's /wx holds the coarse cell server-side (private file) */
test("weather clients carry no location and fetch only the hub /wx", () => {
  for (const f of ["house-weather.js", "night/scene.html", "wall.html", "livinghouse/moon-real.js", "livinghouse/lh.js", "livewx-core.js"]) {
    const s = R(f);
    assert.doesNotMatch(s, /38\.9|-94\.7|39\.0\d|94\.[5-9]\d/, f + " (no metro coordinate literal)");
    assert.doesNotMatch(s, /api\.open-meteo\.com|wttr\.in/, f + " (no direct weather API; only /wx)");
  }
  for (const f of ["house-weather.js", "night/scene.html", "wall.html"]) assert.match(R(f), /fetchWx\(/, f);
  assert.match(R("livewx-core.js"), /var u = \["\/wx"\]/);
});
test("no client file carries a coordinate finer than 0.1 deg", () => {
  for (const f of ["house-weather.js", "night/scene.html", "wall.html", "livinghouse/moon-real.js", "livinghouse/lh.js"]) {
    const s = R(f);
    assert.doesNotMatch(s, /\b(?:LAT|LON|lat|lon|lng)\b\s*[:=]\s*-?\d{1,3}\.\d{2,}/, f);
    assert.doesNotMatch(s, /\b3[89]\.\d{2,}\b|-9[45]\.\d{2,}\b/, f + " (no precise home-area decimals)");
  }
});
