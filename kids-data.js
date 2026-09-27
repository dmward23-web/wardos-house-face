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
    "ain-bath": "ainsley", "ain-laundry": "ainsley",
    "hay-bed": "hayes", "hay-dishes": "hayes", "hay-trash": "hayes", "hay-backpack": "hayes",
    "hay-gear": "hayes", "hay-room": "hayes",
    "har-bed": "harris", "har-dishes": "harris", "har-trash": "harris", "har-backpack": "harris",
    "har-toys": "harris", "har-shoes": "harris"
  };

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Sun Sep 27 2026","asOfIso":"2026-09-27","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 · 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"◆","label":"Gems"},"bankGoal":{"id":"gem-jar","title":"Fill the Gem Jar","blurb":"Clear your musts. Stack gems into the jar. Hit the fill line — then allowance payday with Dad. Craft unlock is optional secondary.","need":8,"reward":"allowance payday with Dad"},"hottest":{"when":"SAT · Leave 7:55 · GAME 8:30","what":"YOUR FLAG GAME!!!","where":"Heritage Park Field 10 · smash it with Dad","badges":["FLAG TIME","GO GO GO"]},"today":[{"kind":"event","when":"Leave 7:55 · game 8:30","what":"🏃 FLAG GAME — Heritage Park F10","hint":"Get your cleats. Be a beast.","tone":"hot"},{"kind":"event","when":"After the game","what":"🏠 Back to YOUR base @ 147th","hint":"Snack + block time if quests clear","tone":"fun"}],"quests":[{"id":"har-bed","what":"🛏️ Make your bed (block rebuild) — daily must","stars":1,"cadence":"daily"},{"id":"har-dishes","what":"🍽️ Dishes helper (mining duty) — daily must","stars":1,"cadence":"daily"},{"id":"har-trash","what":"🗑️ Trash out (clear the cave) — daily must","stars":1,"cadence":"daily"},{"id":"har-backpack","what":"🎒 Pack backpack (loot ready) — daily must","stars":1,"cadence":"daily"},{"id":"har-toys","what":"🧸 Toys reset — weekly must","stars":2,"cadence":"weekly"},{"id":"har-shoes","what":"👟 Shoes by door — weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Sat 26 · leave 7:55 · game 8:30","what":"⚡ FLAG · Heritage Park F10","hint":"YOUR game · with Dad","tone":"hot"}],"school":[{"when":"Mon 28 · leave ~8:10","what":"🏫 SRE drop — you're on the crew","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"🚌 Boys pickup · squad ride","tone":"act"},{"when":"All week","what":"🏡 YOUR BASE @ 147th with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"fun":[{"when":"Quest reward","what":"🧱 BLOCK BUILD TIME","hint":"gems → jar → payday · craft optional","tone":"fun"},{"when":"Outside","what":"🌳 Backyard boss fight (play)","hint":"ask Dad · run wild","tone":"fun"},{"when":"Tonight","what":"🍪 Snack chest raid","hint":"after quests · with Dad","tone":"fun"},{"when":"Base mission","what":"💎 Fill the Gem Jar — allowance payday with Dad","hint":"FUN · craft unlock optional","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No doctor stuff on your board — lucky!!! More play time.","streakLabel":"🔥 3-day craft streak — keep smashing","missions":[{"when":"Anytime","what":"🔥 Musts clear = gems in the jar","hint":"FUN mission","tone":"fun"},{"when":"Goal","what":"💎 Fill jar (8) = allowance payday with Dad","hint":"FUN · miss = payday held","tone":"fun"},{"when":"Weekly","what":"🧸 Toys reset + 👟 shoes by door","hint":"musts · ask Dad to inspect","tone":"fun"}]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"◎","label":"Victory Coins"},"bankGoal":{"id":"victory-jar","title":"Fill the Victory Jar","blurb":"Clear your musts. Bank Victory Coins into the jar. Hit the fill line — then allowance payday with Dad. Umbrella treat is optional secondary.","need":12,"reward":"allowance payday with Dad"},"hottest":{"when":"SAT DROP · Chat & Chew 9:00 · FLAG 2:45","what":"YOUR BIG SATURDAY LOADOUT","where":"Home locked → then Indian Hills MS · go legendary","badges":["LOCKED IN","FLAG DROP"]},"today":[{"kind":"event","when":"9:00 LOCKED","what":"🎤 Chat & Chew @ home — YOU'RE IN","hint":"Locked. Locked. Locked.","tone":"hot"},{"kind":"event","when":"Leave ~2:10 · game 2:45","what":"🏁 FLAG DROP · Indian Hills MS","hint":"6400 Mission Rd · clutch up","tone":"sport"},{"kind":"event","when":"After flag","what":"🏠 Extract to base @ 147th","hint":"Victory snack pending","tone":"fun"}],"quests":[{"id":"hay-bed","what":"🛏️ Make bed — pre-game ritual (daily must)","stars":1,"cadence":"daily"},{"id":"hay-dishes","what":"🍽️ Dishes — wipe the lobby (daily must)","stars":1,"cadence":"daily"},{"id":"hay-trash","what":"🗑️ Trash out — zone clear (daily must)","stars":1,"cadence":"daily"},{"id":"hay-backpack","what":"🎒 Backpack — loadout ready (daily must)","stars":1,"cadence":"daily"},{"id":"hay-gear","what":"⚽ Sports bag / cleats ready — weekly must","stars":2,"cadence":"weekly"},{"id":"hay-room","what":"🧹 Room reset — weekly must","stars":2,"cadence":"weekly"}],"sports":[{"when":"Sat 26 · leave ~2:10 · game 2:45","what":"🏁 FLAG · Indian Hills MS","hint":"YOUR drop","tone":"hot"},{"when":"Mon 28 · leave ~5:40 · game 6:15","what":"⚾ BASEBALL · BV Rec Field 3","hint":"next challenge","tone":"sport"}],"school":[{"when":"Sat · 9:00","what":"Chat & Chew — LOCKED","hint":"don't miss","tone":"hot"},{"when":"Mon · 7:30","what":"🍎 Snacks in the bag","tone":"act"},{"when":"Mon · SRE drop","what":"🏫 School drop with the boys","tone":"act"},{"when":"All week","what":"🏡 DROP ZONE HQ @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"After clears","what":"👑 Victory round — game pick with Dad","hint":"coins → jar → payday","tone":"fun"},{"when":"Outside","what":"⚡ Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"☂️ Fill the Victory Jar — allowance payday with Dad","hint":"FUN · umbrella treat optional","tone":"fun"},{"when":"Squad","what":"🤝 Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","streakLabel":"🔥 6-day fire streak — don't break it","missions":[{"when":"Every clear","what":"💥 Must done = coin banked in the jar","hint":"FUN","tone":"fun"},{"when":"Goal","what":"🏆 Fill jar (12) = allowance payday with Dad","hint":"FUN · miss = payday held","tone":"fun"},{"when":"Weekly","what":"⚽ Gear ready + 🧹 room reset = bonus coins","hint":"musts · ask Dad to inspect","tone":"fun"}]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"eras-stage","themeLabel":"Eras Stage","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"★","label":"Tour Stars"},"bankGoal":{"id":"tour-jar","title":"Fill the Tour Jar","blurb":"Clear your musts. Bank Tour Stars into the jar. Hit the fill line — then allowance payday with Dad. Treat is optional secondary.","need":20,"reward":"allowance payday with Dad"},"hottest":{"when":"SUN · vanity 3:00 · Jessy","what":"FEATURED · SUNDAY","where":"Vanity 3:00 · with Dad @ 147th","badges":["FEATURED","SUNDAY"]},"today":[{"kind":"note","when":"Sat · house day","what":"🛋️ House day — keep it easy","hint":"Sunday vanity is on the board","tone":"quiet"},{"kind":"event","when":"Anytime today","what":"🎧 Playlist in your room","hint":"FUN · your pick","tone":"fun"}],"quests":[{"id":"ain-bed","what":"🛏️ Make bed — stage reset (daily must)","stars":1,"cadence":"daily"},{"id":"ain-toys","what":"🧹 Room reset — clean pass (daily must)","stars":1,"cadence":"daily"},{"id":"ain-backpack","what":"🎒 Backpack ready — school nights (daily must)","stars":1,"cadence":"daily"},{"id":"ain-table","what":"🍽️ Kitchen help OR table (daily must)","stars":1,"cadence":"daily"},{"id":"ain-bath","what":"🛁 Bathroom wipe — weekly must","stars":3,"cadence":"weekly"},{"id":"ain-laundry","what":"👕 Laundry full cycle — her clothes (weekly must)","stars":4,"cadence":"weekly"}],"sports":[],"sportsEmpty":"No swim on the board this weekend — open set","school":[{"when":"Sun 27 · 9–2","what":"🏠 Garage sale / house shake with crew","tone":"act"},{"when":"Mon 28 · 3:00","what":"📚 LKMS Homework Help","tone":"act"},{"when":"All week","what":"🏡 Base @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"Sun after vanity","what":"🎶 Playlist + chill with Dad","hint":"your call","tone":"fun"},{"when":"Creative hour","what":"✏️ Journal / draw / room setup","hint":"earn stars → Tour Jar → payday","tone":"fun"},{"when":"Base mission","what":"★ Fill the Tour Jar — allowance payday with Dad","hint":"FUN setlist goal · treat optional","tone":"fun"},{"when":"Downtime","what":"🌙 Quiet hour · headphones on","hint":"FUN · keep it sharp","tone":"fun"}],"appointments":[{"when":"Sun 27 · 3:00","what":"💅 Vanity · Jessy","hint":"on your board","tone":"hot"}],"appointmentsEmpty":"","streakLabel":"◆ 4-day set streak — hold the line","missions":[{"when":"Every tap","what":"★ Must clear = star banked in the jar","hint":"FUN","tone":"fun"},{"when":"Goal","what":"★ Fill jar (20) = allowance payday with Dad","hint":"FUN · miss = payday held","tone":"fun"},{"when":"Weekly","what":"🛁 Bath wipe + 👕 laundry cycle = big star dump","hint":"musts · ask Dad to inspect","tone":"fun"}]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sat Sep 26 · kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 · 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sat · Harris flag","what":"Leave 7:55 · Heritage Park F10 · Harris game 8:30","tone":"hot"},{"when":"Sat · Hayes Chat & Chew","what":"9:00 LOCKED @ home · Hayes enrolled","tone":"hot"},{"when":"Sat · Hayes flag","what":"Leave ~2:10 · Indian Hills MS · game 2:45","tone":"sport"}],"week":[{"when":"Sun 27 · 9–2","what":"Garage sale / house shake @ 147th","tone":"act"},{"when":"Sun 27 · 3:00","what":"Ainsley vanity · Jessy","tone":"act"},{"when":"Mon 28 · 8:10 / 8:25","what":"SRE drop · Hayes + Harris","tone":"act"},{"when":"Mon 28 · 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 · ~5:40 / 6:15","what":"Hayes baseball · BV Rec Field 3","tone":"sport"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House · kids-safe","tone":"fun"},{"when":"Weekend","what":"Outside + sports weekends","hint":"Harris AM · Hayes PM Sat","tone":"fun"}],"note":"Kids-safe Dad box · no money · no Desk · calendar facts from House / Atlas only"}}};

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
