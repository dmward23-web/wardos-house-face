# FINISH v2 · wall.html restyle (Wright, Thu Oct 1 2026, branch `wall-redesign-1`)

There's no v2 plate in `plates/2026-10-01/redesign/`, so this follows the brief's text. File: `tokens-wall-v2.css`. It's scoped to `body.wall-kiosk.wall-v2` and loaded after `tokens-wall-kiosk27.css`, on wall.html only.

- An architectural panel: 1px hairline rules (`rgba(233,231,226,.16)`), a 6px radius, and **no glows, shadows or text-shadows**.
- One sans (InterV), sentence case (the plate's uppercase kickers are turned off), tight tracking. **Heavy weight only on the mode chip and NEXT UP.** Status, clock, chain times and stamps use tabular figures.
- Near-monochrome: ink `#e9e7e2`, mute, hairline. Signal colors are green `#5fbf8a` (OK), amber `#d9a441` (stale or needs attention only), red `#d0574b` (not OK).
- Kid colors are off. A kid is shown as a name and a small mark.
- Camo is held back to a flat 93% wash over `camo-tile.png`.
- **No motion:** `animation:none; transition:none` on every element, and there are no keyframes. A mode change is a hard cut.
- Controls are labeled and hairline-ruled, with taps ≥ 112px.
- The Ask pip is a hidden `#w-pip` with `data-state="off"`: one state change, no animation, PARKED.
- Tiles carry `data-owner` / `data-tile` / `data-tile-id` (owners per TILE-INVENTORY.md). The top band carries `data-band="top"`, plus `data-glance=mode|next-up|who-home|stale-dot` (GLANCE-01).
- Empty states:
  - Pickup chain: "None left today" / "No school pickups today", or "Not available right now" when the file is missing, stale or not today's.
  - Open loops: "None" (no loop source is wired yet).
- The rail foot reads "Branch build. Not live." (no bot name).

Render: `wall-build-2560-v2.png` (no key; Hayes checked in and Chore done tapped twice → flash `no hall light confirmed`, 0 non-local requests; Atlas kid-seats shown: Harris "Shower", Hayes row + countdown). `wall-build-2560-v2-unlock-MOCK.png` is the **same page with a MOCK `unlocks.json`** (all four lit) and a fake key. Hayes's Weekend fun was tapped (it went to sheet-weekend), and on return it shows as Used. Not a real state. `wall-build-1080x1920-v2.png`, `hub-1080x1920-v2.png`.
