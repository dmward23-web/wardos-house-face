#!/usr/bin/env node
/**
 * WardOS House Face · Kasa lights WRITE proxy (box / LAN / tunnel)
 *
 * Holds Kasa password off GitHub Pages. Browser POSTs here → spawns
 * scripts/kasa-write.py (tplink-cloud-api) → JSON back. Creds never leave box.
 *
 * Secrets (mode 600, never git):
 *   ~/.config/wardos/kasa.user + kasa.password
 *   ~/.config/wardos/lights-proxy.token  (optional auth; required for --lan)
 *
 * Usage:
 *   node scripts/lights-write-proxy.mjs
 *   node scripts/lights-write-proxy.mjs --host 0.0.0.0 --port 8788 --lan
 *   LIGHTS_PROXY_TOKEN=… node scripts/lights-write-proxy.mjs --lan
 *
 * Default bind: 127.0.0.1:8788
 * See ../LIGHTS-LIVE.md
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as sensi from "./sensi-control.mjs"; /* SENSICTL1 */
import * as sensiTravel from "./sensi-travel.mjs"; /* TRAVEL1 · wall Travel / Back home */
import { createNiceOne } from "./house/nice-one.mjs"; /* NICEONE1 · parent PIN verify + one-use grant for the jar Nice one (time/picks, never cash) */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_TOKEN = path.join(os.homedir(), ".config", "wardos", "lights-proxy.token");
const DEFAULT_PYTHON =
  process.env.KASA_VENV_PYTHON ||
  "/workspace/plates/2026-09-28/kasa-live/.venv/bin/python";
const DEFAULT_WRITE = path.join(ROOT, "scripts", "kasa-write.py");
const DEFAULT_DAEMON = path.join(ROOT, "scripts", "kasa-daemon.py");
const LIVE_JSON = path.join(ROOT, "data", "lights-live.json");

const ROSTER_IDS = new Set(["dining-room", "harris-room", "kitchen"]);

