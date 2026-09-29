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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_TOKEN = path.join(os.homedir(), ".config", "wardos", "lights-proxy.token");
const DEFAULT_PYTHON =
  process.env.KASA_VENV_PYTHON ||
  "/workspace/plates/2026-09-28/kasa-live/.venv/bin/python";
const DEFAULT_WRITE = path.join(ROOT, "scripts", "kasa-write.py");
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
          kasaCreds: hasKasaCreds(),
          ts: new Date().toISOString(),
        });
      }

      if (!checkAuth(req, args)) {
        return json(res, 401, {
          error: "unauthorized · need X-Lights-Proxy-Token / ?proxyToken=",
        });
      }

      if (pathname === "/api/lights" && req.method === "GET") {
        let live = null;
        try {
          live = JSON.parse(fs.readFileSync(LIVE_JSON, "utf8"));
        } catch {
          live = null;
        }
        return json(res, 200, {
          status: live?.status || "unknown",
          writeSupported: true,
          source: "lights-write-proxy",
          lights: live?.lights || [],
          fetchedAt: live?.fetchedAt || null,
          proxy: { write: true },
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

        const result = await runWrite(argv, args);
        if (!result.ok) {
          return json(res, 502, {
            ok: false,
            error: result.error || "kasa write failed",
            detail: result.parsed || null,
          });
        }

        // Best-effort refresh snapshot for Pages pollers (non-fatal)
        const snap = await refreshLiveSnapshot();
        return json(res, 200, {
          ok: true,
          write: result.parsed,
          live: snap.live || null,
          refreshed: !!snap.ok,
        });
      }

      return json(res, 404, { error: "not found" });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.error("[lights-write-proxy]", msg);
      return json(res, 500, { error: msg });
    }
  });

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
