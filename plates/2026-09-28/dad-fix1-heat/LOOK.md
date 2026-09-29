# LOOK · Dad Fix1 Heat · DADFIX1 / TEXTBACK1

**Plate:** `dad-fix1-heat` · id **DADFIX1-LOOK** · 2026-09-28 · Prism LOOK only  
**Canvas:** Elo / Asus portrait **1080×1920** · wall, no scroll  
**Ship gate:** LOOK only. Atlas ships after Dan last-yes. **Do not** edit live `sheet-dan.html` / push Pages.  
**Base:** DADCLK1 clock-first + live Dad structure · fixes Dan’s three fails.  
**Heat window:** until midnight CT 2026-09-28.

---

## Dan’s three fails (DADCLK1 → DADFIX1)

| # | Fail | End-state law |
|---|------|----------------|
| 1 | **Empty Today column** — wasted blank / FAIL denser | Today always filled: **next-up · musts · leave** cards (plain words). No empty `sec-list`. |
| 2 | **Placeholder `—°` ovals** | **NEVER show `—°`.** Real wired Weather/Sensi temps only. Else **OMIT the oval entirely** (icon+deg gone). |
| 3 | **Eras Stage corn** still on Dad | **KILL** Eras Stage / vinyl-merch / teen corn. Kid jumps = **plain names only**. |

---

## Law · no em-dash degree (HARD)

```
WRONG:  [ ☀ —° ] [ ⌠ —° ]     ← fake chrome · Dan hates this
RIGHT:  [ ☀ 68° ] [ ⌠ 72° ]   ← real wired instruments only
RIGHT:  (ovals absent)         ← if Wx/Sensi not wired yet
```

| KEEP | KILL |
|------|------|
| Real numeric ° when live JS wires Weather/Sensi | Literal `—°` / `–°` / empty deg pretending to be chrome |
| Icon-only oval **only if** Atlas wires tap without deg (no dash) | Showing oval with placeholder dash-degree |
| Omit entire `.oval.wx` / `.oval.sensi` when unwired | Fake “looks live” chrome |

**LOOK render note:** Mock shows **68° / 72°** as **DEMO WIRED LOOK** only — labeled here so Atlas does **not** hardcode those numbers. Production = live instrument values or omit.

---

## Today column · fill map (denser · plain words)

**Law:** Tonight/next morning always has ≥3 cards. Prefer calendar facts from House / Atlas. Empty mount = FAIL.

| Slot | Plain label (example Mon→Tue) | Wire target |
|------|-------------------------------|-------------|
| 1 · NEXT | Tue 7:30 · pack late-lunch snacks | `sheet-today.html` / next-up focus |
| 2 · LEAVE | 8:10 · Boys SRE drop | `sheet-countdowns.html` |
| 3 · MUSTS | Musts · kids clear | `sheet-chores.html` |
| 4 · HOME (hot) | Kids with Dad @ 147th · through Fri Oct 2 · 3:00 | `sheet-today.html` |
| (overflow) | Tue 4:25 · Ainsley swim leave | `sheet-countdowns.html` |

**Words KEEP:** Next · Leave · Musts · Today · Kids with Dad · SRE drop · swim · flag  
**Words KILL on Dad:** Setlist · Track · Encore · Eras · Stage · Vinyl · Tour · LOADOUT · DROP (corn)

If calendar thin after midnight, still show: standing leave-bys (8:10 / 3:15) + musts + Dad-week home card. Never blank.

---

## Eras / vinyl · kill list (Dad board only)

| KILL on Dad | REPLACE WITH |
|-------------|--------------|
| `Ainsley · Eras Stage` | `Ainsley` (+ Board chip OK) |
| Eras Stage · vinyl · vinyl-night · needle · setlist · encore · tour (as Dad chrome) | omit |
| Theme suffixes on kid jumps (`· Block World` / `· Drop Zone` / `· Eras Stage`) | plain **Harris · Hayes · Ainsley** |
| Teen merch corn / pink mood chrome fighting void+amber | void+amber ops only |

Kid boards keep their own themes; **Dad box does not advertise them.**

---

## Clock-first header (locked · TEXTBACK1)

```
[  10:51  ]················[ ☀ 68° ][ ⌠ 72° ]   ← DEMO wired look
   ↑ TIME only                  real ° or OMIT ovals
```

| KEEP | KILL |
|------|------|
| Huge TIME digits (no “CT”) | Logo / WardOS / tagline / eyebrow / Dad name in hdr |
| Amber Wx/Sensi **only when ° real** | `—°` · condition strings · hot-pill fighting clock |
| Micro Home / Week under clock | Merch corn · Eras · brand chrome |

Palette: void `#0a0908` / `#010205` + amber `#f5c446` / `#ffe894` / `#b85a28`.

---

## Layout · DADFIX1

| Zone | ~H | Role |
|------|----|------|
| HEADER | ~110 | clock-first · amber Wx/Sensi **or omit** · micro Home/Week |
| HERO | ~200 | next leave · huge time · plain where |
| KIDS ROW | ~88 | Harris / Hayes / Ainsley · **names only** · no Eras |
| OPS STACK | flex | **Today dense** · week · leave-bys · picks |
| FOOT | ~48 | kids-safe · DAN · DADFIX1 |

---

## Tap → destination map (every tap leads somewhere)

| LOOK label | Wire target (Atlas) | Notes |
|------------|---------------------|-------|
| **TIME** | ambient (not a link) | Clock display only |
| **☀ ° Wx oval** | `sheet-today.html#house-wx` | **Only if real ° wired** · else omit oval |
| **⌠ ° Sensi oval** | `sheet-sensi.html` | **Only if real ° wired** · else omit oval |
| **Home** | `sheet-index.html` | Micro chip |
| **Week** | `index.html` | Family week strip |
| **Leave hero / Next** | `sheet-countdowns.html` | Huge next time |
| **Harris** | `kid-harris.html` | Name only |
| **Hayes** | `kid-hayes.html` | Name only |
| **Ainsley** | `kid-ainsley.html` | Name only · **no Eras Stage** |
| **Today · next / leave / musts cards** | `sheet-today.html` / countdowns / `sheet-chores.html` | Each card tappable |
| **This week row** | `month.html` or `sheet-today.html` | Known facts only |
| **Leave-bys row** | `sheet-countdowns.html` | Standing leave list |
| **Your picks row** | kid board / pack | Kids-safe |
| **Chores / Musts** | `sheet-chores.html` | Real dest |
| **Jar (via kid)** | `sheet-allowance.html` | Never invent $ |
| **Days / Month** | `month.html` | Day grid |

Dead targets forbidden: logo, tagline, Eras label, empty decorative pills, `—°` chrome.

---

## What’s fixed vs DADCLK1 live

| Knob | DADCLK1 live (fail) | DADFIX1 end-state |
|------|---------------------|-------------------|
| Today | Empty / 1 thin card | **≥3 cards** · next + leave + musts (+ home) |
| Ovals | `—°` fake | **Real ° or omit** · never em-dash |
| Ainsley jump | `Ainsley · Eras Stage` | **`Ainsley`** only |
| Density | Wasted blank | Denser stack · void+amber glass |

---

## Atlas ship one-liner

Paste `tokens-dad-fix1-heat.css` on `sheet-dan` — denser Today (next/musts/leave), kill Eras Stage labels, omit unwired ° ovals (never —°) — Dan last-yes before Pages.

## Files

`ATLAS-DROP.md` · `LOOK.md` · `tokens-dad-fix1-heat.css` · `dad-fix1-heat-mock.html` · `render_look.py` · `wardos-dad-fix1-heat.png` · camo
