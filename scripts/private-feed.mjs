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
 *   GET /api/private/nest/<cam>.jpg         -> front-door | garage | backyard still
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
import { PRIVATE_DIR } from "./private-dir.mjs";

export const FEEDS = { "cal-live": "cal-live.json", "cal-months": "cal-months.json", "kids-week": "kids-week.json",
  /* PRIVFEED2 · house device state (lights, thermostat, cameras) is private too */
  "lights-live": "lights-live.json", "sensi-live": "sensi-live.json", "nest-live": "nest-live.json" };
export const CAMS = new Set(["front-door", "garage", "backyard"]);
const ROUTE = /^\/api\/private\/(?:(health)|(cal-live|cal-months|kids-week|lights-live|sensi-live|nest-live)\.json|nest\/([a-z-]+)\.jpg)$/;

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

const RL = new Map();
function rateOk(key, limit = 120, windowMs = 60000) {
  const now = Date.now();
  const arr = (RL.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now); RL.set(key, arr); return true;
}

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
  if (!rateOk("t:" + crypto.createHash("sha256").update(tok).digest("hex").slice(0, 12))) {
    send(429, '{"error":"slow down"}'); return true;
  }
  const dir = opts.dir || PRIVATE_DIR;
  if (m[1]) {
    const files = {};
    for (const [k, f] of Object.entries(FEEDS)) {
      try { const st = fs.statSync(path.join(dir, f)); files[k] = { at: st.mtime.toISOString(), bytes: st.size }; } catch { files[k] = null; }
    }
    for (const c of CAMS) {
      try { const st = fs.statSync(path.join(dir, "nest-snaps", c + ".jpg")); files["nest/" + c] = { at: st.mtime.toISOString(), bytes: st.size }; } catch { files["nest/" + c] = null; }
    }
    send(200, JSON.stringify({ ok: true, files }));
    return true;
  }
  let fp, type;
  if (m[2]) { fp = path.join(dir, FEEDS[m[2]]); type = "application/json; charset=utf-8"; }
  else {
    if (!CAMS.has(m[3])) { send(404, '{"error":"unknown cam"}'); return true; }
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
