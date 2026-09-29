#!/usr/bin/env node
/**
 * WardOS House Face · Lights live snapshot
 *
 * Creds: ~/.config/wardos/kasa.user + kasa.password (or env KASA_USER /
 * KASA_PASSWORD / KASA_USERNAME). Not the old kasa.token path.
 *
 * If missing → status need_token · roster ids only · controls dark (never DEMO).
 * If present → spawn plates kasa-live venv python + scripts/kasa-probe.py,
 * capture stdout JSON, write --out / data/lights-live.json.
 * On probe failure → status error (keep last lights if any).
 *
 * writeSupported true when status=live (writes via lights-write-proxy on box).
 * LIGHTS6: bake public writeProxy (+ writeProxyToken) from
 * ~/.config/wardos/lights-write-proxy.url + lights-proxy.token so Pages
 * hard-refresh works — no ?lightsProxy= seed. Never put kasa.* in JSON.
 *
 * Usage:
 *   node scripts/lights-fetch.mjs
 *   node scripts/lights-fetch.mjs --out data/lights-live.json
 *
 * See ../LIGHTS-LIVE.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_PYTHON =
  "/workspace/plates/2026-09-28/kasa-live/.venv/bin/python";
const DEFAULT_PROBE = path.join(ROOT, "scripts", "kasa-probe.py");

const STARTER = [
  {
    id: "dining-room",
    name: "Dining Room",
    where: "Dining Room",
    kind: "dimmer",
    on: true,
    brightness: 52,
    online: true,
  },
  {
    id: "harris-room",
    name: "Harris's Room",
    where: "Harris's Room",
    kind: "dimmer",
    on: true,
    brightness: 100,
    online: true,
  },
  {
    id: "kitchen",
    name: "Kitchen",
    where: "Kitchen",
    kind: "dimmer",
    on: true,
    brightness: 1,
    online: true,
  },
];

function parseArgs(argv) {
  const out = {
    outPath: path.join(ROOT, "data", "lights-live.json"),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.outPath = path.resolve(argv[++i]);
  }
  return out;
}

function readCredFile(name) {
  const home = process.env.HOME || "";
  const p = path.join(home, ".config", "wardos", name);
  if (!fs.existsSync(p)) return "";
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
}

/** Detect Kasa account email+password (not legacy kasa.token). */
function hasCreds() {
  const user =
    (process.env.KASA_USER || process.env.KASA_USERNAME || "").trim() ||
    readCredFile("kasa.user");
  const pass =
    (process.env.KASA_PASSWORD || "").trim() || readCredFile("kasa.password");
  return Boolean(user && pass);
}

/**
 * Public write proxy for Pages/Elo (LIGHTS6).
 * Prefer LIGHTS_WRITE_PROXY env, else ~/.config/wardos/lights-write-proxy.url,
 * else loopback (box-only). Never invent a tunnel URL.
 */
function resolveWriteProxy() {
  const fromEnv = (process.env.LIGHTS_WRITE_PROXY || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const fromFile = readCredFile("lights-write-proxy.url").replace(/\/$/, "");
  if (fromFile) return fromFile;
  return "http://127.0.0.1:8788";
}

/**
 * Proxy auth token (NOT Kasa password). LIGHTS6 UX: baked into lights-live.json
 * so Pages hard-refresh works without ?lightsProxy= seed. Readable on Pages by design.
 */
function resolveWriteProxyToken() {
  return (
    (process.env.LIGHTS_PROXY_TOKEN || "").trim() ||
    readCredFile("lights-proxy.token") ||
    ""
  );
}

function isLoopbackProxyUrl(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(String(url || ""));
}

/** Attach writeProxy (+ token when public) onto a live payload. */
function attachWriteProxy(payload) {
  const writeProxy = resolveWriteProxy();
  const token = resolveWriteProxyToken();
  payload.writeProxy = writeProxy;
  payload.writePath = "scripts/lights-write-proxy.mjs → kasa-write.py (cloud)";
  // LIGHTS6: publish token only when proxy is a public URL (Pages cannot use loopback).
  // Kasa email/password NEVER go here.
  if (token && !isLoopbackProxyUrl(writeProxy)) {
    payload.writeProxyToken = token;
  } else {
    delete payload.writeProxyToken;
  }
  return payload;
}

function writeJson(outPath, payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  fs.renameSync(tmp, outPath);
}

function readPrevious(outPath) {
  try {
    if (!fs.existsSync(outPath)) return null;
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    return null;
  }
}

function needTokenPayload(fetchedAt) {
  return {
    status: "need_token",
    fetchedAt,
    source: "kasa-pending",
    writeSupported: false,
    writeProxy: null,
    lights: STARTER.map((s) => ({
      id: s.id,
      name: s.name,
      where: s.where,
      kind: s.kind,
      on: null,
      brightness: null,
      online: null,
    })),
    reserved: [],
    error:
      "NEED TOKEN · no ~/.config/wardos/kasa.user+kasa.password (or KASA_USER/KASA_PASSWORD) yet. tplinkcloud.com is cameras-only; Kasa IoT needs app account creds. Controls stay dark — never DEMO.",
  };
}

function runProbe() {
  const py = process.env.KASA_VENV_PYTHON || DEFAULT_PYTHON;
  const probe =
    process.env.KASA_PROBE_SCRIPT ||
    (fs.existsSync(DEFAULT_PROBE)
      ? DEFAULT_PROBE
      : "/workspace/plates/2026-09-28/kasa-live/probe_kasa.py");

  if (!fs.existsSync(py)) {
    return {
      ok: false,
      error: `kasa venv python missing: ${py}`,
      code: 127,
      stderr: "",
      stdout: "",
    };
  }
  if (!fs.existsSync(probe)) {
    return {
      ok: false,
      error: `kasa-probe.py missing: ${probe}`,
      code: 127,
      stderr: "",
      stdout: "",
    };
  }

  const result = spawnSync(py, [probe], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 120000,
  });

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const code = result.status;

  if (result.error) {
    return {
      ok: false,
      error: `probe spawn failed: ${result.error.message}`,
      code: code ?? 1,
      stderr,
      stdout,
    };
  }

  let parsed = null;
  if (stdout) {
    try {
      // probe may print warnings on stderr; stdout should be pure JSON
      const start = stdout.indexOf("{");
      const end = stdout.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(stdout.slice(start, end + 1));
      }
    } catch (e) {
      return {
        ok: false,
        error: `probe JSON parse failed: ${e.message}`,
        code: code ?? 1,
        stderr,
        stdout: stdout.slice(0, 500),
      };
    }
  }

  if (code !== 0 || !parsed) {
    const msg =
      (parsed && parsed.error) ||
      stderr ||
      (stdout ? stdout.slice(0, 300) : "") ||
      `probe exit ${code}`;
    return {
      ok: false,
      error: String(msg),
      code: code ?? 1,
      stderr,
      stdout,
      parsed,
    };
  }

  return { ok: true, parsed, code, stderr };
}

