# LAUNDRY · LG washer + dryer · NEED TOKEN (branch `wall-redesign-1`)

**Status: NEED TOKEN.** No LG ThinQ Personal Access Token (PAT) exists on the box. Nothing calls LG. Models: WM6500HBA washer / DLEX6500B dryer (**UNCONFIRMED**). A stacked pair is two devices (`DEVICE_WASHER`, `DEVICE_DRYER`), not a WashTower.

## Where it shows
- Google Home board `sheet-google-home.html#laundry` (LAUNDRY1): Washer + Dryer tiles, `NEED TOKEN` pill, **disabled** Start / Pause / Off chips (`data-laundry-op`). No script. Verified 0 requests after clicks at 440x956, 1080x1920, 2560x1440.
- Wall status light: `Laundry · NEED TOKEN` (quiet, LED off). Rules `laundryLight()` / `laundryControls()` in `house-wall-status.js`.

## LG ThinQ Connect API (sources: official `thinqconnect` 1.0.14 SDK `devices/washer.py`, `devices/dryer.py`; jsthinqconnect README; HA `lg_thinq` strings.json)
| Field | Use |
|---|---|
| `runState.currentState` | POWER_OFF, INITIAL, PAUSE, RESERVED, DETECTING, SOAKING, RUNNING, RINSING, SPINNING, DRYING, COOLING, END, WRINKLE_CARE, ERROR … (uppercase) |
| `operation.washerOperationMode` / `operation.dryerOperationMode` | START, STOP, POWER_OFF, WAKE_UP. **Pause = STOP is ASSUMED** |
| `remoteControlEnable.remoteControlEnabled` | must be `true` before Start (set at the machine) |
| `timer.remainHour` / `remainMinute` / `totalHour` / `totalMinute` (+ `relative*`) | remaining time |
- Base `https://api-aic.lgthinq.com` (US). `GET /devices`, `GET /devices/{id}/state`, `GET /devices/{id}/profile`, `POST /devices/{id}/control` body e.g. `{"operation":{"washerOperationMode":"START"}}`.
- Headers: `Authorization: Bearer <PAT>`, `x-country`, `x-message-id`, `x-client-id`, `x-api-key`, `x-service-phase`.
- PAT from `connect-pat.lgthinq.com` (Dan's LG login). **Not obtained.**

## Wall rules (tested)
- No token / `need_token` / `hasToken:false` → `NEED TOKEN`, all controls off, sends nothing.
- Stale (> 30 min, ASSUMED) → hidden. Time printed only when the snapshot is ≤ 5 min old (ASSUMED), never extrapolated; else "running".
- `Washer 0:32 · Dryer DONE`. Both idle → hidden. PAUSE → paused. ERROR → not-OK. Unknown states shown raw, lowercased.
- Start only when `remoteControlEnabled === true` and not running. Pause / Off also need the remote flag (ASSUMED).

## Proposed proxy (not built)
`GET /api/laundry`, `POST /api/laundry/control {unit, op}`; PAT at `~/.config/wardos/lg-thinq.pat` (mode 600); server re-checks remote-start before any START.

## Token lesson (do not repeat)
NESTVID1 / LIGHTS6 baked `nestProxyToken` / `writeProxyToken` into public Pages JSON. KEYROT1 (cc2eb84) and KEYROT2 (e1b1bcc) rotated and dropped them, but `NEST-LIVE.md` still describes baking. **The LG PAT and any laundry control key must never be in Pages JSON**; use a separate non-public key.
