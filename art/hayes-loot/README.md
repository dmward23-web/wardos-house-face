# Hayes loot sprites (HAYESLOOT2)

Used only by `hayes-loot.js` on `kid-hayes.html`. Transparent PNG, painted, original art.
Each sprite ships at 1x `name.png` and 2x `name@2x.png` (2x used when devicePixelRatio > 1.4).

| name | 1x size (CSS px) | anchor / how it's drawn |
|---|---|---|
| `glider` | 128 x 124 | canopy across the top ~40%, rider centered at (64, 87). Drawn centered on its path point, rotated ±7°. |
| `card-common` `card-uncommon` `card-rare` `card-epic` `card-legendary` | 232 x 74 | plate fills the box with ~6px glow margin. Gem centered at (~40, 37). Text is drawn by code: tier name at y=27, chore name at y=52, centered at x=128 (right of the gem). Keep the middle-right area calm/dark so white text reads. |

Generator for the current set: `/workspace/plates/2026-10-13/hayes-fortnite/gen/gen_loot.py`.

## Swapping in Prism's art
1. Drop files with the same names/sizes/anchors into `art/hayes-loot/prism/` (both 1x and @2x).
2. Add the names to `art/hayes-loot/prism.js`, e.g. `window.HAYES_LOOT_PRISM = ["glider", "card-epic"];`
3. Listed names load from `prism/`, everything else falls back to ours. Unlisted files are never requested (no 404s).
