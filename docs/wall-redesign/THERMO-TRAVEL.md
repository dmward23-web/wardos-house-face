# THERMOSTAT TRAVEL · wall button (Dan asked, Thu Oct 1 2026) · branch `wall-redesign-1`

## What it does
| State (from the LIVE reading) | Button | 1st tap | 2nd tap within 5 s |
|---|---|---|---|
| not Auto 55/85 | **Travel** | arms: **`Tap again · Travel 55–85`** | capture current mode + setpoints → write Auto · heat 55 · cool 85 |
| Auto 55/85 + saved setting | **Back home** | arms: **`Tap again · Back home`** | restore the saved mode + setpoints exactly |
| Auto 55/85, nothing saved | Back home · quiet **`no saved setting`** (disabled) | nothing | nothing sent |
| no key saved on the screen | Travel · quiet **`NEED KEY`** (disabled) | nothing | **zero requests** |

- Arm auto-cancels after 5 s (`ARM_MS = 5000`, `armTap` / `isArmed`). A tap at ≥5 s re-arms instead of firing. No menu.
- Status light: **`Travel · 55–85`** whenever the live reading is Auto 55/85 (`isTravelThermo`), regardless of who set it.

## Write path (existing, same as the hub thermostat)
- Wall → hub proxy (`HouseLights.proxyBase()`, token `wardos-lights-proxy-token` in localStorage, headers `X-Lights-Proxy-Token` + `Authorization: Bearer`). Same no-key rule as `house-sensi-ctl.js`.
- New proxy route (TRAVEL1, `scripts/lights-write-proxy.mjs`, after the auth check):
  - `GET /api/sensi/travel` → `{ ok, travel, saved, savedAt, thermostat }`
  - `POST /api/sensi/travel {action:"travel"|"back"}` → runs `scripts/sensi-travel.mjs` with the existing `scripts/sensi-control.mjs` (**unmodified**).
- One POST per confirm, then one GET to re-read the live state.

## Order (box side, `scripts/sensi-travel.mjs`)
- **Travel:** `readState` → capture `{mode, heatSetpoint, coolSetpoint, capturedAt}` → **save → re-read the file** (refuses with "nothing sent" if it did not persist) → `setMode auto` → `setTemp cool 85` → `setTemp heat 55`. Incomplete reading → nothing captured, nothing sent. Already Auto 55/85 → no writes, existing capture kept.
- **Back home:** no capture → 409 `no saved setting`, nothing sent. Else `setTemp heat` → `setTemp cool` (both while still in Auto) → `setMode` prior → `readState` → must match the capture exactly; then the capture is cleared. Mismatch → 502, **capture kept** so it can be retried.
- If someone changes the thermostat away from 55/85 by hand, the button reads Travel again; a new Travel confirm replaces the old capture with the then-current setting.

## Where the prior setting lives
- Box-side file **`~/.config/wardos/sensi-travel-restore.json`** (mode 600, atomic write; override with env `SENSI_TRAVEL_RESTORE`). Survives wall reloads and proxy restarts. **Never** in Pages JSON; `data/sensi-live.json` is not touched by this feature. No localStorage fallback was needed.

## Tests
`node scripts/wall/thermo-travel.test.mjs` (12) + travel cases in `node scripts/wall/house-wall-status.test.mjs`:
arm/disarm timing (4.9 s fires, 5.0 s re-arms, timer auto-disarms), capture-before-write order (`read, save, mode:auto, cool:85, heat:55`), exact restore, no restore without a capture (0 calls), mismatch keeps capture, file mode 600 + survives reload, zero requests with no key, one POST only on confirm.

## Not done / needs the hub restart
- The proxy on the box is **not** restarted by Wright. The endpoint goes live only when the hub runs the branch code (after merge + Dan's yes).