function parseArgs(argv) {
  const out = {
    host: "127.0.0.1",
    port: 8788,
    lan: false,
    authToken: process.env.LIGHTS_PROXY_TOKEN || "",
    tokenFile: DEFAULT_TOKEN,
    python: DEFAULT_PYTHON,
    writeScript: DEFAULT_WRITE,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--host" && argv[i + 1]) out.host = argv[++i];
    else if (a === "--port" && argv[i + 1]) out.port = Number(argv[++i]);
    else if (a === "--lan") {
      out.lan = true;
      if (out.host === "127.0.0.1") out.host = "0.0.0.0";
    } else if (a === "--auth-token" && argv[i + 1]) out.authToken = argv[++i];
    else if (a === "--token-file" && argv[i + 1]) out.tokenFile = path.resolve(argv[++i]);
    else if (a === "--python" && argv[i + 1]) out.python = argv[++i];
    else if (a === "--write" && argv[i + 1]) out.writeScript = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Lights-Proxy-Token, X-Nest-Proxy-Token",
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
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/* TAPSYNC1 · shared kid taps store (box only, never git) */
const TAPS_FILE = path.join(os.homedir(), ".config", "wardos", "kid-taps.json");
const TAP_KEY_RE = /^house-checkoffs:(hayes|harris|ainsley):(week:)?\d{4}-\d{2}-\d{2}$/;
const TAP_ID_RE = /^(hay|har|ain)-[a-z0-9-]{2,24}$/;
function loadTaps() {
  try { return JSON.parse(fs.readFileSync(TAPS_FILE, "utf8")) || {}; } catch { return {}; }
}
function saveTaps(taps) {
  const tmp = TAPS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(taps), { mode: 0o600 });
  fs.renameSync(tmp, TAPS_FILE);
}

function checkAuth(req, args) {
  // Always require token when set (even on localhost) so tunnel cannot be open.
  if (!args.authToken) {
    // localhost without token only when not --lan
    return !args.lan;
  }
  const h =
    req.headers["x-lights-proxy-token"] ||
    req.headers["x-nest-proxy-token"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const u = new URL(req.url || "/", "http://x");
  const q = u.searchParams.get("proxyToken") || u.searchParams.get("lightsProxyToken");
  return h === args.authToken || q === args.authToken;
}

function hasKasaCreds() {
  const home = os.homedir();
  const user =
    (process.env.KASA_USER || process.env.KASA_USERNAME || "").trim() ||
    readText(path.join(home, ".config", "wardos", "kasa.user")) ||
    "";
  const pass =
    (process.env.KASA_PASSWORD || "").trim() ||
    readText(path.join(home, ".config", "wardos", "kasa.password")) ||
    "";
  return Boolean(user && pass);
}

function runWrite(argsList, args) {
  return new Promise((resolve) => {
    const child = spawn(args.python, [args.writeScript, ...argsList], {
      env: process.env,
      timeout: 120000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message, code: 127, stdout, stderr });
    });
    child.on("close", (code) => {
      let parsed = null;
      const start = stdout.indexOf("{");
      const end = stdout.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(stdout.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
      resolve({
        ok: code === 0 && parsed && parsed.ok,
        code: code ?? 1,
        parsed,
        stdout,
        stderr,
        error: parsed?.error || (code !== 0 ? `write exit ${code}` : null),
      });
    });
  });
}

/* LIGHTSFAST1 · warm Kasa session: one long-lived python child keeps the
 * TP-Link cloud login + device handles, so a tap is one passthrough (~0.5 s).
 * Falls back to one-shot kasa-write.py if the daemon is down. */
const warm = {
  child: null,
  ready: false,
  nextRid: 1,
  pending: new Map(),
  lights: null,
  at: null,
  buf: "",
  restarts: 0,
};

function startDaemon(args) {
  if (!fs.existsSync(DEFAULT_DAEMON)) return;
  const child = spawn(args.python, [DEFAULT_DAEMON], {
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  warm.child = child;
  warm.ready = false;
  warm.buf = "";
  child.stdout.on("data", (d) => {
    warm.buf += d.toString("utf8");
    let i;
    while ((i = warm.buf.indexOf("\n")) >= 0) {
      const line = warm.buf.slice(0, i);
      warm.buf = warm.buf.slice(i + 1);
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (Array.isArray(msg.lights)) {
        warm.lights = msg.lights;
        warm.at = new Date().toISOString();
      }
      if (msg.event === "ready") {
        warm.ready = !!msg.ok;
        console.log(`[lights-write-proxy] warm kasa ${msg.ok ? "ready" : "failed"}`);
      }
      if (msg.rid != null && warm.pending.has(msg.rid)) {
        const p = warm.pending.get(msg.rid);
        warm.pending.delete(msg.rid);
        clearTimeout(p.timer);
        p.resolve(msg);
      }
    }
  });
  child.stderr.on("data", () => {});
  child.on("close", (code) => {
    console.warn(`[lights-write-proxy] warm kasa exited ${code}; restarting`);
    warm.child = null;
    warm.ready = false;
    for (const [, p] of warm.pending) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: "daemon exited" });
    }
    warm.pending.clear();
    const delay = Math.min(60000, 2000 * 2 ** Math.min(warm.restarts++, 5));
    setTimeout(() => startDaemon(args), delay);
  });
  child.on("spawn", () => {
    setTimeout(() => {
      if (warm.child === child) warm.restarts = 0;
    }, 120000);
  });
}

function daemonCall(msg, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!warm.child || !warm.ready) return resolve(null);
    const rid = warm.nextRid++;
    const timer = setTimeout(() => {
      warm.pending.delete(rid);
      resolve({ ok: false, error: "warm kasa timeout" });
    }, timeoutMs);
    warm.pending.set(rid, { resolve, timer });
    warm.child.stdin.write(JSON.stringify({ rid, ...msg }) + "\n");
  });
}

