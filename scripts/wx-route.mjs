/* LIVEWX2 · GET /wx · the boards' only weather source. The coarse cell lives server-side in the private data dir
 * (<private dir>/wx-cell.json, {"lat":..,"lon":..}, rounded to 0.1 deg on read; never in git, never in a response body
 * beyond the same 0.1 deg "sky" cell the sun math needs). Upstream is Open-Meteo, fetched at most every 10 min.
 * Reply: { livewx, raw:{current, minutely_15, hourly, daily}, sky:{lat,lon}, ts, stale, ageMin }.
 * Upstream down: the last good reading (memory, then <private dir>/wx-last.json) with stale:true and its age.
 * No reading ever (or no cell file): 503 { livewx:null } and the boards show no weather motion. */
import fs from "node:fs";
import { createRequire } from "node:module";
import { privPath } from "./private-dir.mjs";
const core = createRequire(import.meta.url)("../livewx-core.js");

const r1 = (v) => Math.round(v * 10) / 10;
export function readCell(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    const lat = Number(j.lat), lon = Number(j.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: r1(lat), lon: r1(lon) };   /* coarse cell only, whatever the file holds */
  } catch { return null; }
}
export function upstreamUrl(cell) {
  return "https://api.open-meteo.com/v1/forecast?latitude=" + cell.lat + "&longitude=" + cell.lon
    + "&current=" + core.CURRENT + "&minutely_15=" + core.MINUTELY + "&forecast_minutely_15=2"
    + "&hourly=precipitation_probability,precipitation&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=America%2FChicago";
}
function pick(j) { return { current: j.current, minutely_15: j.minutely_15, hourly: j.hourly, daily: j.daily }; }

export function createWxRoute(opt = {}) {
  const cellFile = opt.cellFile || privPath("wx-cell.json"), lastFile = opt.lastFile || privPath("wx-last.json");
  const fetchImpl = opt.fetchImpl || fetch, now = opt.now || Date.now, ttl = opt.ttlMs || 10 * 6e4, timeout = opt.timeoutMs || 8000;
  let last = null, lastTry = 0, inflight = null;
  try { const s = JSON.parse(fs.readFileSync(lastFile, "utf8")); if (s && s.ts && s.raw && core.parse(s.raw)) last = s; } catch { /* none yet */ }
  async function refresh(cell) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetchImpl(upstreamUrl(cell), { signal: ac.signal });
      if (!r.ok) throw new Error("upstream " + r.status);
      const raw = pick(await r.json());
      if (!core.parse(raw)) throw new Error("no reading");
      last = { ts: now(), raw };
      try { fs.writeFileSync(lastFile, JSON.stringify(last), { mode: 0o600 }); } catch { /* memory copy still serves */ }
      return true;
    } catch { return false; } finally { clearTimeout(t); }
  }
  async function reading() {
    const cell = readCell(cellFile);
    if (!cell) return { cell: null, fresh: false };
    let fresh = !!last && now() - last.ts < ttl;
    if (!fresh && now() - lastTry > 60e3) { lastTry = now(); inflight = inflight || refresh(cell).finally(() => { inflight = null; }); fresh = await inflight; }
    return { cell, fresh: fresh || (!!last && now() - last.ts < ttl) };
  }
  async function body() {
    const { cell, fresh } = await reading();
    if (!cell || !last) return null;
    const w = core.parse(last.raw), stale = !fresh;
    return { livewx: core.toLiveWx(w, last.ts, stale, now()), raw: last.raw, sky: cell, ts: last.ts, stale, ageMin: Math.max(0, Math.round((now() - last.ts) / 6e4)) };
  }
  async function handler(req, res) {
    const b = await body();
    const h = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
    res.writeHead(b ? 200 : 503, h);
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(b || { livewx: null }));
  }
  handler.body = body;
  return handler;
}
