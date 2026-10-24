/* DATA1 P1-5 · the ONE all-day clock for both feeds (calendar-refresh.mjs, cal-from-events.mjs): an all-day date is that
   civil day's America/Chicago midnight with that day's own offset (CDT -05:00, CST -06:00), never a hardcoded -05:00. */
const TZ = "America/Chicago";
export function ctOffsetMinutes(civil) {
  const guess = new Date(civil + "T12:00:00Z");
  if (Number.isNaN(guess.getTime())) return null;
  const off = (new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(guess).find((x) => x.type === "timeZoneName") || {}).value || "GMT-5";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(off);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : -300;
}
export function ctMidnight(civil) {
  const mins = ctOffsetMinutes(civil);
  if (mins == null) return null;
  return new Date(new Date(civil + "T00:00:00Z").getTime() - mins * 60000);
}
export function ctMidnightIso(civil) {
  const mins = ctOffsetMinutes(civil);
  if (mins == null) return null;
  const a = Math.abs(mins), sign = mins < 0 ? "-" : "+";
  return `${civil}T00:00:00${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
