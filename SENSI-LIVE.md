# Sensi live temps · House Face

**Honest gate:** GitHub Pages is static. Emerson Sensi cloud needs a `refresh_token` (reCaptcha blocks password login from scripts). Until Atlas has that token on the box, the UI stays **CONNECT · NEED TOKEN** and DEMO localStorage — **never** labels invented numbers as LIVE.

## Live data flow (path C)

```
Dan (once) → refresh_token
     ↓
Atlas box: scripts/sensi-fetch.mjs
     ↓  OAuth  https://oauth.sensiapi.io/token  (client_id=fleet)
     ↓  WS     wss://rt.sensiapi.io/thermostat/  (read state once)
     ↓
data/sensi-live.json  (committed / pushed / or gist)
     ↓
House Face UI polls JSON every ~60s
  sheet-google-home.html climate hero
  sheet-sensi.html dial
```

- **Read:** ambient (`display_temp`), setpoint (heat/cool), mode, fan, humidity, online.
- **Write:** not wired yet. Setpoint / mode / fan buttons stay **DEMO · local only** until a safe write path exists. `writeSupported: false` in JSON.

## Credential Atlas must request from Dan

**Do NOT ask Dan to paste Emerson password into chat.**

**Ask for:** Sensi OAuth **`refresh_token`** (long JWT string), one-time capture from the web manager.

### How Dan captures it (browser, ~60s)

1. Open Chrome or Edge → https://manager.sensicomfort.com/
2. F12 → **Network** tab (preserve log on).
3. Log in with Emerson Sensi email + password (reCaptcha in browser is fine).
4. Find request to `oauth.sensiapi.io/token` or `token?device=`.
5. Open **Response** → copy the `refresh_token` value (no quotes).
6. Hand to Atlas via secret-request / paste into a **local file on Atlas box only** — never into git, Pages, or chat logs.

Same flow documented by community HA integration [iprak/sensi](https://github.com/iprak/sensi).

### Where Atlas stores it

```bash
mkdir -p ~/.config/wardos
chmod 700 ~/.config/wardos
# paste token into file (mode 600)
nano ~/.config/wardos/sensi-refresh.token
chmod 600 ~/.config/wardos/sensi-refresh.token
```

Or env: `export SENSI_REFRESH_TOKEN='…'` on the Atlas cron user.

**Not needed:** API key product, OAuth app registration, Nest/Google token.

## Run fetch (Atlas box)

```bash
cd /workspace/wardos-house-face   # or clone of wardos-house-face
cd scripts && npm install        # once — needs `ws`
cd ..
node scripts/sensi-fetch.mjs --token-file ~/.config/wardos/sensi-refresh.token
# → writes data/sensi-live.json  status:live|need_token|error
```

On success, commit + push the JSON (or publish via whatever Pages refresh Atlas already uses):

```bash
git add data/sensi-live.json
git commit -m "SENSI-live · snapshot $(date -u +%Y%m%d-%H%M)"
git push origin main
```

### Suggested cron (every 5 min)

```cron
*/5 * * * * cd /path/to/wardos-house-face && node scripts/sensi-fetch.mjs --token-file ~/.config/wardos/sensi-refresh.token && git add data/sensi-live.json && git diff --cached --quiet || (git commit -m "SENSI-live · auto" && git push)
```

Token rotation: OAuth may return a new `refresh_token`; the script rewrites `--token-file` when that happens.

## JSON contract (`data/sensi-live.json`)

| `status` | UI |
|----------|----|
| `need_token` | CONNECT · NEED TOKEN · DEMO fallback |
| `live` | LIVE · ambient/set/mode/fan from `thermostat` (if `updatedAt` &lt; 30 min) |
| `error` / `stale` | DEMO fallback · show error, never fake LIVE |

```json
{
  "status": "live",
  "updatedAt": "2026-09-28T00:00:00.000Z",
  "source": "sensi-cloud",
  "writeSupported": false,
  "thermostat": {
    "name": "Living Room",
    "ambient": 72,
    "setpoint": 70,
    "mode": "Heat",
    "fan": "Auto",
    "humidity": 45,
    "online": true
  },
  "error": null
}
```

## UI rules

- No **LIVE** label unless `status === "live"` and snapshot is fresh.
- Missing / expired token → clear **CONNECT · NEED TOKEN**.
- DEMO writes remain labeled DEMO until `writeSupported` is true.
