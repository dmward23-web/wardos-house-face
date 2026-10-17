# Nest Device Access setup notes

Public status only. No client secret, no refresh token, no auth code.

## Where things stand (2026-09-28 · FAIL3e)

| Item | Value |
|---|---|
| GCP project | Ward House Nest (`YOUR_PROJECT_ID`) |
| Smart Device Management API | Enabled |
| OAuth consent | Google Auth Platform configured, publishing status **Testing**, audience **External** |
| OAuth scope | `https://www.googleapis.com/auth/sdm.service` |
| OAuth client | Web application **Ward House Nest Web** |
| Client ID (public) | `YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com` |
| Authorized redirect URI | `https://www.google.com` |
| Device Access project | **Ward House Atlas** (Sandbox) |
| Device Access project ID | `YOUR_DEVICE_ACCESS_PROJECT_ID` |
| OAuth client linked in Device Access | Yes |
| Client secret on box | Yes · `~/.config/wardos/nest-sdm.json` mode 600 (**never git**) |
| Refresh token on box | **Yes** · `~/.config/wardos/nest-refresh.token` mode 600 (**never git**) |
| `nest-fetch` | Live · lists **5** cams (names stay in the private feed on the house computer, never in git) |
| Stills | Pending (no RTSP) · **WebRTC video LIVE** via nest-webrtc-proxy (NESTVID1) |

## Status

**SDM is live on the box.** Refresh token + `nest-sdm.json` are present. `node scripts/nest-fetch.mjs` writes `data/nest-live.json` with `status: live` and real device names.

House Face pads: tap opens `nest-webrtc.html` WebRTC live (box proxy :8787). Proven on two cameras. Do **not** invent JPEG stills.

### Why stills are pending

These Nest devices advertise `CameraLiveStream.supportedProtocols: ["WEB_RTC"]` only. SDM returns:

- `GenerateRtspStream`: not supported (no RTSP)
- `CameraEventImage.GenerateImage`: not supported without RTSP / needs a real eventId from Pub/Sub

Path when events land: nest-fetch downloads GenerateImage / ClipPreview bytes with the auth header into `data/nest-snaps/*.jpg` (gitignored by default), sets `snapshotUrl` to a relative Pages path. Tokens never go on Pages.

Alternate: go2rtc / Scrypted HTTPS snapshot bridge into the same JSON field.

## Run fetch

```bash
cd /workspace/wardos-house-face
node scripts/nest-fetch.mjs
# writes data/nest-live.json  status:live
```

Secrets stay under `~/.config/wardos/` only.
