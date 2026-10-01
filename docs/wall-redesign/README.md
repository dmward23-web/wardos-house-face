# Wall redesign · Wright kit scaffold (branch `wall-redesign-1`)

Brief: `/workspace/plates/2026-10-01/redesign/BRIEF.md` (Atlas owns). Prism's plate isn't in yet, so this branch only has parts that don't need it.
**Nothing here is wired.** No live page links `tokens-wall-kiosk27.css` or loads `house-wall-status.js`. Not for main until the Prism plate, Alfred PASS, and Dan's last-yes.

| File | What |
|---|---|
| `SCENES.md` | Google Home scene inventory. **None found** (no Home/Leave). Recall paths + gaps |
| `STATUS-LIGHTS.md` | cams/doors, thermostat vs mode, Load day, dragon/pond: sources, rules, stale = hidden |
| `OPEN-LOOPS.md` | max 3 house-object loops, excludes, ranking, empty = hidden |
| `LISTENING-PIP.md` | "Hey Atlas" one-shot pip states; Voice Pipe wiring status |
| `KIOSK-27.md` | 27" landscape CSS plan; **27" vs 32" Elo portrait conflict flagged** |
| `../../tokens-wall-kiosk27.css` | scaffold, double opt-in (`landscape ≥1600px, ≥3/2` media query **and** `body.wall-kiosk`) |
| `../../house-wall-status.js` | pure rules stub (UMD), not wired |
| `../../scripts/wall/house-wall-status.test.mjs` | `node scripts/wall/house-wall-status.test.mjs` |
