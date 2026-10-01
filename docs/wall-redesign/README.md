# Wall redesign · Wright kit (branch `wall-redesign-1`)

Brief: `/workspace/plates/2026-10-01/redesign/BRIEF.md` (Atlas owns). Plate: Prism's `house-face-wall-redesign-27.png` (2560x1440).
**Branch only. Not deployed.** `wall.html` is a new page that no live page links. Not for main until Alfred PASS + Dan's last-yes.

| File | What |
|---|---|
| `WALL-BUILD.md` | wall.html: what is built, what is hidden (and why), deviations from the plate, render notes |
| `THERMO-TRAVEL.md` | Thermostat Travel 55–85 / Back home: arm-then-confirm, capture-before-write, box-side restore file, proxy endpoint |
| `SCENES.md` | Dan's Kasa scenes (I'm home / Leaving); Google Home scene inventory (none exist) |
| `STATUS-LIGHTS.md` | cams, thermostat (+ Travel light), Load day, travel-week care, laundry: sources, rules, stale = hidden |
| `LAUNDRY.md` | LG ThinQ washer + dryer: field names, API, NEED TOKEN, token rules |
| `OPEN-LOOPS.md` | max 3 house-object loops, empty = hidden |
| `LISTENING-PIP.md` | PARKED (ruling Oct 1); removed from the build |
| `KIOSK-27.md` | 27" landscape 2560x1440 ruling, vertical scroll, fit/zoom, portrait fallback |
| `../../wall.html` | the wall page (body.wall-kiosk) |
| `../../tokens-wall-kiosk27.css` | wall.html stylesheet only, derived from the plate CSS |
| `../../house-wall-status.js` | pure rules (UMD) |
| `../../house-wall-actions.js` | wall glue: scenes + Travel, every side effect injected |
| `../../scripts/sensi-travel.mjs` | box-side Travel/Back home logic used by the hub proxy |
| `../../scripts/lights-write-proxy.mjs` | + `GET/POST /api/sensi/travel` (TRAVEL1) |
| `../../sheet-google-home.html` | + `#laundry` section (NEED TOKEN, disabled chips, no script) |
| tests | `node scripts/wall/house-wall-status.test.mjs` · `node scripts/wall/thermo-travel.test.mjs` |
