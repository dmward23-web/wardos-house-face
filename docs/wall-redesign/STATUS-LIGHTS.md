# STATUS LIGHTS · Wright · 27" wall (plan; stub rules in `house-wall-status.js`, not wired)

Status lights are **lines in one quiet strip, not tiles**. Each light is one short line. When everything is OK, the strip is the shortest it can be.
**Stale or missing data = the light is hidden.** No placeholder, no "—", no "STALE" word, no grey box. The top-band **stale dot** (Atlas glance) is the only place "behind" shows up.
Freshness windows reuse the constants that already ship. No new numbers:

| Feed | File | Time field | Fresh window (existing constant) |
|---|---|---|---|
| Nest cams | `data/nest-live.json` | `fetchedAt` / `updatedAt` | 30 min (`house-nest.js:14` `LIVE_FRESH_MS`) |
| Sensi | `data/sensi-live.json` | `updatedAt` | 30 min (`house-sensi.js:12` `LIVE_FRESH_MS`) |
| Kasa lights | `data/lights-live.json` | `fetchedAt` | 24 h (`house-lights.js:17`) |
| Calendar | `data/cal-live.json`, `data/kids-week.json` | `asOfIso` + `fetchedAt` / `refreshedAt` | `asOfIso` = today CT **and** < 6 h (`house-board-strip.js:11` `CAL_FRESH_MS`) |

Wright reads these files. Wright never writes them (allowlisted data-only refreshes own them).

Quiet rendering, for every light: HUBCMD void + amber atoms (`--cmd-*`, `tokens-hub-command-deck-shared.css`). OK = muted ink (`--cmd-mute`) with a small amber dot. Not-OK = `--cmd-amber-hi` text, no red, no blink, no sound, no modal, no LED ring change. Each line taps through to its sheet (no dead ends): cams/thermostat go to `sheet-google-home.html`, Load day goes to `sheet-load-day.html`.

---

## 1. Doors / cams

| | |
|---|---|
| Source | `data/nest-live.json` → `status`, `fetchedAt`, `cameras[].name`, `cameras[].online`, `cameraCount` (roster today: Living Room camera, Front door doorbell, Garage camera, Kitchen camera, Backyard camera) |
| Doors source | **NONE.** Garage + Door pads are `NEED CONNECT` (`sheet-google-home.html:381-405`). No lock/contact/garage data on the box. A Ring 2-pack is a DAN-NEEDS buy (#17), not owned |
| OK rule | `status == "live"`, fresh, every roster cam present, and every `online === true` → one line: **`Cams OK`**. The label says **Cams**, not Doors, until a door source exists. "Doors + cams OK" only when a door feed exists and is OK too |
| Not-OK rule | any cam `online === false` or missing from the roster → name it: **`Garage offline`** (strip " camera"). Two: `Garage, Backyard offline`. More than two: `Garage +2 offline` |
| Unknown | any cam `online === null` (and none false) → **hidden.** We can't claim OK |
| Stale | `status != "live"`, `error` set, or older than 30 min → hidden |
| Never | no camera feed, still, or thumbnail on the hallway wall. Text line only |

**Today's reality:** all 5 cams report `"online": null` (`data/nest-live.json:12,33,58,81,102`). `nest-fetch.mjs:280-286` maps the SDM `Connectivity` trait, which these devices don't return. **Under these rules the cams light stays hidden today.** To light it honestly you need one of: (a) SDM starts returning `Connectivity`, (b) the `nest-webrtc-proxy` writes a per-cam reachability probe into nest-live.json (Atlas owns the feed), or (c) Dan accepts "fetch fresh + listed" as OK. (c) is a Dan call, not Wright's.

## 2. Thermostat vs. house mode ("72°, School day")

| | |
|---|---|
| Source | `data/sensi-live.json` → `status`, `updatedAt`, `thermostat.online`, `.ambient`, `.mode` (Heat/Cool/Auto/Off), `.heatSetpoint`, `.coolSetpoint`. **Sensi, not Nest** (the hub says so: "not Nest") |
| House mode source | **Atlas's house-mode chip. No data file exists yet** (brief: driven by the existing calendar). Field name UNKNOWN; stub takes `{id, label}` |
| Line | `73°, School day`. With no house mode, just `73°` |
| Mismatch rule | Compare the thermostat against a **per-mode band that Dan sets**: `{mode allowed: [...], heatSetpoint: [lo,hi], coolSetpoint: [lo,hi]}`. Outside the band → not-OK: `73°, Nashville week · check set 65–73°`. **No bands exist. Wright won't invent target temps.** With no band for a mode, nothing is flagged |
| Not-OK also | `thermostat.online === false` → `Thermostat offline` |
| Stale | `status != "live"`, no `thermostat`, or older than 30 min → hidden |

## 3. Load day (only today or tomorrow)

| | |
|---|---|
| Source | **No live field.** Evidence: `board-os/data/atlas-packet.json` → `loadDay.isoDate` ("2026-09-25", packet `asOf` Mon Sep 21; desk-side, not in house-face git, not on Pages). `sheet-load-day.html` is hand-built for "Mon Sep 28". `data/cal-live.json` / `kids-week.json` have no load-day field |
| Needed | Atlas emits `loadDay: {isoDate, label}` + `asOfIso` in a Pages data file (Atlas owns; Wright won't touch the data refresh) |
| Rule | `isoDate == today CT` → **`Load day today`**. `== tomorrow CT` → **`Load day tomorrow`**. Any other date → hidden |
| Stale | source `asOfIso != today CT` → hidden (DATE-LAW: no yesterday on today's glass) |
| Tap | `sheet-load-day.html` |

## 4. Dragon + pond (travel-week mode only)

| | |
|---|---|
| What they are | **UNKNOWN.** No reference anywhere in the repo, board-os, wardos-kit, plates, or agent memory. The only hit is Alfred's chores gate, which lists "dragon" and "pond" as **banned words on kid chore pages** (`/workspace/alfred-chores-musts-gate.md:33,249`). The brief says Nashville week = KS house in away-care: "pet, lawn, alarms". Dragon is probably the pet, but that's not confirmed |
| Source | **NONE.** No feeder, filter, sitter log, or sensor data on the box. Who reports fed / filter, and how: UNKNOWN |
| Gate | Show only when the house mode is **Nashville week** (Atlas chip). The next one per `atlas-packet.json` `travel.week` is "Oct 2–9 Nashville", **starting tomorrow** |
| Lines | `Dragon fed` / `Dragon not fed`. `Pond filter OK` / `Pond filter not OK` |
| Stale | report older than its fresh window → hidden. **The window is UNKNOWN** (feeding cadence, filter check cadence). With no window, the line stays hidden |
| Kid-safe | kids see the wall. These two words are on Alfred's kid-chore ban list. **Alfred has to rule on whether they're OK on the wall status strip** |

## Stub API (`house-wall-status.js`, pure, no DOM/fetch/timers, loaded by no page)

`camsLight(nest, {roster, doors, now})` · `thermoLight(sensi, {mode, bands, now})` · `loadDayLight(src, {now})` · `travelLights(mode, care, {now, fresh})` · `statusStrip(...)`. Each returns `null` (hidden) or `{id, ok, text, href}`. Tests: `node scripts/wall/house-wall-status.test.mjs`.
