# RECEIPT · GLYPH-RAIL2 · Mon 28 Sep 2026 ~11:05p CT

**Fold:** Wire amber session-rail SVGs onto boys glass · kill Musts/Jar/Days text · Alfred re-PASS.

## Root cause (GLYPH-RAIL1 FAIL)
HUBCLK1 / TEXTBACK1 forced `body.theme-{hayes,harris} .session-rail img { display: none !important; }`
and left jump-rail as visible Musts / Jar / Days text. SVGs existed in theme-tiles but never shown.

## Shipped
| Live | Change |
|---|---|
| `kid-hayes.html` / `kid-harris.html` | `<img>` session-rail pills + aria-label hit links (no visible word labels) |
| `tokens-hayes-dropzone-heat.css` / `tokens-harris-blockworld-heat.css` | GLYPH-RAIL2: show imgs, transparent Elo hitboxes over 3 pills |
| `theme-tiles/{hayes,harris}-session-rail-pills.svg` | 3-pill unlabeled amber (bolt/ring/flare · grid/gem/stack) |

## Cache
- kid-hayes / kid-harris: `house-engage` / tokens heat / `heat-v3` / SVG → `?v=GLYPH-RAIL2`

## Guardrails
- Nest / Sensi / lights live JSON / sheet-groceries / Ainsley untouched
- Section titles (Musts / Jar / Week) in body kept — only rail text killed
- hrefs `#sec-musts` `#sec-jar` `#sec-days` retained via empty aria-label anchors

Tip: `GLYPH-RAIL2`
