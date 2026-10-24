#!/usr/bin/env node
/**
 * WardOS House Face · Nest WebRTC token proxy (box / LAN only)
 *
 * Holds OAuth secrets off GitHub Pages. Browser builds SDP offer → POST here →
 * SDM GenerateWebRtcStream → answerSdp back. Tokens never leave the box.
 *
 * Secrets (mode 600, never git):
 *   ~/.config/wardos/nest-refresh.token
 *   ~/.config/wardos/nest-sdm.json
 *
 * Usage:
 *   node scripts/nest-webrtc-proxy.mjs
 *   node scripts/nest-webrtc-proxy.mjs --host 0.0.0.0 --port 8787 --lan
 *   node scripts/nest-webrtc-proxy.mjs --token-file ~/.config/wardos/nest-refresh.token
 *
 * Default bind: 127.0.0.1:8787. NOTE: cloudflared forwards public traffic FROM 127.0.0.1, so loopback is NOT trusted.
 *
 * CAMLOCK1 · auth is mandatory:
 *   - every /api/* call needs header X-Nest-Proxy-Token (or Authorization: Bearer); no ?proxyToken= query (URLs leak into logs)
 *   - constant-time compare; no localhost / X-Forwarded-For trust; no open or ephemeral mode
 *   - the proxy REFUSES TO START without an auth token. Sources (any number, each >= 16 chars):
 *       --auth-token-file <path> (repeatable)  · default file ~/.config/wardos/nest-device.token (nest-proxy.token is retired: log label only)
 *       --auth-token <t> (avoid: visible in ps). NEST_PROXY_TOKEN env is retired: log label only, never authorises
 *   - /health answers only {"ok":true}; static page code (no data/, scripts/, dotfiles) is the only keyless content.
 *
 * See ../NEST-LIVE.md
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { createAccessLog } from "./access-log.mjs"; /* ACCESSLOG */
import { createWxRoute } from "./wx-route.mjs"; /* LIVEWX2 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
/* LHVID1 · the night-scene loop videos are not in git (P1 no-video law); the proxy serves them from this private box folder. */
const DEFAULT_NIGHT_MEDIA = path.join(os.homedir(), ".local/share/wardos-private/night-media");

/* CAMLOCK1 tests: NEST_PROXY_TEST_GOOGLE may point Google calls at a LOOPBACK http mock only. */
const TEST_GOOGLE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.NEST_PROXY_TEST_GOOGLE || "") ? process.env.NEST_PROXY_TEST_GOOGLE : "";
const OAUTH_URL = TEST_GOOGLE ? TEST_GOOGLE + "/token" : "https://oauth2.googleapis.com/token";
const SDM_BASE = TEST_GOOGLE ? TEST_GOOGLE + "/v1" : "https://smartdevicemanagement.googleapis.com/v1";
const DEFAULT_AUTH_FILES = [
  path.join(os.homedir(), ".config", "wardos", "nest-device.token"),
];

const DEFAULT_TOKEN = path.join(os.homedir(), ".config", "wardos", "nest-refresh.token");
const DEFAULT_CONFIG = path.join(os.homedir(), ".config", "wardos", "nest-sdm.json");

function parseArgs(argv) {
  const out = {
    host: "127.0.0.1",
    port: 8787,
    lan: false,
    authTokens: [],
    authFiles: [],
    cliToken: "",
    tokenFile: DEFAULT_TOKEN,
    configFile: DEFAULT_CONFIG,
    nightMedia: DEFAULT_NIGHT_MEDIA,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--host" && argv[i + 1]) out.host = argv[++i];
    else if (a === "--port" && argv[i + 1]) out.port = Number(argv[++i]);
    else if (a === "--lan") {
      out.lan = true;
      if (out.host === "127.0.0.1") out.host = "0.0.0.0";
    } else if (a === "--auth-token" && argv[i + 1]) out.cliToken = argv[++i];
    else if (a === "--auth-token-file" && argv[i + 1]) out.authFiles.push(path.resolve(argv[++i]));
    else if (a === "--token-file" && argv[i + 1]) out.tokenFile = path.resolve(argv[++i]);
    else if (a === "--config" && argv[i + 1]) out.configFile = path.resolve(argv[++i]);
    else if (a === "--night-media" && argv[i + 1]) out.nightMedia = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (_) {
    return null;
  }
}

function readConfig(configFile) {
  const raw = readText(configFile);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return {
      projectId: String(j.projectId || j.project_id || "").trim(),
      clientId: String(j.clientId || j.client_id || "").trim(),
      clientSecret: String(j.clientSecret || j.client_secret || "").trim(),
    };
  } catch (_) {
    return null;
  }
}

