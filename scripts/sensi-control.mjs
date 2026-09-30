/**
 * SENSICTL1 · WardOS House Face · Emerson Sensi live CONTROL (box only)
 *
 * Used by lights-write-proxy.mjs (/api/sensi, /api/sensi/set) and CLI.
 * Refresh token lives in ~/.config/wardos/sensi-refresh.token (600, never git).
 * Token exchange is locked (mkdir lock) and rotated tokens are saved, so this and
 * the Sensi refresh routine (sensi-fetch.mjs) never trample each other.
 * Every write is read back from the thermostat; the reply is the real state.
 *
 * CLI:
 *   node scripts/sensi-control.mjs state
 *   node scripts/sensi-control.mjs temp heat 66
 *   node scripts/sensi-control.mjs mode auto
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TOKEN_FILE = process.env.SENSI_TOKEN_FILE || path.join(os.homedir(), ".config", "wardos", "sensi-refresh.token");
const LOCK_DIR = TOKEN_FILE + ".lock";
const LIVE_JSON = path.join(ROOT, "data", "sensi-live.json");
const OAUTH_URL = "https://oauth.sensiapi.io/token";
const CLIENT_ID = "fleet";
const CLIENT_SECRET = "JLFjJmketRhj>M9uoDhusYKyi?zUyNqhGB)H2XiwLEF#KcGKrRD2JZsDQ7ufNven";
const WS_URL = "wss://rt.sensiapi.io/thermostat/?EIO=4&transport=websocket&capabilities=operating_mode_settings,fan_mode_settings";

const MODES = new Set(["heat", "cool", "auto", "off"]);
const MIN_F = 50, MAX_F = 90;

let _access = null; // { token, exp }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withLock(fn) {
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(LOCK_DIR); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(LOCK_DIR).mtimeMs > 60000) fs.rmSync(LOCK_DIR, { recursive: true, force: true }); } catch (_) {}
      if (Date.now() - t0 > 30000) throw new Error("sensi token lock timeout");
      await sleep(250);
    }
  }
  try { return await fn(); } finally { try { fs.rmdirSync(LOCK_DIR); } catch (_) {} }
}

export async function accessToken() {
  if (_access && _access.exp - Date.now() > 120000) return _access.token;
  return withLock(async () => {
    const refresh = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (!refresh) throw new Error("need_token");
    const resp = await fetch(OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8", Accept: "*/*" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "refresh_token", refresh_token: refresh }),
    });
    if (!resp.ok) throw new Error("oauth HTTP " + resp.status);
    const j = await resp.json();
    if (!j.access_token) throw new Error("oauth missing access_token");
    if (j.refresh_token && j.refresh_token !== refresh) fs.writeFileSync(TOKEN_FILE, j.refresh_token.trim() + "\n", { mode: 0o600 });
    _access = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return _access.token;
  });
}

function normalize(packet) {
  const s = packet.state || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  const mode = String(s.operating_mode || "").toLowerCase();
  const heat = num(s.current_heat_temp), cool = num(s.current_cool_temp);
  return {
    name: (packet.registration || {}).name || "Sensi",
    icdId: packet.icd_id,
    online: String(s.status || "").toLowerCase() === "online",
    ambient: num(s.display_temp),
    mode: mode === "aux" ? "heat" : (MODES.has(mode) ? mode : "off"),
    heatSetpoint: heat,
    coolSetpoint: cool,
    setpoint: mode === "cool" ? cool : heat != null ? heat : cool,
    demand: s.demand_status ? { heat: Number(s.demand_status.heat) || 0, cool: Number(s.demand_status.cool) || 0 } : null,
    fan: String(s.fan_mode || "auto").toLowerCase(),
    humidity: Number.isFinite(Number(s.humidity)) ? Number(s.humidity) : null,
    scale: String(s.display_scale || "f").toLowerCase(),
  };
}

