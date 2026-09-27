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
    "ain-bed": "ainsley", "ain-toys": "ainsley",
    "ain-dishwasher": "ainsley", "ain-living": "ainsley",
    "ain-bath": "ainsley", "ain-laundry": "ainsley", "ain-cubby": "ainsley", "ain-babysit": "ainsley",
    "hay-bed": "hayes", "hay-dishes": "hayes", "hay-trash": "hayes", "hay-backpack": "hayes",
    "hay-shower": "hayes", "hay-room": "hayes", "hay-cubby": "hayes",
    "har-bed": "harris", "har-dishes": "harris", "har-trash": "harris", "har-backpack": "harris",
    "har-shower": "harris", "har-toys": "harris", "har-shoes": "harris", "har-cubby": "harris"
  };

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Sun Sep 27 2026","asOfIso":"2026-09-27","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 · 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"◆","label":"Gems"},"bankGoal":{"id":"gem-jar","title":"Gem Jar · earn then save","blurb":"Clear musts to earn up to $10/week with Dad (1★=$1). Miss musts = short or no full payday. Gem Jar $8 = save what you earned — not free money.","need":8,"reward":"Payday with Dad after honest musts","dollarNeed":8,"weeklyAllowance":10,"starDollar":1},"hottest":{"when":"SUN · base day @ 147th","what":"YOUR BASE WITH DAD","where":"Garage-sale crew morning · then play · through Fri Oct 2 3:00","badges":["DAD WEEK","147th"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"🏠 House shake / garage-sale crew @ 147th","hint":"Help Dad · then free play","tone":"act"},{"kind":"event","when":"Anytime today","what":"🧱 Block time if musts clear","hint":"gems → jar → payday","tone":"fun"},{"kind":"note","when":"All day","what":"🏡 YOUR BASE with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"har-bed","what":"🛏️ Make your bed (block rebuild) — daily must","stars":1,"cadence":"daily"},{"id":"har-dishes","what":"🍽️ Dishes helper (mining duty) — daily must","stars":1,"cadence":"daily"},{"id":"har-trash","what":"🗑️ Trash out (clear the cave) — daily must","stars":1,"cadence":"daily"},{"id":"har-backpack","what":"🎒 Pack backpack (loot ready) — daily must","stars":1,"cadence":"daily"},{"id":"har-shower","what":"🚿 Shower · brush · ready for bed","stars":1,"cadence":"daily"},{"id":"har-toys","what":"🧸 Toys reset — weekly must","stars":2,"cadence":"weekly"},{"id":"har-shoes","what":"👟 Shoes by door — weekly must","stars":1,"cadence":"weekly"},{"id":"har-cubby","what":"🎒 Backpack + sports bag in garage cubby — weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Wed 30 · leave ~4:55 · practice","what":"⚡ FLAG practice · Timber Sage grass","hint":"YOUR practice · with Dad","tone":"hot"}],"school":[{"when":"Mon 28 · leave ~8:10","what":"🏫 SRE drop — you're on the crew","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"🚌 Boys pickup · squad ride","tone":"act"},{"when":"Wed 30 · school day","what":"👂 Hearing / vision screen at SRE","hint":"awareness · normal school","tone":"act"},{"when":"Thu 1 · PE day","what":"👟 Tennis shoes for PE","tone":"act"},{"when":"Fri 2 · leave ~8:10","what":"🏫 SRE drop · then Mom week after 3:00","hint":"Dad handoff Fri 3:00","tone":"act"},{"when":"All week","what":"🏡 YOUR BASE @ 147th with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"fun":[{"when":"Quest reward","what":"🧱 BLOCK BUILD TIME","hint":"gems → jar → payday · craft optional","tone":"fun"},{"when":"Outside","what":"🌳 Backyard boss fight (play)","hint":"ask Dad · run wild","tone":"fun"},{"when":"Tonight","what":"🍪 Snack chest raid","hint":"after quests · with Dad","tone":"fun"},{"when":"Base mission","what":"💎 Gem Jar · save with Dad","hint":"FUN · craft unlock optional","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No doctor stuff on your board — lucky!!! More play time.","streakLabel":"🔥 3-day craft streak — keep smashing","missions":[{"when":"Anytime","what":"🔥 Musts clear = gems in the jar","hint":"earn path · skip = less payday","tone":"fun"},{"when":"Weekly","what":"🧸 Toys + 👟 shoes + 🎒 garage cubby","hint":"musts · ask Dad to inspect","tone":"fun"}]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"◎","label":"Victory Coins"},"bankGoal":{"id":"victory-jar","title":"Victory Jar · earn then save","blurb":"Clear musts to earn up to $10/week with Dad (1★=$1). Miss musts = short or no full payday. Victory Jar $12 = save what you earned — not free money.","need":12,"reward":"Payday with Dad after honest musts","dollarNeed":12,"weeklyAllowance":10,"starDollar":1},"hottest":{"when":"MON · leave ~5:40 · BASEBALL 6:15","what":"NEXT DROP · BV REC FIELD 3","where":"Sunday house day · then Mon baseball practice","badges":["LOCKED IN","BASEBALL"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"🏠 House shake / garage-sale loadout @ 147th","hint":"Help the crew · then free time","tone":"act"},{"kind":"event","when":"Anytime today","what":"⚡ Soft warm-up · yard run OK","hint":"ask Dad · Mon baseball next","tone":"fun"},{"kind":"note","when":"All day","what":"🏡 DROP ZONE HQ with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"hay-bed","what":"🛏️ Make bed — pre-game ritual (daily must)","stars":1,"cadence":"daily"},{"id":"hay-dishes","what":"🍽️ Dishes — wipe the lobby (daily must)","stars":1,"cadence":"daily"},{"id":"hay-trash","what":"🗑️ Trash out — zone clear (daily must)","stars":1,"cadence":"daily"},{"id":"hay-backpack","what":"🎒 Backpack — loadout ready (daily must)","stars":1,"cadence":"daily"},{"id":"hay-shower","what":"🚿 Shower · brush · ready for bed","stars":1,"cadence":"daily"},{"id":"hay-room","what":"🧹 Room reset — weekly must","stars":2,"cadence":"weekly"},{"id":"hay-cubby","what":"🎒 Backpack + sports bag in garage cubby — weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Mon 28 · leave ~5:40 · practice 6:15","what":"⚾ BASEBALL practice · BV Rec Field 3","hint":"YOUR next challenge","tone":"hot"},{"when":"Tue 29 · leave 5:40 · 6:00","what":"🏁 FLAG practice · SRE / library fields","hint":"friend drop ~4:30 lock pending","tone":"sport"},{"when":"Thu 1 · leave ~4:55 · game 5:30","what":"⚾ BASEBALL · Falcons vs Lions · Field 24","hint":"HOME game","tone":"hot"}],"school":[{"when":"Mon · 7:30","what":"🍎 Snacks in the bag","hint":"late-lunch · Madi OK","tone":"act"},{"when":"Mon · SRE drop","what":"🏫 School drop with the boys","tone":"act"},{"when":"Tue · 8:50","what":"🤝 Madi + provider collab at SRE","hint":"in person","tone":"act"},{"when":"Wed · school day","what":"👂 Hearing / vision screen at SRE","tone":"act"},{"when":"Thu · PE day","what":"👟 Tennis shoes for PE","tone":"act"},{"when":"Fri · field trip","what":"🚌 Museum + Meadowbrook (school day)","hint":"sack lunch · trip shirt · tennis shoes","tone":"act"},{"when":"All week","what":"🏡 DROP ZONE HQ @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"After clears","what":"👑 Victory round — game pick with Dad","hint":"coins → jar → payday","tone":"fun"},{"when":"Outside","what":"⚡ Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"☂️ Victory Jar · save with Dad","hint":"FUN · umbrella treat optional","tone":"fun"},{"when":"Squad","what":"🤝 Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","streakLabel":"🔥 6-day fire streak — don't break it","missions":[{"when":"Every clear","what":"💥 Must done = coin banked in the jar","hint":"earn path · skip = less payday","tone":"fun"},{"when":"Weekly","what":"🧹 Room + 🎒 garage cubby = bonus coins","hint":"musts · ask Dad to inspect","tone":"fun"}]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"quiet-folk","themeLabel":"Quiet Folk","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"★","label":"Tour Stars"},"bankGoal":{"id":"tour-jar","title":"Tour Jar · earn then save","blurb":"Clear musts to earn up to $20/week with Dad (1★=$1). Miss musts = short or no full payday. Jar $20 = save what you earned — not free money. Babysit $15/hr = hire add-on, not jar.","need":20,"reward":"Payday with Dad after honest musts","dollarNeed":20,"starDollar":1,"weeklyAllowance":20},"hottest":{"when":"SUN · vanity 3:00 · Jessy","what":"ON THE BOARD","where":"Vanity 3:00 · with Dad @ 147th","badges":["SUNDAY","3:00"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"Garage sale / house shake with crew","hint":"Help the crew","tone":"act"},{"kind":"event","when":"3:00 LOCKED","what":"Vanity install · Jessy","hint":"your board","tone":"hot"},{"kind":"event","when":"After vanity","what":"Playlist + chill with Dad","hint":"your pick","tone":"fun"}],"quests":[{"id":"ain-bed","what":"Make bed — morning reset","stars":1,"cadence":"daily"},{"id":"ain-toys","what":"Room reset — clean pass","stars":1,"cadence":"daily"},{"id":"ain-dishwasher","what":"Dishwasher load / unload","stars":1,"cadence":"daily"},{"id":"ain-living","what":"Living room · shoes & coats","stars":1,"cadence":"daily"},{"id":"ain-bath","what":"Bathroom wipe — weekly","stars":3,"cadence":"weekly"},{"id":"ain-laundry","what":"Laundry full cycle — her clothes","stars":5,"cadence":"weekly"},{"id":"ain-cubby","what":"🎒 Backpack + sports bag in garage cubby","stars":1,"cadence":"weekly"},{"id":"ain-babysit","what":"👶 Babysitting — optional hire (Dad books you)","stars":0,"cadence":"addon","optional":true,"hire":true,"hint":"not for jar · Dad handout","rateLabel":"$15/hr"}],"sports":[{"when":"Tue 29 · leave 4:25 · practice 5:00","what":"SWIM · Coach Ann · Genesis Ridgeview","hint":"YOUR set","tone":"hot"},{"when":"Thu 1 · leave 4:25 · practice 5:00","what":"SWIM · Coach Ann · Genesis Ridgeview","hint":"second set this week","tone":"sport"}],"sportsEmpty":"","school":[{"when":"Sun 27 · 9–2","what":"Garage sale / house shake with crew","tone":"act"},{"when":"Mon 28 · 3:00","what":"LKMS Homework Help","tone":"act"},{"when":"Tue 29 · school day","what":"Hearing / vision screen (volunteers)","hint":"at LKMS","tone":"act"},{"when":"Thu 1 · 3:00","what":"LKMS Homework Help","tone":"act"},{"when":"Fri 2 · due","what":"Yearbook baby photo due (email)","hint":"ask Dad if needed","tone":"act"},{"when":"All week","what":"Base @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"appointments":[{"when":"Sun 27 · 3:00","what":"Vanity · Jessy","hint":"on your board","tone":"hot","herSpace":true},{"when":"Wed 30 · leave 12:40 · 1:00","what":"appointment · Lindsay","hint":"with Dad","tone":"act"}],"appointmentsEmpty":"","streakLabel":"◆ 4-day streak — hold the line","missions":[{"when":"Weekly","what":"Bath wipe + laundry + garage cubby = big star dump","hint":"musts · ask Dad to inspect","tone":"fun"},{"when":"Add-on","what":"Babysitting — optional · Dad books you","hint":"hire add-on · not for jar","tone":"fun"}],"goal":{"name":"Stick Season · concert save","need":40,"placeholder":"Set a goal with Dad"},"bag":{"place":"Dad","label":"This week @ Dad · bag","hint":"147th through Fri Oct 2 · pack for Dad week"},"rides":[{"id":"scooter","what":"🛴 Scooter run","when":"your call","clear":true},{"id":"bv-rec","what":"🏟️ BV Rec","when":"when you're free","clear":true},{"id":"swim","what":"🏊 Ridgeview swim","when":"Tue/Thu · leave 4:25","clear":true,"hours":"leave 4:25 · 5:00"}],"fun":[]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sun Sep 27 · kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 · 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sun · 9–2","what":"Garage sale / whole-house shake @ 147th","tone":"act"},{"when":"Sun · 3:00","what":"Ainsley vanity · Jessy","tone":"hot"},{"when":"Custody","what":"Kids with Dad @ 147th through Fri Oct 2 3:00","tone":"hot"}],"week":[{"when":"Mon 28 · 7:30","what":"Hayes snacks in bag (late-lunch)","tone":"act"},{"when":"Mon 28 · 8:10 / 8:25","what":"SRE drop · Hayes + Harris","tone":"act"},{"when":"Mon 28 · 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 · ~5:40 / 6:15","what":"Hayes baseball practice · BV Rec Field 3","tone":"sport"},{"when":"Tue 29 · 8:50","what":"Hayes · Madi + provider collab @ SRE","tone":"act"},{"when":"Tue 29 · leave 4:25 / 5:00","what":"Ainsley swim · Genesis Ridgeview","tone":"sport"},{"when":"Tue 29 · leave 5:40 / 6:00","what":"Hayes flag practice · SRE fields (friend drop ~4:30)","tone":"sport"},{"when":"Wed 30 · 12:40 / 1:00","what":"Ainsley appointment · Lindsay","tone":"act"},{"when":"Wed 30 · ~4:55","what":"Harris flag practice · Timber Sage","tone":"sport"},{"when":"Thu 1 · PE","what":"Boys tennis shoes · SRE PE","tone":"act"},{"when":"Thu 1 · 3:00 / 3:15","what":"Ainsley HW Help · boys pickup","tone":"act"},{"when":"Thu 1 · leave 4:25 / 5:00","what":"Ainsley swim · Genesis","tone":"sport"},{"when":"Thu 1 · leave ~4:55 / 5:30","what":"Hayes baseball game · Falcons vs Lions · Field 24","tone":"sport"},{"when":"Fri 2 · 8:10 drop then 3:00","what":"SRE drop · handoff @ 3:00 · Mom week","tone":"hot"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House · kids-safe","tone":"fun"},{"when":"This week","what":"Sports stack · Mon ball · Tue flag/swim · Wed Harris flag · Thu game/swim","hint":"Dad drives","tone":"fun"}],"note":"Kids-safe Dad box · no money · no Desk · calendar facts from dmward23 / Atlas only"}}};

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
      if (kid.quests[i].id === checkId) {
        var q = kid.quests[i];
        if (q.optional || q.cadence === "addon") return 0;
        return typeof q.stars === "number" ? q.stars : 1;
      }
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

  function questHTML(q, done, kidId) {
    var optional = !!(q.optional || q.cadence === "addon");
    var stars = typeof q.stars === "number" ? q.stars : 1;
    var open = done ? "done" : "open";
    var ring = done ? "✓" : (optional ? "+" : "·");
    var hint;
    if (optional) {
      if (q.hire && kidId === "ainsley") {
        hint = done
          ? "hire logged · $15/hr Dad handout"
          : "hire path · $15/hr · Dad books you · never fills jar";
      } else {
        hint = done
          ? (q.hire ? "hire logged · booked" : "logged")
          : (q.hire ? "hire path · Dad books you · never fills jar" : "add-on · never fills jar");
      }
    } else {
      hint = done ? "cleared · banked" : "tap when clear · ★ " + stars;
    }
    var earn;
    if (optional) {
      if (q.hire && kidId === "ainsley") {
        earn = '<span class="star-earn addon-tag">' + (done ? "$15/hr ✓" : "$15/hr") + "</span>";
      } else {
        earn = '<span class="star-earn addon-tag">' + (done ? "OPTIONAL ✓" : "OPTIONAL") + "</span>";
      }
    } else {
      earn = '<span class="star-earn">' + (done ? "★ +" + stars : "★ " + stars) + "</span>";
    }
    var optAttr = optional ? ' data-optional="1"' : "";
    return (
      '<div class="quest ' + open + (optional ? " addon" : "") + '" data-check="' + esc(q.id) + '" data-kid-quest="1"' + optAttr + ' role="button" tabindex="0">' +
      '<span class="ring">' + ring + "</span>" +
      "<div><div class=\"what\">" + esc(q.what) + '</div><div class="hint">' + esc(hint) + "</div></div>" +
      earn +
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

  function renderQuests(el, quests, data, kidId) {
    if (!el) return;
    var state = loadChecks();
    el.innerHTML = (quests || []).map(function (q) {
      return questHTML(q, !!state[q.id], kidId);
    }).join("");
  }


  /** Next payday = next Friday 6:00p America/Chicago (box TZ). Ledger default. */
  function nextPaydayInfo(now) {
    now = now || new Date();
    var day = now.getDay();
    var hours = now.getHours();
    var daysUntilFri = (5 - day + 7) % 7;
    if (daysUntilFri === 0 && hours >= 18) daysUntilFri = 7;
    var label;
    if (daysUntilFri === 0) label = "Tonight · Fri payday";
    else if (daysUntilFri === 1) label = "Tomorrow · Fri payday";
    else label = daysUntilFri + " days · Fri payday";
    return { days: daysUntilFri, label: label, when: "Fri evening CT", rule: "Next Payday = next Friday 6:00p CT" };
  }

  function getPaidStamp(kidId) {
    try { return localStorage.getItem("house-bank-paid:" + kidId) || ""; } catch (e) { return ""; }
  }

  function resetJarCycle(kidId) {
    var pack = kidDayBank(kidId);
    pack.bag.lifetime = 0;
    saveBankRoot(pack.root);
    var stamp = "Paid · jar reset";
    try {
      localStorage.removeItem("house-bank-goal:" + kidId);
      localStorage.setItem("house-bank-paid:" + kidId, stamp);
      localStorage.setItem("house-bank-paid-at:" + kidId, new Date().toISOString());
    } catch (e) {}
    return stamp;
  }

  function personalGoalView(kidId, data, bank) {
    var kid = data && data.kids && data.kids[kidId];
    var g = (kid && kid.goal) || {};
    var placeholder = g.placeholder || "Add a save on your board";
    var name = "";
    var need = 0;
    // Kid write-in saves win (HouseSaves localStorage) — first with ★ target, else first
    if (global.HouseSaves && typeof global.HouseSaves.list === "function") {
      try {
        var saves = global.HouseSaves.list(kidId) || [];
        var pick = null;
        for (var si = 0; si < saves.length; si++) {
          if (saves[si] && saves[si].need > 0) { pick = saves[si]; break; }
        }
        if (!pick && saves.length) pick = saves[0];
        if (pick && pick.name) {
          name = String(pick.name).trim();
          need = typeof pick.need === "number" ? pick.need : (parseInt(pick.need, 10) || 0);
        }
      } catch (eS) { /* */ }
    }
    if (!name) {
      need = typeof g.need === "number" ? g.need : 0;
      name = (g.name || "").trim();
    }
    if (!name || need <= 0) {
      return { active: false, placeholder: placeholder, name: name || "", need: need || 0, toward: 0, met: false };
    }
    var life = bank ? (bank.lifetime || bank.toward || 0) : 0;
    var toward = Math.min(life, need);
    return { active: true, placeholder: placeholder, name: name, need: need, toward: toward, met: toward >= need };
  }

  function buildNoSurprise(kid, data) {
    var bits = [];
    var cust = data && data.custody;
    if (cust) bits.push({ kind: "house", when: "Now", what: "With " + (cust.with || "Dad") + (cust.place ? " @ " + cust.place : ""), hint: cust.throughLabel || cust.through || "", tone: "hot" });
    if (kid && kid.hottest) bits.push({ kind: "next", when: kid.hottest.when || "Next", what: kid.hottest.what || "Next up", hint: kid.hottest.where || "", tone: "hot" });
    (kid && kid.today || []).slice(0, 2).forEach(function (t) {
      bits.push({ kind: "today", when: t.when || "Today", what: t.what || "", hint: t.hint || "next 24h", tone: t.tone || "act" });
    });
    (kid && kid.appointments || []).forEach(function (a) {
      var when = (a.when || "").toLowerCase();
      // surface near-term appts (Sun/Mon/today-ish labels already in data)
      if (a.tone === "hot" || /sun|mon|today|tonight/.test(when)) {
        bits.push({ kind: "appt", when: a.when, what: a.what, hint: a.hint || "on your board", tone: a.tone || "hot" });
      }
    });
    // dedupe by what
    var seen = {};
    return bits.filter(function (b) {
      var k = (b.what || "") + "|" + (b.when || "");
      if (seen[k]) return false;
      seen[k] = 1;
      return !!b.what;
    }).slice(0, 5);
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
    var dollar = true; // House override 2026-09-27 · show $ deal on kid glass
    root.querySelectorAll("[data-bank-meta]").forEach(function (el) {
      if (dollar) {
        el.textContent = "$" + bank.toward + " / $" + bank.need + " · " + bank.toward + "/" + bank.need + " ★";
      } else {
        el.textContent = bank.toward + " / " + bank.need + " ★";
      }
    });
    var left = Math.max(0, bank.need - bank.toward);
    root.querySelectorAll("[data-bank-left]").forEach(function (el) {
      if (bank.reached) el.textContent = "Jar full · $" + bank.need;
      else if (dollar) el.textContent = "$" + left + " left · " + left + " ★ to unlock";
      else el.textContent = left + " ★ to unlock";
    });
    root.querySelectorAll("[data-payday-chip]").forEach(function (el) {
      var info = nextPaydayInfo();
      el.textContent = "Next payday · " + info.label;
      el.setAttribute("title", info.rule);
    });
    root.querySelectorAll("[data-payday-copy]").forEach(function (el) {
      el.textContent = "Payday with Dad after honest musts";
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      // already set above from goalBlurb — ensure cash blurbs stick
      if (bank.goalBlurb) el.textContent = bank.goalBlurb;
    });
    root.querySelectorAll("[data-unlock-cta]").forEach(function (el) {
      el.hidden = !bank.reached;
      el.classList.toggle("is-loud", !!bank.reached);
    });
    var paid = getPaidStamp(bank.kidId);
    root.querySelectorAll("[data-paid-stamp]").forEach(function (el) {
      if (paid) { el.hidden = false; el.textContent = paid; }
      else { el.hidden = true; }
    });
    root.querySelectorAll("[data-got-it]").forEach(function (el) {
      el.hidden = !bank.reached;
    });
    document.body.classList.toggle("bank-goal-hit", !!bank.reached);
  }

  function renderPersonalGoal(root, kidId, data, bank) {
    if (!root) return;
    var gv = personalGoalView(kidId, data, bank);
    root.querySelectorAll("[data-goal-chip]").forEach(function (el) {
      el.classList.remove("is-met", "is-active", "is-empty");
      if (!gv.active) {
        el.textContent = gv.placeholder;
        el.classList.add("is-empty");
      } else if (gv.met) {
        el.textContent = "Tell Dad — goal met · " + gv.name + " (" + gv.need + "★)";
        el.classList.add("is-met", "is-active");
      } else {
        el.textContent = gv.name + " · " + gv.toward + "/" + gv.need + " ★";
        el.classList.add("is-active");
      }
    });
  }

  function renderHarborStrips(kidId, data) {
    var kid = data.kids[kidId];
    if (!kid) return;
    var ns = document.querySelector("[data-mount-no-surprise]");
    if (ns) {
      var items = buildNoSurprise(kid, data);
      ns.innerHTML = items.length
        ? items.map(cardHTML).join("")
        : quietHTML("quiet board · check musts");
    }
    var rides = document.querySelector("[data-mount-rides]");
    if (rides) {
      var list = kid.rides || [];
      rides.innerHTML = list.length
        ? list.map(function (r) {
            var tone = r.clear ? "fun" : "act";
            return cardHTML({ when: r.when || (r.clear ? "you're clear" : "check timing"), what: r.what, hint: r.hours || (r.clear ? "your move · no conflict flagged" : "ask Dad"), tone: tone });
          }).join("")
        : quietHTML("rides land here when set");
    }
    var bag = document.querySelector("[data-bag-strip]");
    if (bag && kid.bag) {
      bag.hidden = false;
      var lab = bag.querySelector("[data-bag-label]");
      var hint = bag.querySelector("[data-bag-hint]");
      if (lab) lab.textContent = kid.bag.label || ("This week @ " + (kid.bag.place || "Dad") + " · bag");
      if (hint) hint.textContent = kid.bag.hint || "";
    } else if (bag) {
      bag.hidden = false;
      var lab2 = bag.querySelector("[data-bag-label]");
      if (lab2) lab2.textContent = "Bag for Dad week";
    }
    var her = document.querySelector("[data-mount-her-space]");
    if (her) {
      var space = [];
      (kid.appointments || []).forEach(function (a) {
        if (a.herSpace || /vanity|jessy|room/i.test((a.what || "") + (a.hint || ""))) {
          space.push({ when: a.when, what: a.what, hint: a.hint || "your space", tone: a.tone || "hot" });
        }
      });
      // room reset quest as light status if present
      (kid.quests || []).forEach(function (q) {
        if (q.id === "ain-toys" || /room reset/i.test(q.what || "")) {
          var done = getCheck(q.id);
          space.push({ when: "Room", what: done ? "Room reset · clear" : "Room reset · still open", hint: "your space · your pace", tone: done ? "fun" : "act" });
        }
      });
      her.innerHTML = space.length ? space.map(cardHTML).join("") : quietHTML("your space · quiet");
    }
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
    renderQuests(document.querySelector("[data-mount-quests]"), kid.quests, data, kidId);
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
    renderPersonalGoal(document, kidId, data, bank);
    if (kidId === "ainsley") renderHarborStrips(kidId, data);
    if (bank.reached) {
      try { localStorage.setItem("house-bank-goal:" + kidId, "1"); } catch (e) {}
      document.body.classList.add("bank-goal-hit");
      var unlock = document.querySelector("[data-goal-unlock]");
      if (unlock) {
        unlock.hidden = false;
        unlock.textContent = "JAR FULL · Payday with Dad";
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
    renderPersonalGoal: renderPersonalGoal,
    renderHarborStrips: renderHarborStrips,
    renderKidPage: renderKidPage,
    nextPaydayInfo: nextPaydayInfo,
    resetJarCycle: resetJarCycle,
    getPaidStamp: getPaidStamp,
    personalGoalView: personalGoalView,
    buildNoSurprise: buildNoSurprise,
    boot: boot,
    loadJSON: loadJSON,
    _data: null
  };
})(window);
