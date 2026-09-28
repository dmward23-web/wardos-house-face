#!/usr/bin/env node
/**
 * WardOS House Face · Emerson Sensi live snapshot
 *
 * Reads SENSI_REFRESH_TOKEN (env or --token-file), exchanges for access_token,
 * opens the Sensi realtime WebSocket once, writes data/sensi-live.json.
 *
 * Auth is ONE-TIME manual: Dan pastes refresh_token from
 * https://manager.sensicomfort.com/ DevTools (see ../SENSI-LIVE.md).
 * Never commit the token. Never invent temps — if auth missing, write need_token.
 *
 * Usage:
 *   SENSI_REFRESH_TOKEN=... node scripts/sensi-fetch.mjs
 *   node scripts/sensi-fetch.mjs --token-file ~/.config/wardos/sensi-refresh.token
 *   node scripts/sensi-fetch.mjs --out data/sensi-live.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OAUTH_URL = "https://oauth.sensiapi.io/token";
const CLIENT_ID = "fleet";
const CLIENT_SECRET =
  "JLFjJmketRhj>M9uoDhusYKyi?zUyNqhGB)H2XiwLEF#KcGKrRD2JZsDQ7ufNven";
const WS_URL =
  "wss://rt.sensiapi.io/thermostat/?EIO=4&transport=websocket&capabilities=operating_mode_settings,fan_mode_settings";

const MODE_MAP = { heat: "Heat", cool: "Cool", auto: "Auto", off: "Off", aux: "Heat" };
const FAN_MAP = { auto: "Auto", on: "On", smart: "Auto" };

function parseArgs(argv) {
  const out = { tokenFile: null, outPath: path.join(ROOT, "data", "sensi-live.json"), timeoutMs: 25000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token-file" && argv[i + 1]) out.tokenFile = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (a === "--timeout" && argv[i + 1]) out.timeoutMs = Number(argv[++i]) || out.timeoutMs;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function chicagoNowIso() {
  const d = new Date();
  // Store true UTC ISO; UI formats in America/Chicago
  return d.toISOString();
}

function writeJson(outPath, payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  fs.renameSync(tmp, outPath);
}

function needTokenPayload(reason) {
  return {
    status: "need_token",
    updatedAt: chicagoNowIso(),
    source: "sensi-cloud",
    writeSupported: false,
    thermostat: null,
    error: reason || "SENSI_REFRESH_TOKEN missing — Atlas must request refresh_token from Dan (see SENSI-LIVE.md)",
  };
}

function errorPayload(msg) {
  return {
    status: "error",
    updatedAt: chicagoNowIso(),
    source: "sensi-cloud",
    writeSupported: false,
    thermostat: null,
    error: String(msg || "unknown error"),
  };
}

function pickSetpoint(state) {
  const mode = String(state.operating_mode || "").toLowerCase();
  if (mode === "cool") return Number(state.current_cool_temp);
  if (mode === "auto") {
    // Wall glance: prefer heat setpoint when dual; UI can show both later
    const h = Number(state.current_heat_temp);
    const c = Number(state.current_cool_temp);
    if (Number.isFinite(h)) return h;
    if (Number.isFinite(c)) return c;
  }
  const h = Number(state.current_heat_temp);
  if (Number.isFinite(h)) return h;
  const c = Number(state.current_cool_temp);
  return Number.isFinite(c) ? c : null;
}

function normalizeDevice(packet) {
  const state = packet.state || {};
  const reg = packet.registration || {};
  const modeRaw = String(state.operating_mode || "").toLowerCase();
  const fanRaw = String(state.fan_mode || "").toLowerCase();
  const ambient = Number(state.display_temp);
  const setpoint = pickSetpoint(state);
  return {
    name: reg.name || "Sensi",
    icdId: packet.icd_id || null,
    online: String(state.status || "").toLowerCase() === "online",
    ambient: Number.isFinite(ambient) ? Math.round(ambient) : null,
    ambientRaw: Number.isFinite(ambient) ? ambient : null,
    setpoint: Number.isFinite(setpoint) ? Math.round(setpoint) : null,
    heatSetpoint: Number.isFinite(Number(state.current_heat_temp))
      ? Math.round(Number(state.current_heat_temp))
      : null,
    coolSetpoint: Number.isFinite(Number(state.current_cool_temp))
      ? Math.round(Number(state.current_cool_temp))
      : null,
    mode: MODE_MAP[modeRaw] || "Off",
    fan: FAN_MAP[fanRaw] || "Auto",
    humidity: Number.isFinite(Number(state.humidity)) ? Number(state.humidity) : null,
    hold: String(state.hold_mode || "").toLowerCase() === "on",
    scale: String(state.display_scale || "f").toLowerCase(),
  };
}

async function exchangeRefreshToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const resp = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "*/*",
    },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`oauth HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json = await resp.json();
  if (!json.access_token) throw new Error("oauth response missing access_token");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresIn: json.expires_in,
  };
}

function fetchStateOnce(accessToken, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let engineOpen = false;
    const devices = [];

    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: "bearer " + accessToken },
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      if (devices.length) resolve(devices);
      else reject(new Error("timed out waiting for Sensi state"));
    }, timeoutMs);

    function done(err, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      if (err) reject(err);
      else resolve(result);
    }

    ws.on("open", () => {
      // Engine.IO open; wait for 0{...} then send 40 to open Socket.IO namespace
    });

    ws.on("message", (data) => {
      const msg = typeof data === "string" ? data : data.toString("utf8");

      if (msg.startsWith("0") && !engineOpen) {
        engineOpen = true;
        try { ws.send("40"); } catch (_) {}
        return;
      }

      // Token expired / auth reject
      if (msg.startsWith("44") || msg.includes("jwt expired") || msg.includes("Unauthorized")) {
        done(new Error("websocket auth rejected (jwt expired or unauthorized)"));
        return;
      }

      // Socket.IO EVENT: 42["state",[...]]
      if (!msg.startsWith("42")) return;
      try {
        const payload = JSON.parse(msg.slice(2));
        const event = payload[0];
        const body = payload[1];
        if (event === "state" && Array.isArray(body)) {
          for (const d of body) {
            if (d && d.state && Object.keys(d.state).length) {
              devices.push(d);
            } else if (d && d.icd_id) {
              // registration-only packet — keep but prefer later state
              const existing = devices.findIndex((x) => x.icd_id === d.icd_id);
              if (existing < 0) devices.push(d);
              else devices[existing] = { ...devices[existing], ...d };
            }
          }
          // Prefer first device that has ambient
          const ready = devices.find((d) => d.state && d.state.display_temp != null);
          if (ready) done(null, devices);
        }
      } catch (e) {
        // ignore parse noise
      }
    });

    ws.on("error", (err) => done(err));
    ws.on("close", () => {
      if (!settled) {
        if (devices.length) done(null, devices);
        else done(new Error("websocket closed before state"));
      }
    });
  });
}

function persistRotatedToken(tokenFile, newRefresh) {
  if (!tokenFile || !newRefresh) return;
  try {
    fs.writeFileSync(tokenFile, newRefresh.trim() + "\n", { mode: 0o600 });
  } catch (_) {
    // non-fatal — Atlas may manage rotation separately
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: SENSI_REFRESH_TOKEN=... node scripts/sensi-fetch.mjs [--token-file PATH] [--out PATH]`);
    process.exit(0);
  }

  let refresh =
    process.env.SENSI_REFRESH_TOKEN ||
    process.env.SENSI_REFRESH ||
    "";
  if (args.tokenFile) {
    try {
      refresh = fs.readFileSync(args.tokenFile, "utf8").trim();
    } catch (e) {
      writeJson(args.outPath, needTokenPayload("token file unreadable: " + args.tokenFile));
      console.error("need_token: token file missing");
      process.exit(2);
    }
  }

  if (!refresh) {
    writeJson(args.outPath, needTokenPayload());
    console.error("need_token: set SENSI_REFRESH_TOKEN or --token-file (see SENSI-LIVE.md)");
    process.exit(2);
  }

  try {
    const tokens = await exchangeRefreshToken(refresh);
    if (args.tokenFile && tokens.refreshToken && tokens.refreshToken !== refresh) {
      persistRotatedToken(args.tokenFile, tokens.refreshToken);
    }

    const packets = await fetchStateOnce(tokens.accessToken, args.timeoutMs);
    const withState = packets.filter((p) => p && p.state && p.state.display_temp != null);
    const chosen = withState[0] || packets[0];
    if (!chosen || !chosen.state) {
      writeJson(args.outPath, errorPayload("connected but no thermostat state in payload"));
      console.error("error: no state");
      process.exit(1);
    }

    const thermostat = normalizeDevice(chosen);
    if (thermostat.ambient == null) {
      writeJson(args.outPath, errorPayload("state missing display_temp — refusing to invent"));
      console.error("error: missing ambient");
      process.exit(1);
    }

    const payload = {
      status: "live",
      updatedAt: chicagoNowIso(),
      source: "sensi-cloud",
      writeSupported: false,
      thermostat,
      error: null,
    };
    writeJson(args.outPath, payload);
    console.log(
      `live: ${thermostat.name} ambient=${thermostat.ambient}° set=${thermostat.setpoint}° mode=${thermostat.mode} fan=${thermostat.fan} → ${args.outPath}`
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    // Auth failures → need_token so UI stays CONNECT, not fake LIVE
    const authFail =
      /oauth HTTP 40[013]|invalid_grant|jwt expired|unauthorized|Invalid token/i.test(msg);
    writeJson(args.outPath, authFail ? needTokenPayload(msg) : errorPayload(msg));
    console.error((authFail ? "need_token: " : "error: ") + msg);
    process.exit(authFail ? 2 : 1);
  }
}

main();
