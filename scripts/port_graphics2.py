#!/usr/bin/env python3
"""GRAPHICS2 live port · forged icons into House Face Pages. No content invent. Protect sensi/nest."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path("/workspace/wardos-house-face")
SPRITE_RAW = (ROOT / "icons-g2.svg").read_text()
SPRITE_INJECT = SPRITE_RAW.replace(
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">',
    '<svg xmlns="http://www.w3.org/2000/svg" class="g2-sprite" aria-hidden="true" focusable="false">',
    1,
)

CSS_LINK = '<link rel="stylesheet" href="icons-g2.css?v=GRAPHICS2" />\n'
CACHE_BUMP = "GRAPHICS2"

def ico(sym: str, cls: str = "g2") -> str:
    return f'<svg class="{cls}" viewBox="0 0 32 32" aria-hidden="true"><use href="#{sym}"/></svg>'

def mark(sym: str, extra: str = "avatar") -> str:
    return f'<div class="{extra} g2-mark" aria-hidden="true">{ico(sym)}</div>'

def av(sym: str, who: str, extra: str = "avatar") -> str:
    return f'<div class="{extra} g2-av {who}" aria-hidden="true">{ico(sym)}</div>'

def ensure_assets(html: str) -> str:
    if "icons-g2.css" not in html:
        # after heat-v3 if present, else before </head>
        if "heat-v3.css" in html:
            html = re.sub(
                r'(<link rel="stylesheet" href="heat-v3\.css[^"]*"\s*/?>)',
                r"\1\n" + CSS_LINK.rstrip(),
                html,
                count=1,
            )
        else:
            html = html.replace("</head>", CSS_LINK + "</head>", 1)
    if 'class="g2-sprite"' not in html:
        html = re.sub(r"<body([^>]*)>", r"<body\1>\n" + SPRITE_INJECT + "\n", html, count=1)
    return html

def patch_index_hub(html: str) -> str:
    html = ensure_assets(html)
    reps = [
        ('<div class="tile-icon" aria-hidden="true">☀</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-today")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">▦</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-week")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">▣</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-month")}</div>', True),  # first = month; groceries also ▣
        ('<div class="tile-icon av" aria-hidden="true">H</div>',
         f'<div class="tile-icon av g2-av hayes" aria-hidden="true">{ico("g2-hayes")}</div>', True),
        ('<div class="tile-icon av" aria-hidden="true">A</div>',
         f'<div class="tile-icon av g2-av ains" aria-hidden="true">{ico("g2-ainsley")}</div>'),
        ('<div class="tile-icon av" aria-hidden="true">H</div>',
         f'<div class="tile-icon av g2-av harr" aria-hidden="true">{ico("g2-harris")}</div>', True),
        ('<div class="tile-icon av" aria-hidden="true">D</div>',
         f'<div class="tile-icon av g2-av dad" aria-hidden="true">{ico("g2-dad")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">✓</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-chores")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">▣</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-groceries")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">★</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-jar")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">◈</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-diamond")}</div>'),
        ('<div class="tile-icon" aria-hidden="true">✈</div>',
         f'<div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-plane")}</div>'),
    ]
    # Order-sensitive: do sequential unique replaces
    # Month ▣ before groceries ▣ — replace by context
    html = html.replace(
        '<a class="tile today" href="sheet-today.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">☀</div>',
        f'<a class="tile today" href="sheet-today.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-today")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile week" href="index.html?v=WEEKFIX1">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">▦</div>',
        f'<a class="tile week" href="index.html?v=WEEKFIX1">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-week")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile month" href="month.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">▣</div>',
        f'<a class="tile month" href="month.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-month")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile hayes" href="kid-hayes.html">\n <div class="tile-top">\n <div class="tile-icon av" aria-hidden="true">H</div>',
        f'<a class="tile hayes" href="kid-hayes.html">\n <div class="tile-top">\n <div class="tile-icon av g2-av hayes" aria-hidden="true">{ico("g2-hayes")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile ainsley" href="kid-ainsley.html">\n <div class="tile-top">\n <div class="tile-icon av" aria-hidden="true">A</div>',
        f'<a class="tile ainsley" href="kid-ainsley.html">\n <div class="tile-top">\n <div class="tile-icon av g2-av ains" aria-hidden="true">{ico("g2-ainsley")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile harris" href="kid-harris.html">\n <div class="tile-top">\n <div class="tile-icon av" aria-hidden="true">H</div>',
        f'<a class="tile harris" href="kid-harris.html">\n <div class="tile-top">\n <div class="tile-icon av g2-av harr" aria-hidden="true">{ico("g2-harris")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile dan" href="sheet-dan.html">\n <div class="tile-top">\n <div class="tile-icon av" aria-hidden="true">D</div>',
        f'<a class="tile dan" href="sheet-dan.html">\n <div class="tile-top">\n <div class="tile-icon av g2-av dad" aria-hidden="true">{ico("g2-dad")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile chores" href="sheet-chores.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">✓</div>',
        f'<a class="tile chores" href="sheet-chores.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-chores")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile groceries" href="sheet-groceries.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">▣</div>',
        f'<a class="tile groceries" href="sheet-groceries.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-groceries")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile stars" href="sheet-allowance.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">★</div>',
        f'<a class="tile stars" href="sheet-allowance.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-jar")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile fun" href="sheet-weekend.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">◈</div>',
        f'<a class="tile fun" href="sheet-weekend.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-diamond")}</div>',
        1,
    )
    html = html.replace(
        '<a class="tile win" href="sheet-win.html">\n <div class="tile-top">\n <div class="tile-icon" aria-hidden="true">✈</div>',
        f'<a class="tile win" href="sheet-win.html">\n <div class="tile-top">\n <div class="tile-icon g2-mark" aria-hidden="true">{ico("g2-plane")}</div>',
        1,
    )
    return html

def patch_today(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace(
        '<div class="avatar" aria-hidden="true">☀</div>',
        mark("g2-today"),
        1,
    )
    html = html.replace(
        '<span class="spark">★</span>',
        f'<span class="spark g2-spark">{ico("g2-star")}</span>',
        1,
    )
    html = html.replace(
        '<div class="qtile-icon" aria-hidden="true">✓</div>',
        f'<div class="qtile-icon g2-ti" aria-hidden="true">{ico("g2-chores")}</div>',
        1,
    )
    html = html.replace(
        '<div class="qtile-icon" aria-hidden="true">🎒</div>',
        f'<div class="qtile-icon g2-ti" aria-hidden="true">{ico("g2-pack")}</div>',
        1,
    )
    # Load day keeps LD text — no forged LD glyph in sprite; leave as-is
    return html

def patch_week(html: str) -> str:
    html = ensure_assets(html)
    # inject hdr mark after brand / before eyebrow in template
    if "g2-week" not in html and "g2-hdr-mark" not in html:
        html = html.replace(
            '<div class="hdr-left">\n <div class="brand"><img src="wardos-mark-header.png" alt="WardOS" height="48" /></div>',
            '<div class="hdr-left">\n <div class="g2-hdr-mark" aria-hidden="true">' + ico("g2-week") + '</div>\n <div class="brand"><img src="wardos-mark-header.png" alt="WardOS" height="48" /></div>',
            1,
        )
    # forge first sun wx ico only
    html = html.replace(
        '<span class="wx-ico">☀</span>',
        f'<span class="wx-ico g2-wx">{ico("g2-weather")}</span>',
        1,
    )
    return html

def patch_month(html: str) -> str:
    html = ensure_assets(html)
    if "g2-month" not in html:
        html = html.replace(
            '<div class="hdr-left">\n <div class="nav-row">',
            '<div class="hdr-left">\n <div class="g2-hdr-mark" aria-hidden="true">' + ico("g2-month") + '</div>\n <div class="nav-row">',
            1,
        )
    return html

def patch_hayes(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace('<div class="avatar">H</div>', av("g2-hayes", "hayes"), 1)
    return html

def patch_ainsley(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace('<div class="avatar">A</div>', av("g2-ainsley", "ains"), 1)
    return html

def patch_harris(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace('<div class="avatar">H</div>', av("g2-harris", "harr"), 1)
    return html

def patch_dad(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace('<div class="avatar">D</div>', av("g2-dad", "dad"), 1)
    # kid link dots
    html = html.replace(
        '<a class="kid-link harris" href="kid-harris.html"><span class="dot">H</span>',
        f'<a class="kid-link harris" href="kid-harris.html"><span class="dot g2-av harr">{ico("g2-harris")}</span>',
        1,
    )
    html = html.replace(
        '<a class="kid-link hayes" href="kid-hayes.html"><span class="dot">H</span>',
        f'<a class="kid-link hayes" href="kid-hayes.html"><span class="dot g2-av hayes">{ico("g2-hayes")}</span>',
        1,
    )
    html = html.replace(
        '<a class="kid-link ainsley" href="kid-ainsley.html"><span class="dot">A</span>',
        f'<a class="kid-link ainsley" href="kid-ainsley.html"><span class="dot g2-av ains">{ico("g2-ainsley")}</span>',
        1,
    )
    return html

def patch_chores(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace(
        '<div class="avatar" aria-hidden="true">✓</div>',
        mark("g2-chores"),
        1,
    )
    html = html.replace(
        '<span class="spark">★</span>',
        f'<span class="spark g2-spark">{ico("g2-star")}</span>',
        1,
    )
    html = html.replace(
        '<span class="star">★</span>',
        f'<span class="star g2-inline">{ico("g2-star")}</span>',
    )
    html = html.replace(
        'Tap musts · <span class="hl">★ into the jar</span>',
        f'Tap musts · <span class="hl"><span class="g2-inline">{ico("g2-star")}</span> into the jar</span>',
        1,
    )
    return html

def patch_groceries(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace(
        '<div class="avatar" aria-hidden="true">🛒</div>',
        mark("g2-groceries"),
        1,
    )
    html = html.replace(
        '<span class="spark">★</span>',
        f'<span class="spark g2-spark">{ico("g2-star")}</span>',
        1,
    )
    return html

def patch_allowance(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace(
        '<div class="avatar" aria-hidden="true">★</div>',
        mark("g2-jar"),
        1,
    )
    html = html.replace(
        '<span class="spark">★</span>',
        f'<span class="spark g2-spark">{ico("g2-star")}</span>',
        1,
    )
    # kid chip dots
    html = html.replace(
        '<a class="kid-chip ainsley" href="kid-ainsley.html"><span class="dot">A</span>',
        f'<a class="kid-chip ainsley" href="kid-ainsley.html"><span class="dot g2-av ains">{ico("g2-ainsley")}</span>',
        1,
    )
    html = html.replace(
        '<a class="kid-chip hayes" href="kid-hayes.html"><span class="dot">H</span>',
        f'<a class="kid-chip hayes" href="kid-hayes.html"><span class="dot g2-av hayes">{ico("g2-hayes")}</span>',
        1,
    )
    html = html.replace(
        '<a class="kid-chip harris" href="kid-harris.html"><span class="dot">H</span>',
        f'<a class="kid-chip harris" href="kid-harris.html"><span class="dot g2-av harr">{ico("g2-harris")}</span>',
        1,
    )
    # bank lead glyphs (not tap-stars)
    html = html.replace(
        '<div class="star-big"><span class="s">★</span>0</div>',
        f'<div class="star-big"><span class="s g2-inline">{ico("g2-tour")}</span>0</div>',
        1,
    )
    html = html.replace(
        '<div class="star-big"><span class="s">◎</span>0</div>',
        f'<div class="star-big"><span class="s g2-inline">{ico("g2-victory")}</span>0</div>',
        1,
    )
    html = html.replace(
        '<div class="star-big"><span class="s">◆</span>0</div>',
        f'<div class="star-big"><span class="s g2-inline">{ico("g2-gem")}</span>0</div>',
        1,
    )
    grow = (
        '\n <div class="g2-grow-row" aria-label="Grow accents">'
        f'<div class="g2-grow-chip">{ico("g2-tour")}<span>TOUR</span></div>'
        f'<div class="g2-grow-chip">{ico("g2-victory")}<span>VICTORY</span></div>'
        f'<div class="g2-grow-chip">{ico("g2-gem")}<span>GEM</span></div>'
        "</div>\n"
    )
    if "g2-grow-row" not in html:
        # insert before footer if present, else before closing body panel
        if '<footer' in html:
            html = html.replace("<footer", grow + "<footer", 1)
        elif 'class="ftr"' in html:
            html = re.sub(r'(<footer[^>]*>|<div class="ftr")', grow + r"\1", html, count=1)
        else:
            html = html.replace("</div>\n<script", grow + "</div>\n<script", 1)
    return html

def patch_weekend(html: str) -> str:
    html = ensure_assets(html)
    # avatar may have inline style
    html = re.sub(
        r'<div class="avatar" aria-hidden="true"[^>]*>🎯</div>',
        mark("g2-diamond"),
        html,
        count=1,
    )
    html = html.replace(
        '<span class="spark">★</span>',
        f'<span class="spark g2-spark">{ico("g2-star")}</span>',
        1,
    )
    html = html.replace(
        '<div class="emoji">◈</div>',
        f'<div class="emoji g2-mark">{ico("g2-diamond")}</div>',
        1,
    )
    return html

def patch_trips(html: str) -> str:
    html = ensure_assets(html)
    html = html.replace(
        '<div class="avatar" aria-hidden="true">✈</div>',
        mark("g2-plane"),
        1,
    )
    return html

def patch_kids_data(js: str) -> str:
    if "function g2Ico(" in js:
        return js  # already patched
    helper = r'''
  /* GRAPHICS2 · forged SVG marks (sprite must be inlined on kid boards) */
  function g2Ico(sym) {
    return '<svg class="g2" viewBox="0 0 32 32" aria-hidden="true"><use href="#' + sym + '"/></svg>';
  }
'''
    # inject helper just before CONSUME_META
    js = js.replace(
        "  /* CONSUME1 · schedule consume layout (week strip · NEXT UP · HQ · routine · ahead) */",
        helper + "  /* CONSUME1 · schedule consume layout (week strip · NEXT UP · HQ · routine · ahead) */",
        1,
    )
    # monogram marks + home punch SVGs
    js = js.replace(
        'hayes: { world: "Victory world", loadout: "Victory loadout", mark: "◎", hqTitle: "DROP ZONE HQ with Dad", hqIco: "🏠" },',
        'hayes: { world: "Victory world", loadout: "Victory loadout", markSym: "g2-hayes", hqTitle: "DROP ZONE HQ with Dad", hqSym: "g2-home" },',
        1,
    )
    js = js.replace(
        'harris: { world: "Gem world", loadout: "Gem loadout", mark: "◆", hqTitle: "YOUR BASE with Dad", hqIco: "🏡" },',
        'harris: { world: "Gem world", loadout: "Gem loadout", markSym: "g2-harris", hqTitle: "YOUR BASE with Dad", hqSym: "g2-home" },',
        1,
    )
    js = js.replace(
        'ainsley: { world: "Tour world", loadout: "Tour loadout", mark: "◆", hqTitle: "Base with Dad", hqIco: "🏠" }',
        'ainsley: { world: "Tour world", loadout: "Tour loadout", markSym: "g2-ainsley", hqTitle: "Base with Dad", hqSym: "g2-home" }',
        1,
    )
    # consume-mark render
    js = js.replace(
        "'<div class=\"consume-mark\">' + esc(meta.mark) + \"</div>\" +",
        "'<div class=\"consume-mark g2-mark\">' + g2Ico(meta.markSym || \"g2-next\") + \"</div>\" +",
        1,
    )
    # event icons → forged for baseball/swim/flag; others stay emoji (no invent new symbols)
    old_icon = '''  function consumeEventIcon(what) {
    var w = String(what || "").toLowerCase();
    if (/baseball|ball/.test(w)) return "⚾";
    if (/flag/.test(w)) return "🏈";
    if (/swim/.test(w)) return "🏊";
    if (/hearing|vision|screening/.test(w)) return "👁️";
    if (/field\\s*trip|museum/.test(w)) return "🚌";
    if (/\\bpe\\b|tennis/.test(w)) return "👟";
    if (/collab|madi|randy/.test(w)) return "👥";
    if (/anxiety|midwest|doctor|appt/.test(w)) return "🩺";
    if (/homework|yearbook|school|lkms|sre/.test(w)) return "📚";
    return "◆";
  }'''
    new_icon = '''  function consumeEventIcon(what) {
    var w = String(what || "").toLowerCase();
    if (/baseball|ball/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-baseball") + "</span>", text: "" };
    if (/flag/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-flag") + "</span>", text: "" };
    if (/swim/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-swim") + "</span>", text: "" };
    if (/hearing|vision|screening/.test(w)) return { html: "", text: "👁️" };
    if (/field\\s*trip|museum/.test(w)) return { html: "", text: "🚌" };
    if (/\\bpe\\b|tennis/.test(w)) return { html: "", text: "👟" };
    if (/collab|madi|randy/.test(w)) return { html: "", text: "👥" };
    if (/anxiety|midwest|doctor|appt/.test(w)) return { html: "", text: "🩺" };
    if (/homework|yearbook|school|lkms|sre/.test(w)) return { html: "", text: "📚" };
    return { html: '<span class="g2-lead">' + g2Ico("g2-next") + "</span>", text: "" };
  }'''
    if old_icon not in js:
        raise SystemExit("consumeEventIcon block not found exactly — abort")
    js = js.replace(old_icon, new_icon, 1)
    # hero title composition
    js = js.replace(
        "        var ico = consumeEventIcon(title);\n"
        "        nextMount.className = \"consume-hero\";\n"
        "        nextMount.innerHTML =\n"
        "          '<div class=\"consume-hero-inner\">' +\n"
        "          '<div class=\"consume-hero-top\">' +\n"
        "          '<div class=\"consume-hero-when\">' + esc(next.whenLabel || \"NEXT\") + \"</div>\" +\n"
        "          '<div class=\"consume-countdown\"><span class=\"pulse\"></span><span>' + esc(cd) + \"</span></div>\" +\n"
        "          \"</div>\" +\n"
        "          '<div class=\"consume-hero-title\">' + esc(ico + \" \" + title) + \"</div>\" +",
        "        var ico = consumeEventIcon(title);\n"
        "        nextMount.className = \"consume-hero\";\n"
        "        nextMount.innerHTML =\n"
        "          '<div class=\"consume-hero-inner\">' +\n"
        "          '<div class=\"consume-hero-top\">' +\n"
        "          '<div class=\"consume-hero-when\">' + esc(next.whenLabel || \"NEXT\") + \"</div>\" +\n"
        "          '<div class=\"consume-countdown\"><span class=\"pulse\"></span><span>' + esc(cd) + \"</span></div>\" +\n"
        "          \"</div>\" +\n"
        "          '<div class=\"consume-hero-title\">' + (ico.html || \"\") + esc(((ico.text ? ico.text + \" \" : \"\") + title)) + \"</div>\" +",
        1,
    )
    # punch ico
    js = js.replace(
        "'<div class=\"consume-punch-ico\">' + meta.hqIco + \"</div>\" +",
        "'<div class=\"consume-punch-ico g2-mark\">' + g2Ico(meta.hqSym || \"g2-home\") + \"</div>\" +",
        1,
    )
    # routine ico (two occurrences)
    js = js.replace(
        "'<span class=\"consume-routine-ico\">🔁</span>' +",
        "'<span class=\"consume-routine-ico g2-inline\">' + g2Ico(\"g2-routine\") + \"</span>\" +",
    )
    return js

BOARDS = [
    ("sheet-index.html", patch_index_hub),
    ("sheet-today.html", patch_today),
    ("index.html", patch_week),
    ("month.html", patch_month),
    ("kid-hayes.html", patch_hayes),
    ("kid-ainsley.html", patch_ainsley),
    ("kid-harris.html", patch_harris),
    ("sheet-dan.html", patch_dad),
    ("sheet-chores.html", patch_chores),
    ("sheet-groceries.html", patch_groceries),
    ("sheet-allowance.html", patch_allowance),
    ("sheet-weekend.html", patch_weekend),
    ("sheet-win.html", patch_trips),
]

def main():
    for name, fn in BOARDS:
        path = ROOT / name
        before = path.read_text()
        after = fn(before)
        path.write_text(after)
        print(f"OK {name}  g2-uses={after.count('href=\"#g2-')}  delta={len(after)-len(before)}")
    kd = ROOT / "kids-data.js"
    before = kd.read_text()
    after = patch_kids_data(before)
    kd.write_text(after)
    print(f"OK kids-data.js  g2Ico={'g2Ico' in after}  delta={len(after)-len(before)}")
    # hard protect
    for locked in ("data/sensi-live.json", "data/nest-live.json"):
        assert (ROOT / locked).exists()
    print("LOCKED sensi+nest present (untouched by this script)")

if __name__ == "__main__":
    main()