function main() {
  const opts = parseArgs(process.argv);
  const fetchedAt = new Date().toISOString();
  let payload;

  if (!hasCreds()) {
    payload = needTokenPayload(fetchedAt);
  } else {
    const run = runProbe();
    if (
      run.ok &&
      run.parsed &&
      (run.parsed.status === "live" || run.parsed.status === "need_creds")
    ) {
      // Pass through probe JSON; arm write when LIVE (proxy holds creds)
      payload = {
        ...run.parsed,
        writeSupported: run.parsed.status === "live",
      }
      if (run.parsed.status === "live") attachWriteProxy(payload);
      if (payload.status === "need_creds") {
        // Treat as need_token for UI consistency if probe says need_creds
        // despite our local hasCreds() — rare race / empty files
        payload = {
          ...payload,
          status: "need_token",
          lights: payload.lights?.length ? payload.lights : STARTER,
          writeSupported: false,
        };
      }
    } else if (run.ok && run.parsed && run.parsed.status === "error") {
      const prev = readPrevious(opts.outPath);
      payload = {
        ...run.parsed,
        writeSupported: false,
        lights:
          Array.isArray(run.parsed.lights) && run.parsed.lights.length
            ? run.parsed.lights
            : prev?.lights?.length
              ? prev.lights
              : STARTER,
        reserved: run.parsed.reserved ?? prev?.reserved ?? [],
      };
    } else {
      // Probe failed — status error, keep last lights if any
      const prev = readPrevious(opts.outPath);
      const keepLights =
        prev?.lights?.length && Array.isArray(prev.lights)
          ? prev.lights
          : STARTER;
      const keepReserved = Array.isArray(prev?.reserved) ? prev.reserved : [];
      payload = {
        status: "error",
        fetchedAt,
        source: "tplink-cloud-api",
        writeSupported: false,
        lights: keepLights,
        reserved: keepReserved,
        error: run.error || "kasa probe failed",
      };
      // If probe returned a partial parsed object with status live but we
      // somehow failed validation — never invent LIVE from failure path.
      if (payload.status === "live") {
        payload.status = "error";
      }
    }
  }

  // Absolute invariant: never claim write without live status
  if (payload.status !== "live") {
    payload.writeSupported = false;
    if (payload.writeProxy === undefined) payload.writeProxy = null;
    delete payload.writeProxyToken;
  }
  if (payload.status === "live") {
    payload.writeSupported = true;
    attachWriteProxy(payload);
  }
  if (
    payload.status === "live" &&
    (!payload.lights || !Array.isArray(payload.lights) || !payload.lights.length)
  ) {
    payload.status = "error";
    payload.error =
      (payload.error || "") + " · refused LIVE with empty lights roster";
  }

  writeJson(opts.outPath, payload);
  console.log("Wrote", opts.outPath, "status=" + payload.status);
  if (payload.status === "live" && Array.isArray(payload.lights)) {
    for (const L of payload.lights) {
      const br =
        L.brightness != null ? ` brightness=${L.brightness}` : "";
      console.log(
        `  ${L.id}: ${L.on ? "on" : "off"}${br} online=${L.online}`
      );
    }
  }
  if (payload.status === "error" || payload.status === "need_token") {
    process.exitCode = payload.status === "error" ? 1 : 0;
  }
}

main();
