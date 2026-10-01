# SCENES · Wright · House Face wall redesign (branch `wall-redesign-1`)

Inventory taken Thu Oct 1 2026, ~5:15–5:45 PM CT. Read-only: no browser, no scene/routine triggered, no device written.
Law: the wall recalls EXISTING scenes only. It never invents a scene, routine, or automation.

## Bottom line

> **Update Thu Oct 1 ~5:40 PM CT · Dan defined the two wall scenes (Kasa only):**
> **Leaving** = all Kasa OFF (Dining Room, Harris's Room, Kitchen). **I'm home** = Kitchen + Dining Room ON.
> Neither touches the Sensi. Both go through the EXISTING Kasa client (`HouseLights.setLight(id,{on})`, `house-lights.js`).
> No key saved on the screen → quiet `NEED KEY`, zero requests. Mode chips recall nothing (no mode scenes). Kasa All on / All off is untouched.
> **KID LAYER v3 (~6:15 PM CT):** the chore-done hall flash is **not a scene**. It is a 2-second invert-and-restore of lights listed in `config/wall-kid.config.json` through the same `HouseLights.setLight`. The list ships **EMPTY** (no hall-visible light confirmed; Harris's Room never). See KIDLAYER3.md.
> The inventory below (no Google Home scenes exist anywhere on the box) still stands; these two are Dan's wall-side definitions, not Google Home scenes.

**No Google Home scene, routine, or automation was found in any source on the box.**
That includes **Home** and **Leave**, and every mode-like name (Away, Night, Bedtime, Movie, Vacation, Good night, Good morning, I'm home, Leaving).
So the wall recalls **zero Google Home** scenes. "Mode recalls the scene" stays **off** (ruling: mode chips recall nothing). `I'm home / Leaving` are now Dan's Kasa definitions (top of page).

## Scenes found

| Scene (exact name) | Source evidence | Controls | Wall can recall today? |
|---|---|---|---|
| — none found — | see "Where I looked" | — | — |

| Asked-for scene | Status |
|---|---|
| Home | **NOT FOUND** (UNKNOWN whether it exists in the Google Home app) |
| Leave | **NOT FOUND** (UNKNOWN whether it exists in the Google Home app) |
| Away / Night / Bedtime / Movie / Vacation / Good night / Good morning | **NOT FOUND** |

## Closest existing actuators (NOT scenes; listed so nobody relabels them as one)

These are real, already wired, and reachable from the wall through the existing house hub (`scripts/lights-write-proxy.mjs`, token header `X-Lights-Proxy-Token`, reached through the `writeProxy` tunnel URL baked into `data/lights-live.json:64`). None of them is a Google Home scene. Calling one "Home" or "Leave" would be inventing a scene, so it needs Dan's explicit yes first.

| Actuator | Evidence | Controls | Path today |
|---|---|---|---|
| Kasa **All on** / **All off** (bulk) | `scripts/lights-write-proxy.mjs:467` (`POST /api/lights/set` with `{allOn:true}` / `{allOff:true}`), then `scripts/kasa-write.py:13,311-312` (`--all-on` / `--all-off`); buttons `sheet-google-home.html:376-377`, `sheet-lights.html:121-122`; client `house-lights.js:474` | 3 Kasa dimmers: Dining Room, Harris's Room, Kitchen (`data/lights-live.json`, roster `ROSTER_IDS` at `lights-write-proxy.mjs:39`) | Yes, existing proxy endpoint (token + tunnel). **Not a scene.** |
| Kasa single light on/off/brightness | `lights-write-proxy.mjs:467-495` (`{id, on, brightness}`) | one of the 3 dimmers | Yes, existing proxy endpoint. Not a scene. |
| Sensi thermostat mode / setpoint | `lights-write-proxy.mjs:430-441` (`POST /api/sensi/set`, `kind: mode|temp`); modes `Heat, Cool, Auto, Off` (`house-sensi.js:21`); client `house-sensi-ctl.js` | Sensi thermostat (not Nest), `data/sensi-live.json` | Yes, existing proxy endpoint. Not a scene. (Wright does not touch the Sensi handlers.) |
| Nest cams (5) | `NEST-SETUP-NOTES.md` table; `data/nest-live.json` (`cameraCount: 5`); `sheet-google-home.html:297-353` | View only (WebRTC through `nest-webrtc-proxy`) | Read only. No scenes. No camera feed on the hallway wall, per the brief. |
| Garage door, Door pads (lock/unlock) | `sheet-google-home.html:381-405` (`is-need-connect`, `NEED CONNECT`, disabled rocker) | Nothing. No device link exists | **No.** NEED CONNECT. |

## Where I looked

| Source | Result |
|---|---|
| `wardos-house-face/sheet-google-home.html` | Cams, Sensi hero, Kasa lights, Garage/Door NEED CONNECT. No scenes or routines. |
| `wardos-house-face/house-*.js` | Hits on "mode" are Sensi HVAC modes (`house-sensi.js`, `house-sensi-ctl.js`). "routine" hits are the kid schedule rail (SRE drop/pickup, swim) in `kids-data.js:1361-1798`, not home scenes. |
| `scripts/lights-write-proxy.mjs` | Endpoints: `/health` (380), `/api/taps` (402), `/api/sensi` (423), `/api/sensi/set` (430), `/api/lights` GET (444), `/api/lights/refresh` (457), `/api/lights/set` (467). **No scene / routine / automation endpoint.** |
| `data/*.json` (cal-live, cal-months, kids-week, lights-live, nest-live, sensi-live) | No scenes. `sensi-live.json:15` `"mode": "Auto"` is HVAC mode. Calendar "routine" = the House board calendar refresh job (`DATE-LAW.md`, `CAL-LIVE.md`). |
| `LIGHTS-LIVE.md:5` | "Nest SDM on the box is **cameras only** (no lights). Lights are Kasa, separate from Nest." |
| `/workspace/board-os` (WALL-STATION.md, RUNBOOKS, kits, data/home.json, atlas-packet.json) | No scenes. `atlas-packet.json` has `travel.week: "Oct 2–9 Nashville"` (calendar fact, not a scene). |
| `/workspace/wardos-kit` | No scenes. |
| Box-wide filename search (`*google*home*`, `*takeout*`, `*homegraph*`, `*scene*`, `*routine*`) | No Google Home export or Takeout on the box. Only copies of `sheet-google-home.html` and screenshots. |
| Agent memory (`/home/box/agent-data/atlas/dan-needs/DAN-NEEDS.md:12`) | "**Google Home Premium**: KILL before ~Oct 16. Routine Thu Oct 14 armed." That's a subscription-cancel task, not a home scene. |
| MCP connectors (pattern `(?i)home\|nest\|google`) | Only Google Calendar, Drive, Sheets, Gmail. **No Google Home / Nest connector.** |
| Google APIs (docs checked Oct 1 2026) | **SDM (Nest Device Access)**: structures expose only `sdm.structures.traits.Info` (name). No Home/Away, no routines, no scenes. **Google Home APIs Automation API** (Android/iOS only): `structure.automations()` / `listAutomations()` returns "only automations you have created through the Home APIs". Routines made in the Google Home app can't be listed or run from outside. No web/REST path. |

## Mode to scene map (brief: "the mode recalls the scene Wright already owns")

| House mode (brief) | Scene to recall |
|---|---|
| School day | UNKNOWN (none found) |
| After school | UNKNOWN (none found) |
| Weekend | UNKNOWN (none found) |
| Day off (`day-off`, Atlas) | UNKNOWN (none found) |
| Kids away (`kids-away`; renamed from the brief's old label, ruling Oct 1) | UNKNOWN (none found) |
| Nashville week (away-care: pet, lawn, alarms) | UNKNOWN (none found). No alarm device on the box either. Travel week is READ from `data/house-mode.json` (Atlas), never inferred from the calendar |
| Guest | UNKNOWN (none found) |
| Quiet | UNKNOWN (none found) |

## Wall buttons (built in wall.html, branch only)

| Button | Writes (exact, in order) | Path | No key |
|---|---|---|---|
| **I'm home** | `kitchen` on · `dining-room` on (no brightness change) | `HouseLights.setLight` → `POST /api/lights/set` (existing) | `NEED KEY`, disabled, 0 requests |
| **Leaving** | `dining-room` off · `harris-room` off · `kitchen` off | same | same |

Rules: `scenePlan()` / `sceneButtons()` in `house-wall-status.js`; glue `house-wall-actions.js` (`scene()` also refuses when `HouseLights.canWrite()` is false: quiet `lights offline`, nothing sent). Tests: `scripts/wall/house-wall-status.test.mjs`, `scripts/wall/thermo-travel.test.mjs`.
The thermostat has its own **Travel / Back home** button (THERMO-TRAVEL.md). It is not part of either scene.
Mode chips recall nothing. Kasa **All on / All off** is not relabeled; it stays a lights control on the Google Home board.

## Historical: what it would take to recall real Google Home routines (not built)

1. **Dan names what exists.** In the Google Home app, Automations tab. No API or connector exposes that list.
2. Recall paths: (a) a Home APIs phone/tablet relay (can only run automations it created), (b) Assistant voice, (c) the existing hub (what Dan chose for Home/Leaving).
3. SDM has no Home/Away state; the Nest devices on the box are 5 cameras only.
4. Google Home Premium is set to be cancelled (~Oct 16, DAN-NEEDS #5). Which automations use Premium-only starters: UNKNOWN.
