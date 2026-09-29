# CAMLIVE2 · hub cam LIVE WebRTC (Front / Garage / Backyard)

**When:** 2026-09-28 ~20:50 CT  
**Tip:** `f389f43` · CAMLIVE2  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Shipped

1. **Hub deck LIVE video** — Front / Garage / Backyard tiles run inline Nest WebRTC via `nest-webrtc-client.js` + baked `nestProxy` (LIGHTS6 pattern). Hard-refresh just works while CF tunnel + `nest-webrtc-proxy` are up.
2. **Honest LIVE label** — Pill = **LIVE** only after `<video>` has frames (`videoWidth > 0` + playing). JPEG stills stay visible with **STILL** / **STALE** / **NEED PROXY** until then. **Never** fake LIVE on a JPEG.
3. **Tap → fullscreen** — Tile href opens `nest-webrtc.html` with cam + proxy (same stream path).
4. **Proxy path** — If tunnel dead: reopen `cloudflared` → `~/.config/wardos/nest-webrtc-proxy.url`, run `nest-fetch` to re-bake `nestProxy` + `nestProxyToken`.

## LIVE proof (box CDP · Alfred QA)

| Cam | Pill | Video | Playing |
|-----|------|-------|---------|
| Front door | **LIVE** | 960×1280 | yes (`currentTime` advancing) |
| Garage | **LIVE** | 1920×1080 | yes |
| Backyard | **LIVE** | 1920×1080 | yes |

Proof JSON + screenshot: `plates/2026-09-28/cam-live/proof.json` · `hub-cam-deck-live.png`  
(`allHonestLive: true` — pill LIVE **and** video playing; not JPEG-only.)

## Protected

- `data/sensi-live.json` not modified by CAMLIVE2 (left at concurrent SENSIFRESH · md5 `f94ad66f17893dafb644fca4c82c37ca`)
- SDM OAuth / `nest-sdm.json` / refresh token stay box-only (never git)

## Cache bust

`nest-webrtc-client.js` · `house-nest.js` · `tokens-hub-cams.css` → `?v=CAMLIVE2`
