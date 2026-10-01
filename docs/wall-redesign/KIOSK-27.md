# KIOSK 27" · landscape wall CSS plan · `tokens-wall-kiosk27.css` (branch `wall-redesign-1`, not linked)

## FLAG: the panel spec conflicts

| Doc | Says |
|---|---|
| `wardos-house-face/WALL-STATION.md` (locked Sun Sep 27, Dan LAST-YES) | **32" Elo 3202L PCAP, PORTRAIT**, design canvas **1080×1920**, "no scroll, no letterbox". Hardware **HOLD** until a separate Dan last-yes |
| `plates/2026-10-01/redesign/BRIEF.md` (Dan accepted Oct 1) | **27" landscape**, flush on the hallway column. Prism plate at **2560×1440** |
| Brief, also Oct 1 | "Every board scrolls (Dan, Oct 1)". Contradicts WALL-STATION's "no scroll" |

Open questions for Dan, through Atlas: (1) 27" or 32"? (2) Which model? 27" panels are often 2560×1440 native; the Elo 3202L is 1920×1080. (3) Is WALL-STATION.md superseded? Until he answers, this CSS is **resolution-agnostic**. It's built for a 1920×1080 CSS viewport and scales by `vw` to 2560×1440. Portrait 1080×1920 is **not** handled here; the existing pages still serve it.

## Viewport assumption

1920×1080 CSS px, landscape, kiosk fullscreen (no browser chrome), touch (Elo PCAP or similar). If the panel is QHD at 100% scale, the same rules hold because type uses `clamp(min, vw, max)`.

## Opt-in + breakpoint (nothing live changes)

```css
@media (orientation: landscape) and (min-width: 1600px) and (min-aspect-ratio: 3/2) {
  body.wall-kiosk { ... }
}
```
- Two locks: the media query **and** the `body.wall-kiosk` class. No live page has the class and no live page links the file.
- Phone 440×956 (portrait, 440 wide) can't match the media query. Even rotated, 956 wide is under 1600. Desktop/iPad pages without the class are untouched.
- Later wiring (not done): the kiosk boot URL sets the class (for example `sheet-index.html?wall=27`). That needs the plate + Alfred PASS + Dan last-yes.

## Grid regions (three bands; final placement waits on Prism's plate)

```
┌──────────────────────────── 12 cols · 1920 ────────────────────────────┐
│ TOP · 10-ft glance:  [mode chip] [NEXT UP line ............] [who-home] (•)stale │  ~18vh
│        pickup chain (school days, dies 7pm) · Atlas                    │
├────────────────────────────────────────────────────────────────────────┤
│ MID · locked tiles (Today/Week/Month/Dad Seat/kids/MUSTS/...)          │  1fr (scrolls vertically)
├────────────────────────────────────────────────────────────────────────┤
│ LOW · actuators at kid height: I'm home/Leaving* · kid check-in ·      │  ~30vh
│       chore done · dinner vote · ride/gear flag                        │
├────────────────────────────────────────────────────────────────────────┤
│ STATUS strip (Wright lights) · OPEN LOOPS (≤3) · listening pip corner  │  auto (hidden when empty)
└────────────────────────────────────────────────────────────────────────┘
* I'm home / Leaving stays BLOCKED until real scenes exist (SCENES.md).
```
Areas: `top`, `mid`, `act`, `status`. Class names: `.wk-wall`, `.wk-band-top`, `.wk-band-mid`, `.wk-band-act`, `.wk-status`, `.wk-loops`, `.wk-pip`. All `wk-` prefixed so they can't collide with live atoms.

## Type scale (1920 basis; clamps to 2560)

| Token | 1920 px | Use |
|---|---|---|
| `--wk-fs-hero` | 112 | NEXT UP time (the loudest thing on the wall) |
| `--wk-fs-glance` | 72 | mode chip, NEXT UP place, who-home |
| `--wk-fs-tile` | 40 | tile names |
| `--wk-fs-line` | 30 | status lights, open loops, tile sublines |
| `--wk-fs-min` | 22 | the floor; nothing smaller ships on the wall |
Tap targets: `--wk-tap: 96px` minimum on the actuator band (kid fingers). Gaps 24/32 px.

## Rules

- **No sideways scroll:** `overflow-x: hidden` on html/body/.wk-wall, `max-width: 100vw`, `min-width: 0` on grid children, long words wrap.
- **Vertical scroll is allowed** (Dan Oct 1) with `overscroll-behavior: contain`. The top band can stay put (`position: sticky`) so the glance never scrolls away. Plate decides.
- **HUBCMD DNA:** void `--cmd-void #010205` + amber `--cmd-amber / -hi / -on`, glass `--cmd-glass`, borders `--cmd-border`. Only the existing atoms from `tokens-hub-command-deck-shared.css`, with fallbacks. No second palette. Camo + WardOS mark stay (Prism places them).
- **Nothing loud:** no red, no blink, no pulsing alerts. The only motion is the pip ring while listening, and it's off under `prefers-reduced-motion`. Not-OK = amber-hi text, not a color flood.
- No camera feed or thumbnail anywhere in the kiosk layout.
- No `$`, no money, no kid dollars in any wall-kit class or content.
