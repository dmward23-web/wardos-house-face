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
 *       --auth-token-file <path> (repeatable)  · default files ~/.config/wardos/nest-proxy.token + nest-device.token
 *       NEST_PROXY_TOKEN env · --auth-token <t> (avoid: visible in ps)
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
import { createAccessLog } from "./access-log.mjs"; /* ACCESSLOG */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* CAMLOCK1 tests: NEST_PROXY_TEST_GOOGLE may point Google calls at a LOOPBACK http mock only. */
const TEST_GOOGLE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.NEST_PROXY_TEST_GOOGLE || "") ? process.env.NEST_PROXY_TEST_GOOGLE : "";
const OAUTH_URL = TEST_GOOGLE ? TEST_GOOGLE + "/token" : "https://oauth2.googleapis.com/token";
const SDM_BASE = TEST_GOOGLE ? TEST_GOOGLE + "/v1" : "https://smartdevicemanagement.googleapis.com/v1";
const DEFAULT_AUTH_FILES = [
  path.join(os.homedir(), ".config", "wardos", "nest-proxy.token"),
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

function guessWhere(name) {
  const n = String(name || "").toLowerCase();
  if (/front|door|entry|porch/.test(n)) return "Entry";
  if (/drive|garage/.test(n)) return /drive/.test(n) ? "Drive" : "Garage";
  if (/back|yard|patio|garden/.test(n)) return "Yard";
  if (/living|family|room/.test(n)) return "Inside";
  if (/kitchen/.test(n)) return "Kitchen";
  return "Cam";
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
  return "application/octet-stream";
}

export const DEVICE_NAME_RE = /^enterprises\/[A-Za-z0-9_-]+\/devices\/[A-Za-z0-9_-]+$/;
/* PRIVFEED3 · vendor/ holds the in-page QR library (Dad's Pair a screen tile); nothing else under it.
   HUBPIN1 · art/, assets/ and theme-tiles/ serve page art and their scripts (image + js only, every image there is on
   the privacy art allow-list); no traversal (no "..", no dot-segments, no backslash, no encoded slash tricks). */
export const STATIC_OK = /^(?:ori\/[A-Za-z0-9_\/.-]+|[A-Za-z0-9_.-]+)\.(?:html|js|css|png|jpg|webp|svg|woff2?)$|^vendor\/[A-Za-z0-9_.-]+\.js$|^fonts\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:ttf|woff2?)$|^(?:art|assets|theme-tiles)\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp|gif|svg|js)$/;
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

/** ACCESSLOG · auth tokens with the slot each came from (never logged). nest-proxy.token and NEST_PROXY_TOKEN are the
    retired cams key ("retired"); nest-device.token and --auth-token are the device key ("device"). First source wins. */
export function loadAuthEntries(args, env = process.env) {
  const out = [];
  const add = (t, slot) => { t = String(t || "").trim(); if (t.length >= 16 && !out.some((e) => e.t === t)) out.push({ t, slot }); };
  add(args.cliToken, "device");
  add(env.NEST_PROXY_TOKEN, "retired");
  for (const f of (args.authFiles.length ? args.authFiles : DEFAULT_AUTH_FILES)) {
    const slot = /^nest-proxy\.token/.test(path.basename(f)) ? "retired" : "device";
    try { for (const t of fs.readFileSync(f, "utf8").split(/\s+/)) add(t, slot); } catch { /* missing file */ }
  }
  return out;
}
/** CAMLOCK1 · collect auth tokens; never logs them. */
export function loadAuthTokens(args, env = process.env) {
  return loadAuthEntries(args, env).map((e) => e.t);
}
/** ACCESSLOG · which slot the request's key header matched: "device" | "retired" | "none" (constant time over all) */
export function authSlot(req, entries) {
  const h = String(req.headers["x-nest-proxy-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || "");
  if (!h || !entries || !entries.length) return "none";
  let slot = "none";
  for (const e of entries) if (safeEq(h, e.t) && slot === "none") slot = e.slot;
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
  --lan           bind 0.0.0.0 (set NEST_PROXY_TOKEN for auth)
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
    console.error("FATAL: CAMLOCK1 · no auth token (--auth-token-file, ~/.config/wardos/nest-proxy.token / nest-device.token, or NEST_PROXY_TOKEN; >= 16 chars). Refusing to start.");
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
  const access = createAccessLog({ name: "nest-webrtc-proxy", secrets: () => args.authTokens });

  const server = http.createServer(async (req, res) => {
    try { access.setSlot(req, authSlot(req, authEntries)); access.attach(req, res); } catch { /* logging never breaks a request */ }
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

      // Static viewer + assets from repo root (nest-webrtc.html etc.)
      if (req.method === "GET" && !pathname.startsWith("/api/")) {
        /* PRIVFEED2 · this port is reachable through the hub tunnel. Serve ONLY public page code (the same files
         * Pages serves): root or ori/ html/js/css/images. Never data/, scripts/, plates/, dotfiles (.git), json, md. */
        let rel = "";
        try { rel = decodeURIComponent(pathname === "/" ? "/nest-webrtc.html" : pathname).replace(/^\/+/, ""); } catch { return json(res, 404, { error: "not found" }); }
        if (!staticOk(rel)) {
          return json(res, 404, { error: "not found" });
        }
        let filePath = safeJoin(ROOT, "/" + rel);
        if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return json(res, 404, { error: "not found" });
        }
        const buf = fs.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": mimeFor(filePath),
          "Cache-Control": pathname.endsWith(".html") || pathname.endsWith(".js") ? "no-store" : "public, max-age=120",
          "Access-Control-Allow-Origin": "*",
        });
        return res.end(buf);
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

  server.listen(args.port, args.host, () => {
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
