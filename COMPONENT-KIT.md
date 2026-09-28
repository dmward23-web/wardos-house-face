# House face · component kit

**As-of:** Sat Sep 19 2026 (CT)  
**Surface:** Board-OS House face (`/workspace/board-os/house-face/`)  
**Look:** Soft white/grey glass camo · Inter Display · charcoal leave-by  
**Rule:** Reuse these pieces. Do not invent a second chrome language.

Companion: `../PRISM-HMI-HANDOFF.md` · `../HUB-LOCK.md` · `../DESIGN-SYSTEM.md`

All primary plates: **1080×1920**. Phone export crop: **1170×731**.

---

## Shared foundation (every plate)

| Token | Value / pattern |
|-------|-----------------|
| Canvas | `1080×1920`, `overflow: hidden` |
| Base fill | `#d8dadf` |
| Body text | `#121418` |
| Type | `"Inter Display", "Inter", -apple-system, …` (local `fonts/`) |
| Camo | `camo-glass-tile.png` tiled (~420px) + soft white/grey gradients + soft-light overlay |
| Frost shell | Header / cards: `background: rgba(255,255,255,0.55–0.68)`; border `rgba(255,255,255,0.85–0.88)`; inset highlight + soft charcoal drop shadow |
| Mock tag | `MOCK · … · NO PIN` + as-of line (kids-safe wording on kid/sheet pages) |

---

## 1. Leave-by bar

**Job.** Loudest same-day cliff: next leave time + place + flight/detail + badge.

**Where.** `index.html`, `month.html`, `month-chat.html`, `sheet-index.html` (and kid hottest bars echo the same priority energy in kid color).

**Anatomy.**

```
┌──────────────────────────────────────────────────────────────┐
│ ▎ charcoal gradient band · light time pill · detail · badge │
└──────────────────────────────────────────────────────────────┘
```

| Part | Spec |
|------|------|
| Band | Charcoal gradient e.g. `#262830 → #343840 → #454952 → #3a3e46 → #2a2c32` |
| Accent rail | Thin light vertical gradient at leading edge |
| Label | Uppercase / small: “Next leave-by” |
| Main | Date · **time in light pill** · place |
| Detail | Flight / route HTML (strong on flight id) |
| Badge | Frosted pill (e.g. “Load day”) |

**Kid variant.** Same loud-bar role as **hottest bar** (below), tinted to kid green / purple / blue — not a second leave-by system.

---

## 2. Frosted card

**Job.** Content vessel on camo: day columns, chore rows, vote cards, pack sections, win slots.

**Spec.**

- Fill `rgba(255,255,255,0.55–0.72)`
- Border `1px solid rgba(255,255,255,0.85–0.9)`
- Radius ~12–16px
- Shadow: inset top white hairline + soft `rgba(20,22,28,0.08)` drop
- Optional status tint via border/background only (handoff orange, urban green, flight charcoal) — never paint money status on House

**Do.** One idea per card. Known facts or EXAMPLE/MOCK label.  
**Don’t.** Meters, neon floods, Desk FREEZE/BUY chrome.

---

## 3. Kid chip

**Job.** Person color at a glance; tap target toward that kid’s board.

**Ids.** `ain` Ainsley · `hay` Hayes · `har` Harris

| Kid | Label color | Dot / accent |
|-----|-------------|--------------|
| **Ainsley** | `#4a2a58` | Purple `#b468c8` / `#c47ad8 → #9b55b8` |
| **Hayes** | `#144838` | Green `#2fad84` / `#3ec9a0 → #2a9a78` |
| **Harris** | `#1a3050` | Blue `#4a84d4` / `#5a9ae8 → #3a6fc0` |

**Shapes.**

- **Who-chip** (week header): pill + letter dot + name
- **Inline chip** (event block): smaller pill + letter + name
- **Index tile accent** (sheet-index): top gradient bar in kid color + letter icon

Tap kid → `kid-ainsley.html` / `kid-hayes.html` / `kid-harris.html`.

---

## 4. Tap-done ring

**Job.** Kid checkoff affordance with cheer energy (chores, kid-board “Tap when done”).

**Anatomy.**

- Circular ring with `✓` when done
- Label: “Tap when done” / chore name
- Reward cue: streak star `★ +1` (stars only — **no $**)
- Copy energy: “✓ boom” / “Done = stars · cheer energy” · optional soft Web Audio ding (see §7)

**Laws.** Cheer not nag. EXAMPLE starters labeled. Empty/unknown ≠ invent. No homework-scold chrome.

---

## 5. Hottest bar

**Job.** Per-kid (or sheet) “what matters most this week” — same loudness role as leave-by, scoped to that kid/sheet.