/** Open the socket, wait for state, optionally emit one command, then wait for state to reflect it. */
function session(token, { emit = null, until = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const byId = new Map();
    let engineOpen = false, sent = false, settled = false, acked = false;
    const ws = new WebSocket(WS_URL, { headers: { Authorization: "bearer " + token } });
    const finish = (err, val) => {
      if (settled) return; settled = true; clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => {
      const d = [...byId.values()].find((p) => p.state && p.state.display_temp != null);
      if (!emit && d) return finish(null, d);
      if (acked) return finish(null, { acked: true });
      finish(new Error(sent ? "thermostat did not confirm the change" : "timed out waiting for Sensi state"));
    }, timeoutMs);
    ws.on("message", (data) => {
      const msg = data.toString("utf8");
      if (msg === "2") { try { ws.send("3"); } catch (_) {} return; }
      if (msg.startsWith("0") && !engineOpen) { engineOpen = true; ws.send("40"); return; }
      if (msg.startsWith("44") || /jwt expired|Unauthorized/i.test(msg)) { _access = null; return finish(new Error("sensi auth rejected")); }
      if (sent && msg.startsWith("431[")) {
        let ack; try { ack = JSON.parse(msg.slice(3)); } catch (_) { ack = null; }
        if (!ack || ack[0]) return finish(new Error("thermostat refused: " + JSON.stringify(ack && ack[0]).slice(0, 120)));
        acked = true; return;
      }
      if (!msg.startsWith("42")) return;
      let payload; try { payload = JSON.parse(msg.replace(/^4[23]\d*/, "")); } catch (_) { return; }
      if (payload[0] === "state" && Array.isArray(payload[1])) {
        for (const d of payload[1]) {
          if (!d || !d.icd_id) continue;
          const prev = byId.get(d.icd_id) || {};
          byId.set(d.icd_id, { ...prev, ...d, state: { ...(prev.state || {}), ...(d.state || {}) } });
        }
      }
      const dev = [...byId.values()].find((p) => p.state && p.state.display_temp != null);
      if (!dev) return;
      if (!emit) return finish(null, dev);
      if (!sent) {
        sent = true;
        const [ev, body] = emit(dev);
        ws.send("421" + JSON.stringify([ev, body]));
        return;
      }
      if (acked && until && until(normalize(dev))) finish(null, dev);
    });
    ws.on("error", (e) => finish(e));
    ws.on("close", () => finish(new Error("sensi socket closed")));
  });
}

function saveLive(t) {
  try {
    const prev = JSON.parse(fs.readFileSync(LIVE_JSON, "utf8"));
    if (!prev || !prev.thermostat) return;
    prev.thermostat.ambient = t.ambient;
    prev.thermostat.setpoint = t.setpoint;
    prev.thermostat.heatSetpoint = t.heatSetpoint;
    prev.thermostat.coolSetpoint = t.coolSetpoint;
    prev.thermostat.mode = t.mode.charAt(0).toUpperCase() + t.mode.slice(1);
    prev.updatedAt = new Date().toISOString();
    prev.status = "live";
    fs.writeFileSync(LIVE_JSON, JSON.stringify(prev, null, 2) + "\n");
  } catch (_) {}
}

async function run(opts) {
  try { return await session(await accessToken(), opts); }
  catch (e) { if (/auth/.test(e.message)) { _access = null; return session(await accessToken(), opts); } throw e; }
}

/** Thermostat acked; make sure a fresh read shows the change (never report a change that didn't land). */
async function confirmed(dev, ok) {
  if (dev && dev.state) { const t = normalize(dev); if (ok(t)) return t; }
  for (let i = 0; i < 4; i++) {
    const t = normalize(await run({}));
    if (ok(t)) return t;
    await sleep(1500);
  }
  throw new Error("thermostat did not confirm the change");
}

export async function readState() {
  const t = normalize(await run({}));
  return t;
}

export async function setTemp(mode, temp) {
  mode = String(mode || "").toLowerCase();
  temp = Math.round(Number(temp));
  if (mode !== "heat" && mode !== "cool") throw new Error("mode must be heat or cool");
  if (!(temp >= MIN_F && temp <= MAX_F)) throw new Error(`temp must be ${MIN_F}–${MAX_F}°`);
  const key = mode === "heat" ? "heatSetpoint" : "coolSetpoint";
  const dev = await run({
    emit: (d) => {
      return ["set_temperature", { icd_id: d.icd_id, scale: "f", mode, target_temp: temp }];
    },
    until: (t) => t[key] === temp,
    timeoutMs: 8000,
  });
  const t = await confirmed(dev, (x) => x[key] === temp); saveLive(t); return t;
}

export async function setMode(mode) {
  mode = String(mode || "").toLowerCase();
  if (!MODES.has(mode)) throw new Error("mode must be heat, cool, auto, or off");
  const dev = await run({
    emit: (d) => ["set_operating_mode", { icd_id: d.icd_id, value: mode }],
    until: (t) => t.mode === mode,
    timeoutMs: 8000,
  });
  const t = await confirmed(dev, (x) => x.mode === mode); saveLive(t); return t;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  const p = cmd === "temp" ? setTemp(a, b) : cmd === "mode" ? setMode(a) : readState();
  p.then((t) => { console.log(JSON.stringify(t)); process.exit(0); })
   .catch((e) => { console.error("error: " + e.message); process.exit(1); });
}