function isCameraLike(type) {
  return /CAMERA|DOORBELL|DISPLAY/i.test(String(type || ""));
}

function deviceTypeShort(type) {
  const t = String(type || "");
  if (t.includes("DOORBELL")) return "DOORBELL";
  if (t.includes("CAMERA")) return "CAMERA";
  if (t.includes("DISPLAY")) return "DISPLAY";
  return "DEVICE";
}

/* FOLLOWUP2 · no room mapping in git: "where" is a generic label; the camera's own name (private feed) says the rest */
function guessWhere() {
  return "Camera";
}

function normalizeDevice(dev) {
  const traits = dev.traits || {};
  const info = traits["sdm.devices.traits.Info"] || {};
  const live = traits["sdm.devices.traits.CameraLiveStream"] || {};
  const name =
    info.customName ||
    (dev.parentRelations && dev.parentRelations[0] && dev.parentRelations[0].displayName) ||
    "Nest cam";
  return {
    id: (dev.name || "").split("/").pop() || null,
    name: String(name).trim() || "Nest cam",
    where: guessWhere(name),
    type: deviceTypeShort(dev.type),
    rawName: dev.name || null,
    protocols: Array.isArray(live.supportedProtocols) ? live.supportedProtocols : [],
  };
}

/** Access-token cache (refreshed ~5 min before expiry). */
let _tok = { access: null, exp: 0, refreshFile: null, refresh: null };
let _deviceCache = { at: 0, cams: [], devices: [] };
const DEVICE_CACHE_MS = 120_000;

async function exchangeRefresh({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const resp = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`oauth HTTP ${resp.status}: ${text.slice(0, 240)}`);
  }
  const json = await resp.json();
  if (!json.access_token) throw new Error("oauth missing access_token");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresIn: Number(json.expires_in) || 3600,
  };
}

async function getAccessToken(args, config) {
  const now = Date.now();
  if (_tok.access && _tok.exp > now + 60_000) return _tok.access;
  const refresh = process.env.NEST_REFRESH_TOKEN || readText(args.tokenFile) || "";
  if (!refresh) throw new Error("refresh_token missing");
  const tokens = await exchangeRefresh({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: refresh,
  });
  if (tokens.refreshToken && tokens.refreshToken !== refresh) {
    try {
      fs.writeFileSync(args.tokenFile, tokens.refreshToken.trim() + "\n", { mode: 0o600 });
    } catch (_) {}
  }
  _tok = {
    access: tokens.accessToken,
    exp: now + tokens.expiresIn * 1000,
    refreshFile: args.tokenFile,
    refresh: tokens.refreshToken,
  };
  return _tok.access;
}

async function listDevices(accessToken, projectId) {
  const url = `${SDM_BASE}/enterprises/${encodeURIComponent(projectId)}/devices`;
  const resp = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`sdm devices HTTP ${resp.status}: ${text.slice(0, 240)}`);
  }
  const json = await resp.json();
  return Array.isArray(json.devices) ? json.devices : [];
}

async function executeCommand(accessToken, deviceName, command, params) {
  const url = `${SDM_BASE}/${deviceName}:executeCommand`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ command, params }),
  });
  const text = await resp.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  if (!resp.ok) {
    const err =
      (json && json.error && (json.error.message || JSON.stringify(json.error))) ||
      text.slice(0, 400);
    const e = new Error(`SDM ${resp.status}: ${err}`);
    e.status = resp.status;
    e.body = json || text;
    throw e;
  }
  return json;
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nest-Proxy-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function mimeFor(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".woff2")) return "font/woff2";
  if (p.endsWith(".ttf")) return "font/ttf";
  if (p.endsWith(".woff")) return "font/woff";
  if (p.endsWith(".mp3")) return "audio/mpeg";
  if (p.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export const DEVICE_NAME_RE = /^enterprises\/[A-Za-z0-9_-]+\/devices\/[A-Za-z0-9_-]+$/;
/* PRIVFEED3 · vendor/ holds the in-page QR library (Dad's Pair a screen tile); nothing else under it.
   HUBPIN1 · art/, assets/ and theme-tiles/ serve page art and their scripts (image + js only, every image there is on
   the privacy art allow-list). MERGE1-PF4 · night/ and month-theme/ serve the NIGHT52 scene host and month overlay
   (page code, sky art and sounds; every image there is on the art allow-list; no video in git); no traversal (no "..", no dot-segments, no backslash, no encoded slash tricks). */
/* LIVEWX2 · the kid boards' season gate (KIDWORLD2): exactly the two shared clock/season files under livinghouse/ */
export const STATIC_OK = /^(?:ori\/[A-Za-z0-9_\/.-]+|[A-Za-z0-9_.-]+)\.(?:html|js|css|png|jpg|webp|svg|woff2?)$|^livinghouse\/(?:clock|scene-packs)\.js$|^vendor\/[A-Za-z0-9_.-]+\.js$|^fonts\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:ttf|woff2?)$|^(?:art|assets|theme-tiles)\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp|gif|svg|js)$|^(?:night|month-theme)\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:html|js|css|png|webp|mp3|json)$/;
/* LHVID1' · Atlas ruling (via Alfred, Oct 20): the scene loops serve WITHOUT the token, but only (1) .mp4 under night/ or
   month-theme/, (2) on the EXACT committed name list night/media/allow.json, (3) with no listing and no traversal, (4) never
   through a symlink (lstat on every segment), and (5) from a media folder that holds only listed names. */