**Where.** Kid boards (`hot-banner` / `hot-pill`); echoed in sheet headers (“Winning · Taco night”, “6 days to birthday”, etc.).

**Anatomy.**

- Leading accent rail in kid/sheet color
- Label: “Hottest this week” (or sheet equivalent)
- Title with strongs on the deciding nouns (day, time, event)
- Sub: context (handoff, load day, mom’s week…)
- Optional badges (Birthday, UA Glow, WIN, MOCK)

Week-level leave-by stays family-wide charcoal; hottest stays kid-tinted.

---

## 6. Index tile

**Job.** Big tap on `sheet-index.html` to open week / month / kid / sheet.

**Anatomy.**

```
┌─────────────────────┐
│ ▔ accent (optional) │
│  [icon]  Label      │
│          Subline    │
│              Tap    │
└─────────────────────┘
```

| Part | Spec |
|------|------|
| Shell | Frosted card; active scale ~0.975 |
| Icon | Emoji or letter avatar |
| Label | Inter bold; kid tiles use kid label color |
| Sub | Short purpose line (e.g. “Checkoffs · streaks”, “Stars only · cheer”) |
| Tap | Trailing “Tap” chrome |
| Accents | Kid / stars / fun / vote / win / count top-bar gradients |

**Grid.** 16 tiles (4×4): Today, Week, Month, Hayes, Ainsley, Harris, Chores, Groceries/Costco, Allowance ★, Dinner vote, Weekend fun, Pack list, Week win, Countdowns, Us · together, Load day.

---

## Composition notes

| Pattern | Use |
|---------|-----|
| Header frost row | Back link + title/tagline + hot-pill + mock tag |
| Footer | `ftr-chip` (tablet-test / context) + quiet meta (“no money · no PIN”) |
| Us strip (week only) | Logistics FYI chips — display only; never drafts |
| Weather card (mock) | Today strip + week hdr-right · MOCK · icon strip · no invented °F |
| Load-day | Emphasize Fri column / leave-by badge; not a money cliff |

---

## Out of kit (do not add to House)

- Ledger FREEZE / BUY / AVAILABLE chrome  
- Harbor draft / send / Hot Gate  
- Vita rings / therapy meters  
- Dollar amounts / allowance cash  
- Dark SCADA Desk shell tokens (`#070b10`, etc.) on House plates  

Desk Life tiles keep their own anatomy in `DESIGN-SYSTEM.md`. House stays soft glass + kid-pull laws.

*Reuse the kit. Wire facts. Leave the picture alone unless Dan asks.*


---

## 7. Client checkoffs (`house-checkoffs.js`)

**Job.** Kids-safe tap toggles on chores / groceries / pack / allowance stars. Persist in `localStorage` only — no backend.

**Grammar.** `data-check="id"` · done class + ✓ fill · soft `pop` scale · allowance `.tap-star` lit/dim.

**Cheer cue mock (sound).** On check **on** (not off), plays a tiny soft Web Audio sine “ding” (~140ms, low gain). Mock only — no audio files.

| Control | Behavior |
|---------|----------|
| Default | On (`<html data-sound="on">` on chores / groceries / pack / allowance) |
| Toggle off | `data-sound="off"` on `<html>` (or `"0"` / `"false"`) |
| Reduced motion | `prefers-reduced-motion: reduce` → ding suppressed |
| Fail-soft | No AudioContext / autoplay block → silent; never blocks the tap |

Do not add kitchen-loud whoops, loops, or asset packs. Cheer, not carnival.

---

## 8. Weather card (mock)

**Job.** Soft-glass glance slot for outside weather — **PLACEHOLDER labeled MOCK**. No real forecast numbers as truth.

**Where.** `sheet-today.html` (strip under leave-by) · `index.html` week header (`hdr-right`, above mock tag).

**Anatomy.**

```
┌─────────────────────────────────────────────┐
│ Outside · glance          ☀  ☁  🌧  ⛅     │
│ Weather · mock / wire later  [MOCK]         │
│ PLACEHOLDER · no forecast numbers           │
└─────────────────────────────────────────────┘
```

| Part | Spec |
|------|------|
| Shell | Frosted card (`rgba(255,255,255,0.58–0.62)`) · white hairline · soft drop |
| Label | “Weather · mock / wire later” + gold **MOCK** pill |
| Icons | Simple strip only — sun / cloud / rain / part-cloud — decorative, not data |
| Copy | Explicit PLACEHOLDER · wire later |

**Do.** Keep MOCK visible. Soft glass lock.  
**Don’t.** Invent °F, radar, or “feels like” as if live.

