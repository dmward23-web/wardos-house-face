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
  sheet-google-home.html Lights tile (PRIMARY · full roster)
  sheet-lights.html pads (PRIMARY · full roster)
  kid-harris.html Harris's Room only (secondary shortcut)
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

## Roster (LIGHTS2 · from Ward home screenshot)

Named dimmers/switches — kebab ids. Screenshot on/brightness seed DEMO defaults only; gate stays **NEED TOKEN** (never paint LIVE from snapshot alone).

| id | name | where | kind | DEMO seed |
|----|------|-------|------|-----------|
| `dining-room` | Dining Room | Dining Room | dimmer | on · 52 |
| `harris-room` | Harris's Room | Harris's Room | dimmer | on · 100 |
| `kitchen` | Kitchen | Kitchen | dimmer | on · 1 |

**OP Kasa online** (Dan via Atlas). LIVE cloud still `need_token`. No separate pending stub — these three are the primary controllable pads.

**Hub vs kid boards:** `sheet-lights` / Google Home Lights tile = PRIMARY full roster (Dining / Harris / Kitchen · sits with Sensi/Nest). Each kid board gets that kid's named switch only as a secondary shortcut (`kid-harris` → `harris-room` via `HouseLights.mountKidLight`). Same pattern later for Ainsley/Hayes when those lights exist.

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
  "fetchedAt": "2026-09-29T00:01:00.000Z",
  "source": "kasa-pending",
  "writeSupported": false,
  "lights": [
    { "id": "dining-room", "name": "Dining Room", "where": "Dining Room", "kind": "dimmer", "on": true, "brightness": 52, "online": true },
    { "id": "harris-room", "name": "Harris's Room", "where": "Harris's Room", "kind": "dimmer", "on": true, "brightness": 100, "online": true },
    { "id": "kitchen", "name": "Kitchen", "where": "Kitchen", "kind": "dimmer", "on": true, "brightness": 1, "online": true }
  ],
  "reserved": [],
  "error": "NEED TOKEN · screenshot DEMO seeds only · do not paint LIVE"
}
```

## UI rules

- No **LIVE** label unless `status === "live"` and snapshot is fresh.
- Missing token → clear **NEED TOKEN**.
- DEMO writes remain labeled DEMO until `writeSupported` is true.
- Screenshot on/brightness may seed DEMO pad defaults; gate label stays NEED TOKEN.

## Related

- Sensi climate: `SENSI-LIVE.md` / `house-sensi.js`
- Nest cams: `NEST-LIVE.md` / `house-nest.js` (cameras only — no lights)
