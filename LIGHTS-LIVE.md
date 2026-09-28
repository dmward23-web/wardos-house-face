# Lights live control · House Face

**Honest gate:** GitHub Pages is static. TP-Link Kasa / Google Home lights need a cloud token or LAN control path on the Atlas box. Until that token exists under `~/.config/wardos/`, the UI stays **NEED TOKEN** and DEMO localStorage — **never** labels invented on/off as LIVE.

Nest SDM on the box is **cameras only** (no lights). Lights are Kasa / Google Home — separate from Nest.

## Live data flow (path C — same shape as Sensi)

```
Dan (once) → Kasa cloud token / local control path
     ↓
Atlas box: scripts/lights-fetch.mjs  (stub until creds)
     ↓
data/lights-live.json  (committed / pushed)
     ↓
House Face UI polls JSON every ~60s
  sheet-index.html Lights oval
  sheet-google-home.html Lights tile
  sheet-lights.html pads
```

- **Read:** per-light `on`, `brightness` (dimmers), `online`.
- **Write:** DEMO localStorage only until `writeSupported: true` and a safe proxy exists. Never invent LIVE.

## Credential Atlas must request from Dan

**Do NOT ask Dan to paste Kasa / Google password into chat.**

**Ask for:** a Kasa cloud / tplink-cloud token (or agreed LAN discovery path) stored **only on the Atlas box**.

### Where Atlas stores it (when ready)

```bash
mkdir -p ~/.config/wardos
chmod 700 ~/.config/wardos
# token file mode 600 — never commit
nano ~/.config/wardos/kasa.token   # name TBD when Atlas confirms path
chmod 600 ~/.config/wardos/kasa.token
```

Or env: `export KASA_TOKEN='…'` on the Atlas cron user.

**Today on box:** `~/.config/wardos/` has Nest + Sensi only — **no Kasa token yet**.

## Starter roster (provisional IDs)

Pad names from Google Home secondary strip — kebab ids until live fetch renames:

| id | name | where | kind |
|----|------|-------|------|
| `hall` | Hall | Hall | bulb |
| `kitchen` | Kitchen | Kitchen | bulb |
| `porch` | Porch | Porch | bulb |
| `op-wall-dimmer` | OP wall dimmer | Overland Park | dimmer · **pending** |

**OP Kasa KS220/HS220** (`op-wall-dimmer`): reserved fold-in slot · `online:false` · `pending:true` · **not live until Atlas confirms that dimmer is online on Wi-Fi**. Do not invent pairing.

## Run fetch (Atlas box — when tokened)

```bash
cd /workspace/wardos-house-face
node scripts/lights-fetch.mjs --token-file ~/.config/wardos/kasa.token
# → writes data/lights-live.json  status:live|need_token|error
```

Without creds the stub writes `need_token` (honest). Commit + push JSON only when status changes meaningfully:

```bash
git add data/lights-live.json
git commit -m "LIGHTS-live · snapshot $(date -u +%Y%m%d-%H%M)"
git push origin main
```

Secrets **never** on Pages / git.

## JSON contract (`data/lights-live.json`)

| `status` | UI |
|----------|----|
| `need_token` | NEED TOKEN · DEMO local toggles |
| `stage` | same as need_token · roster declared, no live reads |
| `live` | LIVE · on/brightness/online from fetch (if fresh) |
| `error` / stale | DEMO fallback · show error · never fake LIVE |

```json
{
  "status": "need_token",
  "fetchedAt": "2026-09-28T00:00:00.000Z",
  "source": "kasa-pending",
  "writeSupported": false,
  "lights": [
    { "id": "hall", "name": "Hall", "where": "Hall", "kind": "bulb", "on": null, "brightness": null, "online": null }
  ],
  "reserved": [
    { "id": "op-wall-dimmer", "name": "OP wall dimmer", "where": "Overland Park", "kind": "dimmer", "on": null, "brightness": null, "online": false, "pending": true }
  ],
  "error": "Need Kasa cloud token or LAN control path on Atlas box"
}
```

## UI rules

- No **LIVE** label unless `status === "live"` and snapshot is fresh.
- Missing token → clear **NEED TOKEN**.
- DEMO writes remain labeled DEMO until `writeSupported` is true.
- OP wall dimmer stays pending / offline until Atlas confirms Wi-Fi online — then fold into `lights[]`.

## Related

- Sensi climate: `SENSI-LIVE.md` / `house-sensi.js`
- Nest cams: `NEST-LIVE.md` / `house-nest.js` (cameras only — no lights)
