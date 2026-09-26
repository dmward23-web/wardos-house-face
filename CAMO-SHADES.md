# Camo shades — UNITY LOCK

Single-template rule: House and Desk use one camo glass tile template; only the shade may vary. Do not create divergent kid backgrounds or separate camo compositions.

## Current paths

- **House / light:** `house-face/camo-glass-tile.png` (shared white/grey light camo). All three kid boards reference this same relative asset:
  - `house-face/kid-hayes.html`
  - `house-face/kid-ainsley.html`
  - `house-face/kid-harris.html`
- **Desk / dark:** `desk/camo-glass-tile-desk.png` (dark shade) now exists.
- **Shared House copy:** `house-face/camo-glass-tile-desk.png` is an identical copy of the Desk dark tile for shared-asset access.

## Kid accent overlays

- Keep the background shared: every kid board stays on `camo-glass-tile.png`.
- Proposed shade-neutral accents are overlays/chips only:
  - Ainsley: pink chips
  - Hayes: green chips
  - Harris: blue chips
- Accent colors may vary by kid, but never replace or recolor the shared camo tile.

## Verification

The three kid HTML files currently use `url("camo-glass-tile.png")` for their repeating background tile; no divergent camo asset is used. The Desk and House dark-tile copies have matching SHA-256 hashes.

## DESK CAMO LOCK (Sat 26 Sep 2026)

Desk dark chrome tokens (panel `#252a32`, overlay/vignette, glass `rgba(22,26,34,.82)`, mute `#a8b0bc`) are locked in `/workspace/board-os/DESIGN-SYSTEM.md`. Tile asset path unchanged (`camo-glass-tile-desk.png`). House light shade (`#d8dadf` / `camo-glass-tile-house`) unchanged. Wright owns chrome PNG assets.
