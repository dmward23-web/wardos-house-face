# SPOTIFY-LIVE · Music + Home audio on House Face (SPOTIFY1 + SPOTIFY2)

Dan, Sat Oct 3 2026 (CT):
5:46 PM: "Add my Spotify to the main house control board with control and press into Ori control."
6:29 PM: everything Spotify does should be on the Ori board.
6:30 PM: link it to the home audio and put that on the main board too.

## What's on the boards
- **Hub tile: Music · Home audio** (`sheet-index.html`). On the wall it's the last grid cell (spans 2). On the phone it's a strip under the lights.
  - Shows now playing (art, track, artist, progress) with prev, play/pause and next.
  - A **room row** lists the house speakers, groups and TVs. Tap a room to move the music there. The playing room has volume − / +.
  - Tapping the tile body flares it, then the Ori player irises open from the tap.
- **Ori player** (`sheet-spotify.html`) sits in a living painted forest (`ori/ori-scene.js`: WebGL2 parallax, god rays, motes). The forest tints to the album and bursts on track change.
  - Big art, seek, transport, shuffle/repeat, volume and the speaker picker.
  - ♡ like/unlike the current song and ≡ for the queue. The artist and album names open their pages.
  - **Home audio** panel: every room with Play here, per-room volume on the playing room, speaker groups ("Everywhere") and sleeping rooms.
  - **Search** covers songs, artists, albums, playlists, podcasts and episodes. On any song: tap to play, ＋ to queue, ♡ to save.
  - **Library** has Liked Songs plus Playlists, Albums, Artists and Podcasts (with Show more).
  - **Queue** shows Now playing and Up next. **Recent** lists recently played.
  - Album, artist, playlist, podcast and Liked Songs pages rise over the forest as glass. Each has Play, Shuffle and Save/Follow.

## Path (no Spotify token ever reaches a screen)
`screen → box proxy (scripts/lights-write-proxy.mjs, same hub key + Cloudflare tunnel as lights/Sensi) → scripts/spotify-control.mjs → Spotify Web API`

- The box holds ONE Spotify login for the house: Authorization Code + PKCE with a public client (no client secret exists).
- Box-only files, mode 600, never in git or Pages:
  - `~/.config/wardos/spotify-app.json`
  - `spotify-token.json`
  - `spotify-pending.json`
  - `spotify-rooms.json` (speaker names the box has seen)
- Redirect URI: `https://dmward23-web.github.io/wardos-house-face/spotify-callback.html`. The callback POSTs `code+state` to the box, and the single-use box-minted `state` authorises it.
- Endpoints follow Spotify's **Feb-2026 Development Mode** rules for new apps:
  - Library changes go through `/me/library` (save, remove and contains).
  - Playlist contents come from `/playlists/{id}/items`. Search returns at most 10 results.
  - "Top tracks" doesn't exist for new apps, so an artist's songs come from search.

Proxy routes (hub key required, except `exchange`):
`GET /api/spotify[?devices=1]` (snapshot + `rooms`) · `GET /api/spotify/browse?kind=search|liked|playlists|albums|artists|shows|recent|queue|album|artist|playlist|show[&q|&id|&offset|&types]`
`POST /api/spotify/control {action: play|pause|next|previous|seek|volume|shuffle|repeat|transfer|queue|like|unlike, …}`
`POST /api/spotify/auth-start` · `POST /api/spotify/setup {clientId, connect}` · `POST /api/spotify/exchange` · `POST /api/spotify/disconnect`

## Home audio
- The house runs Google Home: Nest cams and doorbell, Google Home Premium.
- Google and Nest speakers, cast groups and TVs reach Spotify as **Spotify Connect** devices, so the board drives them through Spotify:
  - Move the music to any room.
  - Set volume on the room that's playing.
  - Play everywhere by picking a Google Home **speaker group**. Groups are recognised by names like Everywhere, Whole House, Downstairs or "… group".
- Spotify only lists a speaker while it's awake. The box remembers speakers it has seen, so the room list stays stable. Asleep rooms show dimmed, and a tap explains how to wake them.
- Not possible from the box: Google has no public speaker/volume API, and the box isn't on the home Wi-Fi to use Cast directly.
  - Volume on a room that *isn't* playing.
  - Making new groups (do it once in the Google Home app).

## One-time setup (Dan, ~3–5 min, once for every screen)
1. On the board, tap the Music tile, then **Connect Spotify**. That opens the setup card.
2. In https://developer.spotify.com/dashboard/create (signed in as Dan, who has Premium), create the app **WardOS House**.
   - Redirect URI: `https://dmward23-web.github.io/wardos-house-face/spotify-callback.html`
   - Tick **Web API** and Save.
3. Paste the app's **Client ID** into the card, tap **Save & connect**, and approve the Spotify sign-in once.
4. If Spotify says the user isn't registered, go to the app's Settings → User Management and add Dan's Spotify email.

The box can do it too: `node scripts/spotify-control.mjs set-client <id>`, then tap **Connect Spotify** once.

## CLI (box)
`node scripts/spotify-control.mjs status | set-client ID | auth-url | state | devices | rooms | library | browse KIND [id|query] | do ACTION [v] | disconnect`

## QA rig (box only)
`node scripts/qa/spotify-mock.mjs --port 8799 --art-dir DIR --redirect-to http://127.0.0.1:8977/spotify-callback.html` stands in for Spotify. Point a test proxy at it with:
- `SPOTIFY_ACCOUNTS_BASE`, `SPOTIFY_API_BASE`
- `SPOTIFY_*_FILE` (test token, app, pending and rooms files)
- a test `LIGHTS_PROXY_TOKEN`

## Limits (honest)
- Control needs the box and tunnel up, the same as lights. It self-heals through the refresh loop.
- Every screen needs the hub key, the same as lights.
- A Spotify dev-mode app needs the owner's Premium and allows 5 users. Playback control needs Premium.
