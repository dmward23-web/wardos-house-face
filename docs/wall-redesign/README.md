# Wall redesign · Wright kit (branch `wall-redesign-1`)

Brief: `/workspace/plates/2026-10-01/redesign/BRIEF.md` (Atlas owns). Plate: Prism's `house-face-wall-redesign-27.png` (2560x1440).
**Branch only. Not deployed.** `wall.html` is a new page that no live page links. Not for main until review PASS + Dan's last-yes.

| File | What |
|---|---|
| `WALL-BUILD.md` | wall.html: what is built, what is hidden (and why), deviations from the plate, render notes |
| `THERMO-TRAVEL.md` | Thermostat Travel 55–85 / Back home: arm-then-confirm, capture-before-write, box-side restore file, proxy endpoint |
| `SCENES.md` | Dan's Kasa scenes (I'm home / Leaving); Google Home scene inventory (none exist) |
| `STATUS-LIGHTS.md` | cams, thermostat (+ Travel light), Load day, travel-week care, laundry: sources, rules, stale = hidden |
| `LAUNDRY.md` | LG ThinQ washer + dryer: field names, API, NEED TOKEN, token rules |
| `FINISH-V2.md` | v2 restyle tokens (hairline, monochrome, no motion), data-owner/glance attributes, empty states |
| `KIDLAYER3.md` | kid tiles (name = check-in, chore done), hall flash (**no hall light confirmed**), one-use unlocks + seats from Atlas `unlocks.json` / `kid-seats.json` |
| `FIVE-UPGRADES.md` | top-band controls (setpoint, Kasa toggles, scenes, doors/doorbell slots), house timer, Atlas LANE6 readers (provisional, hidden), Alfred P0-5, $15/hr allowlist |
| `GROCERY-CONTRACT.md` | pointer to Ledger's `docs/grocery-list-CONTRACT.md` (hosted as-is) |
| `CAMOFF1.md` | hub camera stills removed (exact references) |
| `JAR-REMOVED.md` | $ scan of every rail target + the hub, dropped rail badges, remaining gaps |
| `OPEN-LOOPS.md` | max 3 house-object loops, empty = hidden |
| `LISTENING-PIP.md` | PARKED (ruling Oct 1); removed from the build |
| `KIOSK-27.md` | 27" landscape 2560x1440 ruling, vertical scroll, fit/zoom, portrait fallback |
| `ATLAS-DATA-LANE.md` | Atlas's data lane (merged @ 4b288a4; Atlas's file, not edited here) |
| `../../wall.html` | the wall page (body.wall-kiosk); reads Atlas's house-mode / pickup-chain / who-home / pack-flags / temps |
| `../../tokens-wall-kiosk27.css` | wall.html stylesheet only, derived from the plate CSS |
| `../../tokens-wall-v2.css` | FINISH v2 overrides (wall.html only) |
| `../../house-wall-kid.js` + `../../config/wall-kid.config.json` | kid layer v3 (flash, marks, check-in, unlocks) |
| `../../house-wall-panel.js` · `../../house-wall-lists.js` | FIVE UPGRADES: setpoint/lights/timer · Atlas LANE6 readers |
| `../../house-grocery-list.js` | Ledger's module, hosted as-is |
| `../../house-wall-status.js` | pure rules (UMD) |
| `../../house-wall-actions.js` | wall glue: scenes + Travel, every side effect injected |
| `../../scripts/sensi-travel.mjs` | box-side Travel/Back home logic used by the hub proxy |
| `../../scripts/lights-write-proxy.mjs` | + `GET/POST /api/sensi/travel` (TRAVEL1) |
| `../../sheet-google-home.html` | + `#laundry` section (NEED TOKEN, disabled chips, no script) |
| tests | `node scripts/wall/house-wall-status.test.mjs` · `node scripts/wall/thermo-travel.test.mjs` · `node scripts/wall/kid-layer.test.mjs` · `node scripts/wall/wall-guards.test.mjs` · `node scripts/wall/panel.test.mjs` · `node --test scripts/wall/grocery-list.test.mjs` (Ledger) |
