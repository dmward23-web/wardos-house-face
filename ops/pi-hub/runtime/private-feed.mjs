#!/usr/bin/env node
/**
 * PRIVFEED1 · private runtime feed for the House Face (box only).
 *
 * The public Pages site holds only code. Calendar, kids-week and camera stills live in the box-only private
 * folder (scripts/private-dir.mjs) and are served here, TOKEN REQUIRED, to the wall and phones that hold the
 * device token (localStorage "wardos-lights-proxy-token", the same key the hub already uses).
 *
 *   GET /api/private/health                 -> {ok, files:{name:{at,bytes}}}  (no contents)
 *   GET /api/private/cal-live.json          -> private cal-live
 *   GET /api/private/cal-months.json        -> private cal-months
 *   GET /api/private/kids-week.json         -> private kids-week
 *   GET /api/private/{lights,sensi,nest}-live.json -> private house device state (PRIVFEED2)
 *   GET /api/private/nest/<cam>.jpg         : a camera still by slug (FOLLOWUP2: no camera names in git; any
 *                                              existing <slug>.jpg in the private nest-snaps folder)
 *   GET /api/private/private-names.json     : {"school":[...]} only (SCHOOLNAMES1 · school-names.js; no other role ever)
 *
 * The house ORIGIN alone never unlocks these routes (anyone who opens the public site has that Origin).
 * Mounted by scripts/lights-write-proxy.mjs (handlePrivate) or run standalone:
 *   node scripts/private-feed.mjs --port 8789 [--host 127.0.0.1] [--token-file ~/.config/wardos/lights-proxy.token]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PRIVATE_DIR, privateNamesPath } from "./private-dir.mjs";

export const FEEDS = { "cal-live": "cal-live.json", "cal-months": "cal-months.json", "kids-week": "kids-week.json",
  /* PRIVFEED2 · house device state (lights, thermostat, cameras) is private too */
  "lights-live": "lights-live.json", "sensi-live": "sensi-live.json", "nest-live": "nest-live.json" };
/* FOLLOWUP2 · camera stills by slug only (lowercase words joined by single hyphens, <= 40 chars); the camera list
   lives in the private folder, never in git */
export const CAM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,5}$/;
export function listCams(dir) {
  try { return fs.readdirSync(path.join(dir, "nest-snaps")).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).filter((c) => c.length <= 40 && CAM_SLUG.test(c)); } catch { return []; }
}
const ROUTE = /^\/api\/private\/(?:(health)|(cal-live|cal-months|kids-week|lights-live|sensi-live|nest-live)\.json|nest\/([a-z0-9-]{1,40})\.jpg|(private-names)\.json)$/;