export const NIGHT_MP4 = /^(?:night|month-theme)\/.*\.mp4$/i;
const ALLOW_FILE = path.join(ROOT, "night/media/allow.json");
export function loadNightAllow(file = ALLOW_FILE) {
  const out = new Set();
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [prefix, names] of Object.entries(j)) {
      if (!/^(?:night|month-theme)\/media$/.test(prefix) || !Array.isArray(names)) continue;
      for (const n of names) if (typeof n === "string" && /^(?:v52\/)?[A-Za-z0-9_-]+\.mp4$/.test(n)) out.add(prefix + "/" + n);
    }
  } catch { /* no list: nothing serves */ }
  return out;
}
export const NIGHT_ALLOW = loadNightAllow();
/** the media-folder name for an allowed request path ("night/media/v52/x.mp4" -> "v52/x.mp4"), else null */
function allowedName(rel, allow) {
  if (typeof rel !== "string" || !allow.has(rel)) return null;
  return rel.replace(/^(?:night|month-theme)\/media\//, "");
}
export function nightMediaPath(rel, dir, allow = NIGHT_ALLOW) {
  if (typeof rel !== "string" || typeof dir !== "string" || !dir || rel.includes("..") || rel.includes("\\") || rel.includes("%")) return null;
  const name = allowedName(rel, allow); if (!name) return null;
  const root = path.resolve(dir), abs = path.resolve(root, name);
  if (!abs.startsWith(root + path.sep)) return null;
  try {
    let cur = root;   /* refuse ALL symlinks: every segment below the media root must be a real dir / regular file */
    for (const seg of name.split("/")) { cur = path.join(cur, seg); const st = fs.lstatSync(cur); if (st.isSymbolicLink()) return null; }
    return fs.lstatSync(abs).isFile() ? abs : null;
  } catch { return null; }
}
/** LHVID1' · startup/test audit: every entry in the media folder must be a listed name (no symlinks, no extras). Counts only. */
export function auditNightMedia(dir, allow = NIGHT_ALLOW) {
  const listed = new Set([...allow].filter((r) => r.startsWith("night/media/")).map((r) => r.slice("night/media/".length)));
  let ok = 0, refused = 0;
  const walk = (d, pre) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const rel = pre + e.name;
      if (e.isDirectory() && rel === "v52") { walk(path.join(d, e.name), "v52/"); continue; }
      if (e.isFile() && listed.has(rel)) ok++; else refused++;
    }
  };
  walk(dir, "");
  return { ok, refused };
}
/** LHVID1 · true when the private folder holds at least one listed loop video (the capability the pages read from night/media/caps.json). */
export function nightMediaAvailable(dir, allow = NIGHT_ALLOW) {
  for (const r of allow) if (r.startsWith("night/media/") && nightMediaPath(r, dir, allow)) return true;
  return false;
}
/** WGART1 · Prism's Halloween art: exact names only, served from <night-media>/art/halloween (private, never git). */
export const HALLOWEEN_ART_RE = /^(backgrounds|signs|signs\/hardware|kidboards|overlays|props|windows|windows\/bgplate|windows\/wall1920|composite|posters)\/[a-z0-9-]+(@[23]x)?(-[0-9]+x[0-9]+)?(-phone@3x)?\.(png|webp)$/;
/* WGVID3 · Prism overlay loops (bats, fog, owl, embers, ghost, fire, smoke, candle, grassfire): private folder only, behind caps video:true */
export const HALLOWEEN_VID_RE = /^overlays\/[a-z0-9-]+\.(mp4|webm)$/;
/* LIVEWX2 (Alfred P2) · EVERY Halloween art file (plates, moon art, costume plates, signs, overlays, loops) serves ONLY from the
   exact list <night-media>/art-halloween-allow.json (relative path -> sha256 of the bytes, generated from Prism's SHA256SUMS by
   scripts/art-halloween-allow-gen.mjs; ONE list file shared with the ambient line). The list lives in the private night-media
   folder next to art/, never in git (PIIGUARD2: a hash list is kept off the public repo). Path listed AND shape rule AND bytes
   hash to the listed value AND no symlink on the way. No list = nothing serves. Anything else is a 404, token or not. */
