#!/usr/bin/env node
/**
 * WardOS House Face · Nest / Google Device Access (SDM) live snapshot
 *
 * LIVE when refresh_token + nest-sdm.json exist on the box.
 * Never invent video or snapshot URLs. Missing creds → need_token JSON.
 * WEB_RTC-only cams: no RTSP / on-demand GenerateImage. Optional stills:
 *   download auth-gated event images into data/nest-snaps/*.jpg (gitignored)
 *   and set snapshotUrl to a relative Pages path (tokens never in JSON).
 *
 * Secrets (never git):
 *   ~/.config/wardos/nest-refresh.token   (mode 600) — OAuth refresh_token
 *   ~/.config/wardos/nest-sdm.json        (mode 600) — { projectId, clientId, clientSecret }
 *
 * Usage:
 *   node scripts/nest-fetch.mjs
 *   node scripts/nest-fetch.mjs --token-file ~/.config/wardos/nest-refresh.token \
 *       --config ~/.config/wardos/nest-sdm.json --out data/nest-live.json
 *
 * See ../NEST-LIVE.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OAUTH_URL = "https://oauth2.googleapis.com/token";
const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";

const DEFAULT_TOKEN = path.join(os.homedir(), ".config", "wardos", "nest-refresh.token");
const DEFAULT_CONFIG = path.join(os.homedir(), ".config", "wardos", "nest-sdm.json");
const SNAPS_DIR = path.join(ROOT, "data", "nest-snaps");

/** Honest stub pads when no live devices yet — matches sheet-google-home.html */
const STUB_PADS = [
  { id: "stub-front", name: "Front door", where: "Entry", type: "CAMERA" },
  { id: "stub-drive", name: "Driveway", where: "Drive", type: "CAMERA" },
  { id: "stub-yard", name: "Backyard", where: "Yard", type: "CAMERA" },
  { id: "stub-garage", name: "Garage cam", where: "Garage", type: "CAMERA" },
];

