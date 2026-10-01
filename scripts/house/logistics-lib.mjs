/* ATLASLANE6 · scripts/house/logistics-lib.mjs · four logistics taps (upgrade 4): state + copy. Pure. NOT WIRED.
   I'm home · Leaving · kid check-in (Harris, Hayes, Ainsley) · Running late (+ a minute chip 5/10/15/20/30).
   No keyboard. Each tap writes LOCAL board state only: the status line (data/logistics-taps.json shape) and, for a
   check-in, who-home (wall-state.mjs checkIn). It NEVER sends to a person: no SMS, email, Slack, Harbor, push, or
   network call of any kind from here. effects.sends is always [].
   Lights (Dan's decisions, wired by Wright through the existing scene buttons, SCENES.md):
     Leaving  -> all Kasa off: dining-room, harris-room, kitchen.   I'm home -> kitchen + dining-room on.
     Neither touches the thermostat (THERMO-TRAVEL has its own button). Need a ride stays on Pack (pack-flags).
   Shared across screens = a NEW hub key ("house-logistics:<house day>") on /api/taps: a last-yes item, so it is
   documented here and OFF (SHARED.enabled = false). Until then state is per-device. */
import { KIDS, ctIso, fmtHM } from "./lib.mjs";
import { houseDay, nextReset, whoHomeFor, checkIn } from "./wall-state.mjs";

export const LATE_CHIPS = [5, 10, 15, 20, 30];
export const CHECKIN_KIDS = ["Harris", "Hayes", "Ainsley"];
export const CONTROLS = [
  { id: "im-home", label: "I'm home", lights: { on: ["kitchen", "dining-room"] }, thermostat: "untouched", writes: ["status"] },
  { id: "leaving", label: "Leaving", lights: { off: ["dining-room", "harris-room", "kitchen"] }, thermostat: "untouched", writes: ["status"] },
  { id: "check-in", label: "Check in", kids: CHECKIN_KIDS, writes: ["who-home", "status"] },
  { id: "running-late", label: "Running late", chips: LATE_CHIPS, writes: ["status"] },
];
export const SHARED = {
  enabled: false,
  key: "house-logistics:<YYYY-MM-DD house day>",
  ids: ["home", "leaving", "late-5", "late-10", "late-15", "late-20", "late-30", "checkin-harris", "checkin-hayes", "checkin-ainsley"],
  value: "{v: true, t: <epoch ms>} (same as house-checkoffs hub values); latest t wins the status line",
  hubChange: "allow keys house-logistics:YYYY-MM-DD and the ids above on the hub /api/taps (last-yes, not done)",
};

/** Status line copy for one tap (h:mm, no am/pm, trailing period, no '!'). */
export function statusLine(tap) {
  const hm = fmtHM(Date.parse(tap.at));
  if (tap.control === "im-home") return `Home ${hm}.`;
  if (tap.control === "leaving") return `Leaving ${hm}.`;
  if (tap.control === "running-late") return `Running ${tap.minutes} min late.`;
  if (tap.control === "check-in") return `${tap.kid} home ${hm}.`;
  return null;
}
export function emptyLogistics(t) {
  return { date: houseDay(t), resetsAt: ctIso(nextReset(t)), status: null, taps: [] };
}
function validTap(x) {
  if (!x || !isFinite(Date.parse(x.at))) return false;
  if (x.control === "im-home" || x.control === "leaving") return true;
  if (x.control === "check-in") return CHECKIN_KIDS.includes(x.kid);
  if (x.control === "running-late") return LATE_CHIPS.includes(x.minutes);
  return false;
}
/** Read-side normalizer: taps from an earlier house day (3:00 AM reset) are gone; status = latest tap. */
export function logisticsFor(state, t) {
  const base = emptyLogistics(t);
  base.taps = ((state && state.taps) || [])
    .filter((x) => validTap(x) && houseDay(Date.parse(x.at)) === base.date && Date.parse(x.at) <= t + 5 * 60000)
    .map((x) => ({ control: x.control, at: x.at, ...(x.kid ? { kid: x.kid } : {}), ...(x.minutes ? { minutes: x.minutes } : {}) }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const last = base.taps[base.taps.length - 1];
  base.status = last ? { control: last.control, line: statusLine(last), at: last.at } : null;
  return base;
}
/** One wall tap. Returns new local state + the effects Wright's glue may run. Invalid tap = no change, no effects. */
export function applyTap(state, whoHome, input, t) {
  const cur = logisticsFor(state, t);
  const tap = { control: input && input.control, at: ctIso(t), ...(input && input.kid ? { kid: input.kid } : {}), ...(input && input.minutes != null ? { minutes: input.minutes } : {}) };
  const none = { logistics: cur, whoHome: whoHomeFor(whoHome, t), effects: { lights: null, thermostat: null, sends: [] } };
  if (!validTap(tap)) return none;
  const next = logisticsFor({ taps: cur.taps.concat([tap]) }, t);
  let wh = whoHomeFor(whoHome, t);
  if (tap.control === "check-in") {
    const k = KIDS.find((x) => x.name === tap.kid);
    wh = checkIn(whoHome, k.id, t);
  }
  const ctl = CONTROLS.find((c) => c.id === tap.control);
  return { logistics: next, whoHome: wh, effects: { lights: ctl.lights || null, thermostat: null, sends: [] } };
}
/** Documented (OFF) shared-key form: local state -> hub entries [{key, id, v, t}] and back. */
export function toHubEntries(state) {
  const out = [];
  for (const x of (state && state.taps) || []) {
    const id = x.control === "im-home" ? "home" : x.control === "leaving" ? "leaving"
      : x.control === "running-late" ? `late-${x.minutes}` : `checkin-${String(x.kid).toLowerCase()}`;
    out.push({ key: `house-logistics:${houseDay(Date.parse(x.at))}`, id, v: true, t: Date.parse(x.at) });
  }
  return out;
}
export function fromHubEntries(entries, t) {
  const taps = [];
  for (const e of entries || []) {
    if (!e || e.v !== true || !/^house-logistics:\d{4}-\d{2}-\d{2}$/.test(e.key) || !SHARED.ids.includes(e.id)) continue;
    const at = ctIso(e.t);
    if (e.id === "home") taps.push({ control: "im-home", at });
    else if (e.id === "leaving") taps.push({ control: "leaving", at });
    else if (e.id.startsWith("late-")) taps.push({ control: "running-late", minutes: Number(e.id.slice(5)), at });
    else taps.push({ control: "check-in", kid: CHECKIN_KIDS.find((k) => k.toLowerCase() === e.id.slice(8)), at });
  }
  return logisticsFor({ taps }, t);
}
/** The public file: state + controls + chips + the shared-key note. */
export function logisticsFile(state, t) {
  return {
    ...logisticsFor(state, t),
    generatedAt: ctIso(t),
    controls: CONTROLS,
    lateChips: LATE_CHIPS,
    sendsToPeople: false,
    perDevice: true,
    shared: SHARED,
    note: "Per-device until the hub allows the shared key (last-yes). Need a ride stays on Pack.",
  };
}
