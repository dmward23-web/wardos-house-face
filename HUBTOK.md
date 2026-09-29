# HUBTOK1 · Shared command-deck tokens + atoms

**Tip:** `HUBTOK1` · 2026-09-28  
**DNA:** Hub Command Deck Hotter (CMDDECK2) — one amber/cyan CONTROL PANEL language.  
**Files:** `tokens-hub-command-deck-shared.css` · hub overlay `tokens-hub-command-deck-hotter.css`

## Load order

1. `tokens-hub-command-deck-shared.css?v=HUBTOK1` — `:root` cmd tokens + reusable atoms  
2. `tokens-hub-command-deck-hotter.css?v=HUBTOK1` — hub-scoped layout (`.hub-upper`, `.leaveby`, `#hub-lights-panel`, `.hub-cam-deck`)

Kit sheets (Wright): link **shared only** this tip. Full chrome restyle = **HUBKIT1**.

## `:root` tokens

| Token | Role |
|-------|------|
| `--cmd-void` | Deep void black |
| `--cmd-ink` | Primary ink |
| `--cmd-amber` / `--cmd-amber-hi` / `--cmd-amber-on` | Hotter amber scale |
| `--cmd-cyan` / `--cmd-cyan-hi` | Cam / edge cyan |
| `--cmd-mute` | Quiet meta |
| `--cmd-glass` | Mission-glass gradient fill |
| `--cmd-border` / `--cmd-border-hot` | Amber panel borders |
| `--cmd-bloom-amber` / `--cmd-bloom-cyan` | Glow blooms |
| `--cmd-tap-min` / `--cmd-bulk-min` / `--cmd-rocker-w` / `--cmd-knob` | Generic tap sizes |

Hub layout sizes (`--hub-command-h`, etc.) stay in the hotter overlay.

## Atoms (stable classes)

| Class | Use |
|-------|-----|
| `.cmd-panel` (+ `.cmd-panel--hot`) | Void mission-glass panel shell |
| `.cmd-hdr` | Header row flex |
| `.cmd-title` | Uppercase command title |
| `.cmd-meta` | Quiet meta text |
| `.cmd-pill` + `--live` / `--off` / `--stub` / `--need` | Honest gates only — **never DEMO** |
| `.cmd-chip` (+ `--loud`) | Slim bulk action chip |
| `.cmd-rocker` + `.is-on` / `.is-off` / `:disabled` / `.is-disabled` / `.is-stub` | Horizontal pill rocker; child `.cmd-rocker-knob` |
| `.cmd-bezel` | Cyan cam-style media bezel |
| `.cmd-hero` (+ `--sm`) | Amber hero numeral |

## Gate law

LIVE / OFF / STUB / NEED only. Stub and Need rows never wear LIVE. No DEMO language in shared DNA.

## Out of scope (HUBTOK1)

- Kid boards (`kid-*`) — Atlas  
- Hub layout / quest redesign — Atlas  
- Full kit sheet chrome restyle — **HUBKIT1**