function liveWithWarm() {
  let live = null;
  try {
    live = JSON.parse(fs.readFileSync(LIVE_JSON, "utf8"));
  } catch {
    live = null;
  }
  if (!warm.lights) return live;
  return {
    ...(live || {}),
    status: "live",
    writeSupported: true,
    source: "lights-write-proxy-warm",
    fetchedAt: warm.at || new Date().toISOString(),
    lights: warm.lights,
    error: null,
  };
}

let refreshTimer = null;
function scheduleSnapshotRefresh() {
  // Debounced, non-blocking: keep data/lights-live.json honest for Pages pollers.
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshLiveSnapshot().catch(() => {});
  }, 20000);
}

function refreshLiveSnapshot() {
  return new Promise((resolve) => {
    const fetchScript = path.join(ROOT, "scripts", "lights-fetch.mjs");
    if (!fs.existsSync(fetchScript)) return resolve({ ok: false, error: "no lights-fetch" });
    const child = spawn(process.execPath, [fetchScript], {
      cwd: ROOT,
      env: process.env,
      timeout: 120000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      let live = null;
      try {
        if (fs.existsSync(LIVE_JSON)) {
          live = JSON.parse(fs.readFileSync(LIVE_JSON, "utf8"));
        }
      } catch {
        live = null;
      }
      resolve({ ok: code === 0, code, live, stdout, stderr });
    });
    child.on("error", (err) => resolve({ ok: false, error: err.message }));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node scripts/lights-write-proxy.mjs [--host 127.0.0.1] [--port 8788] [--lan]
  --lan           bind 0.0.0.0 (requires LIGHTS_PROXY_TOKEN)
  Secrets: ~/.config/wardos/kasa.user + kasa.password (+ lights-proxy.token)`);
    process.exit(0);
  }

  if (!args.authToken) {
    args.authToken = readText(args.tokenFile) || "";
  }
  if (args.lan && !args.authToken) {
    args.authToken =
      "lights-" +
      Math.random().toString(36).slice(2, 12) +
      Math.random().toString(36).slice(2, 8);
    console.warn("WARN: --lan without token — generated ephemeral: " + args.authToken);
  }
  // Prefer always-auth when token file exists (tunnel-safe)
  if (!args.authToken) {
    console.warn("WARN: no lights-proxy.token — localhost API open (no auth)");
  }

  if (!fs.existsSync(args.python)) {
    console.error("FATAL: kasa venv python missing: " + args.python);
    process.exit(2);
  }
  if (!fs.existsSync(args.writeScript)) {
    console.error("FATAL: kasa-write.py missing: " + args.writeScript);
    process.exit(2);
  }
  if (!hasKasaCreds()) {
    console.error("FATAL: kasa.user + kasa.password missing under ~/.config/wardos/");
    process.exit(2);
  }

  const niceOne = createNiceOne(); /* NICEONE1 · ~/.config/wardos/parent-pin.json (600) · verify only; Ledger's house-jar.js writes client-side */
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = u.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Lights-Proxy-Token, X-Nest-Proxy-Token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
      return res.end();
    }

    try {
      if (pathname === "/health" || pathname === "/api/health") {
        return json(res, 200, {
          ok: true,
          service: "lights-write-proxy",
          bind: `${args.host}:${args.port}`,
          lan: args.lan,
          authRequired: Boolean(args.authToken),
          writeSupported: true,
          warm: warm.ready,
          kasaCreds: hasKasaCreds(),
          sensi: true,
          ts: new Date().toISOString(),
        });
      }

      if (!checkAuth(req, args)) {
        return json(res, 401, {
          error: "unauthorized · need X-Lights-Proxy-Token / ?proxyToken=",
        });
      }

      /* NICEONE1 · parent "Nice one": PIN verified HERE on the hub (never in the browser), then one time/pick grant.
         Behind the same checkAuth gate as Sensi/Kasa above. Not configured until a PIN is set (scripts/parent-pin.mjs set). No book write here. */
      if (pathname === "/api/nice-one" || pathname.startsWith("/api/nice-one/")) {
        const body = req.method === "POST" ? await readBody(req) : {};
        const r = await niceOne.handle(pathname, req.method, body);
        if (r) {
          if (pathname !== "/api/nice-one/status") console.log(`[nice-one] ${new Date().toISOString()} ${pathname} -> ${r.status} ${r.body.error || "ok"}`); /* never logs the PIN */
          return json(res, r.status, r.body);
        }
      }

      /* TAPSYNC1 · kids chore taps shared across every device (same key + tunnel) */
      if (pathname === "/api/taps" && (req.method === "GET" || req.method === "POST")) {
        const taps = loadTaps();
        if (req.method === "POST") {
          const body = await readBody(req);
          const changes = Array.isArray(body.changes) ? body.changes.slice(0, 2000) : [];
          let applied = 0;
          for (const c of changes) {
            if (!c || !TAP_KEY_RE.test(String(c.key)) || !TAP_ID_RE.test(String(c.id)) || typeof c.v !== "boolean") continue;
            const t = Number(c.t) || 0;
            const k = (taps[c.key] = taps[c.key] || {});
            const cur = k[c.id];
            if (!cur || t > cur.t) { k[c.id] = { v: c.v, t }; applied++; }
            else if (t === cur.t && c.v && !cur.v) { k[c.id] = { v: true, t }; applied++; }
          }
          if (applied) saveTaps(taps);
          return json(res, 200, { ok: true, applied, taps, ts: new Date().toISOString() });
        }
        return json(res, 200, { ok: true, taps, ts: new Date().toISOString() });
      }

      /* SENSICTL1 · live Sensi thermostat read + control (same key + tunnel as lights) */
      if (pathname === "/api/sensi" && req.method === "GET") {
        try {
          return json(res, 200, { ok: true, service: "sensi", thermostat: await sensi.readState(), ts: new Date().toISOString() });
        } catch (e) {
          return json(res, 502, { ok: false, error: String(e.message || e) });
        }
      }
      if (pathname === "/api/sensi/set" && req.method === "POST") {
        const body = await readBody(req);
        try {
          let t;
          if (body.kind === "mode") t = await sensi.setMode(body.mode);
          else if (body.kind === "temp") t = await sensi.setTemp(body.mode, body.temp);
          else return json(res, 400, { ok: false, error: "kind must be temp or mode" });
          console.log(`[sensi] ${new Date().toISOString()} ${body.kind} ${body.mode || ""} ${body.temp || ""} -> heat ${t.heatSetpoint} cool ${t.coolSetpoint} mode ${t.mode}`);
          return json(res, 200, { ok: true, thermostat: t, ts: new Date().toISOString() });
        } catch (e) {
          return json(res, 502, { ok: false, error: String(e.message || e) });
        }
      }

      /* TRAVEL1 · wall thermostat Travel / Back home (Dan Oct 1). Prior setting saved box-side only
         (~/.config/wardos/sensi-travel-restore.json, mode 600) BEFORE any write; never in Pages JSON. */
      if (pathname === "/api/sensi/travel" && (req.method === "GET" || req.method === "POST")) {
        const store = sensiTravel.fileStore();
        try {
          if (req.method === "GET") {
            const st = await sensiTravel.travelStatus({ sensi, store });
            return json(res, 200, { ok: true, ...st, ts: new Date().toISOString() });
          }
          const body = await readBody(req);
          let out;
          if (body.action === "travel") out = await sensiTravel.goTravel({ sensi, store });
          else if (body.action === "back") out = await sensiTravel.goBack({ sensi, store });
          else return json(res, 400, { ok: false, error: "action must be travel or back" });
          console.log(`[sensi-travel] ${new Date().toISOString()} ${body.action} -> ${JSON.stringify(out.thermostat ? { mode: out.thermostat.mode, heat: out.thermostat.heatSetpoint, cool: out.thermostat.coolSetpoint } : out)}`);
          return json(res, 200, { ...out, saved: !!store.load(), ts: new Date().toISOString() });
        } catch (e) {
          return json(res, e.status || 502, { ok: false, error: String(e.message || e), saved: !!store.load() });
        }
      }

      if (pathname === "/api/lights" && req.method === "GET") {
        const live = liveWithWarm();
        return json(res, 200, {
          ...(live || {}),
          status: live?.status || "unknown",
          writeSupported: true,
          source: live?.source || "lights-write-proxy",
          lights: live?.lights || [],
          fetchedAt: live?.fetchedAt || null,
          proxy: { write: true, warm: warm.ready },
        });
      }

      if (pathname === "/api/lights/refresh" && req.method === "POST") {
        const snap = await refreshLiveSnapshot();
        return json(res, snap.ok ? 200 : 500, {
          ok: snap.ok,
          live: snap.live,
          error: snap.error || null,
        });
      }

      if (
        (pathname === "/api/lights/set" || pathname === "/api/lights") &&
        req.method === "POST"
      ) {
        const body = await readBody(req);
        const id = String(body.id || body.lightId || "").trim();
        const allOn = body.all === true || body.allOn === true;
        const allOff = body.all === false || body.allOff === true;

        let argv = [];
        if (allOn) argv = ["--all-on"];
        else if (allOff) argv = ["--all-off"];
        else {
          if (!ROSTER_IDS.has(id)) {
            return json(res, 400, {
              error: "id required: dining-room|harris-room|kitchen",
            });
          }
          argv = ["--id", id];
          if (typeof body.on === "boolean") argv.push("--on", body.on ? "true" : "false");
          if (typeof body.brightness === "number") {
            argv.push("--brightness", String(Math.round(body.brightness)));
          }
          if (argv.length === 2) {
            return json(res, 400, { error: "need on and/or brightness" });
          }
        }

        const t0 = Date.now();
        let msg;
        if (allOn || allOff) msg = { op: "all", on: !!allOn };
        else {
          msg = { op: "set", id };
          if (typeof body.on === "boolean") msg.on = body.on;
          if (typeof body.brightness === "number") msg.brightness = Math.round(body.brightness);
        }
        const fast = await daemonCall(msg);
        if (fast && fast.ok) {
          scheduleSnapshotRefresh();
          console.log(`[lights-write-proxy] warm ${JSON.stringify(msg)} ${Date.now() - t0}ms`);
          return json(res, 200, {
            ok: true,
            warm: true,
            ms: Date.now() - t0,
            write: { ok: true, lights: fast.lights },
            live: liveWithWarm(),
          });
        }
        if (fast && !fast.ok && /unknown id|need on/.test(fast.error || "")) {
          return json(res, 400, { ok: false, error: fast.error });
        }

        // Fallback: one-shot cold write (full login) if warm session is down.
        const result = await runWrite(argv, args);
        if (!result.ok) {
          return json(res, 502, {
            ok: false,
            error: result.error || "kasa write failed",
            detail: result.parsed || null,
          });
        }
        scheduleSnapshotRefresh();
        console.log(`[lights-write-proxy] cold ${argv.join(" ")} ${Date.now() - t0}ms`);
        return json(res, 200, {
          ok: true,
          warm: false,
          ms: Date.now() - t0,
          write: result.parsed,
          live: liveWithWarm(),
        });
      }

      return json(res, 404, { error: "not found" });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.error("[lights-write-proxy]", msg);
      return json(res, 500, { error: msg });
    }
  });

  startDaemon(args);
  process.on("exit", () => {
    try {
      if (warm.child) warm.child.kill();
    } catch {}
  });
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => process.exit(0));

  server.listen(args.port, args.host, () => {
    const shown = args.host === "0.0.0.0" ? "0.0.0.0 (all interfaces)" : args.host;
    console.log(`lights-write-proxy listening http://${shown}:${args.port}`);
    console.log(`  health:  http://127.0.0.1:${args.port}/health`);
    console.log(`  set:     POST http://127.0.0.1:${args.port}/api/lights/set`);
    if (args.authToken) console.log(`  auth:    X-Lights-Proxy-Token (set)`);
    console.log(`  secrets: ~/.config/wardos/kasa.* (mode 600) — never on Pages`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
