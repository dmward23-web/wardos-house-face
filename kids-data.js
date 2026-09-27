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
  var EMBEDDED = {"asOf":"Sat Sep 26 2026","asOfIso":"2026-09-26","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 \u00b7 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"\u25c6","label":"Gems"},"bankGoal":{"id":"craft-diamond-pick","title":"Craft your Diamond Pick","blurb":"Stack gems from your quests. Fill the craft bar \u2014 then unlock screen-time craft time.","need":8,"reward":"screen-time craft unlock"},"hottest":{"when":"Sat Sep 26 \u00b7 Leave 7:55 \u00b7 game 8:30","what":"Your flag game","where":"Heritage Park Field 10 \u00b7 17255 S Black Bob Rd, Olathe","badges":["Flag","Leave now"]},"today":[{"kind":"event","when":"Leave 7:55 \u00b7 game 8:30","what":"Your flag game \u00b7 Heritage Park F10","hint":"17255 S Black Bob Rd, Olathe","tone":"hot"}],"quests":[{"id":"har-bed","what":"Make your bed","stars":1},{"id":"har-dishes","what":"Help with dishes","stars":1},{"id":"har-trash","what":"Take out trash","stars":1},{"id":"har-backpack","what":"Pack your backpack","stars":1}],"sports":[{"when":"Sat 26 \u00b7 leave 7:55 \u00b7 game 8:30","what":"Flag \u00b7 Heritage Park F10","hint":"with Dad","tone":"hot"}],"school":[{"when":"Mon 28 \u00b7 leave ~8:10 \u00b7 drop 8:25","what":"Your SRE drop \u00b7 Sunset Ridge","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"Boys pickup \u00b7 you're in the crew","tone":"act"},{"when":"through Fri Oct 2 3:00","what":"With Dad @ 147th \u00b7 your base","tone":"act"}],"fun":[{"when":"Anytime after quests","what":"Block build time","hint":"earn gems \u2192 craft unlock","tone":"fun"},{"when":"Dad week","what":"Outside play @ 147th","hint":"ask Dad","tone":"fun"}],"appointments":[],"appointmentsEmpty":"none on your board \u00b7 quiet is good","streakLabel":"3-day craft streak"},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"\u25ce","label":"Victory Coins"},"bankGoal":{"id":"victory-umbrella","title":"Unlock your Victory Umbrella","blurb":"Clear challenges. Bank coins. Fill the storm meter \u2014 umbrella drop when you hit the goal.","need":10,"reward":"victory umbrella drop"},"hottest":{"when":"Sat Sep 26 \u00b7 Chat & Chew 9:00 \u00b7 flag 2:45","what":"Your big Saturday drop","where":"Chat & Chew LOCKED @ home \u00b7 then Indian Hills MS 6400 Mission Rd","badges":["Chat & Chew","Flag"]},"today":[{"kind":"event","when":"9:00 LOCKED","what":"Your Chat & Chew @ home","hint":"you're enrolled \u00b7 locked in","tone":"hot"},{"kind":"event","when":"Leave ~2:10 \u00b7 game 2:45","what":"Your flag game \u00b7 Indian Hills MS","hint":"6400 Mission Rd","tone":"sport"}],"quests":[{"id":"hay-bed","what":"Make your bed","stars":1},{"id":"hay-dishes","what":"Dishes helper","stars":1},{"id":"hay-trash","what":"Trash out","stars":1},{"id":"hay-backpack","what":"Pack your backpack","stars":1}],"sports":[{"when":"Sat 26 \u00b7 leave ~2:10 \u00b7 game 2:45","what":"Flag \u00b7 Indian Hills MS","hint":"6400 Mission Rd \u00b7 with Dad","tone":"hot"},{"when":"Mon 28 \u00b7 leave ~5:40 \u00b7 game 6:15","what":"Baseball \u00b7 BV Rec Field 3","hint":"on your board \u00b7 known","tone":"sport"}],"school":[{"when":"Sat Sep 26 \u00b7 9:00","what":"Chat & Chew @ home","hint":"LOCKED","tone":"hot"},{"when":"Mon 28 \u00b7 7:30","what":"Snacks ready","tone":"act"},{"when":"Mon 28 \u00b7 leave ~8:10 \u00b7 drop 8:25","what":"Your SRE drop","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"through Fri Oct 2 3:00","what":"With Dad @ 147th \u00b7 Drop Zone HQ","tone":"act"}],"fun":[{"when":"After challenges clear","what":"Victory round \u00b7 game pick with Dad","hint":"spend coins toward umbrella","tone":"fun"},{"when":"Dad week","what":"Outside + sports grind","hint":"ask Dad","tone":"fun"}],"appointments":[],"appointmentsEmpty":"no appointments on your board \u00b7 clear skies","streakLabel":"6-day fire streak"},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"eras-stage","themeLabel":"Eras Stage","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"\u2605","label":"Encore Stars"},"bankGoal":{"id":"encore-merch-jar","title":"Fill your Encore Merch Jar","blurb":"Finish your setlist quests. Bank stars. When the jar hits the goal \u2014 treat / merch pick with Dad.","need":12,"reward":"encore merch / treat pick"},"hottest":{"when":"Sun Sep 27 \u00b7 vanity 3:00 \u00b7 Jessy","what":"Your featured Sunday","where":"With Dad @ 147th \u00b7 through Fri Oct 2 3:00","badges":["Vanity","Sun"]},"today":[{"kind":"note","when":"Sat \u00b7 house day","what":"House day with the crew \u00b7 no solo leave","hint":"your rest beat before Sunday","tone":"quiet"}],"quests":[{"id":"ain-bed","what":"Make your bed","stars":1},{"id":"ain-backpack","what":"Backpack ready","stars":1},{"id":"ain-toys","what":"Toys / room reset","stars":1},{"id":"ain-table","what":"Help clear / set table","stars":1}],"sports":[],"sportsEmpty":"no sports on your board this weekend \u00b7 swim returns when calendar posts","school":[{"when":"Sun 27 \u00b7 9\u20132","what":"Garage sale / house shake @ 147th","hint":"with the crew","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"Your LKMS Homework Help","tone":"act"},{"when":"through Fri Oct 2 3:00","what":"With Dad @ 147th \u00b7 your stage base","tone":"act"}],"fun":[{"when":"Sun after vanity","what":"Playlist + chill pick","hint":"your call with Dad","tone":"fun"},{"when":"Dad week","what":"Room vibe / creative hour","hint":"earn stars \u2192 merch jar","tone":"fun"}],"appointments":[{"when":"Sun 27 \u00b7 3:00","what":"Vanity \u00b7 Jessy","hint":"on your board \u00b7 known","tone":"hot"}],"appointmentsEmpty":"","streakLabel":"4-day encore streak"},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sat Sep 26 \u00b7 kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 \u00b7 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sat \u00b7 Harris flag","what":"Leave 7:55 \u00b7 Heritage Park F10 \u00b7 Harris game 8:30","tone":"hot"},{"when":"Sat \u00b7 Hayes Chat & Chew","what":"9:00 LOCKED @ home \u00b7 Hayes enrolled","tone":"hot"},{"when":"Sat \u00b7 Hayes flag","what":"Leave ~2:10 \u00b7 Indian Hills MS \u00b7 game 2:45","tone":"sport"}],"week":[{"when":"Sun 27 \u00b7 9\u20132","what":"Garage sale / house shake @ 147th","tone":"act"},{"when":"Sun 27 \u00b7 3:00","what":"Ainsley vanity \u00b7 Jessy","tone":"act"},{"when":"Mon 28 \u00b7 8:10 / 8:25","what":"SRE drop \u00b7 Hayes + Harris","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 \u00b7 ~5:40 / 6:15","what":"Hayes baseball \u00b7 BV Rec Field 3","tone":"sport"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House \u00b7 kids-safe","tone":"fun"},{"when":"Weekend","what":"Outside + sports weekends","hint":"Harris AM \u00b7 Hayes PM Sat","tone":"fun"}],"note":"Kids-safe Dad box \u00b7 no money \u00b7 no Desk \u00b7 calendar facts from House / Atlas only"}}};

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
    return applyCheckToBank(checkId, !!done, data);
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

    var streak = document.querySelector("[data-streak-label]");
    if (streak && kid.streakLabel) streak.textContent = kid.streakLabel;

    renderBank(document, bank);

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
