/* House face · kids shared data + bank · kids-safe · localStorage only */
(function (global) {
  "use strict";

  var DAY_ISO = (function () {
    try {
      var d = new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    } catch (e) {
      return "2026-09-26";
    }
  })();

  var CHECK_KEY = "house-checkoffs:chores-v2";
  var BANK_KEY = "house-bank:v1";

  var KID_FROM_CHECK = {
    "ain-bed": "ainsley", "ain-backpack": "ainsley", "ain-toys": "ainsley", "ain-table": "ainsley",
    "hay-bed": "hayes", "hay-dishes": "hayes", "hay-trash": "hayes", "hay-backpack": "hayes",
    "har-bed": "harris", "har-dishes": "harris", "har-trash": "harris", "har-backpack": "harris"
  };

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Sat Sep 26 2026","asOfIso":"2026-09-26","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 \u00b7 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"\u25c6","label":"Gems"},"bankGoal":{"id":"craft-diamond-pick","title":"Craft your Diamond Pick","blurb":"Stack gems from your quests. Fill the craft bar \u2014 then unlock screen-time craft time.","need":8,"reward":"screen-time craft unlock"},"hottest":{"when":"SAT \u00b7 Leave 7:55 \u00b7 GAME 8:30","what":"YOUR FLAG GAME!!!","where":"Heritage Park Field 10 \u00b7 smash it with Dad","badges":["FLAG TIME","GO GO GO"]},"today":[{"kind":"event","when":"Leave 7:55 \u00b7 game 8:30","what":"\ud83c\udfc3 FLAG GAME \u2014 Heritage Park F10","hint":"Get your cleats. Be a beast.","tone":"hot"},{"kind":"event","when":"After the game","what":"\ud83c\udfe0 Back to YOUR base @ 147th","hint":"Snack + block time if quests clear","tone":"fun"}],"quests":[{"id":"har-bed","what":"\ud83d\udecf\ufe0f Make your bed (block rebuild)","stars":1},{"id":"har-dishes","what":"\ud83c\udf7d\ufe0f Dishes helper (mining duty)","stars":1},{"id":"har-trash","what":"\ud83d\uddd1\ufe0f Trash out (clear the cave)","stars":1},{"id":"har-backpack","what":"\ud83c\udf92 Pack backpack (loot ready)","stars":1}],"sports":[{"when":"Sat 26 \u00b7 leave 7:55 \u00b7 game 8:30","what":"\u26a1 FLAG \u00b7 Heritage Park F10","hint":"YOUR game \u00b7 with Dad","tone":"hot"}],"school":[{"when":"Mon 28 \u00b7 leave ~8:10","what":"\ud83c\udfeb SRE drop \u2014 you're on the crew","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"\ud83d\ude8c Boys pickup \u00b7 squad ride","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 YOUR BASE @ 147th with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"fun":[{"when":"Quest reward","what":"\ud83e\uddf1 BLOCK BUILD TIME","hint":"earn gems \u2192 unlock craft screen time","tone":"fun"},{"when":"Outside","what":"\ud83c\udf33 Backyard boss fight (play)","hint":"ask Dad \u00b7 run wild","tone":"fun"},{"when":"Tonight","what":"\ud83c\udf6a Snack chest raid","hint":"after quests \u00b7 with Dad","tone":"fun"},{"when":"Base mission","what":"\ud83d\udc8e Fill the craft bar \u2014 Diamond Pick!!!","hint":"FUN quest \u00b7 not a calendar thing","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No doctor stuff on your board \u2014 lucky!!! More play time.","streakLabel":"\ud83d\udd25 3-day craft streak \u2014 keep smashing","missions":[{"when":"Anytime","what":"\ud83d\udd25 4-quest clear = LEVEL UP boom","hint":"FUN mission","tone":"fun"},{"when":"Dad week","what":"\ud83e\ude93 Keep your hotbar full (do your quests)","hint":"FUN mission","tone":"fun"}]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"\u25ce","label":"Victory Coins"},"bankGoal":{"id":"victory-umbrella","title":"Unlock your Victory Umbrella","blurb":"Clear challenges. Bank coins. Fill the storm meter \u2014 umbrella drop when you hit the goal.","need":10,"reward":"victory umbrella drop"},"hottest":{"when":"SAT DROP \u00b7 Chat & Chew 9:00 \u00b7 FLAG 2:45","what":"YOUR BIG SATURDAY LOADOUT","where":"Home locked \u2192 then Indian Hills MS \u00b7 go legendary","badges":["LOCKED IN","FLAG DROP"]},"today":[{"kind":"event","when":"9:00 LOCKED","what":"\ud83c\udfa4 Chat & Chew @ home \u2014 YOU'RE IN","hint":"Locked. Locked. Locked.","tone":"hot"},{"kind":"event","when":"Leave ~2:10 \u00b7 game 2:45","what":"\ud83c\udfc1 FLAG DROP \u00b7 Indian Hills MS","hint":"6400 Mission Rd \u00b7 clutch up","tone":"sport"},{"kind":"event","when":"After flag","what":"\ud83c\udfe0 Extract to base @ 147th","hint":"Victory snack pending","tone":"fun"}],"quests":[{"id":"hay-bed","what":"\ud83d\udecf\ufe0f Make bed \u2014 pre-game ritual","stars":1},{"id":"hay-dishes","what":"\ud83c\udf7d\ufe0f Dishes \u2014 wipe the lobby","stars":1},{"id":"hay-trash","what":"\ud83d\uddd1\ufe0f Trash out \u2014 zone clear","stars":1},{"id":"hay-backpack","what":"\ud83c\udf92 Backpack \u2014 loadout ready","stars":1}],"sports":[{"when":"Sat 26 \u00b7 leave ~2:10 \u00b7 game 2:45","what":"\ud83c\udfc1 FLAG \u00b7 Indian Hills MS","hint":"YOUR drop","tone":"hot"},{"when":"Mon 28 \u00b7 leave ~5:40 \u00b7 game 6:15","what":"\u26be BASEBALL \u00b7 BV Rec Field 3","hint":"next challenge","tone":"sport"}],"school":[{"when":"Sat \u00b7 9:00","what":"Chat & Chew \u2014 LOCKED","hint":"don't miss","tone":"hot"},{"when":"Mon \u00b7 7:30","what":"\ud83c\udf4e Snacks in the bag","tone":"act"},{"when":"Mon \u00b7 SRE drop","what":"\ud83c\udfeb School drop with the boys","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 DROP ZONE HQ @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"After clears","what":"\ud83d\udc51 Victory round \u2014 game pick with Dad","hint":"spend coins toward UMBRELLA","tone":"fun"},{"when":"Outside","what":"\u26a1 Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"\u2602\ufe0f Storm meter \u2192 Victory Umbrella","hint":"FUN challenge \u00b7 bank those coins","tone":"fun"},{"when":"Squad","what":"\ud83e\udd1d Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","streakLabel":"\ud83d\udd25 6-day fire streak \u2014 don't break it","missions":[{"when":"Every clear","what":"\ud83d\udca5 Elimination = quest done sound","hint":"FUN","tone":"fun"},{"when":"Goal","what":"\ud83c\udfc6 Hit 10 coins = VICTORY ROYALE unlock ask","hint":"FUN","tone":"fun"}]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"eras-stage","themeLabel":"Eras Stage","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"\u2605","label":"Encore Stars"},"bankGoal":{"id":"encore-merch-jar","title":"Fill your Encore Merch Jar","blurb":"Finish your setlist quests. Bank stars. When the jar hits the goal \u2014 treat / merch pick with Dad.","need":12,"reward":"encore merch / treat pick"},"hottest":{"when":"SUN \u00b7 vanity 3:00 \u00b7 Jessy","what":"YOUR FEATURED SUNDAY \u2728","where":"Stage lights on YOU \u00b7 with Dad @ 147th","badges":["HEADLINER","SUNDAY"]},"today":[{"kind":"note","when":"Sat \u00b7 house day","what":"\ud83d\udecb\ufe0f Soft day with the crew \u2014 rest voice","hint":"Tomorrow you're the headliner","tone":"quiet"},{"kind":"event","when":"Anytime today","what":"\ud83c\udfa7 Playlist warm-up in your room","hint":"FUN \u00b7 vibe check","tone":"fun"}],"quests":[{"id":"ain-bed","what":"\ud83d\udecf\ufe0f Make bed \u2014 stage reset","stars":1},{"id":"ain-backpack","what":"\ud83c\udf92 Backpack ready \u2014 tour bag","stars":1},{"id":"ain-toys","what":"\ud83e\uddf9 Room reset \u2014 glam zone","stars":1},{"id":"ain-table","what":"\ud83c\udf7d\ufe0f Table help \u2014 crew catering","stars":1}],"sports":[],"sportsEmpty":"No swim on the board this weekend \u2014 more stage time \ud83c\udfa4","school":[{"when":"Sun 27 \u00b7 9\u20132","what":"\ud83c\udfe0 Garage sale / house shake with crew","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"\ud83d\udcda LKMS Homework Help \u2014 you got this","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 YOUR STAGE BASE @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"Sun after vanity","what":"\ud83c\udfb6 Playlist + chill pick with Dad","hint":"your call","tone":"fun"},{"when":"Creative hour","what":"\u2728 Room vibe / journal / draw","hint":"earn stars \u2192 merch jar","tone":"fun"},{"when":"Base mission","what":"\u2b50 Fill the Encore Jar \u2014 treat unlock","hint":"FUN setlist goal","tone":"fun"},{"when":"Famous feels","what":"\ud83d\udcf8 Mirror check \u00b7 main character energy","hint":"FUN \u00b7 keep it clean & kind","tone":"fun"}],"appointments":[{"when":"Sun 27 \u00b7 3:00","what":"\ud83d\udc85 Vanity \u00b7 Jessy \u2014 YOU'RE THE MOMENT","hint":"on your board","tone":"hot"}],"appointmentsEmpty":"","streakLabel":"\ud83d\udc9c 4-day encore streak \u2014 don't drop the mic","missions":[{"when":"Every tap","what":"\ud83c\udf1f Track clear = sparkle rain","hint":"FUN","tone":"fun"},{"when":"Goal","what":"\ud83d\udcbf 12 stars = encore merch / treat ask Dad","hint":"FUN","tone":"fun"}]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sat Sep 26 \u00b7 kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 \u00b7 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sat \u00b7 Harris flag","what":"Leave 7:55 \u00b7 Heritage Park F10 \u00b7 Harris game 8:30","tone":"hot"},{"when":"Sat \u00b7 Hayes Chat & Chew","what":"9:00 LOCKED @ home \u00b7 Hayes enrolled","tone":"hot"},{"when":"Sat \u00b7 Hayes flag","what":"Leave ~2:10 \u00b7 Indian Hills MS \u00b7 game 2:45","tone":"sport"}],"week":[{"when":"Sun 27 \u00b7 9\u20132","what":"Garage sale / house shake @ 147th","tone":"act"},{"when":"Sun 27 \u00b7 3:00","what":"Ainsley vanity \u00b7 Jessy","tone":"act"},{"when":"Mon 28 \u00b7 8:10 / 8:25","what":"SRE drop \u00b7 Hayes + Harris","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 \u00b7 ~5:40 / 6:15","what":"Hayes baseball \u00b7 BV Rec Field 3","tone":"sport"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House \u00b7 kids-safe","tone":"fun"},{"when":"Weekend","what":"Outside + sports weekends","hint":"Harris AM \u00b7 Hayes PM Sat","tone":"fun"}],"note":"Kids-safe Dad box \u00b7 no money \u00b7 no Desk \u00b7 calendar facts from House / Atlas only"}}};

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadJSON(cb) {
    var urls = ["kids-week.json", "data/kids-week.json"];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        if (EMBEDDED) { cb(null, EMBEDDED); return; }
        cb(new Error("kids-week.json missing"), null);
        return;
      }
      var u = urls[i++];
      if (typeof fetch !== "function") { tryNext(); return; }
      fetch(u, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          EMBEDDED = data;
          cb(null, data);
        })
        .catch(function () { tryNext(); });
    }
    if (EMBEDDED) {
      cb(null, EMBEDDED);
      if (typeof fetch === "function") {
        fetch(urls[0], { cache: "no-store" }).then(function(r){return r.ok?r.json():Promise.reject();}).then(function(d){EMBEDDED=d;}).catch(function(){});
      }
      return;
    }
    tryNext();
  }

  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveChecks(state) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch (e) { /* */ }
  }

  function loadBankRoot() {
    try { return JSON.parse(localStorage.getItem(BANK_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveBankRoot(root) {
    try { localStorage.setItem(BANK_KEY, JSON.stringify(root)); } catch (e) { /* */ }
  }

  function kidDayBank(kidId) {
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0 };
    if (!root[kidId].days[DAY_ISO]) root[kidId].days[DAY_ISO] = { stars: 0, earned: {} };
    return { root: root, day: root[kidId].days[DAY_ISO], bag: root[kidId] };
  }

  function questStarsFor(kidId, checkId, data) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !kid.quests) return 1;
    for (var i = 0; i < kid.quests.length; i++) {
      if (kid.quests[i].id === checkId) return kid.quests[i].stars || 1;
    }
    return 1;
  }

  function applyCheckToBank(checkId, done, data) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return null;
    var pack = kidDayBank(kidId);
    var stars = questStarsFor(kidId, checkId, data);
    var was = !!pack.day.earned[checkId];
    if (done && !was) {
      pack.day.earned[checkId] = true;
      pack.day.stars += stars;
      pack.bag.lifetime = (pack.bag.lifetime || 0) + stars;
    } else if (!done && was) {
      pack.day.earned[checkId] = false;
      pack.day.stars = Math.max(0, pack.day.stars - stars);
      pack.bag.lifetime = Math.max(0, (pack.bag.lifetime || 0) - stars);
    }
    // recompute day stars from earned map for safety
    var sum = 0;
    Object.keys(pack.day.earned).forEach(function (k) {
      if (pack.day.earned[k]) sum += questStarsFor(kidId, k, data);
    });
    pack.day.stars = sum;
    saveBankRoot(pack.root);
    return getBankView(kidId, data);
  }

  function getBankView(kidId, data) {
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || { need: 8, title: "Goal", blurb: "", reward: "" };
    var cur = kid.currency || { plural: "stars", symbol: "★", label: "Stars" };
    var today = pack.day.stars || 0;
    var life = pack.bag.lifetime || 0;
    // goal meter uses lifetime toward need (tangible jar), capped display
    var toward = Math.min(life, goal.need);
    var pct = goal.need ? Math.round((toward / goal.need) * 100) : 0;
    return {
      kidId: kidId,
      today: today,
      lifetime: life,
      need: goal.need,
      toward: toward,
      pct: Math.min(100, pct),
      reached: life >= goal.need,
      goalTitle: goal.title,
      goalBlurb: goal.blurb,
      reward: goal.reward,
      currency: cur,
      dayIso: DAY_ISO,
      earned: Object.assign({}, pack.day.earned)
    };
  }

  function setCheck(checkId, done, data) {
    var state = loadChecks();
    state[checkId] = !!done;
    saveChecks(state);
    var kidId = KID_FROM_CHECK[checkId];
    var before = kidId ? getBankView(kidId, data) : null;
    var was = before ? before.reached : false;
    var bank = applyCheckToBank(checkId, !!done, data);
    if (bank && bank.reached && !was) {
      try { localStorage.setItem("house-bank-goal:" + bank.kidId, "1"); } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: bank.kidId, reward: bank.reward, bank: bank } }));
      } catch (e) {}
    }
    return bank;
  }

  function getCheck(checkId) {
    var state = loadChecks();
    return !!state[checkId];
  }

  function syncBankFromChecks(data) {
    Object.keys(KID_FROM_CHECK).forEach(function (id) {
      applyCheckToBank(id, getCheck(id), data);
    });
  }

  function cardHTML(item) {
    var tone = item.tone || "act";
    var cls = "card " + tone;
    if (item.compact) cls += " compact";
    var html = '<div class="' + cls + '">';
    if (item.when) html += '<div class="when">' + esc(item.when) + "</div>";
    if (item.what) html += '<div class="what">' + esc(item.what) + "</div>";
    if (item.hint) html += '<div class="hint">' + esc(item.hint) + "</div>";
    html += "</div>";
    return html;
  }

  function quietHTML(msg) {
    return '<div class="card quiet">' + esc(msg) + "</div>";
  }

  function questHTML(q, done) {
    var open = done ? "done" : "open";
    var ring = done ? "✓" : "";
    var hint = done ? "done · nice!" : "tap when done · ★ " + (q.stars || 1);
    return (
      '<div class="quest ' + open + '" data-check="' + esc(q.id) + '" data-kid-quest="1" role="button" tabindex="0">' +
      '<span class="ring">' + ring + "</span>" +
      "<div><div class=\"what\">" + esc(q.what) + '</div><div class="hint">' + esc(hint) + "</div></div>" +
      '<span class="star-earn">' + (done ? "★ +" + (q.stars || 1) : "★ " + (q.stars || 1)) + "</span>" +
      "</div>"
    );
  }

  function renderList(el, items, emptyMsg) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = quietHTML(emptyMsg || "none on your board yet");
      return;
    }
    el.innerHTML = items.map(cardHTML).join("");
  }

  function renderQuests(el, quests, data) {
    if (!el) return;
    var state = loadChecks();
    el.innerHTML = (quests || []).map(function (q) {
      return questHTML(q, !!state[q.id]);
    }).join("");
  }

  function renderBank(root, bank) {
    if (!root || !bank) return;
    var sym = bank.currency.symbol || "★";
    var plural = bank.currency.plural || "stars";
    root.querySelectorAll("[data-bank-today]").forEach(function (el) {
      el.textContent = String(bank.today);
    });
    root.querySelectorAll("[data-bank-life]").forEach(function (el) {
      el.textContent = String(bank.lifetime);
    });
    root.querySelectorAll("[data-bank-need]").forEach(function (el) {
      el.textContent = String(bank.need);
    });
    root.querySelectorAll("[data-bank-toward]").forEach(function (el) {
      el.textContent = String(bank.toward);
    });
    root.querySelectorAll("[data-bank-pct]").forEach(function (el) {
      el.textContent = bank.pct + "%";
    });
    root.querySelectorAll("[data-bank-fill]").forEach(function (el) {
      el.style.width = bank.pct + "%";
      el.classList.toggle("is-full", bank.reached);
    });
    root.querySelectorAll("[data-bank-goal-title]").forEach(function (el) {
      el.textContent = bank.goalTitle;
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      el.textContent = bank.goalBlurb;
    });
    root.querySelectorAll("[data-bank-reward]").forEach(function (el) {
      el.textContent = bank.reward;
    });
    root.querySelectorAll("[data-bank-unit]").forEach(function (el) {
      el.textContent = plural;
    });
    root.querySelectorAll("[data-bank-symbol]").forEach(function (el) {
      el.textContent = sym;
    });
    root.querySelectorAll("[data-bank-meta]").forEach(function (el) {
      el.textContent = bank.toward + " / " + bank.need + " " + plural + (bank.reached ? " · UNLOCKED" : " to go");
    });
    document.body.classList.toggle("bank-goal-hit", !!bank.reached);
  }

  function renderKidPage(kidId, data) {
    var kid = data.kids[kidId];
    if (!kid) return;
    syncBankFromChecks(data);
    var bank = getBankView(kidId, data);

    var hotTitle = document.querySelector("[data-hot-title]");
    if (hotTitle && kid.hottest) hotTitle.innerHTML = esc(kid.hottest.when).replace(/(\d+:\d+|Leave\s+\d+:\d+)/g, function (m) {
      return '<span class="hl">' + m + "</span>";
    });
    // simpler: just set text with hl on numbers already in template — overwrite text
    if (hotTitle && kid.hottest) {
      hotTitle.textContent = "";
      hotTitle.innerHTML = esc(kid.hottest.when);
    }
    var hotSub = document.querySelector("[data-hot-sub]");
    if (hotSub && kid.hottest) {
      hotSub.innerHTML = "<strong>" + esc(kid.hottest.what) + "</strong> · " + esc(kid.hottest.where || "");
    }
    var hotPill = document.querySelector("[data-hot-pill]");
    if (hotPill && kid.hottest) {
      hotPill.innerHTML = '<span class="spark">◆</span> ' + esc(kid.hottest.what) + " · " + esc((kid.hottest.when || "").split("·")[0].trim());
    }

    renderList(document.querySelector("[data-mount-today-events]"), kid.today, "easy day · your quests below");
    renderQuests(document.querySelector("[data-mount-quests]"), kid.quests, data);
    renderList(document.querySelector("[data-mount-sports]"), kid.sports, kid.sportsEmpty || "no sports on your board right now");
    renderList(document.querySelector("[data-mount-school]"), kid.school, "school bits show up when known");
    renderList(document.querySelector("[data-mount-fun]"), kid.fun, "fun picks land here");
    renderList(document.querySelector("[data-mount-appointments]"), kid.appointments, kid.appointmentsEmpty || "none on your board · quiet is good");
    renderList(document.querySelector("[data-mount-missions]"), kid.missions || kid.fun, "bonus missions land here");

    var streak = document.querySelector("[data-streak-label]");
    if (streak && kid.streakLabel) streak.textContent = kid.streakLabel;

    var prevReached = false;
    try { prevReached = localStorage.getItem("house-bank-goal:" + kidId) === "1"; } catch (e) {}
    renderBank(document, bank);
    if (bank.reached) {
      try { localStorage.setItem("house-bank-goal:" + kidId, "1"); } catch (e) {}
      document.body.classList.add("bank-goal-hit");
      var unlock = document.querySelector("[data-goal-unlock]");
      if (unlock) {
        unlock.hidden = false;
        unlock.textContent = "UNLOCKED · ask Dad · " + (bank.reward || "your reward");
      }
      if (!prevReached) {
        try {
          document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: kidId, reward: bank.reward, bank: bank } }));
        } catch (e) {}
      }
    } else {
      var unlock2 = document.querySelector("[data-goal-unlock]");
      if (unlock2) unlock2.hidden = true;
    }

    try {
      document.dispatchEvent(new CustomEvent("house:kid-rendered", { detail: { kidId: kidId, bank: bank } }));
    } catch (e) { /* */ }
  }

  function renderDanPage(data) {
    var dan = data.kids.dan;
    if (!dan) return;
    renderList(document.querySelector("[data-mount-dan-today]"), dan.today, "quiet day");
    renderList(document.querySelector("[data-mount-dan-week]"), dan.week, "week fills from Atlas");
    renderList(document.querySelector("[data-mount-dan-leave]"), dan.leaveBys, "leave-bys when known");
    renderList(document.querySelector("[data-mount-dan-picks]"), dan.picks, "picks later");
  }

  function boot(kidId) {
    loadJSON(function (err, data) {
      if (err || !data) {
        console.warn("[kids-data]", err);
        return;
      }
      global.WardKids._data = data;
      if (kidId === "dan") renderDanPage(data);
      else if (kidId) renderKidPage(kidId, data);
      try {
        document.dispatchEvent(new CustomEvent("house:kids-data-ready", { detail: { kidId: kidId, data: data } }));
      } catch (e) { /* */ }
    });
  }

  global.WardKids = {
    DAY_ISO: DAY_ISO,
    CHECK_KEY: CHECK_KEY,
    BANK_KEY: BANK_KEY,
    KID_FROM_CHECK: KID_FROM_CHECK,
    loadChecks: loadChecks,
    saveChecks: saveChecks,
    getCheck: getCheck,
    setCheck: setCheck,
    getBankView: getBankView,
    applyCheckToBank: applyCheckToBank,
    syncBankFromChecks: syncBankFromChecks,
    renderBank: renderBank,
    renderKidPage: renderKidPage,
    boot: boot,
    loadJSON: loadJSON,
    _data: null
  };
})(window);
