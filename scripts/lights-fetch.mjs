#!/usr/bin/env node
/**
 * WardOS House Face · Lights live snapshot (stub)
 *
 * Until a Kasa cloud token / LAN path exists on the Atlas box, this writes
 * data/lights-live.json with status:need_token. Never invents on/off LIVE.
 *
 * Usage:
 *   node scripts/lights-fetch.mjs
 *   node scripts/lights-fetch.mjs --token-file ~/.config/wardos/kasa.token
 *   node scripts/lights-fetch.mjs --out data/lights-live.json
 *
 * See ../LIGHTS-LIVE.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    tokenFile: null,
    outPath: path.join(ROOT, "data", "lights-live.json"),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token-file") out.tokenFile = argv[++i];
    else if (a === "--out") out.outPath = path.resolve(argv[++i]);
  }
  return out;
}

function readToken(opts) {
  if (process.env.KASA_TOKEN) return process.env.KASA_TOKEN.trim();
  if (opts.tokenFile && fs.existsSync(opts.tokenFile)) {
    return fs.readFileSync(opts.tokenFile, "utf8").trim();
  }
  const home = process.env.HOME || "";
  const def = path.join(home, ".config", "wardos", "kasa.token");
  if (fs.existsSync(def)) return fs.readFileSync(def, "utf8").trim();
  return "";
}

const STARTER = [
  { id: "dining-room", name: "Dining Room", where: "Dining Room", kind: "dimmer", on: true, brightness: 52, online: true },
  { id: "harris-room", name: "Harris's Room", where: "Harris's Room", kind: "dimmer", on: true, brightness: 100, online: true },
  { id: "kitchen", name: "Kitchen", where: "Kitchen", kind: "dimmer", on: true, brightness: 1, online: true },
];

function main() {
  const opts = parseArgs(process.argv);
  const token = readToken(opts);
  const fetchedAt = new Date().toISOString();
  let payload;
  if (!token) {
    payload = {
      status: "need_token",
      fetchedAt,
      source: "kasa-pending",
      writeSupported: false,
      lights: STARTER,
      reserved: [],
      error:
        "NEED TOKEN · no Kasa cloud yet. Screenshot roster DEMO seeds only (Dining/Harris/Kitchen) — do not paint LIVE. OP Kasa online; LIVE cloud still need_token.",
    };
  } else {
    payload = {
      status: "need_token",
      fetchedAt,
      source: "kasa-pending",
      writeSupported: false,
      lights: STARTER,
      reserved: [],
      error:
        "Kasa token file present but lights cloud/LAN client not wired yet — do not invent LIVE.",
    };
  }
  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  fs.writeFileSync(opts.outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log("Wrote", opts.outPath, "status=" + payload.status);
}

main();