function tokenEq(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function readTokens(files) {
  const out = [];
  for (const f of files) {
    try {
      for (const t of fs.readFileSync(f, "utf8").split(/\s+/)) if (t && t.length >= 16) out.push(t);
    } catch { /* missing file = no tokens from it */ }
  }
  const e = process.env.PRIVATE_FEED_TOKEN;
  if (e && e.length >= 16) out.push(e); /* short tokens are refused */
  return out;
}
function reqToken(req) {
  return req.headers["x-private-feed-token"] || req.headers["x-lights-proxy-token"] ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

/* RATEKEY1 · rate buckets are (token hash + client hash), so the wall, phones and kid pages sharing one paired key no
   longer share one bucket; one flooding client hits its own limit without starving the others. A per-token ceiling
   still caps a stolen key. Client = first CF-Connecting-IP / X-Forwarded-For entry, else the socket address, hashed to
   12 hex (never stored or logged raw). OPTIONS and 401 never count (they return before this check). */
export const RATE = { perClient: 600, perToken: 3000, windowMs: 60000, retryAfterS: 60 };
const RL = new Map();
const H12 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
export function clientKey(req) {
  const h = req.headers || {};
  const first = (v) => String(Array.isArray(v) ? v[0] : v || "").split(",")[0].trim();
  const ip = first(h["cf-connecting-ip"]) || first(h["x-forwarded-for"]) || (req.socket && req.socket.remoteAddress) || "unknown";
  return H12(ip);
}
function rateOk(key, limit, windowMs = RATE.windowMs, now = Date.now()) {
  const arr = (RL.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { RL.set(key, arr); return false; }
  arr.push(now); RL.set(key, arr); return true;
}
/* count-only minute summary (stderr, opt-in WARDOS_PRIVFEED_RATELOG=1): bucket hash-prefixes + counts, no IP, no token */
const STAT = new Map();
let statTimer = null;
function stat(bucket, limited) {
  const s = STAT.get(bucket) || { n: 0, r429: 0 }; s.n++; if (limited) s.r429++; STAT.set(bucket, s);
  if (!statTimer && process.env.WARDOS_PRIVFEED_RATELOG === "1") {
    statTimer = setInterval(() => {
      if (!STAT.size) return;
      const parts = [...STAT].map(([b, v]) => `${b} n=${v.n} 429=${v.r429}`);
      STAT.clear();
      console.error("RATEKEY1 min " + parts.join(" · "));
    }, 60000);
    if (statTimer.unref) statTimer.unref();
  }
}
export function rateCheck(tok, req, now = Date.now()) {
  const t = H12(tok), c = clientKey(req);
  const bucket = t.slice(0, 6) + ":" + c.slice(0, 6);
  /* client bucket first: a flooding client is refused before it can eat the shared token ceiling */
  const ok = rateOk("tc:" + t + ":" + c, RATE.perClient, RATE.windowMs, now) && rateOk("t:" + t, RATE.perToken, RATE.windowMs, now);
  stat(bucket, !ok);
  return ok;
}
export function _resetRate() { RL.clear(); STAT.clear(); }

/**
 * Returns true when the request was a /api/private/* route (handled, any status), false otherwise.
 * opts: { tokens: string[], origins: Set<string>, dir?: string }
 */
export function handlePrivate(req, res, opts) {
  let u;
  try { u = new URL(req.url || "/", "http://x"); } catch { return false; }
  if (!u.pathname.startsWith("/api/private/")) return false;
  const origin = req.headers.origin || "";
  const allowOrigin = opts.origins && opts.origins.has(origin) ? origin : "";
  const base = {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
    ...(allowOrigin ? {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Headers": "X-Private-Feed-Token, X-Lights-Proxy-Token, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Expose-Headers": "Retry-After",
    } : {}),
  };
  const send = (code, body, type = "application/json; charset=utf-8") => {
    res.writeHead(code, { ...base, "Content-Type": type });
    res.end(body);
  };
  if (req.method === "OPTIONS") { res.writeHead(204, base); res.end(); return true; }
  if (req.method !== "GET") { send(405, '{"error":"method"}'); return true; }
  const m = ROUTE.exec(u.pathname);
  if (!m) { send(404, '{"error":"unknown private route"}'); return true; }
  const tok = reqToken(req);
  const tokens = opts.tokens || [];
  if (!tokens.length || !tokens.some((t) => tokenEq(t, tok))) {
    send(401, '{"error":"token required"}');
    return true;
  }
  if (!rateCheck(tok, req)) {
    res.writeHead(429, { ...base, "Content-Type": "application/json; charset=utf-8", "Retry-After": String(RATE.retryAfterS) });
    res.end('{"error":"slow down","retryAfter":' + RATE.retryAfterS + '}'); return true;
  }
  const dir = opts.dir || PRIVATE_DIR;
  if (m[1]) {
    const files = {};
    for (const [k, f] of Object.entries(FEEDS)) {
      try { const st = fs.statSync(path.join(dir, f)); files[k] = { at: st.mtime.toISOString(), bytes: st.size }; } catch { files[k] = null; }
    }
    for (const c of listCams(dir)) {
      try { const st = fs.statSync(path.join(dir, "nest-snaps", c + ".jpg")); files["nest/" + c] = { at: st.mtime.toISOString(), bytes: st.size }; } catch { files["nest/" + c] = null; }
    }
    send(200, JSON.stringify({ ok: true, files }));
    return true;
  }
  if (m[4]) {
    /* SCHOOLNAMES1 · role "school" rows only (same token rule as school-names.js / LHRules); partner, co-parent and
       other-family names never leave the box. Missing file = empty list. */
    const fpN = dir === PRIVATE_DIR ? privateNamesPath() : path.join(dir, "private-names.tsv");
    const school = [];
    try {
      for (const ln of fs.readFileSync(fpN, "utf8").split("\n")) {
        if (!ln.trim() || ln.startsWith("#") || !ln.includes("\t")) continue;
        const i = ln.indexOf("\t");
        const role = ln.slice(0, i).trim().toLowerCase(), name = ln.slice(i + 1).trim().replace(/\s+/g, " ");
        if (role === "school" && (/^[A-Za-z]{2,8}$/.test(name) || /^[A-Za-z]{2,}(?: [A-Za-z]{2,}){1,3}$/.test(name))) school.push(name);
      }
    } catch { /* no names file = no school names */ }
    send(200, JSON.stringify({ school }));
    return true;
  }
  let fp, type;
  if (m[2]) { fp = path.join(dir, FEEDS[m[2]]); type = "application/json; charset=utf-8"; }
  else {
    if (!CAM_SLUG.test(m[3])) { send(404, '{"error":"unknown cam"}'); return true; }
    fp = path.join(dir, "nest-snaps", m[3] + ".jpg"); type = "image/jpeg";
  }
  let buf;
  try { buf = fs.readFileSync(fp); } catch { send(404, '{"error":"not in private folder yet","offline":true}'); return true; }
  let st; try { st = fs.statSync(fp); } catch { st = null; }
  res.writeHead(200, { ...base, "Content-Type": type, "Content-Length": buf.length, ...(st ? { "Last-Modified": st.mtime.toUTCString() } : {}) });
  res.end(buf);
  return true;
}

function main() {
  const a = process.argv.slice(2);
  const arg = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
  const host = arg("--host", "127.0.0.1");
  const port = Number(arg("--port", "8789"));
  const tokenFiles = [arg("--token-file", path.join(os.homedir(), ".config", "wardos", "lights-proxy.token")),
    path.join(os.homedir(), ".config", "wardos", "private-feed.token")];
  const tokens = readTokens(tokenFiles);
  if (!tokens.length) { console.error("PRIVFEED1: no token (token file or PRIVATE_FEED_TOKEN) · refusing to serve private data"); process.exit(2); }
  const origins = new Set((process.env.HOUSE_ORIGINS || "https://dmward23-web.github.io").split(",").map((s) => s.trim()).filter(Boolean));
  const dir = arg("--dir", PRIVATE_DIR);
  http.createServer((req, res) => {
    if (!handlePrivate(req, res, { tokens, origins, dir })) { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"not found"}'); }
  }).listen(port, host, () => console.log(`private-feed on http://${host}:${port} · dir ${dir} · ${tokens.length} token(s) · origins ${[...origins].join(",")}`));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
