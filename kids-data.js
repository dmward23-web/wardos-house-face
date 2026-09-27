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
    "ain-bath": "ainsley", "ain-laundry": "ainsley", "ain-babysit": "ainsley",
    "hay-bed": "hayes", "hay-dishes": "hayes", "hay-trash": "hayes", "hay-backpack": "hayes",
    "hay-gear": "hayes", "hay-room": "hayes",
    "har-bed": "harris", "har-dishes": "harris", "har-trash": "harris", "har-backpack": "harris",
    "har-toys": "harris", "har-shoes": "harris"
  };

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Sun Sep 27 2026","asOfIso":"2026-09-27","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 \u00b7 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"\u25c6","label":"Gems"},"bankGoal":{"id":"gem-jar","title":"Fill the Gem Jar","blurb":"Clear your musts. Stack gems into the jar. Hit the fill line \u2014 then allowance payday with Dad. Craft unlock is optional secondary.","need":8,"reward":"allowance payday with Dad"},"hottest":{"when":"SUN \u00b7 base day @ 147th","what":"YOUR BASE WITH DAD","where":"Garage-sale crew morning \u00b7 then play \u00b7 through Fri Oct 2 3:00","badges":["DAD WEEK","147th"]},"today":[{"kind":"event","when":"Morning \u00b7 9\u20132","what":"\ud83c\udfe0 House shake / garage-sale crew @ 147th","hint":"Help Dad \u00b7 then free play","tone":"act"},{"kind":"event","when":"Anytime today","what":"\ud83e\uddf1 Block time if musts clear","hint":"gems \u2192 jar \u2192 payday","tone":"fun"},{"kind":"note","when":"All day","what":"\ud83c\udfe1 YOUR BASE with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"har-bed","what":"\ud83d\udecf\ufe0f Make your bed (block rebuild) \u2014 daily must","stars":1,"cadence":"daily"},{"id":"har-dishes","what":"\ud83c\udf7d\ufe0f Dishes helper (mining duty) \u2014 daily must","stars":1,"cadence":"daily"},{"id":"har-trash","what":"\ud83d\uddd1\ufe0f Trash out (clear the cave) \u2014 daily must","stars":1,"cadence":"daily"},{"id":"har-backpack","what":"\ud83c\udf92 Pack backpack (loot ready) \u2014 daily must","stars":1,"cadence":"daily"},{"id":"har-toys","what":"\ud83e\uddf8 Toys reset \u2014 weekly must","stars":2,"cadence":"weekly"},{"id":"har-shoes","what":"\ud83d\udc5f Shoes by door \u2014 weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Wed 30 \u00b7 leave ~4:55 \u00b7 practice","what":"\u26a1 FLAG practice \u00b7 Timber Sage grass","hint":"YOUR practice \u00b7 with Dad","tone":"hot"}],"school":[{"when":"Mon 28 \u00b7 leave ~8:10","what":"\ud83c\udfeb SRE drop \u2014 you're on the crew","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"\ud83d\ude8c Boys pickup \u00b7 squad ride","tone":"act"},{"when":"Wed 30 \u00b7 school day","what":"\ud83d\udc42 Hearing / vision screen at SRE","hint":"awareness \u00b7 normal school","tone":"act"},{"when":"Thu 1 \u00b7 PE day","what":"\ud83d\udc5f Tennis shoes for PE","tone":"act"},{"when":"Fri 2 \u00b7 leave ~8:10","what":"\ud83c\udfeb SRE drop \u00b7 then Mom week after 3:00","hint":"Dad handoff Fri 3:00","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 YOUR BASE @ 147th with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"fun":[{"when":"Quest reward","what":"\ud83e\uddf1 BLOCK BUILD TIME","hint":"gems \u2192 jar \u2192 payday \u00b7 craft optional","tone":"fun"},{"when":"Outside","what":"\ud83c\udf33 Backyard boss fight (play)","hint":"ask Dad \u00b7 run wild","tone":"fun"},{"when":"Tonight","what":"\ud83c\udf6a Snack chest raid","hint":"after quests \u00b7 with Dad","tone":"fun"},{"when":"Base mission","what":"\ud83d\udc8e Fill the Gem Jar \u2014 allowance payday with Dad","hint":"FUN \u00b7 craft unlock optional","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No doctor stuff on your board \u2014 lucky!!! More play time.","streakLabel":"\ud83d\udd25 3-day craft streak \u2014 keep smashing","missions":[{"when":"Anytime","what":"\ud83d\udd25 Musts clear = gems in the jar","hint":"FUN mission","tone":"fun"},{"when":"Goal","what":"\ud83d\udc8e Fill jar (8) = allowance payday with Dad","hint":"FUN \u00b7 miss = payday held","tone":"fun"},{"when":"Weekly","what":"\ud83e\uddf8 Toys reset + \ud83d\udc5f shoes by door","hint":"musts \u00b7 ask Dad to inspect","tone":"fun"}]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"\u25ce","label":"Victory Coins"},"bankGoal":{"id":"victory-jar","title":"Fill the Victory Jar","blurb":"Clear your musts. Bank Victory Coins into the jar. Hit the fill line \u2014 then allowance payday with Dad. Umbrella treat is optional secondary.","need":12,"reward":"allowance payday with Dad"},"hottest":{"when":"MON \u00b7 leave ~5:40 \u00b7 BASEBALL 6:15","what":"NEXT DROP \u00b7 BV REC FIELD 3","where":"Sunday house day \u00b7 then Mon baseball practice","badges":["LOCKED IN","BASEBALL"]},"today":[{"kind":"event","when":"Morning \u00b7 9\u20132","what":"\ud83c\udfe0 House shake / garage-sale loadout @ 147th","hint":"Help the crew \u00b7 then free time","tone":"act"},{"kind":"event","when":"Anytime today","what":"\u26a1 Soft warm-up \u00b7 yard run OK","hint":"ask Dad \u00b7 Mon baseball next","tone":"fun"},{"kind":"note","when":"All day","what":"\ud83c\udfe1 DROP ZONE HQ with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"hay-bed","what":"\ud83d\udecf\ufe0f Make bed \u2014 pre-game ritual (daily must)","stars":1,"cadence":"daily"},{"id":"hay-dishes","what":"\ud83c\udf7d\ufe0f Dishes \u2014 wipe the lobby (daily must)","stars":1,"cadence":"daily"},{"id":"hay-trash","what":"\ud83d\uddd1\ufe0f Trash out \u2014 zone clear (daily must)","stars":1,"cadence":"daily"},{"id":"hay-backpack","what":"\ud83c\udf92 Backpack \u2014 loadout ready (daily must)","stars":1,"cadence":"daily"},{"id":"hay-gear","what":"\u26bd Sports bag / cleats ready \u2014 weekly must","stars":2,"cadence":"weekly"},{"id":"hay-room","what":"\ud83e\uddf9 Room reset \u2014 weekly must","stars":2,"cadence":"weekly"}],"sports":[{"when":"Mon 28 \u00b7 leave ~5:40 \u00b7 practice 6:15","what":"\u26be BASEBALL practice \u00b7 BV Rec Field 3","hint":"YOUR next challenge","tone":"hot"},{"when":"Tue 29 \u00b7 leave 5:40 \u00b7 6:00","what":"\ud83c\udfc1 FLAG practice \u00b7 SRE / library fields","hint":"friend drop ~4:30 lock pending","tone":"sport"},{"when":"Thu 1 \u00b7 leave ~4:55 \u00b7 game 5:30","what":"\u26be BASEBALL \u00b7 Falcons vs Lions \u00b7 Field 24","hint":"HOME game","tone":"hot"}],"school":[{"when":"Mon \u00b7 7:30","what":"\ud83c\udf4e Snacks in the bag","hint":"late-lunch \u00b7 Madi OK","tone":"act"},{"when":"Mon \u00b7 SRE drop","what":"\ud83c\udfeb School drop with the boys","tone":"act"},{"when":"Tue \u00b7 8:50","what":"\ud83e\udd1d Madi + provider collab at SRE","hint":"in person","tone":"act"},{"when":"Wed \u00b7 school day","what":"\ud83d\udc42 Hearing / vision screen at SRE","tone":"act"},{"when":"Thu \u00b7 PE day","what":"\ud83d\udc5f Tennis shoes for PE","tone":"act"},{"when":"Fri \u00b7 field trip","what":"\ud83d\ude8c Museum + Meadowbrook (school day)","hint":"sack lunch \u00b7 trip shirt \u00b7 tennis shoes","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 DROP ZONE HQ @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"After clears","what":"\ud83d\udc51 Victory round \u2014 game pick with Dad","hint":"coins \u2192 jar \u2192 payday","tone":"fun"},{"when":"Outside","what":"\u26a1 Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"\u2602\ufe0f Fill the Victory Jar \u2014 allowance payday with Dad","hint":"FUN \u00b7 umbrella treat optional","tone":"fun"},{"when":"Squad","what":"\ud83e\udd1d Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","streakLabel":"\ud83d\udd25 6-day fire streak \u2014 don't break it","missions":[{"when":"Every clear","what":"\ud83d\udca5 Must done = coin banked in the jar","hint":"FUN","tone":"fun"},{"when":"Goal","what":"\ud83c\udfc6 Fill jar (12) = allowance payday with Dad","hint":"FUN \u00b7 miss = payday held","tone":"fun"},{"when":"Weekly","what":"\u26bd Gear ready + \ud83e\uddf9 room reset = bonus coins","hint":"musts \u00b7 ask Dad to inspect","tone":"fun"}]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"eras-stage","themeLabel":"Eras Stage","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"\u2605","label":"Tour Stars"},"bankGoal":{"id":"tour-jar","title":"Fill the Tour Jar","blurb":"Clear your musts. Bank Tour Stars into the jar. Hit the fill line \u2014 then allowance payday with Dad. Treat is optional secondary.","need":20,"reward":"allowance payday with Dad"},"hottest":{"when":"SUN \u00b7 vanity 3:00 \u00b7 Jessy","what":"FEATURED \u00b7 SUNDAY","where":"Vanity 3:00 \u00b7 with Dad @ 147th","badges":["FEATURED","SUNDAY"]},"today":[{"kind":"event","when":"Morning \u00b7 9\u20132","what":"\ud83c\udfe0 Garage sale / house shake with crew","hint":"Help set the stage","tone":"act"},{"kind":"event","when":"3:00 LOCKED","what":"\ud83d\udc85 Vanity install \u00b7 Jessy","hint":"FEATURED \u00b7 your board","tone":"hot"},{"kind":"event","when":"After vanity","what":"\ud83c\udfa7 Playlist + chill with Dad","hint":"FUN \u00b7 your pick","tone":"fun"}],"quests":[{"id":"ain-bed","what":"\ud83d\udecf\ufe0f Make bed \u2014 stage reset (daily must)","stars":1,"cadence":"daily"},{"id":"ain-toys","what":"\ud83e\uddf9 Room reset \u2014 clean pass (daily must)","stars":1,"cadence":"daily"},{"id":"ain-dishwasher","what":"\ud83c\udf7d\ufe0f Dishwasher load/unload \u2014 stage crew (daily must)","stars":1,"cadence":"daily"},{"id":"ain-living","what":"\ud83d\udecb\ufe0f Living room straighten \u00b7 shoes & coats (daily must)","stars":1,"cadence":"daily"},{"id":"ain-bath","what":"\ud83d\udec1 Bathroom wipe \u2014 weekly must","stars":3,"cadence":"weekly"},{"id":"ain-laundry","what":"\ud83d\udc55 Laundry full cycle \u2014 her clothes (weekly must)","stars":5,"cadence":"weekly"},{"id":"ain-babysit","what":"\ud83d\udc76 Babysitting \u2014 optional add-on (when Dad books you)","stars":0,"cadence":"addon","optional":true}],"sports":[{"when":"Tue 29 \u00b7 leave 4:25 \u00b7 practice 5:00","what":"\ud83c\udfca SWIM \u00b7 Coach Ann \u00b7 Genesis Ridgeview","hint":"YOUR set","tone":"hot"},{"when":"Thu 1 \u00b7 leave 4:25 \u00b7 practice 5:00","what":"\ud83c\udfca SWIM \u00b7 Coach Ann \u00b7 Genesis Ridgeview","hint":"second set this week","tone":"sport"}],"sportsEmpty":"","school":[{"when":"Sun 27 \u00b7 9\u20132","what":"\ud83c\udfe0 Garage sale / house shake with crew","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"\ud83d\udcda LKMS Homework Help","tone":"act"},{"when":"Tue 29 \u00b7 school day","what":"\ud83d\udc42 Hearing / vision screen (volunteers)","hint":"at LKMS","tone":"act"},{"when":"Thu 1 \u00b7 3:00","what":"\ud83d\udcda LKMS Homework Help","tone":"act"},{"when":"Fri 2 \u00b7 due","what":"\ud83d\udcf7 Yearbook baby photo due (email)","hint":"ask Dad if needed","tone":"act"},{"when":"All week","what":"\ud83c\udfe1 Base @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"Sun after vanity","what":"\ud83c\udfb6 Playlist + chill with Dad","hint":"your call","tone":"fun"},{"when":"Creative hour","what":"\u270f\ufe0f Journal / draw / room setup","hint":"earn stars \u2192 Tour Jar \u2192 payday","tone":"fun"},{"when":"Base mission","what":"\u2605 Fill the Tour Jar \u2014 allowance payday with Dad","hint":"FUN setlist goal \u00b7 treat optional","tone":"fun"},{"when":"Downtime","what":"\ud83c\udf19 Quiet hour \u00b7 headphones on","hint":"FUN \u00b7 keep it sharp","tone":"fun"}],"appointments":[{"when":"Sun 27 \u00b7 3:00","what":"\ud83d\udc85 Vanity \u00b7 Jessy","hint":"on your board","tone":"hot"},{"when":"Wed 30 \u00b7 leave 12:40 \u00b7 1:00","what":"\ud83d\udc9c appointment \u00b7 Lindsay","hint":"with Dad","tone":"act"}],"appointmentsEmpty":"","streakLabel":"\u25c6 4-day set streak \u2014 hold the line","missions":[{"when":"Every tap","what":"\u2605 Must clear = star banked in the jar","hint":"FUN","tone":"fun"},{"when":"Goal","what":"\u2605 Fill jar (20) = allowance payday with Dad","hint":"FUN \u00b7 miss = payday held","tone":"fun"},{"when":"Weekly","what":"\ud83d\udec1 Bath wipe + \ud83d\udc55 laundry cycle = big star dump","hint":"musts \u00b7 ask Dad to inspect","tone":"fun"},{"when":"Add-on","what":"\ud83d\udc76 Babysitting \u2014 optional (Dad books you)","hint":"not required for jar \u00b7 ask Dad","tone":"fun"}]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sun Sep 27 \u00b7 kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 \u00b7 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sun \u00b7 9\u20132","what":"Garage sale / whole-house shake @ 147th","tone":"act"},{"when":"Sun \u00b7 3:00","what":"Ainsley vanity \u00b7 Jessy","tone":"hot"},{"when":"Custody","what":"Kids with Dad @ 147th through Fri Oct 2 3:00","tone":"hot"}],"week":[{"when":"Mon 28 \u00b7 7:30","what":"Hayes snacks in bag (late-lunch)","tone":"act"},{"when":"Mon 28 \u00b7 8:10 / 8:25","what":"SRE drop \u00b7 Hayes + Harris","tone":"act"},{"when":"Mon 28 \u00b7 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 \u00b7 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 \u00b7 ~5:40 / 6:15","what":"Hayes baseball practice \u00b7 BV Rec Field 3","tone":"sport"},{"when":"Tue 29 \u00b7 8:50","what":"Hayes \u00b7 Madi + provider collab @ SRE","tone":"act"},{"when":"Tue 29 \u00b7 leave 4:25 / 5:00","what":"Ainsley swim \u00b7 Genesis Ridgeview","tone":"sport"},{"when":"Tue 29 \u00b7 leave 5:40 / 6:00","what":"Hayes flag practice \u00b7 SRE fields (friend drop ~4:30)","tone":"sport"},{"when":"Wed 30 \u00b7 12:40 / 1:00","what":"Ainsley appointment \u00b7 Lindsay","tone":"act"},{"when":"Wed 30 \u00b7 ~4:55","what":"Harris flag practice \u00b7 Timber Sage","tone":"sport"},{"when":"Thu 1 \u00b7 PE","what":"Boys tennis shoes \u00b7 SRE PE","tone":"act"},{"when":"Thu 1 \u00b7 3:00 / 3:15","what":"Ainsley HW Help \u00b7 boys pickup","tone":"act"},{"when":"Thu 1 \u00b7 leave 4:25 / 5:00","what":"Ainsley swim \u00b7 Genesis","tone":"sport"},{"when":"Thu 1 \u00b7 leave ~4:55 / 5:30","what":"Hayes baseball game \u00b7 Falcons vs Lions \u00b7 Field 24","tone":"sport"},{"when":"Fri 2 \u00b7 8:10 drop then 3:00","what":"SRE drop \u00b7 handoff @ 3:00 \u00b7 Mom week","tone":"hot"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House \u00b7 kids-safe","tone":"fun"},{"when":"This week","what":"Sports stack \u00b7 Mon ball \u00b7 Tue flag/swim \u00b7 Wed Harris flag \u00b7 Thu game/swim","hint":"Dad drives","tone":"fun"}],"note":"Kids-safe Dad box \u00b7 no money \u00b7 no Desk \u00b7 calendar facts from dmward23 / Atlas only"}}};

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

  function questHTML(q, done) {
    var optional = !!(q.optional || q.cadence === "addon");
    var stars = typeof q.stars === "number" ? q.stars : 1;
    var open = done ? "done" : "open";
    var ring = done ? "✓" : (optional ? "＋" : "");
    var hint;
    if (optional) {
      hint = done ? "logged · ask Dad" : "optional add-on · not required for jar";
    } else {
      hint = done ? "done · nice!" : "tap when done · ★ " + stars;
    }
    var earn = optional
      ? '<span class="star-earn addon-tag">' + (done ? "ADD-ON ✓" : "ADD-ON") + "</span>"
      : '<span class="star-earn">' + (done ? "★ +" + stars : "★ " + stars) + "</span>";
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