function parseArgs(argv) {
  const out = {
    tokenFile: DEFAULT_TOKEN,
    configFile: DEFAULT_CONFIG,
    outPath: path.join(ROOT, "data", "nest-live.json"),
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token-file" && argv[i + 1]) out.tokenFile = path.resolve(argv[++i]);
    else if (a === "--config" && argv[i + 1]) out.configFile = path.resolve(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function chicagoNowIso() {
  return new Date().toISOString();
}

function writeJson(outPath, payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  fs.renameSync(tmp, outPath);
}

function stubCameras() {
  return STUB_PADS.map((p) => ({
    id: p.id,
    name: p.name,
    where: p.where,
    type: p.type,
    online: null,
    snapshotUrl: null,
    streamUrl: null,
    traits: [],
  }));
}

function needTokenPayload(reason) {
  return {
    status: "need_token",
    fetchedAt: chicagoNowIso(),
    updatedAt: chicagoNowIso(),
    source: "nest-sdm",
    cameras: stubCameras(),
    error:
      reason ||
      "NEST refresh_token / nest-sdm.json missing — Atlas must secret-request from Dan (see NEST-LIVE.md)",
  };
}

function errorPayload(msg) {
  return {
    status: "error",
    fetchedAt: chicagoNowIso(),
    updatedAt: chicagoNowIso(),
    source: "nest-sdm",
    cameras: stubCameras(),
    error: String(msg || "unknown error"),
  };
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (_) {
    return null;
  }
}

function readConfig(configFile) {
  const raw = readTextFile(configFile);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    return {
      projectId: String(j.projectId || j.project_id || "").trim(),
      clientId: String(j.clientId || j.client_id || "").trim(),
      clientSecret: String(j.clientSecret || j.client_secret || "").trim(),
    };
  } catch (_) {
    return null;
  }
}

function deviceTypeShort(type) {
  if (!type) return "DEVICE";
  const t = String(type);
  if (t.includes("DOORBELL")) return "DOORBELL";
  if (t.includes("CAMERA")) return "CAMERA";
  if (t.includes("DISPLAY")) return "DISPLAY";
  if (t.includes("THERMOSTAT")) return "THERMOSTAT";
  const parts = t.split(".");
  return parts[parts.length - 1] || "DEVICE";
}

function guessWhere(name) {
  const n = String(name || "").toLowerCase();
  if (/front|door|entry|porch/.test(n)) return "Entry";
  if (/drive|garage/.test(n)) return /drive/.test(n) ? "Drive" : "Garage";
  if (/back|yard|patio|garden/.test(n)) return "Yard";
  if (/living|family|room/.test(n)) return "Inside";
  return "Cam";
}

function isCameraLike(type) {
  const t = String(type || "");
  return /CAMERA|DOORBELL|DISPLAY/i.test(t);
}

function normalizeDevice(dev) {
  const traits = dev.traits || {};
  const info = traits["sdm.devices.traits.Info"] || {};
  const connectivity = traits["sdm.devices.traits.Connectivity"] || {};
  const name = info.customName || (dev.parentRelations && dev.parentRelations[0] && dev.parentRelations[0].displayName) || "Nest cam";
  const type = deviceTypeShort(dev.type);
  const traitKeys = Object.keys(traits);
  const online =
    connectivity.status != null
      ? String(connectivity.status).toUpperCase() === "ONLINE"
      : null;
  // SDM GenerateImage needs an eventId (CameraEventImage) — no on-demand JPEG.
  // RTSP/WebRTC stream URLs are short-lived and need player plumbing — never fake.
  // Optional bridge: traits may carry nothing; leave URLs null until event/bridge.
  let snapshotUrl = null;
  let streamUrl = null;
  if (dev._bridgeSnapshotUrl) snapshotUrl = String(dev._bridgeSnapshotUrl);
  if (dev._bridgeStreamUrl) streamUrl = String(dev._bridgeStreamUrl);

  return {
    id: (dev.name || "").split("/").pop() || null,
    name: String(name).trim() || "Nest cam",
    where: guessWhere(name),
    type,
    online,
    snapshotUrl,
    streamUrl,
    traits: traitKeys,
    rawName: dev.name || null,
  };
}

async function exchangeRefreshToken({ clientId, clientSecret, refreshToken }) {
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
  if (!json.access_token) throw new Error("oauth response missing access_token");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresIn: json.expires_in,
  };
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

/**
 * Attempt GenerateImage only when an eventId is supplied via env (rare).
 * WEB_RTC-only Nest cams often reject this command entirely (no RTSP).
 * Without eventId this is a no-op — we refuse to invent URLs.
 */
async function tryGenerateImage(accessToken, deviceName, eventId) {
  if (!eventId || !deviceName) return null;
  const url = `${SDM_BASE}/${deviceName}:executeCommand`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      command: "sdm.devices.commands.CameraEventImage.GenerateImage",
      params: { eventId },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { error: `GenerateImage HTTP ${resp.status}: ${text.slice(0, 160)}` };
  }
  const json = await resp.json();
  const results = json.results || {};
  if (!results.url) return { error: "GenerateImage missing url" };
  // URL needs Authorization: Basic <token> — not embeddable as bare <img> on Pages.
  return { url: results.url, token: results.token || null, needsAuthHeader: true };
}

/** Download auth-gated SDM image bytes → data/nest-snaps/<slug>.jpg (relative snapshotUrl). */
async function downloadSnapToPages(img, slug) {
  if (!img || !img.url || !img.token) return null;
  fs.mkdirSync(SNAPS_DIR, { recursive: true });
  const fileName = String(slug || "cam").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() + ".jpg";
  const abs = path.join(SNAPS_DIR, fileName);
  const resp = await fetch(img.url + (img.url.includes("?") ? "&" : "?") + "width=640", {
    headers: { Authorization: "Basic " + img.token },
  });
  if (!resp.ok) return null;
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 100) return null;
  fs.writeFileSync(abs, buf);
  return "data/nest-snaps/" + fileName;
}

