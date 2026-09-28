# Nest cams live · House Face (Device Access SDM)

**Honest gate:** GitHub Pages is static. Nest / Google Home cams use **Google Device Access (SDM)** OAuth.

**Status (2026-09-28 · NESTVID1):** Refresh token + `nest-sdm.json` on box (mode 600). **WebRTC live video works** via box proxy `scripts/nest-webrtc-proxy.mjs` → `nest-webrtc.html`. Proven tonight: **Front door** (384×512) + **Garage** (1920×1080) ICE connected + frames. Living Room / Kitchen returned SDM `FAILED_PRECONDITION` (not available). Tokens never on Pages.

## Live data flow (stage)

```
Dan (once) → Device Access project + OAuth client + refresh_token
     ↓
Atlas box secrets (never git):
  ~/.config/wardos/nest-sdm.json          { projectId, clientId, clientSecret }
  ~/.config/wardos/nest-refresh.token     OAuth refresh_token (mode 600)
     ↓
scripts/nest-fetch.mjs
     ↓  OAuth  https://oauth2.googleapis.com/token
     ↓  SDM    GET .../enterprises/{projectId}/devices
     ↓  (optional) GenerateImage only with real eventId — no invent
     ↓
data/nest-live.json  status: need_token | live | error
     ↓
sheet-google-home.html polls every ~60s
  LIVE pulse only if status=live AND ≥1 fresh non-null snapshotUrl
  else honest STUB / NEED TOKEN
```

- **List devices:** camera / doorbell / display names + online when SDM returns them. **LIVE on glass.**
- **Snapshots:** These house cams are **WEB_RTC-only** (no RTSP). `GenerateImage` / `GenerateRtspStream` are rejected. When a Pub/Sub `eventId` exists, nest-fetch can download Basic-auth image bytes into `data/nest-snaps/*.jpg` and set `snapshotUrl` to that relative path (Pages-safe; tokens off JSON). Until then `snapshotUrl` stays **null** — never invent video.
- **RTSP / WebRTC:** RTSP unsupported. **WebRTC LIVE path (NESTVID1):**
  1. Box: `node scripts/nest-webrtc-proxy.mjs` → `http://127.0.0.1:8787`
  2. Open `http://127.0.0.1:8787/nest-webrtc.html` (or tap a cam pad on Google Home sheet)
  3. Browser builds Nest-legal SDP offer → proxy calls `GenerateWebRtcStream` → answer → ICE → `<video>`
  4. Elo / LAN: `node scripts/nest-webrtc-proxy.mjs --lan` then `?proxy=http://<box-ip>:8787&proxyToken=…`
  5. Secrets stay in `~/.config/wardos/` only — never git / never Pages

## Credential Atlas must request from Dan

**Do NOT ask Dan to paste Google account password into chat.**

**Ask for (secret-request / masked input, box-only):**

1. **Nest OAuth `refresh_token`** (long string from Device Access OAuth consent).
2. **`nest-sdm.json` fields** (or confirm Atlas already has them on box):
   - `projectId` — Device Access project ID
   - `clientId` / `clientSecret` — Google Cloud OAuth client (Desktop or Web) linked to that project

### How Atlas asks (secret-request)

Use the host **secret-request** surface (masked field → secret store). Never ask Dan to paste tokens into Slack/chat/git.

Suggested labels:

- `Nest SDM refresh_token` → write to `~/.config/wardos/nest-refresh.token` (mode 600)
- Optionally separate secrets for `client_secret` if not already in `nest-sdm.json`

After secrets land, Atlas runs `node scripts/nest-fetch.mjs` and pushes `data/nest-live.json` if status changes.

### How Dan sets up Device Access (browser, once)

1. Open https://console.nest.google.com/device-access → create / open a project → note **Project ID**.
2. Enable the SDM API on the linked Google Cloud project; create an OAuth client (client id + secret).
3. Set OAuth redirect (Device Access docs) and add scope `https://www.googleapis.com/auth/sdm.service`.
4. Run the Device Access OAuth link for your Google account that owns the Nest cams; approve devices.
5. Exchange the auth `code` for tokens; copy the **`refresh_token`**.
6. Hand refresh_token to Atlas via **secret-request** (masked) — never commit it.

