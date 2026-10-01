/* ATLASLANE1 · scripts/house/wall-state.mjs · pure helpers for wall-tap data shapes. NOT WIRED. No server.
   who-home: three kids, checkedInAt or null, resets daily at 3:00 AM CT ("house day").
   pack-flags: {kid, text, createdAt}, clear at the end of the CT day (midnight).
   house-mode-temps: per-mode targets, all null until Dan sets them -> no bands -> thermostat light never flags. */
import { KIDS, MODES, ctDate, ctWallMs, addDays, ctIso, bannedHits } from "./lib.mjs";

const RESET_H = 3;
/** House day = CT date of (t - 3h): 2:59 AM still belongs to yesterday. */
export function houseDay(t) { return ctDate(t - RESET_H * 3600000); }
export function nextReset(t) { return ctWallMs(addDays(houseDay(t), 1), RESET_H, 0); }

export function emptyWhoHome(t) {
  return {
    date: houseDay(t),
    resetsAt: ctIso(nextReset(t)),
    kids: KIDS.map((k) => ({ id: k.id, name: k.name, checkedInAt: null })),
  };
}
/** Read-side normalizer: any check-in from an earlier house day reads as null. */
export function whoHomeFor(state, t) {
  const base = emptyWhoHome(t);
  const byId = {};
  for (const k of (state && Array.isArray(state.kids) ? state.kids : [])) byId[String(k.id || k.name || "").toLowerCase()] = k;
  base.kids = base.kids.map((k) => {
    const s = byId[k.id];
    const at = s && s.checkedInAt ? Date.parse(s.checkedInAt) : NaN;
    return { ...k, checkedInAt: isFinite(at) && at <= t + 5 * 60000 && houseDay(at) === base.date ? ctIso(at) : null };
  });
  return base;
}
/** A wall tap: returns the new state (caller persists it). */
export function checkIn(state, kidId, t) {
  const cur = whoHomeFor(state, t);
  cur.kids = cur.kids.map((k) => (k.id === kidId ? { ...k, checkedInAt: ctIso(t) } : k));
  return cur;
}

export function packFlagsFor(state, t) {
  const today = ctDate(t);
  const flags = (state && Array.isArray(state.flags) ? state.flags : []).filter((f) => {
    const at = Date.parse(f && f.createdAt);
    return isFinite(at) && ctDate(at) === today && KIDS.some((k) => k.name === f.kid) && f.text && !bannedHits(f.text).length;
  });
  return { date: today, clearsAt: ctIso(ctWallMs(addDays(today, 1), 0, 0)), flags };
}
export function addPackFlag(state, kidName, text, t) {
  const cur = packFlagsFor(state, t);
  const clean = String(text || "").trim().slice(0, 60);
  if (!KIDS.some((k) => k.name === kidName) || !clean || bannedHits(clean).length) return cur;
  cur.flags.push({ kid: kidName, text: clean, createdAt: ctIso(t) });
  return cur;
}

/** house-mode-temps.json -> Wright's thermoLight bands ({[modeKey]: {heatSetpoint:[lo,hi], coolSetpoint:[lo,hi]}}).
    Only modes with a non-null target get a band; all-null (today) = {} = the light never flags. */
export function bandsFromTemps(temps) {
  const out = {};
  const modes = (temps && temps.modes) || {};
  const tol = temps && typeof temps.toleranceF === "number" ? temps.toleranceF : 0;
  for (const key of Object.keys(MODES)) {
    const m = modes[key];
    if (!m) continue;
    const band = {};
    if (typeof m.heatSetpoint === "number") band.heatSetpoint = [m.heatSetpoint - tol, m.heatSetpoint + tol];
    if (typeof m.coolSetpoint === "number") band.coolSetpoint = [m.coolSetpoint - tol, m.coolSetpoint + tol];
    if (Object.keys(band).length) out[key] = band;
  }
  return out;
}
