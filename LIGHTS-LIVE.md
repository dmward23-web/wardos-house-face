# Lights live control · House Face

**Honest gate:** GitHub Pages is static. TP-Link **Kasa IoT** dimmers need cloud (or LAN) credentials on the Atlas box. With `kasa.user`+`kasa.password` on Atlas, `lights-fetch.mjs` runs the cloud probe and ships `status:live`. Without creds the UI stays **NEED TOKEN** + DEMO — **never** labels invented on/off as LIVE.

Nest SDM on the box is **cameras only** (no lights). Lights are Kasa — separate from Nest.

## Important: tplinkcloud.com ≠ Kasa switches

| Login | What you get |
|-------|----------------|
| **https://tplinkcloud.com** | Legacy **camera** admin only — **no** switches / dimmers |
| **Kasa / TP-Link account** (app email+password) | IoT cloud for plugs / switches / dimmers (KS220 etc.) |

Do **not** chase a token from the camera portal for Dining / Harris / Kitchen.

## Auth path (confirmed 2026-09-28)

**Preferred for Atlas (not necessarily on home Wi-Fi): cloud**

1. Dan places Kasa **account email + password** on Atlas only (files below).
2. Probe uses [`tplink-cloud-api`](https://pypi.org/project/tplink-cloud-api/) → V2 cloud login → `get_devices()` → map alias → `get_sys_info()` for `relay_state` + `brightness`.
3. Optional LAN: [`python-kasa`](https://pypi.org/project/python-kasa/) `Discover` / `Device.connect` with the same email+password (`Credentials`) for newer KLAP/AES devices. Env names for the CLI: `KASA_USERNAME` / `KASA_PASSWORD`.

There is **no** separate long-lived “kasa.token” from tplinkcloud.com for IoT. Session tokens come from email+password login inside the library (or optional refresh-token cache later).

**Brightness:** Yes for KS220 / HS220-style dimmers — read `brightness` from sysinfo; write via cloud passthrough `smartlife.iot.dimmer.set_brightness` (`scripts/kasa-write.py`). Probe remains read-only; **write** goes through `scripts/lights-write-proxy.mjs` (creds on box only).

## Live data flow (path C — same shape as Sensi)

```
Dan (once) → ~/.config/wardos/kasa.user + kasa.password  (mode 600)
     ↓
Atlas box: scripts/lights-fetch.mjs → kasa-live/.venv python + scripts/kasa-probe.py
     ↓  (tplink-cloud-api V2 login → get_devices + sysinfo)
data/lights-live.json  status=live (Dining / Harris / Kitchen)
     ↓
House Face UI polls JSON every ~60s
```

**LIVE (LIGHTS5):** cloud **read + write**. `writeSupported: true` when snapshot is live. Wall taps POST the Atlas `lights-write-proxy` (never the Kasa password).

- **Read:** per-light `on`, `brightness` (dimmers), `online` via `lights-fetch.mjs` → `data/lights-live.json`.
- **Write:** `POST /api/lights/set` on box proxy → `kasa-write.py` → Kasa cloud. **No DEMO overlays.** If proxy unreachable → controls dark (`PROXY OFF` / `NEED TOKEN` / `OFFLINE`).

## Credential Atlas must request from Dan

**Do NOT ask Dan to paste the Kasa password into chat.**

**Ask Dan to create these files on the Atlas box** (or have Atlas create empty files and Dan fill them via a secure channel / desktop):

```bash
mkdir -p ~/.config/wardos
chmod 700 ~/.config/wardos
# Kasa / TP-Link account email (same as Kasa app — NOT the camera-portal-only confusion)
nano ~/.config/wardos/kasa.user
# account password
nano ~/.config/wardos/kasa.password
chmod 600 ~/.config/wardos/kasa.user ~/.config/wardos/kasa.password
```

Or env on the Atlas cron user: `KASA_USER` + `KASA_PASSWORD` (also accepts `KASA_USERNAME`).

**Today on box (2026-09-28 CT):** `kasa.user` + `kasa.password` present (mode 600). LIVE cloud path works via those creds + `scripts/kasa-probe.py`. Nest + Sensi unchanged.

## Roster (LIGHTS2 · from Ward home screenshot)

Named dimmers/switches — kebab ids. Screenshot on/brightness seed DEMO defaults only; gate stays **NEED TOKEN** (never paint LIVE from snapshot alone).

| id | name | where | kind | DEMO seed |
|----|------|-------|------|-----------|
| `dining-room` | Dining Room | Dining Room | dimmer | on · 52 |
| `harris-room` | Harris's Room | Harris's Room | dimmer | on · 100 |
| `kitchen` | Kitchen | Kitchen | dimmer | on · 1 |

Aliases must match the **Kasa app** device names (probe normalizes case / punctuation).

**Hub vs kid boards:** `sheet-index` hub rocker panel (`#hub-lights-panel`) = PRIMARY wall control (Dining / Harris / Kitchen). `sheet-lights.html` = full-page board. Kid boards: that kid's named switch only (`kid-harris` → `harris-room`). LIGHTS4.

## Probe / fetch (Atlas box)

```bash
# venv (PEP 668 — do not pip --user on this distro)
python3 -m venv /workspace/plates/2026-09-28/kasa-live/.venv
/workspace/plates/2026-09-28/kasa-live/.venv/bin/pip install -r /workspace/plates/2026-09-28/kasa-live/requirements.txt

# cloud probe (stdout JSON — no secrets)
/workspace/plates/2026-09-28/kasa-live/.venv/bin/python \
  /workspace/wardos-house-face/scripts/kasa-probe.py
# or: .../probe_kasa.py --lan   # only if Atlas is on home LAN
```

Without creds → exit 2 + `status: need_creds`. **Do not** commit/push `status: live` until a probe succeeds.

Fetch (LIVE when creds present):

```bash
cd /workspace/wardos-house-face
node scripts/lights-fetch.mjs
# → data/lights-live.json  status:live  (Dining/Harris/Kitchen from cloud)
# missing creds → status:need_token + DEMO starter (honest)
# probe failure → status:error (keeps last lights if any; never invents LIVE)
```

Secrets **never** on Pages / git.

## JSON contract (`data/lights-live.json`)

| `status` | UI |
|----------|----|
| `need_token` / `need_creds` | NEED TOKEN · DEMO local toggles |
| `stage` | same as need_token · roster declared, no live reads |
| `live` | LIVE · on/brightness/online from fetch (if fresh) |
| `error` / stale | DEMO fallback · show error · never fake LIVE |

```json
{
  "status": "need_token",
  "fetchedAt": "2026-09-29T00:01:00.000Z",
  "source": "kasa-pending",
  "writeSupported": true,  // LIGHTS5 when status=live
  "lights": [
    { "id": "dining-room", "name": "Dining Room", "where": "Dining Room", "kind": "dimmer", "on": true, "brightness": 52, "online": true },
    { "id": "harris-room", "name": "Harris's Room", "where": "Harris's Room", "kind": "dimmer", "on": true, "brightness": 100, "online": true },
    { "id": "kitchen", "name": "Kitchen", "where": "Kitchen", "kind": "dimmer", "on": true, "brightness": 1, "online": true }
  ],
  "reserved": [],
  "error": "NEED TOKEN · controls dark — never DEMO"
}
```

## Write path (LIGHTS5 · wall taps → Kasa)

```
Elo / phone / box UI
  → POST {writeProxy}/api/lights/set   (Header: X-Lights-Proxy-Token)
       default writeProxy: http://127.0.0.1:8788
       Pages: seed once with ?lightsProxy=URL&lightsProxyToken=… (localStorage)
  → scripts/lights-write-proxy.mjs  (Atlas box · holds kasa.* secrets)
  → scripts/kasa-write.py           (tplink-cloud-api passthrough)
  → Kasa cloud → HS220 Dining / Harris / Kitchen
  → lights-fetch.mjs refreshes data/lights-live.json
```

Keep proxy running on Atlas:
```bash
LIGHTS_PROXY_TOKEN=$(cat ~/.config/wardos/lights-proxy.token) \
  node scripts/lights-write-proxy.mjs --host 127.0.0.1 --port 8788
```
Token file: `~/.config/wardos/lights-proxy.token` (mode 600). Optional CF quick tunnel to :8788 for Pages/Elo (same pattern as Nest :8787) — do not commit tunnel URL or token.

## UI rules

- **LIVE** only when `status === "live"` and snapshot is fresh.
- Missing Kasa creds → **NEED TOKEN** · controls dark (never DEMO).
- Live + writeSupported but proxy down → **PROXY OFF** · controls dark.
- Live + proxy up → pill **LIVE** · taps are real Kasa writes (optimistic UI + rollback on fail).

## Related

- Sensi climate: `SENSI-LIVE.md` / `house-sensi.js`
- Nest cams: `NEST-LIVE.md` / `house-nest.js` (cameras only — no lights)
- Plate notes: `/workspace/plates/2026-09-28/kasa-live/README.md`
