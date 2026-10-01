/**
 * TRAVEL1 · Sensi "Travel" / "Back home" for the 27" wall (branch wall-redesign-1).
 * Dan asked for it Oct 1 2026. Uses the EXISTING Sensi write path (scripts/sensi-control.mjs
 * setMode / setTemp / readState); that module is not changed.
 *
 * Travel   = capture the live mode + setpoints FIRST (to a box-only file), then Auto, cool 85, heat 55.
 * Back home = restore the captured mode + setpoints exactly, verify by a fresh read, then clear the file.
 * No capture -> no restore, no guess (409 "no saved setting").
 *
 * Capture file: ~/.config/wardos/sensi-travel-restore.json (mode 600). NOT in git, NOT on Pages.
 * Override: SENSI_TRAVEL_RESTORE=/path.json
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TRAVEL = Object.freeze({ mode: "auto", heatSetpoint: 55, coolSetpoint: 85 });
export const DEFAULT_RESTORE_FILE =
  process.env.SENSI_TRAVEL_RESTORE || path.join(os.homedir(), ".config", "wardos", "sensi-travel-restore.json");
const MODES = new Set(["heat", "cool", "auto", "off"]);

const lc = (m) => String(m || "").toLowerCase();
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

export function isTravel(t) {
  return !!t && lc(t.mode) === TRAVEL.mode && t.heatSetpoint === TRAVEL.heatSetpoint && t.coolSetpoint === TRAVEL.coolSetpoint;
}

/** Exact prior state from a LIVE reading. Anything missing -> null (never guess). */
export function captureOf(t, now = Date.now()) {
  if (!t || t.online === false) return null;
  const mode = lc(t.mode);
  if (!MODES.has(mode) || !isNum(t.heatSetpoint) || !isNum(t.coolSetpoint)) return null;
  return { mode, heatSetpoint: t.heatSetpoint, coolSetpoint: t.coolSetpoint, capturedAt: new Date(now).toISOString(), v: 1 };
}

export function validCapture(c) {
  return !!c && c.v === 1 && MODES.has(c.mode) && isNum(c.heatSetpoint) && isNum(c.coolSetpoint) && !!c.capturedAt;
}

export function matchesCapture(t, c) {
  return !!t && !!c && lc(t.mode) === c.mode && t.heatSetpoint === c.heatSetpoint && t.coolSetpoint === c.coolSetpoint;
}

/** File store (atomic write, mode 600). */
export function fileStore(file = DEFAULT_RESTORE_FILE) {
  return {
    file,
    load() {
      try { const c = JSON.parse(fs.readFileSync(file, "utf8")); return validCapture(c) ? c : null; } catch { return null; }
    },
    save(c) {
      if (!validCapture(c)) throw new Error("refusing to save an invalid capture");
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const tmp = file + ".tmp";
      const fd = fs.openSync(tmp, "w", 0o600);
      try { fs.writeSync(fd, JSON.stringify(c) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, file);
    },
    clear() { try { fs.rmSync(file, { force: true }); } catch {} },
  };
}

/** Status for the wall: is the live reading Travel, and is there a saved prior setting? */
export async function travelStatus({ sensi, store }) {
  const t = await sensi.readState();
  const c = store.load();
  return { travel: isTravel(t), saved: !!c, savedAt: c ? c.capturedAt : null, thermostat: t };
}

/** Travel: capture FIRST, then write. Already in Travel -> no writes, capture untouched. */
export async function goTravel({ sensi, store, now = Date.now() }) {
  const cur = await sensi.readState();
  if (isTravel(cur)) return { ok: true, already: true, saved: !!store.load() };
  const cap = captureOf(cur, now);
  if (!cap) { const e = new Error("live reading incomplete · nothing captured · nothing sent"); e.status = 409; throw e; }
  store.save(cap); // must land before any write
  if (!validCapture(store.load())) { const e = new Error("capture did not persist · nothing sent"); e.status = 500; throw e; }
  await sensi.setMode(TRAVEL.mode);
  await sensi.setTemp("cool", TRAVEL.coolSetpoint); // cool up first so heat 55 never fights the deadband
  const t = await sensi.setTemp("heat", TRAVEL.heatSetpoint);
  return { ok: true, travel: isTravel(t), captured: cap, thermostat: t };
}

/** Back home: restore exactly. No capture -> nothing sent. */
export async function goBack({ sensi, store }) {
  const cap = store.load();
  if (!cap) { const e = new Error("no saved setting"); e.status = 409; throw e; }
  // Setpoints first (Travel is Auto, so both are settable; 55/85 is wide so heat-then-cool never crosses), mode last.
  await sensi.setTemp("heat", cap.heatSetpoint);
  await sensi.setTemp("cool", cap.coolSetpoint);
  await sensi.setMode(cap.mode);
  const t = await sensi.readState();
  if (!matchesCapture(t, cap)) { const e = new Error("thermostat did not match the saved setting · saved setting kept"); e.status = 502; throw e; }
  store.clear();
  return { ok: true, restored: cap, thermostat: t };
}
