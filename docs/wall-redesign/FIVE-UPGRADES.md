# FIVE UPGRADES · wall.html (Wright, Thu Oct 1 2026 ~6:35 PM CT, branch `wall-redesign-1`)

Brief: `BRIEF.md` "FIVE UPGRADES" (Dan, 6:19 PM CT). Same board: no new board, cron or scene, and no now-playing. Code is in `house-wall-panel.js` and `house-wall-lists.js`, with Ledger's `house-grocery-list.js` hosted as-is. Tests: `node scripts/wall/panel.test.mjs` (14) and `node scripts/wall/wall-guards.test.mjs` (17).

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
- Atlas's NEXT UP (cal-live) stays as is.
- **Leave-by line** (`#w-leave`) reads Atlas's `data/next-up.json` (ATLASLANE6, **not on origin**). It's hidden when the file is absent.
- **Timer** (`#w-timer`, Wright):
  - Label chips: Oven / Laundry / Bath. Minute chips: 5/10/15/20/30/60.
  - Reads "Oven 12:00" (no label → "Timer 12:00").
  - It's one object: a new set replaces the old one.
  - Stored per device in localStorage `wardos-wall-timer`, so a reload keeps the countdown.
  - At 0 it shows a 2 s on-screen inverse (a single state change, no animation), then clears.
  - **No Kasa flash, no sound file, nothing to a phone.**

## 3 · Atlas's four taps + school-night strip (hidden until ATLASLANE6)
`data/logistics-taps.json` and `data/school-night.json` are **not on origin**, so both are hidden. PROVISIONAL reading shapes, to be re-checked when ATLASLANE6 lands:
- `logistics-taps.json` `{asOfIso, generatedAt, taps:[{id: "im-home"|"leaving"|"check-in"|"running-late", label, minutes?:[n]}]}`. Unknown ids are not drawn. Running late shows minute chips. Check-in shows the three names.
- Taps log per device to `wardos-wall-logistics:<CT date>`. **No keyboard, nothing is sent to a person.**
- `school-night.json` `{asOfIso, generatedAt, schoolNight:true, pickup?, gear?[], formDue?, fieldWeather?}`. Shown **only 3:00–6:59 PM CT**, today's and ≤ 6 h old. Lines are shown in the file's words.
- `next-up.json` `{asOfIso, generatedAt, leaveBy:{copy:"Leave 5:10.", atIso}}`. Shown only when today's, ≤ 6 h old and the time is in the future.

## 4 · Grocery tile
GROCERY-CONTRACT.md → Ledger's `docs/grocery-list-CONTRACT.md`.

## 5 · Alfred P0s (branch copies only; live pages untouched until merge)
- Hub `sheet-index.html`: the **"Show me the Money" / Jars tile is removed**.
- **"Balance $…" is removed** from kid surfaces: `kids-data.js` bank meta and jar-left lines, and the `sheet-allowance.html` label.
- **Ainsley's babysit `$15/hr` tag STAYS** (Dan, 6:27 PM CT: the one allowed dollar exception). It was briefly stripped and is now restored. `wall-guards` allowlists exactly that tag: any `$N/hr` in the reachable files must be `$15/hr` on a babysit/hire line, and wall.html itself shows no `$`.
- Earlier P0s are kept: no cam video or still, `data-owner` + tile ids on every tile.
- **No hardcoded "Mom"** in wall code or copy. Calendar text renders exactly as the data gives it (NEXT UP currently reads "Pick up Hayes at Casey's (Riley's mom)" from `cal-live.json`). The only remaining occurrence is `PEOPLE_RE` in `house-wall-status.js`, the open-loops block filter, which hides loops with people words and never prints one.

## Renders (2560x1440 unless noted)
- `wall-build-2560-v3.png`: clean, no key, no taps.
- `wall-build-2560-v3-tapped.png`: no key. Hayes checked in + chore done, Oven 15, grocery chips added and one checked.
- `wall-build-2560-v3-key-MOCK.png`: fake key with mocked hub replies. Two Heat + taps → **exactly one** `POST /api/sensi/set`.
- `wall-build-1080x1920-v3.png`.

0 non-local requests without a key, no page errors, and no sideways scroll at 2560 or 1080.
