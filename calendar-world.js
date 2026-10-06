/* calendar-world.js · Calendar World inside each kid board.
   C1 is the path itself (lanterns, walker, fog, now-line, time ring, briefing).
   C2–C9 open painted sub-scenes. Sentences are Atlas's Oct 2 wording.
   Numbers missing from that transcript are named plainly for their phase.
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
    if (age() === "small") {
      if (n > 7) return n + "☾";
      var moons = "";
      for (var i = 0; i < n; i++) moons += "☾";
      return moons;
    }
    if (n === 1) return "1 sleep";
    return age() === "teen" ? (n + " nights") : (n + " sleeps");
  }
  function chicagoMonth() {
    try {
      return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "numeric" }).format(new Date()), 10) || 1;
    } catch (e) { return new Date().getMonth() + 1; }
  }
  function monthName() {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long" }).format(new Date());
    } catch (e2) { return ""; }
  }
  var litDays = {};
  function lightLantern(iso) {
    if (!iso) return;
    litDays[iso] = 1;
    keep("lantern-" + iso, "1");
  }
  function lanternOn(iso) {
    return !!(litDays[iso] || kept("lantern-" + iso) === "1");
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
      b.className = "cw-lantern" + (diff < 0 ? " is-past" : diff > 0 ? " is-fog" : " is-now") + (lanternOn(iso) ? " is-lit" : "");
      b.style.setProperty("--orb", kid() === "ainsley" ? "#e7b089" : kid() === "harris" ? "#8ee7a0" : "#8fd8ff");
      var wd = btn.querySelector(".wd");
      var dn = btn.querySelector(".dn");
      b.innerHTML = '<span class="cw-orb"></span><small>' + (wd ? wd.textContent : "") + '</small><small>' + (diff > 0 ? sleeps(diff) : (dn ? dn.textContent : "")) + "</small>";
      b.addEventListener("click", function () {
        btn.click();
        lightLantern(iso);
        b.classList.add("is-lit");
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
    var line = fog
      ? "Fog of tomorrow. Future days are misty, and tapping a day blows the fog away to reveal it."
      : diff < 0
        ? "Past fades gently. Finished events drift up as spirits instead of vanishing."
        : "The week is a glowing path. Each day is a clearing in the forest, and events are lanterns along the trail.";
    open({
      from: from,
      kicker: fog ? "ahead, still soft" : diff < 0 ? "already faded" : "today",
      title: sleeps(Math.max(0, diff)),
      html: "<p>" + line + "</p><p>The creature walks the path and peeks at what is next.</p>",
      paint: global.KidWorld && KidWorld.vignette("woods")
    });
  }

  function paintBrief(root) {
    var n = nextText();
    var sp = specialLine();
    var rt = routineText();
    var hour = parseInt(chicagoParts().hour, 10);
    var hello = hour < 11 ? say("Good morning", "Morning", "Morning") : hour < 17 ? say("Good day", "Today", "This afternoon") : say("Quiet evening", "Evening", "Evening");
    var bits = [];
    if (n.title && n.title !== "Nothing timed next") bits.push(n.title);
    if (sp && age() !== "small") bits.push(sp);
    if (rt && age() === "teen") bits.push(rt);
    var line = hello + ". " + say("Three lights.", "Morning briefing.", "Morning briefing.") + " " + (bits.slice(0, 3).join(" · ") || "The path is open.");
    if (age() === "teen") line += " " + monthName() + ".";
    if (asleep()) line = "Forest sleeps. On mom's weeks the forest gently sleeps, with nothing tracked, and wakes when they're back.";
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
      { n: 11, title: "Pack the bag", kind: "pack", line: "Pack your bag. Drag tomorrow's gear (cleats, swim bag, library book) into a glowing backpack the night before." },
      { n: 14, title: "Weekly scout", kind: "scout", line: "Weekly scout. Sunday night, the creature asks \"want to scout the week?\" and flies them through the 7 days in 20 seconds." },
      { n: 18, title: "Prep quests", kind: "prep", line: "Prep quests. The creature turns the next thing into a few small lights to get ready, only from what the week already knows." },
      { n: 19, title: "Carry the gear", kind: "carry", line: "The creature carries the gear. It walks the bag, the book, and the shoes over so the kid can follow." },
      { n: 107, title: "Backward planning", kind: "backplan", line: "Backward planning. The creature walks backward from an event (\"to leave at 8:10, shoes at 8:00, breakfast at 7:40\")." },
      { n: 108, title: "Chunk the big thing", kind: "chunk", line: "Chunk the big thing. A project lantern breaks into stepping stones across the days before it's due." },
    ]},
    { id: "c3", phase: "C3", title: say("Two homes", "Two homes", "Two shores"), ideas: [
      { n: 5, title: "Two lands", kind: "shores", line: "Mom-week and Dad-week are two lands joined by a bridge. Handoff day is crossing the bridge, shown as a calm moment, never sad." },
      { n: 59, title: "Mom's lighthouse", kind: "shores", line: "Mom's lighthouse. Mom's house is a warm, always-lit lighthouse, with nothing tracked there." },
      { n: 60, title: "Bridge ritual", kind: "bridge", line: "Bridge ritual. Handoff day has the same little animation and song every time, so transitions feel predictable." },
      { n: 61, title: "Things that travel", kind: "travel", line: "Things that travel. Items that go between houses get tagged, and the creature reminds them before the bridge." },
      { n: 62, title: "Welcome-back glow", kind: "welcome", line: "Welcome-back glow. When they return, the forest wakes up and their creature runs to greet them." },
      { n: 99, title: "Forest sleeps", kind: "sleep", line: "Forest sleeps. On mom's weeks the forest gently sleeps, with nothing tracked, and wakes when they're back." },
      { n: 115, title: "Both homes are okay", kind: "both", line: "Both homes are okay. Mom's shore and Dad's shore are both good places. Nothing is kept while the forest sleeps." },
      { n: 66, title: "Dad's compass", kind: "compass", line: "Dad's compass. While Dad travels, a compass points toward him and counts the days to the reunion." },
      { n: 23, title: "Dad's lantern", kind: "lantern", line: "Dad's lantern. A steady lantern stays lit on Dad's shore so the way back is easy to see." },
      { n: 116, title: "Goodnight from afar", kind: "stub-voice", line: "Goodnight from afar. A short goodnight can ride a lantern once a voice is connected. Until then the lantern just dims." },
      { n: 118, title: "Steady anchors", kind: "anchors", line: "Steady anchors. School, practice, and home sit in the same places every week." },
    ]},
    { id: "c4", phase: "C4", title: say("Calm", "Calm", "Steady"), ideas: [
      { n: 51, title: "Worry stones", kind: "stone", line: "Worry stones. A kid drops a \"nervous\" stone on an upcoming event, so a parent sees it and can talk before the day." },
      { n: 52, title: "Feeling weather", kind: "weather", line: "Feeling weather. After an event, the kid picks sunny, cloudy or stormy, and the forest remembers it with no judgment." },
      { n: 53, title: "Brave lanterns", kind: "brave", line: "Brave lanterns. Hard or first-time things get a special flame, and the creature walks with them to it." },
      { n: 54, title: "Before and after", kind: "before", line: "Before and after. The creature asks \"how will it go?\" before and \"how did it go?\" after, which teaches that worry usually shrinks." },
      { n: 55, title: "Transition breath", kind: "breath", line: "Transition breath. Before big changes, the forest slows down and the creature does a 3-breath glow with them." },
      { n: 56, title: "Decompress glade", kind: "glade", line: "Decompress glade. After a packed day, there's a quiet clearing to sit in for a minute." },
      { n: 117, title: "The glade", kind: "glade", line: "The glade. The same quiet clearing is there after a full day, every time." },
      { n: 139, title: "Overwhelm as weather", kind: "wind", line: "Overwhelm meter as weather. Too many events in a week shows as wind in the forest." },
      { n: 140, title: "Calm on cue", kind: "breath", line: "Calm on cue. A kid taps their creature to slow the whole board into a breathing glow." },
      { n: 141, title: "Quiet hours", kind: "quiet", line: "Quiet hours. Evenings after 8 dim the forest so screens wind down." },
      { n: 142, title: "Rest is a quest", kind: "rest", line: "Rest is a quest. Doing nothing on a rest day is celebrated as finishing a quest." },
      { n: 49, title: "Rest-day hammock", kind: "rest", line: "Rest-day hammock. Days with nothing planned show the creature napping in a hammock, and that's celebrated." },
    ]},
    { id: "c5", phase: "C5", title: say("Stories", "Stories", "Journal"), ideas: [
      { n: 34, title: "Memory crystals", kind: "crystal", line: "Memory crystals. After an event, the lantern turns into a memory crystal, and a tap shows a photo." },
      { n: 74, title: "Week chapters", kind: "chapter", line: "Week chapters. Each week becomes a short chapter the creature can read back, with no grades." },
      { n: 75, title: "The year book", kind: "year", line: "The year book. The chapters stack into one book the kid can open." },
      { n: 77, title: "Creature journal", kind: "journal", line: "The creature journal. It keeps a few plain lines about the week." },
      { n: 113, title: "It remembers", kind: "journal", line: "The creature remembers them. It recalls past events (\"remember the rain game?\")." },
      { n: 126, title: "Their words", kind: "note", line: "Their words. A kid can leave a line in their own words. It stays on this device during Dad weeks." },
      { n: 127, title: "Hero moments", kind: "hero", line: "Hero moments. A bright thing from the week can be marked, just to remember it." },
      { n: 129, title: "Friday lantern", kind: "friday", line: "Friday lantern. Friday gets its own warm lantern at the end of the school stretch." },
      { n: 130, title: "Sunday seeds", kind: "seed", line: "Sunday seeds. Sunday plants one small idea for the week ahead." },
      { n: 132, title: "Monthly story", kind: "month", line: "Monthly story. Once a month the creature tells the month as one short story." },
    ]},
    { id: "c6", phase: "C6", title: say("Seasons", "Seasons", "Senses"), ideas: [
      { n: 7, title: "Seasons", kind: "season", line: "Seasons change the forest to match the real month: fall leaves in October, snow for winter break." },
      { n: 67, title: "Real sunlight", kind: "sky", line: "Real sunlight. Real sunrise and sunset times shift the forest light." },
      { n: 68, title: "Evening color", kind: "sky", line: "Evening color. As the real day ends, the forest shifts toward dusk on its own." },
      { n: 69, title: "Rain on the leaves", kind: "rain", line: "Rain on the leaves. A wet week sounds like soft rain in the canopy." },
      { n: 70, title: "Wind in the trees", kind: "wind", line: "Wind in the trees. A breezy day moves the branches." },
      { n: 72, title: "A warm window", kind: "lantern", line: "A warm window. Cold months show a lit window, a small sense of being indoors." },
      { n: 73, title: "Cool air", kind: "breath", line: "Cool air. Hot months let the forest feel a little cooler in the shade." },
      { n: 81, title: "Event sounds", kind: "sense", line: "Event sounds. Swim sounds like water, baseball like a bat crack, school like a bell." },
      { n: 82, title: "Spirit colors", kind: "color", line: "Spirit colors. Each activity type has its own color, so a glance tells the kind of day." },
      { n: 85, title: "Music by day", kind: "strings", line: "Music by day. Calm music on rest days, upbeat on game days." },
      { n: 9, title: "A shooting star", kind: "sky", line: "A shooting star crosses the sky when something new lands on their calendar." },
      { n: 10, title: "Night sky", kind: "sky", line: "Night sky mode. At bedtime the forest dims and tomorrow's 3 things appear as constellations." },
      { n: 48, title: "Bedtime lullaby", kind: "sense", line: "Bedtime lullaby. The forest sings tomorrow's first event in one line, softly." },
    ]},
    { id: "c7", phase: "C7", title: say("Choose", "Choose", "Agency"), ideas: [
      { n: 12, title: "Choose your path", kind: "pick", line: "Choose your path. On free weekend time the kid picks between 2-3 lantern options, and the pick becomes the plan." },
      { n: 13, title: "Plant a seed", kind: "note", line: "Plant a seed. The kid adds an idea (\"go to the park\"), and it sprouts on a day once a parent approves it." },
      { n: 17, title: "A say in the pace", kind: "guide", line: "A say in the pace. The kid can ask the creature to slow the next step. Nothing is marked wrong." },
      { n: 21, title: "Who is here", kind: "table", line: "Who is here. The week shows the people it already knows are around." },
      { n: 22, title: "A hand offered", kind: "hand", line: "A hand offered. Extra help is an offer. It never fills the jar." },
      { n: 25, title: "Your own speed", kind: "pace", line: "Your own speed. Going slower is allowed. The path does not scold." },
      { n: 27, title: "Siblings' woods", kind: "siblings", line: "Siblings' woods. Each kid keeps their own forest. A visit is just a visit." },
      { n: 28, title: "Room to be quiet", kind: "glade", line: "Room to be quiet. There is a clearing for being alone a while." },
      { n: 47, title: "Sunday campfire", kind: "table", line: "Sunday campfire. A 2-minute family look at the week, with all three creatures and Dad's." },
      { n: 57, title: "Choice fruit", kind: "pick", line: "Choice fruit. Small choices on the plan get picked from fruit on a tree, giving kids real control over little things." },
      { n: 64, title: "Weekly roles", kind: "extra", line: "Weekly roles. Lantern-keeper, pathfinder, weather-watcher, rotating each week." },
      { n: 65, title: "Sibling trade post", kind: "pass", line: "Sibling trade post. Kids swap small tasks or choices with a parent's OK, which teaches negotiation." },
      { n: 134, title: "Kid veto token", kind: "pick", line: "Kid veto token. Once a month each kid can gently request a swap on something optional, with a parent deciding." },
      { n: 135, title: "Propose a plan", kind: "note", line: "Propose a plan. A kid designs a whole Saturday, and a parent approves pieces of it." },
      { n: 136, title: "Rate the forest", kind: "pick", line: "Rate the forest. Kids pick what they want more of (more parks, more friends, more rest), and it shapes future plans." },
      { n: 137, title: "Kid-built events", kind: "note", line: "Kid-built events. Kids create a family event, like \"movie night,\" which the parent sees and approves." },
      { n: 138, title: "Kid's choice day", kind: "guide", line: "Kid's choice day. One day a month, one kid is the forest's guide and picks the plan." },
      { n: 44, title: "Ask a question", kind: "note", line: "Ask a question. Kids tap a lantern and record \"what's this?\" for a parent to answer." },
      { n: 45, title: "My own lantern", kind: "note", line: "My own lantern. Kids can add personal events like a friend's birthday or a project due, with parent approval." },
      { n: 112, title: "Self-set reminders", kind: "wisp", line: "Self-set reminders. Older kids set their own wisp reminders." },
    ]},
    { id: "c8", phase: "C8", title: say("Far away", "Far lights", "Horizon"), ideas: [
      { n: 35, title: "Birthday bloom", kind: "far", line: "Birthday bloom. Their birthday is a giant flower visible from weeks away that grows as it nears." },
      { n: 46, title: "Planner rank by age", kind: "far", line: "Planner rank by age. Kids unlock features with age (scout, ranger, navigator), never by performance." },
      { n: 95, title: "Growth rings", kind: "grow", line: "Growth rings. Every birthday adds a ring to their tree." },
      { n: 119, title: "First light of the year", kind: "welcome", line: "First light of the year. The new year is a lantern on the far path." },
      { n: 120, title: "A last day", kind: "far", line: "A last day. The end of a season gets one quiet lantern, then the path continues." },
      { n: 121, title: "The long solstice", kind: "astro", line: "The long solstice. The longest and shortest days are marked as sky facts, gently." },
      { n: 122, title: "The even day", kind: "astro", line: "The even day. Equinox is a day when light and dark share the path." },
      { n: 123, title: "A thin moon", kind: "astro", line: "A thin moon. New moon is a small mark in the night sky." },
      { n: 124, title: "A full moon", kind: "astro", line: "A full moon. Full moon is a bright mark, only to notice." },
      { n: 125, title: "A year-end light", kind: "friday", line: "A year-end light. The last stretch of a season holds a lantern for looking back." },
      { n: 128, title: "A marker", kind: "marker", line: "A marker. A kid can place one stone on a far day. It is a reminder, not a deadline." },
      { n: 133, title: "Growing", kind: "grow", line: "Growing. Getting older only changes how much of the forest you can see." },
      { n: 92, title: "Dream tree", kind: "far", line: "Dream tree. Far-off wishes hang on a tree, and a parent can turn one into a real plan." },
      { n: 93, title: "Time capsule", kind: "note", line: "Time capsule. A yearly message to their future self, opened on the same day next year." },
      { n: 94, title: "Summer island", kind: "trip", line: "Summer island. Summer is an island on the map all year that gets closer, and the kids help plan it." },
      { n: 96, title: "Horizon view", kind: "far", line: "Horizon view. Ainsley sees high school, driving and college as far mountains." },
      { n: 97, title: "Experience goals", kind: "far", line: "Experience goals. Kids plan toward experiences, like a special day with Dad, and see the path there." },
      { n: 147, title: "Letters to graduation", kind: "note", line: "Letters to graduation. Each year Dad and the kids write a short letter sealed until their graduation year (Ainsley ~2031, Hayes ~2036, Harris ~2038)." },
      { n: 148, title: "Family constitution", kind: "chapter", line: "Family constitution. The family's values grow as a tree the kids help write over the years." },
      { n: 149, title: "The forest grows", kind: "grow", line: "The forest grows with them. By their teens the forest matures from a magical glade into a sleeker world." },
      { n: 150, title: "Hand-me-down world", kind: "far", line: "Hand-me-down world. One day each kid can export their forest and memories to keep as adults." },
      { n: 100, title: "Legacy grove", kind: "far", line: "Legacy grove. Every school year becomes a tree, so by graduation they walk through their whole childhood." },
    ]},
    { id: "c9", phase: "C9", title: say("More woods", "More woods", "The rest"), ideas: [
      { n: 6, title: "Vine countdown", kind: "scout", line: "The countdown is a vine growing toward a big event (a game, a birthday, the trip home), one leaf per day." },
      { n: 8, title: "School river", kind: "scout", line: "School days are a river crossing with stepping stones. Weekends are open meadow." },
      { n: 24, title: "A question left", kind: "note", line: "A question left on a lantern. It waits for a parent, with no timer." },
      { n: 26, title: "A soft no", kind: "rest", line: "A soft no. Skipping an optional thing leaves the forest the same." },
      { n: 29, title: "See", kind: "sense", line: "See. Notice one color in today's clearing." },
      { n: 30, title: "Hear", kind: "sense", line: "Hear. Notice one sound the day already has." },
      { n: 31, title: "Touch", kind: "stone", line: "Touch. A stone in the path you can hold for a moment." },
      { n: 32, title: "Smell", kind: "sense", line: "Smell. A season line, like leaves or rain." },
      { n: 33, title: "Taste", kind: "sense", line: "Taste. A meal on the day can be named, or left unnamed." },
      { n: 36, title: "Holiday creatures", kind: "season", line: "Holiday creatures. Special spirits appear near holidays and school breaks." },
      { n: 37, title: "Game day face", kind: "color", line: "Game day face. Their creature wears team colors on game days." },
      { n: 38, title: "Trip portals", kind: "trip", line: "Trip portals. Big trips appear as a glowing portal on the map, and the last day before is \"stepping through.\"" },
      { n: 39, title: "Calm-week rain", kind: "rain", line: "Calm-week rain. Light weeks get a gentle rain that makes the forest lush, which teaches that quiet weeks are good too." },
      { n: 40, title: "First-time lanterns", kind: "lantern", line: "First-time lanterns. New activities get a special golden lantern, so the unknown feels exciting, not scary." },
      { n: 50, title: "Year path", kind: "year", line: "Year path. At year end, the whole year unrolls as one long glowing trail of memory crystals." },
      { n: 63, title: "Family tree of time", kind: "table", line: "Family tree of time. Grandparents, cousins and Erin's side are branches that light up on visits." },
      { n: 71, title: "Weather on the branches", kind: "season", line: "Weather on the branches. The forecast sits on a tree as a picture, with a one-line why nearby." },
      { n: 76, title: "Strings, no words", kind: "strings", line: "Strings, no words. A hum with no lyrics, only a tone for the day." },
      { n: 78, title: "A drawing", kind: "draw", line: "A drawing. A mark on a clear patch, kept only on Dad weeks." },
      { n: 79, title: "A color", kind: "color", line: "A color. Pick a color for today. It changes nothing else." },
      { n: 80, title: "A smell-word", kind: "note", line: "A smell-word. One word for the air, if you want it." },
      { n: 83, title: "Haptic pulse", kind: "wisp", line: "Haptic pulse. The next event pulses softly on a phone or tablet." },
      { n: 84, title: "Season lines", kind: "season", line: "Season lines. Short lines like \"smells like fall leaves\" make each season feel real." },
      { n: 86, title: "Room light", kind: "stub-lights", line: "Room light. A kid's real room light glows their color 10 minutes before leave time (stub until backend + Alfred check)." },
      { n: 87, title: "Friend spirits", kind: "table", line: "Friend spirits. Playdates show the friend's own spirit visiting." },
      { n: 88, title: "Team spirits", kind: "table", line: "Team spirits. Each team or class has a group spirit on practice and game days." },
      { n: 89, title: "Kindness echoes", kind: "echo", line: "Kindness echoes. A parent drops an echo through the forest when a kid helps someone." },
      { n: 90, title: "Co-op adventures", kind: "siblings", line: "Co-op adventures. Events with cousins or friends become quests both creatures go on." },
      { n: 91, title: "Invite crafting", kind: "draw", line: "Invite crafting. Kids design glowing invites for their own sleepovers and birthdays." },
      { n: 98, title: "Treehouse", kind: "lantern", line: "Treehouse. Each kid's home base, decorated with memories from past events." },
      { n: 103, title: "Day shape", kind: "scout", line: "Day shape. Each day shows as a shape (a hill for busy mornings, a valley for quiet evenings)." },
      { n: 106, title: "Time travel tap", kind: "echo", line: "Time travel tap. Swipe back for last week's memories, forward for the fog of next week." },
      { n: 110, title: "Forgot-it rescue", kind: "wisp", line: "Forgot-it rescue. If gear gets left behind, the creature helps make a \"next time\" pack note, with no blame." },
      { n: 111, title: "Plan vs. real", kind: "chapter", line: "Plan vs. real. At night the creature shows what was planned and what actually happened; changes are just part of the story." },
      { n: 114, title: "Dad's voice drops", kind: "stub-voice", line: "Dad's voice drops. Dad records short voice notes that attach to their lanterns, like \"good luck at swim\" (stub until backend)." },
      { n: 131, title: "An empty frame", kind: "frame", line: "An empty frame. A picture can be added later. None is invented." },
      { n: 143, title: "Math in the map", kind: "scout", line: "Math in the map. \"How many sleeps until?\" puzzles for Harris and Hayes, optional and playful." },
      { n: 144, title: "Reading the week", kind: "sense", line: "Reading the week. Harris's creature points at words on lanterns, so the calendar helps him read." },
      { n: 145, title: "Geography trips", kind: "trip", line: "Geography trips. Trips show the real map path, like KC to Nashville, with landmarks along the way." },
      { n: 146, title: "Weather science", kind: "sky", line: "Weather science. Real forecasts come with a one-line \"why\" from the creature." },
    ]},
  ];
  function softTone(freq, dur, type) {
    try {
      if (!global.HouseSfx || (HouseSfx.isMuted && HouseSfx.isMuted())) return;
      var ac = HouseSfx.ensureCtx && HouseSfx.ensureCtx();
      var master = HouseSfx.masterGain && HouseSfx.masterGain();
      if (!ac || !master) return;
      var o = ac.createOscillator();
      var g = ac.createGain();
      var t0 = ac.currentTime;
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function chips(body, names, onPick) {
    names.forEach(function (name) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-idea";
      b.textContent = name;
      b.addEventListener("click", function () {
        if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
        onPick(b, name);
      });
      body.appendChild(b);
    });
  }
  function seasonPaint(ctx, W, H, t) {
    var m = chicagoMonth();
    var fall = m >= 9 && m <= 11;
    var winter = m === 12 || m <= 2;
    var spring = m >= 3 && m <= 5;
    for (var i = 0; i < 16; i++) {
      var x = (i * 53 + t * (winter ? 12 : 36)) % W;
      var y = (i * 70 + t * (winter ? 22 : 48)) % (H * 0.7);
      ctx.fillStyle = winter ? "rgba(255,255,255,0.85)" : spring ? "#f4c2d8" : fall ? (i % 2 ? "#e07a3a" : "#d4a017") : "#8fd18a";
      ctx.beginPath();
      ctx.ellipse(x, y, winter ? 2.2 : 7, winter ? 2.2 : 3.2, t + i, 0, 7);
      ctx.fill();
    }
  }
  function starPaint(ctx, W, H, t) {
    var u = (t * 0.25) % 1;
    var x = W * (0.15 + u * 0.75);
    var y = H * (0.12 + u * 0.28);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 48, y - 18);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
  }
  function skyPaint(ctx, W, H, t) {
    ctx.fillStyle = "rgba(8, 12, 28, 0.35)";
    ctx.fillRect(0, 0, W, H * 0.45);
    var n = nextText();
    var labels = [n.title || "one", specialLine() || "two", "three"];
    for (var i = 0; i < 3; i++) {
      var x = W * (0.22 + i * 0.26);
      var y = H * (0.16 + (i === 1 ? 0.08 : 0));
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.sin(t * 2 + i), 0, 7); ctx.fill();
      if (age() !== "small") {
        ctx.font = "600 14px Palatino, Georgia, serif";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(String(labels[i]).slice(0, 16), x - 20, y + 22);
      }
    }
  }
  function sunPaint(ctx, W, H, t) {
    var p = chicagoParts();
    var mins = (parseInt(p.hour, 10) || 0) * 60 + (parseInt(p.minute, 10) || 0);
    var rise = 7 * 60, set = 18 * 60 + 30;
    var f = mins <= rise ? 0 : mins >= set ? 1 : (mins - rise) / (set - rise);
    var ang = Math.PI + f * Math.PI;
    var cx = W * 0.5, cy = H * 0.62, rad = Math.min(W, H) * 0.28;
    var x = cx + Math.cos(ang) * rad;
    var y = cy + Math.sin(ang) * rad * 0.55;
    ctx.strokeStyle = "rgba(255,220,160,0.35)";
    ctx.beginPath(); ctx.arc(cx, cy, rad, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = mins < rise || mins > set ? "#d8e4ff" : "#ffe1a0";
    ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
  }
  function rainPaint(ctx, W, H, t) {
    ctx.strokeStyle = "rgba(180,210,230,0.45)";
    ctx.lineWidth = 1.4;
    for (var i = 0; i < 24; i++) {
      var x = (i * 37 + t * 40) % W;
      var y = (i * 61 + t * 90) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke();
    }
  }
  function playIdea(idea, from) {
    var n = idea.n;
    var handled = {
      6: 1, 7: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 18: 1, 19: 1,
      34: 1, 35: 1, 44: 1, 45: 1, 48: 1, 51: 1, 52: 1, 55: 1, 57: 1,
      67: 1, 68: 1, 69: 1, 70: 1, 72: 1, 73: 1, 81: 1, 82: 1, 85: 1, 86: 1,
      107: 1, 108: 1, 112: 1, 114: 1, 116: 1, 134: 1, 135: 1, 136: 1, 137: 1, 138: 1, 140: 1, 143: 1
    };
    if (!handled[n]) return false;
    var line = "<p>" + (idea.line || "") + "</p>";
    var html = "";
    var mount = null;
    var paint = global.KidWorld && KidWorld.vignette("woods");
    if (n === 11) {
      html = "<p>Cleats, swim bag, library book.</p>";
      mount = function (body) { chips(body, ["cleats", "swim bag", "library book"], function (b, name) { b.textContent = name + " · in"; }); };
    } else if (n === 14) {
      html = "<p></p>";
      mount = function (body) {
        var names = [];
        document.querySelectorAll(".kw-day b").forEach(function (el) { names.push(el.textContent || "·"); });
        if (!names.length) names = ["S", "S", "M", "T", "W", "T", "F"];
        var show = document.createElement("p");
        show.style.cssText = "font-size:32px;font-weight:800;letter-spacing:0.08em";
        body.appendChild(show);
        var i = 0;
        function step() {
          show.textContent = names[i] || "";
          i += 1;
          if (i < names.length && !reduced()) setTimeout(step, 2800);
        }
        step();
      };
    } else if (n === 12 || n === 57 || n === 136) {
      var opts = n === 136 ? ["more parks", "more friends", "more rest"] : n === 57 ? ["this one", "that one", "later"] : ["this lantern", "that lantern", "leave it open"];
      mount = function (body) {
        chips(body, opts, function (b, name) {
          if (keep("pick-" + n, name)) b.textContent = name + " · the plan";
          else b.textContent = name + " · seen";
        });
      };
    } else if (n === 13 || n === 44 || n === 45 || n === 135 || n === 137) {
      html = asleep() ? "<p>The forest is sleeping, so this stays unwritten.</p>" : "<p>A few words. A parent says yes before it sprouts.</p>";
      mount = function (body) {
        if (asleep()) return;
        var input = document.createElement("input");
        input.maxLength = 80;
        input.placeholder = n === 44 ? "what's this?" : n === 137 ? "movie night" : "an idea";
        input.style.cssText = "display:block;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;width:min(100%,320px)";
        var save = document.createElement("button");
        save.type = "button"; save.className = "cw-idea"; save.textContent = "Offer";
        save.addEventListener("click", function () {
          if (keep("idea-" + n, input.value || "noted")) save.textContent = "Offered";
        });
        body.appendChild(input); body.appendChild(save);
      };
    } else if (n === 18 || n === 19 || n === 107 || n === 108) {
      var rt = routineText();
      var nx = nextText();
      html = "<p>" + (nx.title || "The next thing") + (nx.when ? " · " + nx.when : "") + "</p>";
      if (n === 107) html += "<p>" + (rt || "To leave at 8:10, shoes at 8:00, breakfast at 7:40.") + "</p>";
      if (n === 108) html += "<p>One stone, then the next, then the day it is due.</p>";
      if (n === 19) html += "<p>The creature walks the bag across.</p>";
      mount = function (body) {
        var steps = n === 107 ? ["breakfast", "shoes", "leave"] : n === 108 ? ["start", "middle", "due"] : ["bag", "book", "shoes"];
        chips(body, steps, function (b, name) { b.textContent = name + " · ready"; });
      };
    } else if (n === 51) {
      mount = function (body) {
        chips(body, ["nervous"], function (b) {
          if (keep("worry", nextText().title || "soon")) b.textContent = "stone set";
          else b.textContent = "seen";
        });
      };
    } else if (n === 52) {
      mount = function (body) {
        chips(body, ["sunny", "cloudy", "stormy"], function (b, name) {
          if (keep("feel", name)) b.textContent = name + " · kept";
          else b.textContent = name + " · not kept";
        });
      };
    } else if (n === 55 || n === 140) {
      mount = function (body) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "cw-idea"; b.textContent = "Breath 1";
        var c = 0;
        b.addEventListener("click", function () {
          c = Math.min(3, c + 1);
          b.textContent = c >= 3 ? "glow" : ("Breath " + (c + 1));
          softTone(220 + c * 40, 0.6, "sine");
        });
        body.appendChild(b);
      };
    } else if (n === 34) {
      html = "<p>The crystal can hold a few words. A photo waits until one is really here.</p>";
    } else if (n === 48) {
      var first = nextText().title || "a quiet morning";
      html = "<p>" + first + "</p>";
      softTone(196, 1.1, "sine");
    } else if (n === 7) {
      paint = seasonPaint;
    } else if (n === 9) {
      paint = starPaint;
    } else if (n === 10) {
      paint = skyPaint;
    } else if (n === 67 || n === 68) {
      paint = sunPaint;
    } else if (n === 69 || n === 39) {
      paint = rainPaint;
    } else if (n === 70 || n === 139) {
      paint = function (ctx, W, H, t) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        for (var i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(0, H * (0.3 + i * 0.08));
          ctx.quadraticCurveTo(W * 0.5, H * (0.28 + i * 0.08) + Math.sin(t * 2 + i) * 12, W, H * (0.32 + i * 0.08));
          ctx.stroke();
        }
      };
    } else if (n === 72) {
      paint = function (ctx, W, H) {
        ctx.fillStyle = "rgba(255, 186, 96, 0.35)";
        ctx.fillRect(W * 0.62, H * 0.28, 70, 54);
      };
    } else if (n === 73) {
      paint = function (ctx, W, H) {
        ctx.fillStyle = "rgba(160, 200, 230, 0.2)";
        ctx.fillRect(0, 0, W, H);
      };
    } else if (n === 81) {
      mount = function (body) {
        chips(body, ["swim", "bat", "bell"], function (b, name) {
          if (name === "swim") softTone(520, 0.25, "triangle");
          else if (name === "bat") softTone(140, 0.08, "square");
          else softTone(880, 0.4, "sine");
          b.textContent = name + " · heard";
        });
      };
    } else if (n === 82) {
      mount = function (body) {
        [["school", "#8fd8ff"], ["sport", "#8ee7a0"], ["home", "#ffd56a"], ["rest", "#e7b089"]].forEach(function (pair) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cw-idea"; b.textContent = pair[0];
          b.style.boxShadow = "0 0 16px " + pair[1];
          b.addEventListener("click", function () { b.textContent = pair[0] + " · this color"; });
          body.appendChild(b);
        });
      };
    } else if (n === 85) {
      mount = function (body) {
        chips(body, ["rest day", "game day"], function (b, name) {
          softTone(name === "rest day" ? 174 : 392, 0.5, "sine");
          b.textContent = name + " · playing";
        });
      };
    } else if (n === 86 || n === 114 || n === 116) {
      html = n === 86
        ? "<p>The real room light stays on its own switch. This is only a picture.</p>"
        : "<p>A voice isn't connected yet. The lantern still dims.</p>";
    } else if (n === 112) {
      html = age() === "teen" ? "<p>Set your own wisp.</p>" : "<p>This one opens as you get older.</p>";
      if (age() === "teen") {
        mount = function (body) {
          chips(body, ["15 minutes", "this evening"], function (b, name) {
            if (keep("wisp", name)) b.textContent = name + " · set";
            else b.textContent = name + " · seen";
          });
        };
      }
    } else if (n === 134) {
      mount = function (body) {
        chips(body, ["ask for a swap"], function (b) {
          if (keep("veto", nextText().title || "optional")) b.textContent = "asked";
          else b.textContent = "seen";
        });
      };
    } else if (n === 138) {
      mount = function (body) { chips(body, ["I'll guide"], function (b) { b.textContent = "guiding"; }); };
    } else if (n === 143) {
      var today = global.WardKids && WardKids.DAY_ISO;
      var hw = (data() && data().homeWeek) || {};
      var end = hw.endIso ? String(hw.endIso).slice(0, 10) : today;
      var left = Math.max(0, dayDiff(today, end));
      html = "<p>" + sleeps(left) + " until the week turns.</p>";
    } else if (n === 6 || n === 35) {
      var today2 = global.WardKids && WardKids.DAY_ISO;
      var hw2 = (data() && data().homeWeek) || {};
      var end2 = hw2.endIso ? String(hw2.endIso).slice(0, 10) : today2;
      var leaves = Math.max(1, Math.min(12, dayDiff(today2, end2) || 3));
      html = "<p>" + leaves + (n === 35 ? " lights until a far bloom." : " leaves on the vine.") + "</p>";
      paint = seasonPaint;
    }
    open({
      from: from,
      kicker: "idea " + idea.n,
      title: idea.title,
      html: line + html,
      paint: paint,
      onMount: mount
    });
    return true;
  }

  function ideaScene(idea, from) {
    if (playIdea(idea, from)) return;
    var kind = idea.kind;
    var html = "";
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
    if (idea.line) html = "<p>" + idea.line + "</p>" + html;
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
    var host = document.querySelector("#kw-cal") || document.querySelector("#sec-days, .sec-schedule");
    if (!host || host.querySelector("[data-cw]")) return host && host.querySelector("[data-cw]");
    var el = document.createElement("div");
    el.className = "cw";
    el.setAttribute("data-cw", "1");
    el.innerHTML =
      '<button type="button" class="cw-brief" data-cw-brief></button>' +
      '<div class="cw-row"><canvas class="cw-ring" data-cw-ring width="168" height="168" aria-hidden="true"></canvas>' +
      '<button type="button" class="cw-next" data-cw-next><strong>Next</strong><div data-cw-next-copy></div></button></div>' +
      '<button type="button" class="cw-phase" data-cw-wisp hidden></button>' +
      '<div class="cw-path" data-cw-path></div>' +
      '<div class="cw-phases" data-cw-phases></div>';
    var hdr = host.querySelector(".sec-hdr");
    if (hdr && hdr.nextSibling) host.insertBefore(el, hdr.nextSibling);
    else host.insertBefore(el, host.firstChild);
    el.querySelector("[data-cw-brief]").addEventListener("click", function (ev) {
      var n = nextText();
      var sp = specialLine();
      var rt = routineText();
      var bits = [n.title, sp, rt].filter(function (x) { return x && x !== "Nothing timed next"; }).slice(0, 3);
      while (bits.length < 3) bits.push(bits.length === 0 ? "quiet" : "open");
      open({
        from: ev.currentTarget,
        kicker: "morning",
        title: "Got it",
        html: "<p>Morning briefing. Their creature yawns, stretches and shows today's 3 lanterns. One tap says \"got it.\"</p><div class='cw-ideas' data-three></div>",
        paint: global.KidWorld && KidWorld.vignette("glow"),
        onMount: function (body) {
          var box = body.querySelector("[data-three]");
          var glyphs = ["☀", "✦", "●"];
          bits.forEach(function (name, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "cw-idea";
            b.textContent = age() === "small" ? glyphs[i] : name;
            b.setAttribute("aria-label", name);
            b.addEventListener("click", function () { b.textContent = "got it"; });
            box.appendChild(b);
          });
        }
      });
    });
    el.querySelector("[data-cw-next]").addEventListener("click", function (ev) {
      var n = nextText();
      open({
        from: ev.currentTarget,
        kicker: "what's next",
        title: n.title || "Next",
        html: "<p>What's next. An orb shows the next thing on the path, and later days stay in fog.</p><p>No-surprise glow. Anything new or changed glows the day before, so nobody gets blindsided.</p><p>" + (n.when || "") + "</p><p>" + (n.title || "") + "</p>",
        paint: global.KidWorld && KidWorld.vignette("glow")
      });
    });
    el.querySelector("[data-cw-wisp]").addEventListener("click", function (ev) {
      open({
        from: ev.currentTarget,
        kicker: "leave-by",
        title: "Leave-by spirit",
        html: "<p>Leave-by spirit. A little wisp appears 15 minutes before leave time.</p><p>" + routineText() + "</p><p>Transition warnings. A gentle 10-, 5- and 1-minute glow before switching activities.</p>",
        paint: global.KidWorld && KidWorld.vignette("glow")
      });
    });
    var box = el.querySelector("[data-cw-phases]");
    PHASES.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-phase";
      if (p.id === "c6" || p.id === "c7" || p.id === "c8" || p.id === "c9") b.setAttribute("data-late", "1");
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
