/* Synthetic calendar shaped like the real MCP dump (/workspace/cal-dmward23-week.json). Test-only. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const CONFIG = readJson(path.join(ROOT, "config/house-mode.config.json"));
export const KIDS_WEEK = { asOfIso: "2026-10-01", leaveBys: { SRE_pickup: "leave 3:15 for 3:40" } };
export const at = (s) => Date.parse(s);

const timed = (summary, start, end, extra = {}) => ({ summary, start: { dateTime: start }, end: { dateTime: end }, ...extra });
const allDay = (summary, from, to) => ({ summary, start: { date: `${from}T00:00:00Z` }, end: { date: `${to}T00:00:00Z` } });

export function calendar(extra = []) {
  return {
    summary: "Dan", updated: "2026-10-01T21:49:40Z",
    events: [
      timed("Kids with Dan", "2026-09-25T15:00:00-05:00", "2026-10-02T15:00:00-05:00"),
      timed("Kids with Dan", "2026-10-09T15:00:00-05:00", "2026-10-16T15:00:00-05:00"),
      timed("Kids with Dan", "2026-10-23T15:00:00-05:00", "2026-10-30T15:00:00-05:00"),
      allDay("Dan Nashville [DRIVE Sat Oct 3]", "2026-10-03", "2026-10-10"),
      allDay("Dan Nashville [lands @ 1:40p, departs @ 8:10a]", "2026-10-02", "2026-10-10"),
      allDay("Dan Nashville [lands @ 12:15p, departs @ 8:10a]", "2026-10-16", "2026-10-24"),
      allDay("Ward Kids [AHH No School]", "2026-10-09", "2026-10-10"),
      allDay("Johnson Kids [RH No School]", "2026-10-12", "2026-10-13"),
      timed("Hayes + Harris — SRE drop-off · 8:25", "2026-10-01T08:10:00-05:00", "2026-10-01T08:40:00-05:00", { location: "Sunset Ridge Elementary, 14901 England St, Overland Park, KS 66221" }),
      timed("Dan picks up Harris — SRE pickup · 3:40 | Casey (Riley's mom) picks up Hayes; Hayes hangs at Casey's", "2026-10-01T15:15:00-05:00", "2026-10-01T16:00:00-05:00", { location: "Sunset Ridge Elementary, 14901 England St, Overland Park, KS 66221" }),
      timed("Ainsley swim — Coach Ann · 5:00 practice", "2026-10-01T16:25:00-05:00", "2026-10-01T18:20:00-05:00", { location: "Genesis Health Clubs Olathe Ridgeview, 1 Main" }),
      timed("Hayes baseball — Falcons vs Lions (home) · 5:30 game (cleats, glove)", "2026-10-01T16:55:00-05:00", "2026-10-01T19:20:00-05:00", { location: "Blue Valley Rec Sports Complex, Field 24" }),
      timed("CANCELLED (rain) - Harris flag practice · 6:00", "2026-10-01T17:45:00-05:00", "2026-10-01T19:00:00-05:00", { location: "Fields by the Library" }),
      timed("Pick up Hayes at Casey's (Riley's mom)", "2026-10-01T18:20:00-05:00", "2026-10-01T18:55:00-05:00", { location: "Casey's (Riley's mom), 9504 W 148th St" }),
      timed("Late pickup Harris · 6:59", "2026-10-01T18:59:00-05:00", "2026-10-01T19:30:00-05:00", { location: "Sunset Ridge Elementary, 14901 England St" }),
      /* must never appear */
      timed("Ainsley — therapy pickup 4:00", "2026-10-01T15:30:00-05:00", "2026-10-01T16:30:00-05:00", { location: "Clinic, 1 St" }),
      timed("Ainsley — Midwest Anxiety pickup · 2:00", "2026-10-01T13:40:00-05:00", "2026-10-01T15:20:00-05:00", { location: "8675 College Blvd" }),
      timed("Erin drop Hayes at legal office", "2026-10-01T16:00:00-05:00", "2026-10-01T16:30:00-05:00", { location: "Office, 2 St" }),
      timed("Dan — Hayes Johnson gift $150 pickup", "2026-10-01T12:00:00-05:00", "2026-10-01T12:15:00-05:00", { location: "Home, 6719 W 147th Terrace" }),
      timed("GET · Pick up Harris form for school", "2026-10-01T12:30:00-05:00", "2026-10-01T12:45:00-05:00", { location: "Home, 6719 W 147th Terrace" }),
      timed("Hayes pickup — Wells autopay balance run", "2026-10-01T13:00:00-05:00", "2026-10-01T13:15:00-05:00", { location: "Bank, 3 St" }),
      timed("Cursor work call — Harris carpool sync", "2026-10-01T14:00:00-05:00", "2026-10-01T14:30:00-05:00", { location: "Zoom" }),
      /* kids-away day: rides on Dan's calendar during their mom's week are not Dad's chain */
      timed("Hayes + Harris — SRE drop-off · 8:25", "2026-10-05T08:10:00-05:00", "2026-10-05T08:40:00-05:00", { location: "Sunset Ridge Elementary, 14901 England St" }),
      ...extra,
    ],
  };
}
