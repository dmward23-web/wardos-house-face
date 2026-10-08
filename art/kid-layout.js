/* Shared marker layout for the painter and scripts/check-kid-layout.mjs.
   Boxes are CSS pixels. Phone 440×956 at 3× and the 1080×1920 wall
   use the same fractions; labels stay 16px. Advances match Chrome's
   600 16px system-ui so a wrapped line here is the line that is drawn. */
(function (root) {
  "use strict";

  var GAP = 8;
  var ADV = {"0":9.152,"1":9.152,"2":9.152,"3":9.152,"4":9.152,"5":9.152,"6":9.152,"7":9.152,"8":9.152,"9":9.152,"a":9.664,"b":10.128,"c":8.224,"d":10.128,"e":9.456,"f":6.192,"g":10.128,"h":10.512,"i":4.88,"j":4.88,"k":9.92,"l":4.88,"m":15.712,"n":10.512,"o":9.904,"p":10.128,"q":10.128,"r":7.264,"s":7.952,"t":6.944,"u":10.512,"v":9.104,"w":13.696,"x":9.248,"y":9.104,"z":7.808,"A":11.04,"B":10.752,"C":10.192,"D":11.84,"E":8.96,"F":8.784,"G":11.584,"H":12.24,"I":6.224,"J":5.296,"K":10.624,"L":9.04,"M":15.088,"N":13.008,"O":12.736,"P":10.048,"Q":12.736,"R":10.56,"S":8.816,"T":9.264,"U":12.096,"V":10.4,"W":15.472,"X":10.672,"Y":9.984,"Z":9.264,"&":12,"'":4.256,"-":5.152,"·":4.56," ":4.16};
  /* Long side of the keyed sprite is markerPx. w/h is the file aspect. */
  var ITEM = {
    hayes: { w: 578, h: 478 },
    harris: { w: 656, h: 684 },
    ainsley: { w: 387, h: 669 }
  };
  var GROUND = {
    hayes: { portrait: { x: 0.36, y: 0.865 }, landscape: { x: 0.36, y: 0.808 } },
    harris: { portrait: { x: 0.32, y: 0.820 }, landscape: { x: 0.32, y: 0.902 } },
    ainsley: { portrait: { x: 0.30, y: 0.942 }, landscape: { x: 0.48, y: 0.855 } }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function orient(w, h) { return w > h * 1.15 ? "landscape" : "portrait"; }

  function shortLabel(full) {
    var s = String(full || "").replace(/\s+/g, " ").trim();
    s = s.replace(/^(?:\p{Extended_Pictographic}|\uFE0F|\uFE0E|\u200D|\s)+/u, "");
    s = s.replace(/[\uFE0F\uFE0E\u200D]/g, "");
    s = s.replace(/\s*\([^)]*\)/g, "");
    s = s.replace(/\s+/g, " ").trim();
    var head = s.split(/\s+[—–]\s+|\s+-\s+/)[0];
    var bit = head.split(/\s+·\s+/)[0].trim();
    return bit || head || s;
  }

  function textWidth(s, size) {
    var scale = (size || 16) / 16;
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = ADV[s.charAt(i)];
      n += c == null ? 10.5 : c;
    }
    return n * scale;
  }

  function wrap(text, maxW, size) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = "";
    for (var i = 0; i < words.length; i++) {
      var next = cur ? cur + " " + words[i] : words[i];
      if (cur && textWidth(next, size) > maxW) {
        lines.push(cur);
        cur = words[i];
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  function metrics(text, maxW) {
    var size = 16;
    var lines = wrap(text, maxW, size);
    if (lines.length > 2) {
      size = 15;
      lines = wrap(text, maxW, size);
    }
    var tw = 0;
    for (var i = 0; i < lines.length; i++) tw = Math.max(tw, textWidth(lines[i], size));
    return {
      lines: lines,
      size: size,
      tw: tw,
      hw: Math.max(36, tw + 8),
      hh: lines.length * (size + 3) + 4
    };
  }

  function markerPx(W) {
    var cap = Math.max(W, 1) >= 1000 ? 96 : 80;
    return clamp(Math.round(W * 72 / 440), 64, cap);
  }

  function markerDraw(world, ms) {
    var it = ITEM[world] || ITEM.hayes;
    var sc = ms / Math.max(it.w, it.h);
    return { dw: it.w * sc, dh: it.h * sc };
  }

  function creatureAnchor(world, W, H) {
    var book = GROUND[world] || GROUND.hayes;
    var g = book[orient(W, H)] || book.portrait;
    var draw = clamp(Math.round(Math.min(W, H) * 0.318), 140, 226);
    var bodyW = draw * (615 / 1024);
    var bodyH = draw * (616 / 1024);
    var cx = W * g.x;
    var groundY = H * g.y;
    var foot = groundY + draw * 0.108;
    return {
      draw: draw,
      jw: bodyW,
      jh: bodyH,
      jx: cx - bodyW / 2,
      jy: foot - bodyH,
      cx: cx,
      foot: foot,
      groundY: groundY
    };
  }

  function creatureBox(world, W, H) {
    var b = creatureAnchor(world, W, H);
    return { cx: b.cx, cy: b.jy + b.jh / 2, w: b.jw, h: b.jh, x: b.jx, y: b.jy };
  }

  function lanternPoint(i, W, H, t) {
    var u = i / 6;
    var x = W * (0.58 + u * 0.36) + Math.sin((t || 0) * 0.2 + i) * 2;
    var y = H * (0.785 + Math.sin(u * Math.PI * 1.35) * 0.028);
    return { x: x, y: y };
  }

  function sampleQuad(p0, p1, c, n) {
    var out = [];
    for (var k = 0; k <= n; k++) {
      var t = k / n;
      var u = 1 - t;
      out.push({
        x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
        y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
      });
    }
    return out;
  }

  /* Screen-space day path. Fixed, so a parallax shift of a marker still has to clear it. */
  function calendarBoxes(W, H) {
    var pts = [];
    var boxes = [];
    var i;
    for (i = 0; i < 7; i++) pts.push(lanternPoint(i, W, H, 0));
    for (i = 1; i < pts.length; i++) {
      var prev = pts[i - 1];
      var p = pts[i];
      var gy0 = prev.y + 26;
      var gy1 = p.y + 26;
      var c = { x: (prev.x + p.x) / 2, y: Math.max(prev.y, p.y) + 34 };
      var samples = sampleQuad({ x: prev.x, y: gy0 }, { x: p.x, y: gy1 }, c, 8);
      for (var s = 0; s < samples.length; s++) {
        boxes.push({ cx: samples[s].x, cy: samples[s].y, w: 22, h: 22, kind: "path" });
      }
    }
    for (i = 0; i < pts.length; i++) {
      var q = pts[i];
      boxes.push({ cx: q.x, cy: q.y, w: 44, h: 44, kind: "lantern" });
      boxes.push({ cx: q.x, cy: q.y + 36, w: 16, h: 18, kind: "letter" });
    }
    return boxes;
  }

  function itemBoxes(it) {
    var marker = { cx: it.x, cy: it.seat, w: it.dw, h: it.dh, kind: "marker" };
    var label = {
      cx: it.x,
      cy: it.seat + it.dh / 2 + GAP + it.met.hh / 2,
      w: it.met.hw,
      h: it.met.hh,
      kind: "label"
    };
    return [marker, label];
  }

  function overlaps(a, b, gap) {
    return Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + gap &&
      Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + gap;
  }

  function pushApart(aItem, bItem) {
    var A = itemBoxes(aItem);
    var B = itemBoxes(bItem);
    var ai, bi, a, b, ox, oy;
    for (ai = 0; ai < A.length; ai++) {
      for (bi = 0; bi < B.length; bi++) {
        a = A[ai];
        b = B[bi];
        ox = (a.w + b.w) / 2 + GAP - Math.abs(a.cx - b.cx);
        oy = (a.h + b.h) / 2 + GAP - Math.abs(a.cy - b.cy);
        if (ox > 0.5 && oy > 0.5) {
          if (ox < oy) {
            var sx = a.cx <= b.cx ? -1 : 1;
            aItem.x += sx * (ox / 2 + 0.5);
            bItem.x -= sx * (ox / 2 + 0.5);
          } else {
            var sy = aItem.seat <= bItem.seat ? -1 : 1;
            aItem.seat += sy * (oy / 2 + 0.5);
            bItem.seat -= sy * (oy / 2 + 0.5);
          }
          return true;
        }
      }
    }
    return false;
  }

  function clampItem(it, W, H) {
    var half = Math.max(it.dw, it.met.hw) / 2 + 2;
    var lo = half;
    var hi = W - half;
    if (hi < lo) {
      lo = it.dw / 2 + 2;
      hi = W - it.dw / 2 - 2;
    }
    it.x = clamp(it.x, lo, hi);
    var labelDrop = it.dh / 2 + GAP + it.met.hh;
    var seatMin = Math.max(it.dh / 2 + 4, 50 - it.dh / 2 - GAP);
    var seatMax = (H - 64) - labelDrop;
    if (seatMax < seatMin) seatMax = H - labelDrop - 4;
    it.seat = clamp(it.seat, seatMin, seatMax);
  }

  function placeLabels(world, rawLabels, W, H, panX) {
    var plates = root.HousePlates || {};
    var marks = (plates[world] && plates[world].landmarks) || [];
    var n = Math.min(rawLabels.length, marks.length || rawLabels.length);
    var ms = markerPx(W);
    var dim = markerDraw(world, ms);
    var maxW = Math.min(132, W * 0.32);
    var items = [];
    var i;
    for (i = 0; i < n; i++) {
      var ledge = marks[i] || { x: 0.5, y: 0.4, depth: 0.35 };
      var chip = shortLabel(rawLabels[i]);
      var met = metrics(chip, maxW);
      var depth = ledge.depth == null ? 0.35 : ledge.depth;
      items.push({
        i: i,
        chip: chip,
        met: met,
        depth: depth,
        kind: ledge.kind || "",
        ms: ms,
        dw: dim.dw,
        dh: dim.dh,
        maxW: maxW,
        x: ledge.x * W + (panX || 0) * depth,
        seat: ledge.y * H,
        ox: 0,
        oseat: 0
      });
    }
    items.forEach(function (it) { clampItem(it, W, H); it.ox = it.x; it.oseat = it.seat; });
    var cre = creatureBox(world, W, H);
    var pass, moved;
    for (pass = 0; pass < 16; pass++) {
      moved = false;
      for (i = 0; i < items.length; i++) {
        for (var j = i + 1; j < items.length; j++) {
          if (pushApart(items[i], items[j])) moved = true;
        }
        var boxes = itemBoxes(items[i]);
        for (var k = 0; k < boxes.length; k++) {
          var b = boxes[k];
          var ox = (b.w + cre.w) / 2 + GAP - Math.abs(b.cx - cre.cx);
          var oy = (b.h + cre.h) / 2 + GAP - Math.abs(b.cy - cre.cy);
          if (ox > 0.5 && oy > 0.5) {
            if (ox < oy) items[i].x += b.cx < cre.cx ? -(ox + 0.5) : ox + 0.5;
            else items[i].seat += b.cy < cre.cy ? -(oy + 0.5) : oy + 0.5;
            moved = true;
          }
        }
      }
      items.forEach(function (it) { clampItem(it, W, H); });
      if (!moved) break;
    }
    return items;
  }

  function place(quests, W, H, world, panX) {
    var labels = quests.map(function (q) { return q.label; });
    var items = placeLabels(world, labels, W, H, panX || 0);
    items.forEach(function (it) {
      var q = quests[it.i];
      var boxes = itemBoxes(it);
      q.depth = it.depth;
      q.kind = it.kind;
      q.scale = 1;
      q.ms = it.ms;
      q.x = it.x;
      q.seat = it.seat;
      q.chip = it.chip;
      q.maxW = it.maxW;
      q.hw = it.met.hw;
      q.hh = it.met.hh;
      q.r = it.ms * 0.5;
      q.y = boxes[1].cy;
      q.chipY = q.y;
      q.ledY = it.seat;
    });
    return items;
  }

  function boxProblem(a, b, gap) {
    if (!overlaps(a, b, gap)) return "";
    return a.kind + "∩" + b.kind;
  }

  function auditOne(world, labels, W, H, panX, tag) {
    var errors = [];
    var items = placeLabels(world, labels, W, H, panX);
    var where = world + " " + tag + " " + W + "x" + H + " pan " + panX;
    var i, j, k, a, b;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var nudge = Math.max(Math.abs(it.x - it.ox), Math.abs(it.seat - it.oseat));
      if (nudge > 36) errors.push(where + " nudge " + it.chip + " by " + Math.round(nudge));
      var boxes = itemBoxes(it);
      var lb = boxes[1];
      var left = lb.cx - lb.w / 2;
      var right = lb.cx + lb.w / 2;
      var top = lb.cy - lb.h / 2;
      var bot = lb.cy + lb.h / 2;
      if (left < 2 || right > W - 2 || top < 48 || bot > H - 8) {
        errors.push(where + " clipped " + it.chip + " [" + [left, top, right, bot].map(function (n) { return Math.round(n); }).join(",") + "]");
      }
      var mk = boxes[0];
      if (mk.cx - mk.w / 2 < 0 || mk.cx + mk.w / 2 > W || mk.cy - mk.h / 2 < 0 || mk.cy + mk.h / 2 > H) {
        errors.push(where + " marker offscreen " + it.chip);
      }
      if (overlaps(boxes[0], boxes[1], 1)) errors.push(where + " label covers own marker " + it.chip);
      for (j = i + 1; j < items.length; j++) {
        var other = itemBoxes(items[j]);
        for (k = 0; k < boxes.length; k++) {
          for (a = 0; a < other.length; a++) {
            b = boxProblem(boxes[k], other[a], GAP);
            if (b) errors.push(where + " " + it.chip + " " + b + " " + items[j].chip);
          }
        }
      }
      var cre = creatureBox(world, W, H);
      for (k = 0; k < boxes.length; k++) {
        if (overlaps(boxes[k], cre, GAP)) errors.push(where + " " + it.chip + " " + boxes[k].kind + "∩creature");
      }
      var cal = calendarBoxes(W, H);
      for (k = 0; k < boxes.length; k++) {
        for (a = 0; a < cal.length; a++) {
          if (overlaps(boxes[k], cal[a], 4)) {
            errors.push(where + " " + it.chip + " " + boxes[k].kind + "∩" + cal[a].kind);
            break;
          }
        }
      }
    }
    var path = calendarBoxes(W, H);
    var cre2 = creatureBox(world, W, H);
    for (a = 0; a < path.length; a++) {
      var p = path[a];
      if (p.cx - p.w / 2 < 0 || p.cx + p.w / 2 > W || p.cy - p.h / 2 < 0 || p.cy + p.h / 2 > H) {
        errors.push(where + " calendar " + p.kind + " clipped");
        break;
      }
      if (overlaps(p, cre2, 6)) {
        errors.push(where + " calendar " + p.kind + "∩creature");
        break;
      }
    }
    return errors;
  }

  function audit(labelsByWorld) {
    var views = [
      { id: "phone", w: 440, h: 956 },
      { id: "wall", w: 1080, h: 1920 }
    ];
    var pans = [-26, 0, 26];
    var worlds = ["hayes", "harris", "ainsley"];
    var errors = [];
    worlds.forEach(function (world) {
      var labels = labelsByWorld[world] || [];
      views.forEach(function (v) {
        pans.forEach(function (pan) {
          errors = errors.concat(auditOne(world, labels, v.w, v.h, pan, v.id));
        });
      });
    });
    return errors;
  }

  var api = {
    shortLabel: shortLabel,
    textWidth: textWidth,
    metrics: metrics,
    markerPx: markerPx,
    markerDraw: markerDraw,
    creatureAnchor: creatureAnchor,
    lanternPoint: lanternPoint,
    calendarBoxes: calendarBoxes,
    placeLabels: placeLabels,
    place: place,
    audit: audit,
    GAP: GAP
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KidLayout = api;
})(typeof window !== "undefined" ? window : globalThis);