Official docs: [Device Access](https://developers.google.com/nest/device-access).

### Where Atlas stores secrets

```bash
mkdir -p ~/.config/wardos
chmod 700 ~/.config/wardos

# OAuth client + SDM project (never git)
cat > ~/.config/wardos/nest-sdm.json <<'JSON'
{
  "projectId": "YOUR_DEVICE_ACCESS_PROJECT_ID",
  "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "clientSecret": "YOUR_CLIENT_SECRET"
}
JSON
chmod 600 ~/.config/wardos/nest-sdm.json

# refresh_token only (mode 600) — Atlas writes this after secret-request
# nano ~/.config/wardos/nest-refresh.token
chmod 600 ~/.config/wardos/nest-refresh.token
```

Env overrides (optional): `NEST_REFRESH_TOKEN`, or `--token-file` / `--config` flags.

**Gitignored:** `*.token`, `nest-sdm.json`, `.env*`, `data/nest-live.json.tmp`.

## Run fetch (Atlas box)

```bash
cd /workspace/wardos-house-face
node scripts/nest-fetch.mjs \
  --token-file ~/.config/wardos/nest-refresh.token \
  --config ~/.config/wardos/nest-sdm.json
# → data/nest-live.json  status:live|need_token|error
```

Missing token or client secrets → **exit 2**, writes `need_token` JSON (clean, no crash spam).

On success (auth + devices list), commit the JSON snapshot if desired:

```bash
git add data/nest-live.json
git commit -m "NEST-live · snapshot $(date -u +%Y%m%d-%H%M)"
git push origin main
```

### Suggested cron (every 5–10 min, after token exists)

```cron
*/10 * * * * cd /path/to/wardos-house-face && node scripts/nest-fetch.mjs && git add data/nest-live.json && git diff --cached --quiet || (git commit -m "NEST-live · auto" && git push)
```

## JSON contract (`data/nest-live.json`)

| `status` | UI |
|----------|----|
| `need_token` | STUB · NEED TOKEN · no LIVE pulse |
| `live` | Roster **LIVE** when `fetchedAt` fresh · green still pulse only if ≥1 non-null `snapshotUrl` · else **LIVE · NO STILL** |
| `error` | STUB · show error · never fake LIVE |

```json
{
  "status": "need_token",
  "fetchedAt": "2026-09-28T01:00:00.000Z",
  "updatedAt": "2026-09-28T01:00:00.000Z",
  "source": "nest-sdm",
  "cameras": [
    {
      "id": "stub-front",
      "name": "Front door",
      "where": "Entry",
      "type": "CAMERA",
      "online": null,
      "snapshotUrl": null,
      "streamUrl": null,
      "traits": []
    }
  ],
  "error": "NEST refresh_token / nest-sdm.json missing — …"
}
```

## UI rules

- `status === "live"` + fresh → show **LIVE** roster (real device names). Do not invent video.
- Green still + `<img>` only when a camera has a Pages-servable `snapshotUrl` (e.g. `data/nest-snaps/….jpg`).
- Otherwise pad badge **LIVE · NO STILL** + “Still pending · auth proxy” — never STUB · NEED TOKEN while SDM is linked.
- Names from SDM when live; stub pad names when `need_token`.
- Alternate path: local go2rtc/Scrypted HTTPS snapshots written into `snapshotUrl` by a future bridge (same JSON contract).

## Related

- Sensi climate (separate): **SENSI-LIVE.md** · `data/sensi-live.json`
- Surface: `sheet-google-home.html`


## WebRTC live video (NESTVID1)

```bash
# Atlas box — tokens already at ~/.config/wardos/
cd /workspace/wardos-house-face
node scripts/nest-webrtc-proxy.mjs          # 127.0.0.1:8787
# Elo wall on LAN:
# NEST_PROXY_TOKEN=secret node scripts/nest-webrtc-proxy.mjs --lan --port 8787
```

| URL | Role |
|-----|------|
| `http://127.0.0.1:8787/nest-webrtc.html` | Fullscreen viewer (tap cams) |
| `http://127.0.0.1:8787/api/cameras` | Live roster |
| `POST /api/webrtc` | `{ deviceId, offerSdp }` → `{ answerSdp, mediaSessionId }` |
| Pages `nest-webrtc.html?proxy=…` | Same UI; points at box proxy |

Pad tap on `sheet-google-home.html` opens the viewer. **No fake stills** — real WebRTC or honest error.