export const ART_ALLOW_NAME = "art-halloween-allow.json";
export function loadArtFiles(file) {
  const out = new Map(); if (!file) return out;
  try { if (fs.lstatSync(file).isSymbolicLink()) return out;
    const j = JSON.parse(fs.readFileSync(file, "utf8")), f = j && j.files && typeof j.files === "object" ? j.files : {};
    for (const [k, v] of Object.entries(f)) if (typeof k === "string" && !k.includes("..") && !k.startsWith("/") && typeof v === "string" && /^[0-9a-f]{64}$/.test(v)) out.set(k, v); } catch { /* no list: nothing serves */ }
  return out;
}
const LISTS = new Map();   /* list file -> {size, mtimeMs, files}: re-read only when Prism's regenerated list lands */
export function artFilesFor(dir) {
  if (!dir) return new Map();
  const f = path.join(dir, ART_ALLOW_NAME); let st; try { st = fs.statSync(f); } catch { return new Map(); }
  const c = LISTS.get(f); if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) return c.files;
  const files = loadArtFiles(f); LISTS.set(f, { size: st.size, mtimeMs: st.mtimeMs, files }); return files;
}
const shapeOk = (n) => HALLOWEEN_ART_RE.test(n) || HALLOWEEN_VID_RE.test(n) || n === "backgrounds/porchlight-flicker-curve.json" || n === "props/porch-lantern-position.json";
export const HALLOWEEN_ART = { has: (n, files) => !!files && typeof n === "string" && shapeOk(n) && files.has(n) };
const BYTES_OK = new Map();   /* abs path -> {size, mtimeMs, sha, ok}: re-hash only when the file changes */
export function bytesMatch(f, sha) {
  try { const st = fs.statSync(f), c = BYTES_OK.get(f); if (c && c.size === st.size && c.mtimeMs === st.mtimeMs && c.sha === sha) return c.ok;
    const ok = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") === sha; BYTES_OK.set(f, { size: st.size, mtimeMs: st.mtimeMs, sha, ok }); return ok; } catch { return false; }
}
export function halloweenArtPath(rel, dir, files = artFilesFor(dir)) {
  const m = /^night\/media\/art\/halloween\/(.+)$/.exec(rel || "");
  if (!m || m[1].includes("..") || !HALLOWEEN_ART.has(m[1], files) || !dir) return null;
  const base = path.join(dir, "art", "halloween"), f = path.join(base, m[1]);
  try { let cur = base; for (const seg of m[1].split("/")) { cur = path.join(cur, seg); if (fs.lstatSync(cur).isSymbolicLink()) return null; }
    if (!fs.lstatSync(f).isFile()) return null; } catch { return null; }
  return bytesMatch(f, files.get(m[1])) ? f : null;   /* listed path, wrong bytes: refused */
}
/** the listed files present with the right bytes (the list, never a directory listing) */
export function halloweenArtList(dir, files = artFilesFor(dir)) {
  const out = []; if (!dir) return out;
  for (const n of files.keys()) if (halloweenArtPath("night/media/art/halloween/" + n, dir, files)) out.push(n);
  return out.sort();
}
/* LIVEWX2 · caps.json never names art: it carries a 64-bit FNV-1a key per present file ("artH"); the page keys the names it
   already holds the same way (wg-assets.js artKey, identical code). */
export function artKey(n) {
  let a = 0x811c9dc5, b = 0x050c5d1f;
  for (let i = 0; i < n.length; i++) { const c = n.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x01000193) >>> 0; b = (b ^ (b >>> 13)) >>> 0; }
  return ("0000000" + a.toString(16)).slice(-8) + ("0000000" + b.toString(16)).slice(-8);
}
/** LHVID1 · stream a video with byte ranges (iOS Safari will not play mp4 without them). */
export function sendVideo(req, res, file) {
  const size = fs.statSync(file).size, h = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (m && (m[1] || m[2])) {
    let a = m[1] ? Number(m[1]) : size - Number(m[2]), b = m[1] && m[2] ? Number(m[2]) : size - 1; if (a < 0) a = 0; if (b >= size) b = size - 1;
    if (a > b || a >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...h, "Content-Range": `bytes ${a}-${b}/${size}`, "Content-Length": b - a + 1 });
    return req.method === "HEAD" ? res.end() : fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { ...h, "Content-Length": size });
  return req.method === "HEAD" ? res.end() : fs.createReadStream(file).pipe(res);
}
/* LHVID1'' (Alfred 0803 condition 5) · the TOKENLESS static path under night/ and month-theme/ serves only files TRACKED at
   the proxy tree's HEAD, byte for byte. At startup `git ls-files -s -z -- night month-theme` (execFile, timeout) gives the
   exact path -> blob sha set; each serve re-hashes the bytes as a git blob and refuses on any mismatch (a modified tracked
   file), and `git diff --name-only HEAD` drops paths changed vs HEAD. Untracked: not in the set, 404. Git fails: the set
   is null and NO night/ or month-theme/ static file serves. The private media mp4 route above is separate and unchanged. */
