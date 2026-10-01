# CAMOFF1 · camera stills removed from the hub (Wright, Thu Oct 1 2026, branch `wall-redesign-1`)

`sheet-index.html` (the hub) no longer shows any camera image. The removed references are listed exactly below.

Removed from `sheet-index.html`:
- the whole `#hub-cam-deck` block: three `.hub-cam` still tiles, each with an `<img>` (`data/nest-snaps/front-door.jpg`, `data/nest-snaps/garage.jpg`, `data/nest-snaps/backyard.jpg`) and a STILL pill
- `<script src="nest-webrtc-client.js?v=PROXYFOLLOW2">`
- `<script src="house-nest.js?v=CAMIOS2">`
- the inline `var N = window.HouseNest;` line and its `if (N) { … N.mountHubCamDeck("#hub-cam-deck") … }` block

Kept on purpose:
- the `tokens-hub-cams.css` link (styling only)
- the shared files themselves (`house-nest.js`, `nest-webrtc-client.js`, `data/nest-snaps/`), which other pages use. Nothing was deleted.

Added (`#hub-cams-row`, `data-owner="Wright"`):
- a cams status light (`HouseWallStatus.camsLight` over `data/nest-live.json`, refreshed every 60 s). It's hidden when stale and links to `sheet-google-home.html`.
- a `House panel · pickup · loops · gallery` link to `wall.html`
- an `Add screen key` button (`data-hub-key-entry`), shown only when no `wardos-lights-proxy-token` is saved. Key entry used to start from a cam tile; this keeps it.

Guard: `wall-guards.test.mjs` checks for no `<video>` / nest-webrtc / house-nest / nest-snaps references in wall.html and sheet-index.html.
Gap: the cams light has no `online:null` check yet.
