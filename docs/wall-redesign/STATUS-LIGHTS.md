# STATUS LIGHTS · Wright · 27" wall (rules in `house-wall-status.js`; drawn by `wall.html`, branch only)

Updated Thu Oct 1 2026 ~5:45 PM CT with the redesign owner's rulings.

Status lights are **lines in one quiet strip, not tiles**. Each light is one short line. When everything is OK, the strip is the shortest it can be.
**Stale or missing data = the light is hidden.** No placeholder, no "—", no "STALE" word, no grey box. The top-band **stale dot** (Atlas glance) is the only place "behind" shows up. (Laundry's quiet `NEED TOKEN` is the one exception the owner asked for, below.)

Freshness windows reuse the constants that already ship:

| Feed | File | Time field | Fresh window |
|---|---|---|---|
| Nest cams | `data/nest-live.json` | `fetchedAt` / `updatedAt` | 30 min (`house-nest.js:14`) |
| Sensi | `data/sensi-live.json` | `updatedAt` | 30 min (`house-sensi.js:12`) |
| Kasa lights | `data/lights-live.json` | `fetchedAt` | 24 h (`house-lights.js:17`) |
| House mode | `data/house-mode.json` (Atlas, branch `wall-redesign-atlas`, **not on origin yet**) | `asOfIso` (ASSUMED) | must equal today CT |
| Mode temps | `data/house-mode-temps.json` (Atlas; temps `null` today) | n/a | n/a |
| Laundry | proposed `/api/laundry` (LAUNDRY.md) | `fetchedAt` | 30 min state / 5 min timer (**ASSUMED kit defaults**) |

Wright reads these. Wright never writes them.

Quiet rendering: HUBCMD void + amber atoms (`--cmd-*`). OK = muted ink with a small amber dot. Not-OK = `--cmd-amber-hi` text, no red, no blink, no sound, no modal. Each line taps through to its sheet (no dead ends).

---

## 1. Cams (doors NOT shown)

| | |
|---|---|
| Ruling | Cams only. **Hidden until a real per-camera check exists.** Doors aren't shown (no door source; Garage/Door pads are `NEED CONNECT`) |
| Source | `data/nest-live.json` → `status`, `fetchedAt`, `cameras[].name`, `cameras[].online` |
| Rule | Every roster cam needs a real `online: true/false`. Any `null` → hidden. All `true` → `Cams OK`. Any `false` / missing → `Garage offline`, `Garage, Backyard offline`, `Garage +2 offline` |
| Stale | not live, `error`, or > 30 min → hidden |
| Today | all 5 cams report `"online": null` (SDM doesn't return `Connectivity` for them, `nest-fetch.mjs:280-286`), so the light is **hidden** |
| Never | no camera feed, still, or thumbnail on the hallway wall |

## 2. Thermostat (plain reading)

| | |
|---|---|
| Line | **`73° · school day`** (mode label from `data/house-mode.json`, lowercased). No house-mode file → `73°` only |
| Source | `data/sensi-live.json` → `thermostat.ambient`, `.online`, `.mode`, `.heatSetpoint`, `.coolSetpoint` (Sensi, not Nest) |
| Flag | **None while `house-mode-temps.json` temps are `null`** (they are today). A quiet `· check set 65–73°` shows up only once Dan puts real numbers in a mode's band |
| Travel | When the **live reading** is Auto heat 55 / cool 85 → **`Travel · 55–85`** (OK light). Read from the reading itself (`isTravelThermo`), never from a local flag. With a key saved, the wall uses the hub's live reading (`GET /api/sensi/travel`); without one, `data/sensi-live.json` |
| Not-OK | `online === false` → `Thermostat offline` |
| Stale | not live, no thermostat, or > 30 min → hidden |

## 3. Load day

| | |
|---|---|
| Ruling | **Hidden until a live source with an as-of exists.** No hard-coded dates |
| Evidence of no live source | `board-os/data/atlas-packet.json` `loadDay.isoDate` = 2026-09-25 (packet asOf Sep 21, desk-side, not on Pages); `sheet-load-day.html` hand-built for Mon Sep 28; nothing in `data/*.json` |
| Rule (once a source exists) | `asOfIso == today CT` **and** `loadDay.isoDate` is today → `Load day today`; tomorrow → `Load day tomorrow`; else hidden |

## 4. Travel-week care

| | |
|---|---|
| Gate | Travel week is **READ** from `data/house-mode.json` (key `nashville-week`, ASSUMED until Atlas's schema lands). **Never inferred** from the calendar or the Oct 2–12 trip. File missing / stale → hidden |
| Dragon | **No line, ever, until it exists** (ruling). The rule has no dragon output |
| Pond | **Hidden until a real data source exists.** Once one exists: `{filterOk, asOf, freshMs}` → `Pond filter OK` / `Pond filter not OK`. With no `freshMs` from the source → hidden |
| Kid-safe | "dragon" / "pond" are on Alfred's kid-chore ban list; Alfred rules before the pond line goes live |

## 5. Laundry (LG washer + dryer, NEED TOKEN)

| | |
|---|---|
| Source | none yet. Proposed `/api/laundry` on the house hub (LAUNDRY.md). Field names are LG ThinQ Connect's real schema |
| No token | **`NEED TOKEN`** (quiet, links to `sheet-google-home.html#laundry`). This is the state today: no PAT obtained |
| Stale | > 30 min → hidden |
| Line | `Washer 0:32 · Dryer DONE`. Time only from `timer.remainHour/remainMinute` when the snapshot is ≤ 5 min old; otherwise `Washer running`. **Never a made-up or extrapolated time.** Both off/idle → hidden |
| Not-OK | `ERROR` / `POWER_FAIL` → `Washer error` |

## Stub API (`house-wall-status.js`, pure, no DOM/fetch/timers, loaded by no live page)

`readHouseMode(json)` · `camsLight(nest, {roster})` · `thermoLight(sensi, {mode, temps})` · `loadDayLight(src)` · `travelLights(mode, care)` · `laundryLight(laundry)` · `laundryControls(laundry, unit)` · `sceneButtons(defined)` · `statusStrip(feeds)` · `openLoops(items)`. 57 tests: `node scripts/wall/house-wall-status.test.mjs`.