export const SCENE_RE = /^(?:night|month-theme)\//;
function git(args, cwd, gitBin, timeout) {
  return new Promise((resolve, reject) => execFile(gitBin, args, { cwd, timeout, maxBuffer: 16 << 20, encoding: "buffer", env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", GIT_CONFIG_NOSYSTEM: "1" } },
    (err, out) => (err ? reject(err) : resolve(out.toString("utf8")))));
}
export async function loadTrackedScene(root = ROOT, { gitBin = "git", timeout = 5000 } = {}) {
  try {
    const ls = await git(["ls-files", "-s", "-z", "--", "night", "month-theme"], root, gitBin, timeout);
    const diff = await git(["diff", "--name-only", "-z", "HEAD", "--", "night", "month-theme"], root, gitBin, timeout);
    const changed = new Set(diff.split("\0").filter(Boolean));
    const out = new Map();
    for (const rec of ls.split("\0")) {
      const m = /^(100644|100755) ([0-9a-f]{40,64}) 0\t(.+)$/.exec(rec); if (!m) continue;   /* regular files only: no symlinks (120000), no conflicts */
      if (!SCENE_RE.test(m[3]) || changed.has(m[3])) continue;
      out.set(m[3], m[2]);
    }
    return out;
  } catch { return null; }
}
export function gitBlobSha(buf, len = 40) {
  return crypto.createHash(len === 64 ? "sha256" : "sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
}
/** true when rel is outside night/ and month-theme/, or is a HEAD-tracked scene file whose bytes match HEAD */
export function sceneServeOk(rel, buf, tracked) {
  if (!SCENE_RE.test(rel)) return true;
  if (!tracked || !tracked.has(rel)) return false;
  const want = tracked.get(rel);
  return gitBlobSha(buf, want.length) === want;
}
export function staticOk(rel) {
  return typeof rel === "string" && STATIC_OK.test(rel) && !rel.includes("..") && !rel.includes("\\") && !rel.split("/").some((seg) => !seg || seg.startsWith("."));
}
function safeJoin(root, urlPath) {
  const cleaned = decodeURIComponent(String(urlPath || "/").split("?")[0].split("#")[0]);
  const rel = cleaned.replace(/^\/+/, "") || "nest-webrtc.html";
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

/** ACCESSLOG · auth tokens with the slot each came from (never logged): nest-device.token and --auth-token are the device
    key ("device"). FOLLOWUP1/2: nest-proxy.token and NEST_PROXY_TOKEN are never auth sources (retired cams key; log label
    only, see loadRetiredLabels). */
export function loadAuthEntries(args, env = process.env) {
  const out = [];
  const add = (t, slot) => { t = String(t || "").trim(); if (t.length >= 16 && !out.some((e) => e.t === t)) out.push({ t, slot }); };
  add(args.cliToken, "device");
  /* FOLLOWUP2 · NEST_PROXY_TOKEN is label-only like nest-proxy.token (never authorises; see loadRetiredLabels) */
  for (const f of (args.authFiles.length ? args.authFiles : DEFAULT_AUTH_FILES)) {
    if (RETIRED_FILE_RE.test(path.basename(f))) continue; /* FOLLOWUP1 · label only, never authorises (loadRetiredLabels) */
    try { for (const t of fs.readFileSync(f, "utf8").split(/\s+/)) add(t, "device"); } catch { /* missing file */ }
  }
  return out;
}
/** FOLLOWUP1 · the retired cams key file (nest-proxy.token) is read ONLY as a log label: a request carrying it is still
    401, but the access log says slot "retired" instead of "none". Read from ~/.config/wardos and from any
    --auth-token-file that names it. Values that are also an auth key stay with their auth slot. */
const RETIRED_FILE_RE = /^nest-proxy\.token/;
export function loadRetiredLabels(args, authTokens = [], home = os.homedir(), env = process.env) {
  const files = new Set([path.join(home, ".config", "wardos", "nest-proxy.token"), ...(args.authFiles || []).filter((f) => RETIRED_FILE_RE.test(path.basename(f)))]);
  const out = [];
  { const t = String(env.NEST_PROXY_TOKEN || "").trim(); if (t.length >= 16 && !authTokens.includes(t)) out.push(t); }
  for (const f of files) {
    try { for (let t of fs.readFileSync(f, "utf8").split(/\s+/)) { t = t.trim(); if (t.length >= 16 && !authTokens.includes(t) && !out.includes(t)) out.push(t); } } catch { /* missing file */ }
  }
  return out;
}
/** CAMLOCK1 · collect auth tokens; never logs them. */
export function loadAuthTokens(args, env = process.env) {
  return loadAuthEntries(args, env).map((e) => e.t);
}
/** ACCESSLOG · which slot the request's key header matched: "device" | "retired" | "none" (constant time over all) */
export function authSlot(req, entries, retired = []) {
  const h = String(req.headers["x-nest-proxy-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || "");
  if (!h) return "none";
  let slot = "none";
  for (const e of entries || []) if (safeEq(h, e.t) && slot === "none") slot = e.slot;
  for (const t of retired || []) if (safeEq(h, t) && slot === "none") slot = "retired"; /* label only: checkAuth never sees these */
  return slot;
}

function safeEq(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/** CAMLOCK1 · header only, constant time, no loopback / forwarded-for trust, deny when no tokens. */
export function checkAuth(req, tokens) {
  if (!tokens || !tokens.length) return false;
  const h = String(req.headers["x-nest-proxy-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || "");
  if (!h) return false;
  let ok = false;
  for (const t of tokens) ok = safeEq(h, t) || ok;
  return ok;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node scripts/nest-webrtc-proxy.mjs [--host 127.0.0.1] [--port 8787] [--lan]
  --lan           bind 0.0.0.0 (auth: nest-device.token)
  Secrets: ~/.config/wardos/nest-refresh.token + nest-sdm.json`);
    process.exit(0);
  }

  const config = readConfig(args.configFile);
  if (!config || !config.projectId || !config.clientId || !config.clientSecret) {
    console.error("FATAL: nest-sdm.json missing/incomplete at " + args.configFile);
    process.exit(2);
  }
  if (!readText(args.tokenFile) && !process.env.NEST_REFRESH_TOKEN) {
    console.error("FATAL: nest-refresh.token missing at " + args.tokenFile);
    process.exit(2);
  }
  const authEntries = loadAuthEntries(args);
  args.authTokens = authEntries.map((e) => e.t);
  if (!args.authTokens.length) {
    console.error("FATAL: CAMLOCK1 · no auth token (--auth-token-file or ~/.config/wardos/nest-device.token, >= 16 chars; the retired nest-proxy.token and NEST_PROXY_TOKEN never count). Refusing to start.");
    process.exit(3);
  }

  async function loadCams(accessToken, force) {
    const now = Date.now();
    if (!force && _deviceCache.cams.length && now - _deviceCache.at < DEVICE_CACHE_MS) {
      return _deviceCache.cams;
    }
    const devices = await listDevices(accessToken, config.projectId);
    const cams = devices.filter((d) => isCameraLike(d.type)).map(normalizeDevice);
    _deviceCache = { at: now, cams, devices };
    return cams;
  }

  /** Resolve device id / short name → full SDM resource name. */
  async function resolveDevice(accessToken, idOrName) {
    const q = String(idOrName || "").trim();
    // Direct resource name bypasses list (avoids 429)
    /* PRIVFEED3 · a full resource name must be exactly enterprises/<id>/devices/<id> (no '..', no extra slashes),
       so a keyed caller can never steer the Google bearer to another SDM path */
    if (q.startsWith("enterprises/") && !DEVICE_NAME_RE.test(q)) return { cams: _deviceCache.cams, device: null };
    if (q.startsWith("enterprises/")) {
      return {
        cams: _deviceCache.cams,
        device: {
          id: q.split("/").pop(),
          name: q.split("/").pop(),
          rawName: q,
          where: "Cam",
          type: "CAMERA",
          protocols: ["WEB_RTC"],
        },
      };
    }
    const cams = await loadCams(accessToken, false);
    if (!q) return { cams, device: null };
    const hit =
      cams.find((c) => c.id === q) ||
      cams.find((c) => c.rawName === q) ||
      cams.find((c) => c.name.toLowerCase() === q.toLowerCase()) ||
      cams.find((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    return { cams, device: hit || null };
  }

  /* ACCESSLOG · one JSON line per request (route, status, slot, cf-connecting-ip, UA); keys are scrubbed, never logged */
  const retiredLabels = loadRetiredLabels(args, args.authTokens);
  const access = createAccessLog({ name: "nest-webrtc-proxy", secrets: () => [...args.authTokens, ...retiredLabels] });

  const wxRoute = createWxRoute(); /* LIVEWX2 · /wx: the coarse cell stays server-side; boards call only /wx */
  const server = http.createServer(async (req, res) => {
    try { access.setSlot(req, authSlot(req, authEntries, retiredLabels)); access.attach(req, res); } catch { /* logging never breaks a request */ }
    /* PRIVFEED3 · never build a URL from the Host header; a bad request line is a 400, never a crash */
    let u;
    try { u = new URL(req.url || "/", "http://proxy.invalid"); } catch { return json(res, 400, { error: "bad request" }); }
    const pathname = u.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nest-Proxy-Token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
      return res.end();
    }

    try {
      if (pathname === "/health" || pathname === "/api/health") {
        return json(res, 200, { ok: true }); /* CAMLOCK1 · reveals nothing else */
      }

      if (pathname === "/wx" && (req.method === "GET" || req.method === "HEAD")) return wxRoute(req, res); /* LIVEWX2 · before the static branch */
      // Static viewer + assets from repo root (nest-webrtc.html etc.)
      if ((req.method === "GET" || req.method === "HEAD") && !pathname.startsWith("/api/")) {   /* LHVID1' · HEAD answers exactly like GET, without a body */
        /* PRIVFEED2 · this port is reachable through the hub tunnel. Serve ONLY public page code (the same files
         * Pages serves): root or ori/ html/js/css/images. Never data/, scripts/, plates/, dotfiles (.git), json, md. */
        let rel = "";
        try { rel = decodeURIComponent(pathname === "/" ? "/nest-webrtc.html" : pathname).replace(/^\/+/, ""); } catch { return json(res, 404, { error: "not found" }); }
        if (rel === "night/media/caps.json") { /* LHVID1 · the page asks once before it sets any video src (Pages serves the committed {video:false}) */
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
          return res.end(req.method === "HEAD" ? undefined : (() => { const v = nightMediaAvailable(args.nightMedia); return JSON.stringify({ video: v, artH: halloweenArtList(args.nightMedia).filter((n) => v || !HALLOWEEN_VID_RE.test(n)).map(artKey) }); })());
        }
        if (rel.startsWith("night/media/art/halloween/")) { /* WGART1 / LIVEWX2 · exact listed Prism art only (path + sha256); a miss is a 404 the page never asks for (caps.artH keys what exists) */
          const af = halloweenArtPath(rel, args.nightMedia);
          if (!af) return json(res, 404, { error: "not found" });
          res.writeHead(200, { "Content-Type": af.endsWith(".webp") ? "image/webp" : af.endsWith(".webm") ? "video/webm" : af.endsWith(".mp4") ? "video/mp4" : af.endsWith(".json") ? "application/json" : "image/png", "Cache-Control": "public, max-age=3600" });
          return req.method === "HEAD" ? res.end() : fs.createReadStream(af).pipe(res);
        }
        if (NIGHT_MP4.test(rel)) { /* LHVID1 · private media folder; a miss is a plain 404 and the page shows the still poster */
          const vf = nightMediaPath(rel, args.nightMedia);
          return vf ? sendVideo(req, res, vf) : json(res, 404, { error: "not found" });
        }
        if (!staticOk(rel)) {
          return json(res, 404, { error: "not found" });
        }
        let filePath = safeJoin(ROOT, "/" + rel);
        if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return json(res, 404, { error: "not found" });
        }
        if (SCENE_RE.test(rel) && (!sceneTracked || !sceneTracked.has(rel) || fs.lstatSync(filePath).isSymbolicLink())) return json(res, 404, { error: "not found" });
        const buf = fs.readFileSync(filePath);
        if (!sceneServeOk(rel, buf, sceneTracked)) return json(res, 404, { error: "not found" });   /* LHVID1'' · modified vs HEAD */
        res.writeHead(200, {
          "Content-Type": mimeFor(filePath),
          "Cache-Control": pathname.endsWith(".html") || pathname.endsWith(".js") ? "no-store" : "public, max-age=120",
          "Access-Control-Allow-Origin": "*",
        });
        return res.end(req.method === "HEAD" ? undefined : buf);
      }

      if (!checkAuth(req, args.authTokens)) {
        return json(res, 401, { error: "unauthorized", locked: true });
      }

      if (pathname === "/api/cameras" && req.method === "GET") {
        const access = await getAccessToken(args, config);
        const force = u.searchParams.get("refresh") === "1";
        const cameras = await loadCams(access, force);
        return json(res, 200, {
          status: "live",
          source: "nest-webrtc-proxy",
          cameras,
          cameraCount: cameras.length,
          fetchedAt: new Date().toISOString(),
          cachedAt: new Date(_deviceCache.at).toISOString(),
          proxy: { webrtc: true, extend: true },
        });
      }

      if (pathname === "/api/webrtc" && req.method === "POST") {
        const body = await readBody(req);
        const offerSdp = String(body.offerSdp || "").trim();
        if (!offerSdp) return json(res, 400, { error: "offerSdp required" });
        // Nest requires trailing newline
        const sdp = offerSdp.endsWith("\n") ? offerSdp : offerSdp + "\n";
        const access = await getAccessToken(args, config);
        const { device } = await resolveDevice(access, body.deviceId || body.id || body.name);
        if (!device || !device.rawName) {
          return json(res, 404, { error: "camera not found", hint: "GET /api/cameras" });
        }
        const result = await executeCommand(
          access,
          device.rawName,
          "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream",
          { offerSdp: sdp }
        );
        const results = result.results || {};
        return json(res, 200, {
          ok: true,
          deviceId: device.id,
          name: device.name,
          answerSdp: results.answerSdp,
          expiresAt: results.expiresAt,
          mediaSessionId: results.mediaSessionId,
        });
      }

      if (pathname === "/api/webrtc/extend" && req.method === "POST") {
        const body = await readBody(req);
        const mediaSessionId = String(body.mediaSessionId || "").trim();
        if (!mediaSessionId) return json(res, 400, { error: "mediaSessionId required" });
        const access = await getAccessToken(args, config);
        const { device } = await resolveDevice(access, body.deviceId || body.id || body.name);
        if (!device || !device.rawName) return json(res, 404, { error: "camera not found" });
        const result = await executeCommand(
          access,
          device.rawName,
          "sdm.devices.commands.CameraLiveStream.ExtendWebRtcStream",
          { mediaSessionId }
        );
        return json(res, 200, { ok: true, ...(result.results || {}) });
      }

      if (pathname === "/api/webrtc/stop" && req.method === "POST") {
        const body = await readBody(req);
        const mediaSessionId = String(body.mediaSessionId || "").trim();
        if (!mediaSessionId) return json(res, 400, { error: "mediaSessionId required" });
        const access = await getAccessToken(args, config);
        const { device } = await resolveDevice(access, body.deviceId || body.id || body.name);
        if (!device || !device.rawName) return json(res, 404, { error: "camera not found" });
        await executeCommand(
          access,
          device.rawName,
          "sdm.devices.commands.CameraLiveStream.StopWebRtcStream",
          { mediaSessionId }
        );
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: "not found" });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.error("[nest-webrtc-proxy]", msg);
      return json(res, err.status && err.status < 600 ? err.status : 500, {
        error: msg,
        detail: err.body || null,
      });
    }
  });

  const sceneTracked = await loadTrackedScene(ROOT);   /* LHVID1'' · null = git failed: no tokenless scene static at all */
  console.log(sceneTracked ? `  scene static: ${sceneTracked.size} HEAD-tracked file(s) under night/ + month-theme/` : "  scene static: git unavailable, night/ + month-theme/ static refused");
  { const a = auditNightMedia(args.nightMedia); /* LHVID1' · names never printed, counts only */
    console.log(`  night media: ${a.ok} listed loop(s) present, ${a.refused} other entr${a.refused === 1 ? "y" : "ies"} refused`); }
  server.listen(args.port, args.host, () => {
    args.port = server.address().port;   /* LHVID1' · --port 0 (tests): the kernel picks the port and we print the real one */
    const shown = args.host === "0.0.0.0" ? "0.0.0.0 (all interfaces)" : args.host;
    console.log(`nest-webrtc-proxy listening http://${shown}:${args.port}`);
    console.log(`  viewer:  http://127.0.0.1:${args.port}/nest-webrtc.html`);
    console.log(`  health:  http://127.0.0.1:${args.port}/health`);
    console.log(`  cameras: http://127.0.0.1:${args.port}/api/cameras`);
    console.log(`  auth:    X-Nest-Proxy-Token required (${args.authTokens.length} token(s) loaded)`);
    console.log(`  secrets: ${args.configFile} + token file (mode 600)`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