function slugForCam(pad) {
  const base = String(pad.name || pad.id || "cam")
    .toLowerCase()
    .replace(/\s+camera$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "cam";
}

function persistRotatedToken(tokenFile, newRefresh) {
  if (!tokenFile || !newRefresh) return;
  try {
    fs.writeFileSync(tokenFile, newRefresh.trim() + "\n", { mode: 0o600 });
  } catch (_) {
    /* non-fatal */
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      "Usage: node scripts/nest-fetch.mjs [--token-file PATH] [--config PATH] [--out PATH]\n" +
        "Secrets: ~/.config/wardos/nest-refresh.token + nest-sdm.json (see NEST-LIVE.md)"
    );
    process.exit(0);
  }

  const refresh =
    process.env.NEST_REFRESH_TOKEN ||
    process.env.NEST_REFRESH ||
    readTextFile(args.tokenFile) ||
    "";
  const config = readConfig(args.configFile);

  if (!refresh || !config || !config.projectId || !config.clientId || !config.clientSecret) {
    const reasons = [];
    if (!refresh) reasons.push("refresh_token missing (" + args.tokenFile + ")");
    if (!config) reasons.push("config missing/unreadable (" + args.configFile + ")");
    else {
      if (!config.projectId) reasons.push("projectId missing in nest-sdm.json");
      if (!config.clientId) reasons.push("clientId missing in nest-sdm.json");
      if (!config.clientSecret) reasons.push("clientSecret missing in nest-sdm.json");
    }
    writeJson(args.outPath, needTokenPayload(reasons.join("; ")));
    console.error("need_token: " + reasons.join("; "));
    process.exit(2);
  }

  try {
    const tokens = await exchangeRefreshToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: refresh,
    });
    if (tokens.refreshToken && tokens.refreshToken !== refresh) {
      persistRotatedToken(args.tokenFile, tokens.refreshToken);
    }

    const devices = await listDevices(tokens.accessToken, config.projectId);
    const camsRaw = devices.filter((d) => isCameraLike(d.type));
    const eventId = process.env.NEST_EVENT_ID || "";

    const cameras = [];
    let snapsSaved = 0;
    let snapErrors = [];
    for (const d of camsRaw.length ? camsRaw : []) {
      const pad = normalizeDevice(d);
      const live = (d.traits && d.traits["sdm.devices.traits.CameraLiveStream"]) || {};
      pad.protocols = Array.isArray(live.supportedProtocols) ? live.supportedProtocols : [];
      if (eventId && d.name) {
        const img = await tryGenerateImage(tokens.accessToken, d.name, eventId);
        if (img && img.url && img.token) {
          // Download with Basic auth → relative path Pages can serve (token never in JSON).
          try {
            const rel = await downloadSnapToPages(img, slugForCam(pad));
            if (rel) {
              pad.snapshotUrl = rel;
              snapsSaved++;
            } else {
              snapErrors.push(pad.name + ": download empty");
            }
          } catch (e) {
            snapErrors.push(pad.name + ": " + (e && e.message ? e.message : String(e)));
          }
        } else if (img && img.error) {
          snapErrors.push(pad.name + ": " + img.error);
        }
      }
      cameras.push(pad);
    }

    const webrtcOnly =
      cameras.length > 0 &&
      cameras.every((c) => Array.isArray(c.protocols) && c.protocols.includes("WEB_RTC") && !c.protocols.includes("RTSP"));

    // No camera devices linked — still "live" auth but honest empty pads (not invented video)
    const payload = {
      status: "live",
      fetchedAt: chicagoNowIso(),
      updatedAt: chicagoNowIso(),
      source: "nest-sdm",
      cameras: cameras.length ? cameras : stubCameras().map((c) => ({ ...c, note: "no CAMERA devices in SDM list" })),
      deviceCount: devices.length,
      cameraCount: camsRaw.length,
      stillsPending: snapsSaved === 0,
      stillNote: snapsSaved
        ? null
        : webrtcOnly
          ? "WEB_RTC-only cams: GenerateImage/RTSP unsupported without event bridge. snapshotUrl null — never invent."
          : "No embeddable stills yet (set NEST_EVENT_ID or bridge HTTPS into snapshotUrl).",
      error: camsRaw.length
        ? snapErrors.length
          ? snapErrors.slice(0, 3).join("; ")
          : null
        : "auth ok · no camera/doorbell devices in SDM enterprise list",
    };
    writeJson(args.outPath, payload);
    console.log(
      `live: devices=${devices.length} cameras=${camsRaw.length} snaps=${snapsSaved} → ${args.outPath}` +
        (webrtcOnly && !snapsSaved ? " (WEB_RTC-only · stills pending)" : "")
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const authFail =
      /oauth HTTP 40[013]|invalid_grant|unauthorized|Invalid token|invalid_client/i.test(msg);
    writeJson(args.outPath, authFail ? needTokenPayload(msg) : errorPayload(msg));
    console.error((authFail ? "need_token: " : "error: ") + msg);
    process.exit(authFail ? 2 : 1);
  }
}

main();
