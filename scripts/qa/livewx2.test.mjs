/* LIVEWX2 · the hub's /wx is the boards' only weather source: coarse cell server-side, stale age, gusts, no reading = no motion. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module"; import { createWxRoute, readCell, upstreamUrl } from "../wx-route.mjs";
const core = createRequire(import.meta.url)("../../livewx-core.js");
const R = (f) => fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "livewx2-")); test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const cellF = path.join(tmp, "cell.json"), lastF = path.join(tmp, "last.json");
fs.writeFileSync(cellF, JSON.stringify({ lat: 123456 / 1e4, lon: -456789 / 1e4 }));   /* synthetic point, not a real place of ours */
const RAW = { current: { temperature_2m: 10, wind_speed_10m: 12, wind_gusts_10m: 20, wind_direction_10m: 270, cloud_cover: 80, precipitation: 0, weather_code: 3, is_day: 0, visibility: 20000, relative_humidity_2m: 70 }, minutely_15: {}, hourly: {}, daily: {}, latitude: 1, longitude: 2 };
const ok = (j) => async () => ({ ok: true, json: async () => j }), down = async () => { throw new Error("down"); };
test("readCell rounds to 0.1 deg; upstream asks for gusts and is_day", () => {
  assert.deepEqual(readCell(cellF), { lat: 12.3, lon: -45.7 });
  assert.equal(readCell(path.join(tmp, "nope.json")), null);
  const u = upstreamUrl({ lat: 12.3, lon: -45.7 }); assert.match(u, /wind_gusts_10m/); assert.match(u, /is_day/); assert.match(u, /latitude=12\.3&longitude=-45\.7&/);
});
test("no cell file = 503 {livewx:null}; no reading ever = null body", async () => {
  const h = createWxRoute({ cellFile: path.join(tmp, "nope.json"), lastFile: lastF, fetchImpl: ok(RAW) });
  let code, out; await h({ method: "GET" }, { writeHead: (c) => { code = c; }, end: (b) => { out = b; } });
  assert.equal(code, 503); assert.deepEqual(JSON.parse(out), { livewx: null });
  assert.equal(await createWxRoute({ cellFile: cellF, lastFile: path.join(tmp, "x.json"), fetchImpl: down }).body(), null);
});
test("live reading: coarse sky only, gusts, no upstream lat/lon echoed, last reading kept mode 600", async () => {
  let t = 1_800_000_000_000; const h = createWxRoute({ cellFile: cellF, lastFile: lastF, fetchImpl: ok(RAW), now: () => t });
  const b = await h.body();
  assert.deepEqual(b.sky, { lat: 12.3, lon: -45.7 }); assert.equal(b.stale, false); assert.equal(b.ageMin, 0);
  assert.equal(b.livewx.gustMph, 12.4); assert.equal(b.livewx.windMph, 7.5);   /* km/h upstream, mph out */ assert.equal(b.livewx.windDirDeg, 270);
  assert.ok(!("latitude" in b.raw) && !("longitude" in b.raw)); assert.doesNotMatch(JSON.stringify(b), /12\.34|45\.67/);
  assert.equal(fs.statSync(lastF).mode & 0o777, 0o600);
  /* upstream down 25 min later: the same reading, stale, with its age */
  const h2 = createWxRoute({ cellFile: cellF, lastFile: lastF, fetchImpl: down, now: () => t + 25 * 6e4 });
  const s = await h2.body(); assert.equal(s.stale, true); assert.equal(s.ageMin, 25); assert.equal(s.livewx.stale, true); assert.equal(s.livewx.ageMin, 25);
  assert.equal(core.ageText(25 * 6e4), "25 min ago"); assert.equal(core.ageText(3 * 3600e3), "3 h ago");
});
test("core: gust never below mean wind; missing fields stay null (no made-up gust, dir, cloud or temp); no wind/temp = no reading", () => {
  assert.equal(core.parse({ current: { ...RAW.current, wind_gusts_10m: 5 } }).wg, 12);
  const c = { ...RAW.current }; delete c.wind_gusts_10m; assert.equal(core.parse({ current: c }).wg, null, "missing gust is unknown, not mean x 1.5");
  assert.equal(core.toLiveWx(core.parse({ current: c }), 1e12, false, 1e12).gustMph, null);
  assert.equal(core.parse({ current: {} }), null); assert.equal(core.parse(null), null);
  /* LIVEWX2 (ambient line) · each missing field is null in the contract, never dir 200 / cloud 20 / temp 10 */
  for (const [k, out] of [["wind_direction_10m", "windDirDeg"], ["cloud_cover", "cloudPct"], ["wind_gusts_10m", "gustMph"]]) {
    const d = { ...RAW.current }; delete d[k]; const w = core.parse({ current: d }); assert.ok(w, k);
    assert.equal(core.toLiveWx(w, 1e12, false, 1e12)[out], null, k + " -> " + out);
  }
  const full = core.toLiveWx(core.parse(RAW), 1e12, false, 1e12);
  assert.equal(full.gustMph, Math.round(20 * 0.621371 * 10) / 10); assert.equal(full.windDirDeg, 270); assert.equal(full.cloudPct, 80);
  for (const k of ["state", "intensity", "windMph", "gustMph", "windDirDeg", "cloudPct", "fog", "wet", "tempF", "ts", "stale", "ageMin", "code"]) assert.ok(k in full, "contract field " + k);
  /* ambient line lightning keys on isStormCode(code): the raw WMO code rides along, null when the feed sent none */
  assert.equal(full.code, RAW.current.weather_code); { const d = { ...RAW.current }; delete d.weather_code; assert.equal(core.toLiveWx(core.parse({ current: d }), 1e12, false, 1e12).code, null); }
  assert.equal(full.fog, full.state === "fog", "fog comes from the reading's state only");
  const src = R("livewx-core.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /\|\|\s*(?:200|8|20|10)\b|\*\s*1\.5\b/, "no gap-filler literals");
});
test("clients: /wx only (same origin, then pinned hub; .invalid never), no location literal, no calm default", () => {
  const urls = core.wxUrls({ location: { origin: "https://pages.example" }, HouseHub: { cams: () => "https://cams.example" } });
  assert.deepEqual(urls, ["/wx", "https://cams.example/wx"]);
  assert.deepEqual(core.wxUrls({ location: { origin: "http://127.0.0.1:1" }, HouseHub: { cams: () => "https://cams.qa.invalid" } }), ["/wx"]);
  for (const f of ["night/scene.html", "wall.html"]) {
    const s = R(f);
    assert.match(s, /LWC\.fetchWx\(window,8000\)/, f); assert.doesNotMatch(s, /HOME=\{lat:/, f); assert.doesNotMatch(s, /api\.open-meteo/, f);
    assert.match(s, /src:'none'/, f + " starts with no reading");
    assert.match(s, /src==='none'/, f + " no reading = WXZERO (no weather motion)");
  }
  const h = R("house-weather.js"); assert.match(h, /fetchWx\(global, 8000\)/); assert.doesNotMatch(h, /var LAT|open-meteo\.com|wttr/);
  for (const f of ["month.html", "sheet-dan.html", "sheet-index.html", "sheet-today.html", "sheet-us.html"]) assert.ok(R(f).indexOf("livewx-core.js") < R(f).indexOf("house-weather.js"), f);
});
test("lh: fog has no static default; no data-wx = no fog/leaf motion; gust drives drift; stale shows age", () => {
  const css = R("livinghouse/lh.css"), js = R("livinghouse/lh.js");
  assert.doesNotMatch(css, /--fogfar:\s*\.\d/); assert.doesNotMatch(css, /var\(--fog(far|near), \.\d/);
  assert.match(css, /#lh:not\(\[data-wx\]\) \.lh-fogfar, #lh:not\(\[data-wx\]\) \.lh-fognear, #lh:not\(\[data-wx\]\) \.lh-leaf \{ opacity: 0 !important; animation: none !important; \}/);
  assert.match(js, /if \(!o\) \{ h\.removeAttribute\("data-wx"\)/); assert.match(js, /mph = mean \+ 0\.5 \* \(gust - mean\)/);
  assert.match(js, /"Weather from "/); assert.match(R("livinghouse/index.html"), /id="lh-wxage"/);
});
test("proxy serves /wx before the static branch", () => {
  const s = R("scripts/nest-webrtc-proxy.mjs"); const i = s.indexOf('pathname === "/wx"'); assert.ok(i > 0); assert.match(s, /import \{ createWxRoute \} from "\.\/wx-route\.mjs"/);
});
