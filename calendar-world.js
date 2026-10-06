/* calendar-world.js · Calendar World inside each kid board.
   C1 is the path itself (lanterns, walker, fog, now-line, time ring, briefing).
   C2–C9 open painted sub-scenes. Idea numbers follow Dan's phase list.
   Where the Atlas chat text is not in the repo, the scene is named for the
   phase job (seasons, agency, rites, the rest) and tagged with its number.
   No scores, money, shame, or red marks. Mom weeks: look, don't keep. */
(function (global) {
  "use strict";

  function kid() { return (document.body && document.body.getAttribute("data-kid")) || "hayes"; }
  function data() { return (global.WardKids && WardKids._data) || null; }
  function asleep() { return global.JarEngine ? JarEngine.asleepWeek(data()) : false; }
  function age() { return kid() === "harris" ? "small" : kid() === "ainsley" ? "teen" : "mid"; }
  function say(small, mid, teen) { return age() === "small" ? small : age() === "teen" ? teen : mid; }
  function reduced() { return global.KidWorld && KidWorld.reduced && KidWorld.reduced(); }

  function chicagoParts() {
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return p;
    } catch (e) { return { hour: "12", minute: "00", weekday: "" }; }
  }

  function dayDiff(a, b) {
    if (!a || !b) return 0;
    var pa = a.split("-"), pb = b.split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    var db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }

  function sleeps(n) {
    if (n <= 0) return say("today", "today", "today");
    if (n === 1) return say("1 sleep", "1 sleep", "tomorrow");
    return say(n + " sleeps", n + " sleeps", n + " nights");
  }

  function canKeep() { return !asleep(); }
  function keep(key, val) {
    if (!canKeep()) return false;
    try { localStorage.setItem("cw:" + kid() + ":" + key, String(val)); } catch (e) {}
    return true;
  }
  function kept(key) {
    try { return localStorage.getItem("cw:" + kid() + ":" + key) || ""; } catch (e) { return ""; }
  }

  function open(opts) {
    if (global.KidWorld && KidWorld.openScene) KidWorld.openScene(opts);
  }

  function nextText() {
    var el = document.querySelector("[data-mount-consume-next]");
    if (!el) return { title: "Nothing timed", when: "" };
    var title = el.querySelector(".consume-hero-title");
    var when = el.querySelector(".consume-hero-when");
    return {
      title: title ? title.textContent.trim() : "Quiet",
      when: when ? when.textContent.trim() : ""
    };
  }

  function routineText() {
    var el = document.querySelector("[data-mount-consume-routine]");
    if (!el || el.hidden) return "";
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function specialLine() {
    var d = data();
    var k = kid();
    if (!d || !d.kids || !d.kids[k]) return "";
    var rows = d.kids[k].school || [];
    for (var i = 0; i < rows.length; i++) {
      if (/special|art|music|spanish|pe/i.test(rows[i].what || "")) return rows[i].what;
    }
    return "";
  }

  /* ---------- C1 path ---------- */
  function paintPath(root) {
    var days = document.querySelectorAll("[data-consume-day]");
    var today = global.WardKids && WardKids.DAY_ISO;
    var path = root.querySelector("[data-cw-path]");
    if (!path) return;
    path.innerHTML = "";
    var nowIdx = 0;
    days.forEach(function (btn, i) {
      var iso = btn.getAttribute("data-consume-day");
      var diff = dayDiff(today, iso);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-lantern" + (diff < 0 ? " is-past" : diff > 0 ? " is-fog" : " is-now");
      b.style.setProperty("--orb", kid() === "ainsley" ? "#e7b089" : kid() === "harris" ? "#8ee7a0" : "#8fd8ff");
      var wd = btn.querySelector(".wd");
      var dn = btn.querySelector(".dn");
      b.innerHTML = '<span class="cw-orb"></span><small>' + (wd ? wd.textContent : "") + '</small><small>' + (diff > 0 ? sleeps(diff) : (dn ? dn.textContent : "")) + "</small>";
      b.addEventListener("click", function () {
        btn.click();
        openDay(iso, diff, b);
      });
      path.appendChild(b);
      if (diff === 0) nowIdx = i;
    });
    if (!days.length) {
      path.innerHTML = "<p>The week is still settling.</p>";
      return;
    }
    var line = document.createElement("i");
    line.className = "cw-now";
    line.style.left = ((nowIdx + 0.5) / days.length * 100) + "%";
    path.appendChild(line);
    var cre = document.createElement("i");
    cre.className = "cw-creature";
    cre.style.left = "calc(" + ((nowIdx + 0.5) / days.length * 100) + "% - 9px)";
    path.appendChild(cre);
    /* walker eases toward the next lit day */
    if (!reduced()) {
      setTimeout(function () {
        var nxt = Math.min(days.length - 1, nowIdx + 1);
        cre.style.left = "calc(" + ((nxt + 0.5) / days.length * 100) + "% - 9px)";
      }, 600);
    }
  }

  function openDay(iso, diff, from) {
    var fog = diff > 0;
    open({
      from: from,
      kicker: fog ? "ahead, still soft" : diff < 0 ? "already faded" : "today",
      title: sleeps(Math.max(0, diff)),
      html: fog ? "<p>Tomorrow stays misty until it is close. Nothing jumps out.</p>" : "<p>This day is on the path.</p>",
      paint: global.KidWorld && KidWorld.vignette("woods")
    });
  }

  function paintBrief(root) {
    var n = nextText();
    var sp = specialLine();
    var rt = routineText();
    var hour = parseInt(chicagoParts().hour, 10);
    var hello = hour < 11 ? say("Good morning", "Morning", "Morning") : hour < 17 ? say("Good day", "Today", "This afternoon") : say("Quiet evening", "Evening", "Evening");
    var line = hello + ". " + (n.title && n.title !== "Nothing timed next" ? n.title : "The path is open.");
    if (sp && age() !== "small") line += " " + sp + ".";
    if (asleep()) line = say("The woods are sleeping.", "The woods are resting this week.", "The woods are resting. Nothing new is kept.");
    else {
      var hw = data() && data().homeWeek;
      var end = hw && hw.endIso ? new Date(hw.endIso).getTime() : 0;
      if (end && end - Date.now() < 2 * 86400000 && end > Date.now()) {
        line += " " + say("The week turns soon.", "The week turns softly.", "The week turns soon. No rush.");
      }
    }
    var el = root.querySelector("[data-cw-brief]");
    if (el) el.textContent = line;
    var sub = root.querySelector("[data-cw-next-copy]");
    if (sub) sub.textContent = (n.when ? n.when + " · " : "") + (n.title || "");
    paintRing(root, n);
    var wisp = root.querySelector("[data-cw-wisp]");
    if (wisp) {
      wisp.hidden = !rt;
      wisp.textContent = rt ? say("Leave-light", "Leave-by light", rt) : "";
    }
  }

  function paintRing(root, next) {
    var c = root.querySelector("[data-cw-ring]");
    if (!c) return;
    var ctx = c.getContext("2d");
    var w = c.width = 168, h = c.height = 168;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(84, 84, 60, 0, 7); ctx.stroke();
    var parts = chicagoParts();
    var mins = (parseInt(parts.hour, 10) || 0) * 60 + (parseInt(parts.minute, 10) || 0);
    var frac = mins / (24 * 60);
    ctx.strokeStyle = kid() === "ainsley" ? "#f0c2a0" : kid() === "harris" ? "#b6f5c4" : "#9ee7ff";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(84, 84, 60, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.font = "700 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var label = say("now", "now", (parts.hour || "") + ":" + (parts.minute || ""));
    ctx.fillText(label, 84, 84);
    /* gentle pulse when something is close: we don't parse every clock, the ring just breathes via CSS if a when exists */
    var orb = root.querySelector("[data-cw-next]");
    if (orb) orb.classList.toggle("is-soon", /min|soon|now/i.test(next.when || ""));
  }

  /* ---------- phase scenes ---------- */
  var PHASES = [
    { id: "c2", phase: "C2", title: say("Pack", "Get ready", "Prep"), ideas: [
      { n: 11, title: "Pack the bag", kind: "pack" },
      { n: 14, title: "Scout the week", kind: "scout" },
      { n: 18, title: "Prep lights", kind: "prep" },
      { n: 19, title: "Carry the gear", kind: "carry" },
      { n: 107, title: "Work backward", kind: "backplan" },
      { n: 108, title: "Break it up", kind: "chunk" }
    ]},
    { id: "c3", phase: "C3", title: say("Two homes", "Two homes", "Two shores"), ideas: [
      { n: 5, title: "Two shores", kind: "shores" },
      { n: 59, title: "Lighthouse", kind: "shores" },
      { n: 60, title: "Cross the bridge", kind: "bridge" },
      { n: 61, title: "What travels", kind: "travel" },
      { n: 62, title: "Welcome glow", kind: "welcome" },
      { n: 99, title: "Forest sleeps", kind: "sleep" },
      { n: 115, title: "Both are good", kind: "both" },
      { n: 66, title: "Compass", kind: "compass" },
      { n: 23, title: "A lantern here", kind: "lantern" },
      { n: 116, title: "Goodnight, from far", kind: "stub-voice" },
      { n: 118, title: "Steady stones", kind: "anchors" }
    ]},
    { id: "c4", phase: "C4", title: say("Calm", "Calm", "Steady"), ideas: [
      { n: 51, title: "Worry stone", kind: "stone" },
      { n: 52, title: "Feeling weather", kind: "weather" },
      { n: 53, title: "Brave light", kind: "brave" },
      { n: 54, title: "Before and after", kind: "before" },
      { n: 55, title: "A breath", kind: "breath" },
      { n: 56, title: "The glade", kind: "glade" },
      { n: 117, title: "Sit in the glade", kind: "glade" },
      { n: 139, title: "Wind, then still", kind: "wind" },
      { n: 140, title: "Calm on cue", kind: "breath" },
      { n: 141, title: "Quiet hours", kind: "quiet" },
      { n: 142, title: "Rest", kind: "rest" },
      { n: 49, title: "Rest is allowed", kind: "rest" }
    ]},
    { id: "c5", phase: "C5", title: say("Stories", "Stories", "Journal"), ideas: [
      { n: 34, title: "A crystal", kind: "crystal" },
      { n: 74, title: "This week's chapter", kind: "chapter" },
      { n: 75, title: "The year book", kind: "year" },
      { n: 77, title: "Journal", kind: "journal" },
      { n: 113, title: "It remembers", kind: "journal" },
      { n: 126, title: "Your words", kind: "journal" },
      { n: 127, title: "A bright moment", kind: "hero" },
      { n: 129, title: "Friday light", kind: "friday" },
      { n: 130, title: "Sunday seed", kind: "seed" },
      { n: 132, title: "This month", kind: "month" }
    ]},
    { id: "c6", phase: "C6", title: say("Seasons", "Seasons", "Senses"), ideas: [
      { n: 7, title: "The season veil", kind: "season" },
      { n: 9, title: "Sky right now", kind: "sky" },
      { n: 10, title: "Light by the hour", kind: "sky" },
      { n: 48, title: "Up close", kind: "texture" },
      { n: 67, title: "Morning light", kind: "sky" },
      { n: 68, title: "Evening light", kind: "sky" },
      { n: 69, title: "Rain", kind: "rain" },
      { n: 70, title: "Wind", kind: "wind" },
      { n: 72, title: "A warm window", kind: "lantern" },
      { n: 73, title: "Cool air", kind: "breath" },
      { n: 81, title: "Small wings", kind: "motes" },
      { n: 82, title: "The lake", kind: "lake" },
      { n: 85, title: "Leaves", kind: "season" }
    ]},
    { id: "c7", phase: "C7", title: say("Choose", "Choose", "Agency"), ideas: [
      { n: 12, title: "Pick a path", kind: "pick" },
      { n: 13, title: "A note for Dad", kind: "note" },
      { n: 17, title: "Guide the light", kind: "guide" },
      { n: 21, title: "Who is here", kind: "table" },
      { n: 22, title: "Offer a hand", kind: "hand" },
      { n: 25, title: "Your pace", kind: "pace" },
      { n: 27, title: "Siblings", kind: "siblings" },
      { n: 28, title: "Alone a while", kind: "glade" },
      { n: 44, title: "More or less", kind: "density" },
      { n: 45, title: "Pictures first", kind: "density" },
      { n: 47, title: "A wish", kind: "note" },
      { n: 57, title: "The weekly rhythm", kind: "anchors" },
      { n: 64, title: "Something extra", kind: "extra" },
      { n: 65, title: "Pass the light", kind: "pass" },
      { n: 112, title: "A kept moment", kind: "hero" },
      { n: 134, title: "Dinner light", kind: "lantern" },
      { n: 135, title: "The ride", kind: "carry" },
      { n: 136, title: "The porch", kind: "lantern" },
      { n: 137, title: "A story", kind: "chapter" },
      { n: 138, title: "Goodnight window", kind: "quiet" }
    ]},
    { id: "c8", phase: "C8", title: say("Far away", "Far lights", "Horizon"), ideas: [
      { n: 35, title: "A far birthday light", kind: "far" },
      { n: 46, title: "The turn of the season", kind: "season" },
      { n: 92, title: "No far trip, or one", kind: "trip" },
      { n: 93, title: "A long road", kind: "trip" },
      { n: 94, title: "Coming home", kind: "welcome" },
      { n: 95, title: "A year out", kind: "far" },
      { n: 96, title: "School year", kind: "far" },
      { n: 97, title: "Someday", kind: "far" },
      { n: 100, title: "Far lighthouse", kind: "shores" },
      { n: 119, title: "First day back", kind: "welcome" },
      { n: 120, title: "A last day", kind: "far" },
      { n: 121, title: "Solstice", kind: "astro" },
      { n: 122, title: "Equinox", kind: "astro" },
      { n: 123, title: "New moon", kind: "astro" },
      { n: 124, title: "Full moon", kind: "astro" },
      { n: 125, title: "Friday light", kind: "friday" },
      { n: 128, title: "Place a marker", kind: "marker" },
      { n: 133, title: "Growing", kind: "grow" },
      { n: 147, title: "This month", kind: "month" },
      { n: 148, title: "This season", kind: "season" },
      { n: 149, title: "This school year", kind: "far" },
      { n: 150, title: "Someday", kind: "far" }
    ]},
    { id: "c9", phase: "C9", title: say("More woods", "More woods", "The rest"), ideas: [
      { n: 6, title: "Yesterday's echo", kind: "echo" },
      { n: 8, title: "A leaving bell", kind: "wisp" },
      { n: 24, title: "A question", kind: "note" },
      { n: 26, title: "A soft no", kind: "rest" },
      { n: 29, title: "See", kind: "sense" },
      { n: 30, title: "Hear", kind: "sense" },
      { n: 31, title: "Touch", kind: "stone" },
      { n: 32, title: "Smell", kind: "sense" },
      { n: 33, title: "Taste", kind: "sense" },
      { n: 36, title: "Week map", kind: "scout" },
      { n: 37, title: "Night sky", kind: "astro" },
      { n: 38, title: "Sunrise", kind: "sky" },
      { n: 39, title: "Kitchen light", kind: "lantern" },
      { n: 40, title: "Porch", kind: "lantern" },
      { n: 50, title: "Soft landing", kind: "glade" },
      { n: 63, title: "Two times", kind: "twoclock" },
      { n: 71, title: "Weather on the trees", kind: "season" },
      { n: 76, title: "Strings, no words", kind: "strings" },
      { n: 78, title: "A drawing", kind: "draw" },
      { n: 79, title: "A color", kind: "color" },
      { n: 80, title: "A smell-word", kind: "note" },
      { n: 83, title: "Far thunder", kind: "rain" },
      { n: 84, title: "Lake at dusk", kind: "lake" },
      { n: 86, title: "House lights", kind: "stub-lights" },
      { n: 87, title: "The long road", kind: "trip" },
      { n: 88, title: "A bridge", kind: "bridge" },
      { n: 89, title: "Cabin", kind: "lantern" },
      { n: 90, title: "String lights", kind: "strings" },
      { n: 91, title: "A line", kind: "note" },
      { n: 98, title: "The woods keep it", kind: "sleep" },
      { n: 103, title: "Soft sand", kind: "sand" },
      { n: 106, title: "What faded", kind: "echo" },
      { n: 110, title: "A nudge, not an alarm", kind: "wisp" },
      { n: 111, title: "The path goes on", kind: "scout" },
      { n: 114, title: "A voice, later", kind: "stub-voice" },
      { n: 131, title: "An empty frame", kind: "frame" },
      { n: 143, title: "One more breath", kind: "breath" },
      { n: 144, title: "One more stone", kind: "stone" },
      { n: 145, title: "One more light", kind: "lantern" },
      { n: 146, title: "One more quiet", kind: "quiet" }
    ]}
  ];

  function ideaScene(idea, from) {
    var kind = idea.kind;
    var html = "<p></p>";
    var mount = null;
    if (kind === "pack") {
      html = "<p>Tap what goes in the bag.</p><div class='cw-ideas'></div>";
      mount = function (body) {
        var box = body.querySelector(".cw-ideas");
        ["water", "shoes", "folder", "warm layer"].forEach(function (name) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = name;
          b.addEventListener("click", function () {
            b.textContent = name + " · in";
            if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
          });
          box.appendChild(b);
        });
      };
    } else if (kind === "scout" || kind === "chunk" || kind === "backplan" || kind === "prep" || kind === "carry") {
      var n = nextText();
      var rt = routineText();
      html = "<p>" + (n.title || "The next thing") + (n.when ? " · " + n.when : "") + "</p>";
      if (kind === "backplan") html += "<p>" + (rt || "Leave a little early. The light goes first.") + "</p>";
      if (kind === "chunk") html += "<p>Get ready. Go. Be there.</p>";
      if (kind === "carry") html += "<p>The little light walks it over for you.</p>";
      if (kind === "prep") html += "<p>Only what the week already knows.</p>";
    } else if (kind === "shores" || kind === "both") {
      var hw = (data() && data().homeWeek) || {};
      html = "<p>One shore is here. One shore is with Mom. Both stay kind.</p><p>" + (hw.throughLabel || hw.through || "") + "</p>";
    } else if (kind === "bridge") {
      html = "<p>Hold to cross.</p>";
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Cross";
        b.addEventListener("pointerdown", function () { b.textContent = "Crossing"; });
        b.addEventListener("pointerup", function () { b.textContent = "Across"; });
        body.appendChild(b);
      };
    } else if (kind === "travel") {
      html = "<p>These can live in either place.</p>";
      mount = function (body) {
        ["bag", "book", "comfort"].forEach(function (name) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = name;
          b.addEventListener("click", function () {
            if (keep("travel-" + name, "1")) b.textContent = name + " · tucked";
            else b.textContent = name + " · looked at";
          });
          body.appendChild(b);
        });
      };
    } else if (kind === "welcome") {
      var hw2 = (data() && data().homeWeek) || {};
      html = "<p>A glow for coming back. " + (hw2.through || "When the week turns.") + "</p>";
    } else if (kind === "sleep") {
      html = "<p>While the week is away, the forest rests. New notes wait.</p>";
    } else if (kind === "compass") {
      var hw3 = (data() && data().homeWeek) || {};
      html = "<p>The needle leans toward the next time with Dad.</p><p>" + (hw3.throughLabel || hw3.through || "Soon.") + "</p>";
    } else if (kind === "lantern" || kind === "brave") {
      html = "<p>Light it. It does not keep score.</p>";
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Light";
        b.addEventListener("click", function () { b.textContent = "Lit"; b.style.boxShadow = "0 0 18px #ffe1a8"; });
        body.appendChild(b);
      };
    } else if (kind === "stub-voice") {
      html = "<p>A goodnight voice isn't connected yet. The lantern still dims.</p>";
    } else if (kind === "stub-lights") {
      html = "<p>The house lights stay on Dad's own switch. This is only a picture of them.</p>";
    } else if (kind === "anchors") {
      html = "<p>" + (routineText() || "The repeating things sit like stones: school, practice, home.") + "</p>";
    } else if (kind === "stone" || kind === "wind" || kind === "glade") {
      html = "<p>Hold. The weather in here can soften.</p>";
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Hold";
        var t = null;
        b.addEventListener("pointerdown", function () {
          b.textContent = "Holding";
          t = setTimeout(function () { b.textContent = "Still"; }, 700);
        });
        b.addEventListener("pointerup", function () { if (t) clearTimeout(t); });
        body.appendChild(b);
      };
    } else if (kind === "weather") {
      html = "<p>How does the air feel? It stays on this device, and only on Dad weeks.</p>";
      mount = function (body) {
        ["clear", "rain", "wind", "mist"].forEach(function (name) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = name;
          b.addEventListener("click", function () {
            if (!keep("feel", name)) b.textContent = name + " · not kept";
            else b.textContent = name + " · kept";
          });
          body.appendChild(b);
        });
      };
    } else if (kind === "before") {
      html = "<p>Before: gathering. After: arrived. The middle can be slow.</p>";
    } else if (kind === "breath" || kind === "quiet" || kind === "sand") {
      html = "<p>In for four. Out for four. The ring is only a guide.</p>";
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Begin";
        var n = 0;
        b.addEventListener("click", function () {
          n = (n + 1) % 4;
          b.textContent = ["In", "Hold", "Out", "Rest"][n];
        });
        body.appendChild(b);
      };
    } else if (kind === "rest") {
      html = "<p>Rest counts. Skipping it changes nothing bad.</p>";
    } else if (kind === "crystal" || kind === "note" || kind === "hero") {
      html = "<p>" + (asleep() ? "The woods are resting, so this stays unwritten." : "A few words, if you want them.") + "</p>";
      mount = function (body) {
        if (asleep()) return;
        var words = age() === "teen" ? null : ["fun", "proud", "calm", "tired"];
        if (words) {
          words.forEach(function (w) {
            var b = document.createElement("button");
            b.type = "button"; b.className = "cw-idea"; b.textContent = w;
            b.addEventListener("click", function () { keep(kind, w); b.textContent = w + " · kept"; });
            body.appendChild(b);
          });
        }
        var input = document.createElement("input");
        input.maxLength = 80;
        input.placeholder = "a few words";
        input.style.cssText = "display:block;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;width:min(100%,320px)";
        var save = document.createElement("button");
        save.type = "button"; save.className = "cw-idea"; save.textContent = "Keep";
        save.addEventListener("click", function () { if (keep(kind, input.value || kept(kind))) save.textContent = "Kept"; });
        body.appendChild(input); body.appendChild(save);
      };
    } else if (kind === "chapter" || kind === "month" || kind === "year" || kind === "journal") {
      var mem = kept("crystal") || kept("hero") || kept("note");
      var nx = nextText();
      html = "<p>" + (nx.title || "A quiet week") + ".</p>" + (mem ? "<p>It remembers: " + mem + "</p>" : "<p>Nothing written yet.</p>");
    } else if (kind === "friday" || kind === "seed") {
      var wd = chicagoParts().weekday || "";
      html = "<p>" + (kind === "friday" ? (wd === "Fri" ? "Friday is here. The lantern is warm." : "Friday's lantern is ahead.") : "A seed for the next week. It can wait.") + "</p>";
    } else if (kind === "season" || kind === "sky" || kind === "rain" || kind === "lake" || kind === "motes" || kind === "texture" || kind === "strings") {
      var month = new Date().getMonth();
      var season = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "fall" : "winter";
      html = "<p>" + season + " light. " + (kind === "rain" ? "Rain, far off." : kind === "lake" ? "The lake holds the sky." : kind === "strings" ? "Lights on a wire. No song with words." : "Just the air.") + "</p>";
    } else if (kind === "pick" || kind === "pace" || kind === "density") {
      html = "<p>Either way is fine.</p>";
      mount = function (body) {
        ["this way", "that way"].forEach(function (name) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = name;
          b.addEventListener("click", function () { b.textContent = name + " · ok"; });
          body.appendChild(b);
        });
      };
    } else if (kind === "table") {
      html = "<p>Hayes, Harris, Ainsley, Dad. Whoever the week says is here.</p>";
    } else if (kind === "hand" || kind === "extra") {
      html = "<p>Extras never fill the jar. They are only an offer.</p>";
    } else if (kind === "siblings") {
      html = "<p>The other boards are their own woods.</p>";
      mount = function (body, actions) {
        ["hayes", "harris", "ainsley"].forEach(function (id) {
          if (id === kid()) return;
          var a = document.createElement("a");
          a.className = "kw-go"; a.href = "kid-" + id + ".html"; a.textContent = id;
          actions.appendChild(a);
        });
      };
    } else if (kind === "pass") {
      var st = global.JarEngine ? JarEngine.choreState(kid()) : { full: false };
      html = st.full ? "<p>The run is open.</p>" : "<p>The jar is still gathering. The run waits without a fuss.</p>";
      mount = function (body, actions) {
        if (!st.full) return;
        var a = document.createElement("a");
        a.className = "kw-go"; a.href = "mercury-run.html?kid=" + kid(); a.textContent = "The run";
        actions.appendChild(a);
      };
    } else if (kind === "guide") {
      html = "<p>Tap the light to walk it forward.</p>";
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Step";
        var steps = 0;
        b.addEventListener("click", function () { steps++; b.textContent = steps > 3 ? "There" : "Step"; });
        body.appendChild(b);
      };
    } else if (kind === "far" || kind === "astro" || kind === "trip" || kind === "grow" || kind === "marker") {
      html = "<p>Far things stay foggy on purpose. " + (kind === "grow" ? "You are simply getting older. That is not a score." : "A marker, not a deadline.") + "</p>";
      if (kind === "marker") {
        mount = function (body) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = "Place";
          b.addEventListener("click", function () {
            if (keep("marker", new Date().toISOString())) b.textContent = "Placed";
            else b.textContent = "Seen";
          });
          body.appendChild(b);
        };
      }
    } else if (kind === "echo") {
      html = "<p>What already happened is dim, still there, not a grade.</p>";
    } else if (kind === "wisp") {
      html = "<p>" + (routineText() || "A small light for leaving. It does not shout.") + "</p>";
    } else if (kind === "twoclock") {
      var nx2 = nextText();
      html = "<p>Here, now. There, " + (nx2.when || "when it is time") + ".</p>";
    } else if (kind === "sense") {
      html = "<p>Notice one thing. You don't have to name it.</p>";
    } else if (kind === "draw" || kind === "color") {
      html = "<p>A mark, if you want one.</p>";
      mount = function (body) {
        var c = document.createElement("canvas");
        c.width = 320; c.height = 160;
        c.style.cssText = "width:100%;max-width:360px;background:rgba(255,255,255,.06);border-radius:12px;touch-action:none";
        var g = c.getContext("2d");
        var down = false;
        function pos(e) { var r = c.getBoundingClientRect(); var x = (e.clientX - r.left) * (c.width / r.width); var y = (e.clientY - r.top) * (c.height / r.height); return [x, y]; }
        c.addEventListener("pointerdown", function (e) { if (asleep()) return; down = true; var p = pos(e); g.strokeStyle = "#f4e1c8"; g.lineWidth = 3; g.beginPath(); g.moveTo(p[0], p[1]); });
        c.addEventListener("pointermove", function (e) { if (!down) return; var p = pos(e); g.lineTo(p[0], p[1]); g.stroke(); });
        c.addEventListener("pointerup", function () { down = false; });
        body.appendChild(c);
      };
    } else if (kind === "frame") {
      html = "<p>An empty frame. A picture can live here later. None is invented.</p>";
    } else {
      html = "<p>A quiet place on the path.</p>";
    }
    open({
      from: from,
      kicker: "idea " + idea.n,
      title: idea.title,
      html: html,
      paint: global.KidWorld && KidWorld.vignette(kind === "rain" || kind === "lake" ? "water" : "woods"),
      onMount: mount
    });
  }

  function openPhase(phase, from) {
    var html = "<div class='cw-ideas'></div>";
    open({
      from: from,
      kicker: phase.phase,
      title: phase.title,
      html: html,
      paint: global.KidWorld && KidWorld.vignette("woods"),
      onMount: function (body) {
        var box = body.querySelector(".cw-ideas");
        phase.ideas.forEach(function (idea) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "cw-idea";
          b.textContent = (age() === "small" ? "" : idea.n + " ") + idea.title;
          b.addEventListener("click", function () { ideaScene(idea, b); });
          box.appendChild(b);
        });
      }
    });
  }

  function shell() {
    var host = document.querySelector("#sec-days, .sec-schedule");
    if (!host || host.querySelector("[data-cw]")) return host && host.querySelector("[data-cw]");
    var el = document.createElement("div");
    el.className = "cw";
    el.setAttribute("data-cw", "1");
    el.innerHTML =
      '<div class="cw-brief" data-cw-brief></div>' +
      '<div class="cw-row"><canvas class="cw-ring" data-cw-ring width="168" height="168" aria-hidden="true"></canvas>' +
      '<button type="button" class="cw-next" data-cw-next><strong>Next</strong><div data-cw-next-copy></div></button></div>' +
      '<button type="button" class="cw-phase" data-cw-wisp hidden></button>' +
      '<div class="cw-path" data-cw-path></div>' +
      '<div class="cw-phases" data-cw-phases></div>';
    var hdr = host.querySelector(".sec-hdr");
    if (hdr && hdr.nextSibling) host.insertBefore(el, hdr.nextSibling);
    else host.insertBefore(el, host.firstChild);
    el.querySelector("[data-cw-next]").addEventListener("click", function (ev) {
      var n = nextText();
      open({
        from: ev.currentTarget,
        kicker: "what's next",
        title: n.title || "Next",
        html: "<p>" + (n.when || "") + "</p><p>" + sleeps(0) + " stays clear. Later stays soft.</p>",
        paint: global.KidWorld && KidWorld.vignette("glow")
      });
    });
    el.querySelector("[data-cw-wisp]").addEventListener("click", function (ev) {
      open({
        from: ev.currentTarget,
        kicker: "leave-by",
        title: "The leaving light",
        html: "<p>" + routineText() + "</p>",
        paint: global.KidWorld && KidWorld.vignette("glow")
      });
    });
    var box = el.querySelector("[data-cw-phases]");
    PHASES.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-phase";
      b.textContent = p.title;
      b.addEventListener("click", function () { openPhase(p, b); });
      box.appendChild(b);
    });
    return el;
  }

  function refresh() {
    if (!document.body || !document.body.getAttribute("data-kid")) return;
    var root = shell();
    if (!root) return;
    document.body.classList.toggle("kw-asleep", asleep());
    paintBrief(root);
    paintPath(root);
  }

  document.addEventListener("house:kid-rendered", refresh);
  if (document.readyState !== "loading") setTimeout(refresh, 400);
})(window);
