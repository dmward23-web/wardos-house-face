# FIVE UPGRADES · wall.html (Wright, Thu Oct 1 2026, v4 ~7:10 PM CT, branch `wall-redesign-1`)

Brief: `BRIEF.md` "FIVE UPGRADES" (Dan, 6:19 PM CT). Same board: no new board, cron or scene, and no now-playing. Code is in `house-wall-panel.js` and `house-wall-lists.js`, with Ledger's `house-grocery-list.js` hosted as-is. Tests: `node scripts/wall/panel.test.mjs` (20) and `node scripts/wall/wall-guards.test.mjs` (23).

**v4: the data shapes now come from Atlas's contracts** (ATLASLANE6, merged from origin `wall-redesign-atlas` @ `c9ee49a`): `docs/wall-redesign/ATLAS-DATA-LANE.md` (NEXT UP `data/next-up.json`, school-night `data/school-night.json`, display renames `config/display-rename.json`) and `docs/wall-redesign/LOGISTICS-TAPS.md` (`data/logistics-taps.json`). The provisional v3 shapes are gone.

## 1 · Top band = house controls (`#w-ctl`, `data-band="top"`)
- **Mode chip**: display only (Atlas's `house-mode.json`). There's no mode write path (gap).
- **Temperature**:
  - Shows the inside temperature, plus Heat and/or Cool −/+ steppers depending on the mode.
  - Uses the existing Sensi write path, `POST /api/sensi/set {kind:"temp", mode:"heat"|"cool", temp}`, with the same key and proxy as `house-sensi-ctl.js`.
  - Each tap moves 1°. There's no arm/confirm.
  - **Debounced 1.2 s: one request per settled side.** Net-zero taps send nothing.
  - Limits: 50–90°, and a 3° deadband in Auto.
  - No steps when there's no key (NEED KEY, zero requests), when there's no live reading, or when the thermostat is offline, Off, or in Travel (55/85).
  - Travel / Back home is the existing arm-then-confirm toggle, moved into this group.
- **Lights**:
  - The existing Kasa toggles (Dining Room, Harris's Room, Kitchen), from the `HouseLights.effectiveLights()` roster, via `HouseLights.setLight`.
  - No key: disabled with NEED KEY. An unknown on/off state is disabled (never guessed).
- **I'm home / Leaving**: Dan's existing Kasa scenes (SCENES.md), unchanged.
- **Doors lamp** (`#w-doors`): hidden, with no reader, because no door source exists on the box.
- **Doorbell line** (`#w-bell`): hidden, with no reader. There's no Ring. The Nest "Front door doorbell" is in `nest-live.json`, but it carries no ring events. Never a feed or a still.
- All targets ≥ 48px: chips are 64px, small taps 88px, steppers 80px, kid/act taps 112px.

## 2 · NEXT UP + one house timer (`#w-nextbar`)
- Atlas's NEXT UP (cal-live) stays as is. Its title and place go through the display renames (below).
- **Leave-by line** (`#w-leave`) reads `data/next-up.json` per ATLAS-DATA-LANE.md "NEXT UP": `{asOfIso, generatedAt, next:{label, copy, leaveAt, leaveIso, startIso, day} | null, timer: null}`.
  - Renders `label · copy`, plus `(day)` when `day` isn't `Today`. Today's file reads `Hayes + Harris drop-off · Leave 8:10. (Fri)`.
  - Hidden when: the file is absent, not today's, more than 6 h old, `next` is null, `copy` isn't exactly `Leave h:mm.`, or `leaveIso` has passed.
- **Timer** (`#w-timer`, Wright; this is Atlas's "timer slot", which Wright owns):
  - Label chips: Oven / Laundry / Bath. Minute chips: 5/10/15/20/30/60.
  - Stored shape is the contract's `{label, endsAt}`: `label` is 1–12 letters/spaces, and `endsAt` is ISO with a CT offset.
  - Reads `Oven 12:00.` (m:ss left, rounded up, with a trailing period; no label → `Timer 12:00.`). It clamps at `Oven 0:00.`. An invalid slot renders nothing.
  - It's one object: a new set replaces the old one. Stored per device in localStorage `wardos-wall-timer`.
  - At 0 it shows a 2 s on-screen inverse, then clears.
  - **No Kasa flash, no sound file, nothing to a phone.**

## 3 · Atlas's four taps + school-night strip
**Logistics taps** (`#w-ltaps`) follow LOGISTICS-TAPS.md and read `data/logistics-taps.json`:
- File shape: `{date, resetsAt, status, taps, generatedAt, controls[], lateChips, sendsToPeople:false, perDevice:true, shared:{enabled:false}}`.
- Drawn controls are the file's own `controls` (ids `im-home`, `leaving`, `check-in`, `running-late`), with the file's labels, kids (Harris, Hayes, Ainsley) and chips (5/10/15/20/30). Unknown ids aren't drawn.
- Hidden when `sendsToPeople` isn't `false`, when `date` isn't today's house day, or when `resetsAt` has passed (3:00 AM CT).
- State is per device in localStorage `wardos-wall-logistics`, as `{taps:[{control, at, kid?, minutes?}]}`. The house day resets at 3:00 AM CT, and the latest tap wins the status line.
- Status copy follows the contract: `Home 6:05.` · `Leaving 8:05.` · `Running 15 min late.` · `Ainsley home 5:52.`
- **Check in** also writes who-home (`checkedInAt`, the same as the kid name button). The kid name button also logs a check-in tap.
- **I'm home / Leaving** carry the file's `lights` plan. Only with the key, they run the existing scene client (`act.scene`, SCENES.md): Kitchen + Dining on, or all Kasa off. No key means no light request. The thermostat is untouched.
- **Nothing is sent to a person**: `effects.sends` is always `[]`, and `house-wall-lists.js` has no network code (tested). The shared hub key stays OFF (last-yes).

**School-night strip** (`#w-school`) reads `data/school-night.json` per ATLAS-DATA-LANE.md:
- Shape: `{asOfIso, generatedAt, visibleFrom, visibleUntil, visibleFromIso, visibleUntilIso, schoolNight, visible, pickup[{who,label,time,leaveBy,by,copy}], gear[{who,items,copy}], form?{who,what,dueIso,day,copy}, weather:null, weatherSource}`.
- Shown only when `schoolNight` and `visible` are both true, the file is today's and ≤ 6 h old, and now is in [`visibleFromIso`, `visibleUntilIso`). It hides at 7:00 PM even on a stale file.
- Lines are Atlas's `copy` strings: Pickup, Gear, Form.
- **Field weather** (Wright, FIELDWX1). Atlas's `weather` is `null` ("source needed"), so the wall adds a Field line itself:
  - **Game**: today's timed calendar event in `cal-live.json` whose title says "game" (not a practice) and that hasn't started. The game time comes from `game H:MM` / `H:MM game` in the title, otherwise the start time.
  - **Forecast**: the one the existing Open-Meteo pill already fetches (`house-weather.js`, home coordinates 38.884, −94.671, cached in `house-wx:v4`). That same call now also asks for hourly `temperature_2m`, and `HouseWeather.load()` returns it as `hourlyTemp`.
  - **What it reads**: the forecast hour the game starts in, e.g. `64° at 5:30`.
  - **Shows nothing** when there's no game, when that hour isn't in the forecast or has no number, or when the pill fell back to wttr.in (no hourly temps). The current temperature is never used as the field temperature.
  - It asks for weather only when the strip is up **and** there's a game. There's no new fetch, key or cron, and wall.html contains no weather URL.

**Display renames** come from `config/display-rename.json` (loaded by the wall; there are no names in the wall code):
- They apply the grandparents' rename plus the parent-word scrub to calendar-derived labels: NEXT UP title/place, pickup chain, Pack flags, kid countdown, school-night lines and the next-up label.
- Everything else renders as the data gives it. An item the scrub would drop isn't shown.

## 4 · Grocery tile
GROCERY-CONTRACT.md → Ledger's `docs/grocery-list-CONTRACT.md`.

## 5 · Alfred P0s (branch copies only; live pages untouched until merge)
- Hub `sheet-index.html`: the money tile is removed (v3), and so is the Ainsley tile's jar sub/row (v4).
- **Ainsley's babysit `$15/hr` tag STAYS** (Dan, 6:27 PM CT: the one allowed dollar exception). Its places are `kids-week.json` `rateLabel`, the `sheet-chores.html` addon tag, the `sheet-allowance.html` feed row, and `kids-data.js` (tag + earnOpt).
- **KIDPATH1 (v4)**: `scripts/wall/kid-path-copy.mjs` pulls the visible copy out of the kid-path files:
  - It reads HTML text plus aria-label/title/placeholder/alt, JS string literals (tags stripped) and JSON values. It skips code tokens, ids and comments.
  - Files: house-kid-engage.js, sheet-index.html, kid-ainsley.html, kids-data.js (incl. EMBEDDED), kids-week.json, sheet-chores.html, sheet-allowance.html, sheet-pack.html, sheet-win.html.
  - `wall-guards` fails on any `$` other than `$15/hr`, and on jar, XP, Bal, "Show me the Money" or Mom wording.
  - Per-chore `$N` now shows the row's own star count (`N★`, equal to `data-stars`).
  - The allowance rate logic, star counts, goal `need` and ids are untouched (display text only).
- **WALLKIT8/9**: kid-hayes.html + kid-harris.html get the same treatment, and the scanner also bans streak / 🔥 (16 files). Atlas's ATLASLANE7 (`scripts/house/kid-copy.mjs`) now owns kids-week kid copy at the source; the streak/🔥 → "Week N" wording lives there too, so a calendar refresh can't bring it back.
  - Hayes/Harris reward line = Atlas's "Goal with Dad after honest musts" (kids-week + the kids-data.js fallback).
  - Ainsley has a seat, not a score (KL-05): her streakLabel is "" at the source, `house-kid-engage.js` `SEAT_ONLY` drops every streak/day count on her seat, and the sheet-chores "★ 4-day" chip in her column is gone. Counts are removed, not relabeled.
- No hardcoded parent names in wall code. Renames come from the config.
- Earlier P0s are kept: no cam video or still, `data-owner` + tile ids on every tile.

## 6 · Rail
- **Week → `sheet-index.html`** (the House hub). There is no standalone week page: WEEKGONE1 (Dan 9/29, `index.html`) retired the old Week page and sends old Week links to the hub, and LINKWEB1 maps "Week board" to it.
- **Dad Seat stays on `sheet-dan.html`.** A test checks that the two targets differ.

## Renders (2560x1440 unless noted)
- `wall-build-2560-v4.png`: clean, no key, real clock.
- `wall-build-2560-v4-schoolnight.png`: **MOCK** (red banner on the image).
  - The clock is fixed to Thu Oct 1 6:45 PM CT, inside 3–7 PM, using Atlas's real `school-night.json` for today.
  - A game fixture ("MOCK fixture · Hayes baseball · 7:30 game") is served in `cal-live.json` to the page only. No real game falls on a visible school night in the calendar window: Mon Oct 5's 5:30 game is a kids-away night per Atlas's CLI.
  - The Open-Meteo reply is a fixture. Its hourly `temperature_2m` values are the NWS EAX hourly forecast for the home point, because Open-Meteo answered "Daily API request limit exceeded" from this box.
  - The Field line reads `68° at 7:30`.
- `wall-build-1080x1920-v4.png`.

0 non-local requests without a key on the clean renders, no page errors, and no sideways scroll at 2560 or 1080.
