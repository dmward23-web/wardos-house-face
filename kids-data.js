/* House face · kids shared data + bank · kids-safe · localStorage only */
(function (global) {
  "use strict";

  var DAY_ISO = (function () {
    try {
      if (typeof HouseClock !== "undefined" && HouseClock.iso) return HouseClock.iso();
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      try {
        var d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      } catch (e2) {
        return "1970-01-01";
      }
    }
  })();

  var CHECK_KEY = "house-checkoffs:chores-v2"; /* legacy flat key — migrate-read only */
  var BANK_KEY = "house-bank:v1";
  var CHECK_PREFIX = "house-checkoffs:";

  var KID_FROM_CHECK = {
    "ain-bed": "ainsley", "ain-toys": "ainsley",
    "ain-dishwasher": "ainsley", "ain-empty": "ainsley", "ain-living": "ainsley",
    "ain-bath": "ainsley", "ain-laundry": "ainsley", "ain-cubby": "ainsley", "ain-babysit": "ainsley",
    "hay-bed": "hayes", "hay-backpack": "hayes", "hay-dishes": "hayes", "hay-empty": "hayes", "hay-trash": "hayes",
    "hay-postgame": "hayes", "hay-shower": "hayes", "hay-room": "hayes", "hay-shoes": "hayes", "hay-cubby": "hayes",
    "har-bed": "harris", "har-backpack": "harris", "har-dishes": "harris", "har-empty": "harris", "har-trash": "harris",
    "har-postgame": "harris", "har-shower": "harris", "har-toys": "harris", "har-shoes": "harris", "har-cubby": "harris"
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** Chicago hour 0–23 (for Fri 3:00p custody handoff). */
  function chicagoHourNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hourCycle: "h23"
      }).formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "hour") return Number(parts[i].value) % 24;
      }
    } catch (e) { /* */ }
    try { return new Date().getHours(); } catch (e2) { return 12; }
  }

  /**
   * Custody chore week = Fri 3:00p → next Fri 3:00p (Dad week nights Fri→Thu).
   * Day taps: Fri Sat Sun Mon Tue Wed Thu. Before Fri 3p still prior week.
   */
  function weekStartIso(dayIso) {
    var iso = dayIso || DAY_ISO;
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    /* Noon CT anchor — box TZ is America/Chicago */
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var dow = d.getDay(); /* 0=Sun … 5=Fri */
    var sinceFri = (dow - 5 + 7) % 7; /* Fri=0 … Thu=6 */
    d.setDate(d.getDate() - sinceFri);
    /* Fri before 3:00p CT = still previous custody week (handoff not yet) */
    if (iso === DAY_ISO && sinceFri === 0 && chicagoHourNow() < 15) {
      d.setDate(d.getDate() - 7);
    }
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dowIndexFromIso(iso) {
    var parts = String(iso).split("-");
    if (parts.length !== 3) return 0;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    return d.getDay();
  }

  function questMeta(kidId, checkId, data) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !kid.quests) return { cadence: "daily", stars: 1, optional: false };
    for (var i = 0; i < kid.quests.length; i++) {
      if (kid.quests[i].id === checkId) {
        var q = kid.quests[i];
        var optional = !!(q.optional || q.cadence === "addon");
        var cadence = q.cadence || (optional ? "addon" : "daily");
        var stars = optional ? 0 : (typeof q.stars === "number" ? q.stars : 1);
        return { cadence: cadence, stars: stars, optional: optional };
      }
    }
    return { cadence: "daily", stars: 1, optional: false };
  }

  var WEEKLY_IDS = {
    "ain-bath": 1, "ain-laundry": 1, "ain-cubby": 1,
    "hay-room": 1, "hay-shoes": 1, "hay-cubby": 1,
    "har-toys": 1, "har-shoes": 1, "har-cubby": 1
  };
  var DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
  var DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function checkKeyFor(checkId, data, dayIso) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return CHECK_KEY;
    var meta = questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data));
    var weekly = meta.cadence === "weekly" || !!WEEKLY_IDS[checkId];
    var iso = dayIso || DAY_ISO;
    if (weekly) {
      return CHECK_PREFIX + kidId + ":week:" + weekStartIso(iso);
    }
    /* daily musts + soft/addon — keyed per Chicago day (Fri→Thu Dad-week taps) */
    return CHECK_PREFIX + kidId + ":" + iso;
  }

  /** Fri–Thu inclusive = 7 Dad-week tap days (Fri Sat Sun Mon Tue Wed Thu). */
  var DAD_WEEK_DAYS = 7;

  function weekDayIsos(anchorIso) {
    var start = weekStartIso(anchorIso || DAY_ISO);
    var parts = String(start).split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var out = [];
    for (var i = 0; i < DAD_WEEK_DAYS; i++) {
      out.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function dadWeekLen() {
    return weekDayIsos(DAY_ISO).length || DAD_WEEK_DAYS;
  }

  function dailyDoneCount(checkId, data) {
    var n = 0;
    var days = weekDayIsos(DAY_ISO);
    for (var i = 0; i < days.length; i++) {
      if (getCheckRaw(checkId, data, days[i])) n += 1;
    }
    return n;
  }

  function dailyWeekComplete(checkId, data) {
    return dailyDoneCount(checkId, data) >= weekDayIsos(DAY_ISO).length;
  }

  /* Stars credited to jar for a must. Daily = stars×DAD_WEEK_DAYS once Fri→Thu complete (not per-day pay). */
  function bankStarsFor(kidId, checkId, data) {
    var meta = questMeta(kidId, checkId, data);
    if (meta.optional) return 0;
    if (meta.cadence === "daily") return (meta.stars || 1) * dadWeekLen();
    return meta.stars || 1;
  }

  function recomputeDayStars(kidId, dayBag, data) {
    var sum = 0;
    if (!dayBag || !dayBag.earned) return 0;
    Object.keys(dayBag.earned).forEach(function (k) {
      if (dayBag.earned[k]) sum += bankStarsFor(kidId, k, data);
    });
    dayBag.stars = sum;
    return sum;
  }

  function ensureDayBag(root, kidId, iso) {
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (!root[kidId].days) root[kidId].days = {};
    if (!root[kidId].days[iso]) root[kidId].days[iso] = { stars: 0, earned: {} };
    if (!root[kidId].days[iso].earned) root[kidId].days[iso].earned = {};
    return root[kidId].days[iso];
  }

  /** Daily musts: $ unlocks only when Fri→Thu Dad-week days all tapped. Credit stars×days on week-start bucket. */
  function syncDailyWeekBank(checkId, data) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return null;
    var meta = questMeta(kidId, checkId, data);
    if (meta.optional || meta.cadence !== "daily") return null;
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    var days = weekDayIsos(DAY_ISO);
    var ws = days[0];
    var complete = dailyWeekComplete(checkId, data);
    var wsBag = ensureDayBag(root, kidId, ws);
    var wasCredited = !!(wsBag.earned && wsBag.earned[checkId]);
    var pay = bankStarsFor(kidId, checkId, data);
    var i, iso, bag;
    for (i = 0; i < days.length; i++) {
      iso = days[i];
      bag = ensureDayBag(root, kidId, iso);
      if (iso === ws) {
        if (complete) bag.earned[checkId] = true;
        else delete bag.earned[checkId];
      } else if (bag.earned && bag.earned[checkId]) {
        /* scrub legacy per-day credits for daily musts */
        delete bag.earned[checkId];
      }
      recomputeDayStars(kidId, bag, data);
    }
    if (complete && !wasCredited) {
      root[kidId].lifetime = (root[kidId].lifetime || 0) + pay;
    } else if (!complete && wasCredited) {
      root[kidId].lifetime = Math.max(0, (root[kidId].lifetime || 0) - pay);
    }
    saveBankRoot(root);
    return getBankView(kidId, data);
  }

  function weekStarsFor(kidId) {
    var root = loadBankRoot();
    var bag = root[kidId];
    if (!bag || !bag.days) return 0;
    var start = weekStartIso(DAY_ISO);
    var parts = start.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var sum = 0;
    for (var i = 0; i < DAD_WEEK_DAYS; i++) {
      var iso = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      if (bag.days[iso] && bag.days[iso].stars) sum += bag.days[iso].stars;
      d.setDate(d.getDate() + 1);
    }
    return sum;
  }

  /* Embedded fallback — same payload as kids-week.json (fetch preferred on Pages) */
  var EMBEDDED = {"asOf":"Sun Sep 27 2026","asOfIso":"2026-09-27","custody":{"with":"Dad","place":"147th","through":"Fri Oct 2 · 3:00","throughLabel":"with Dad @ 147th through Fri Oct 2 3:00"},"leaveBys":{"SRE_drop":"leave 8:10 for 8:25","SRE_pickup":"leave 3:15 for 3:40","note":"sports: event START = leave-by"},"kids":{"harris":{"id":"harris","name":"Harris","you":"you","theme":"block-world","themeLabel":"Block World","gradeVoice":"1st grade","avatar":"H","currency":{"unit":"gem","plural":"gems","symbol":"◆","label":"Gems"},"bankGoal":{"id":"gem-jar","title":"Gem Jar · earn then save","blurb":"Honest Dad-week musts (Fri→Thu) hit Gem Jar $10 AND full $10 payday (1★=$1). Miss musts = short or no full payday. Jar = save what you earned — not free money.","need":10,"reward":"Payday with Dad after honest musts","dollarNeed":10,"weeklyAllowance":10,"starDollar":1},"hottest":{"when":"SUN · base day @ 147th","what":"YOUR BASE WITH DAD","where":"Garage-sale crew morning · then play · through Fri Oct 2 3:00","badges":["DAD WEEK","147th"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"🏠 House shake / garage-sale crew @ 147th","hint":"Help Dad · then free play","tone":"act"},{"kind":"event","when":"Anytime today","what":"🧱 Block time if musts clear","hint":"gems → jar → payday","tone":"fun"},{"kind":"note","when":"All day","what":"🏡 YOUR BASE with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"har-bed","what":"🛏️ Make bed — pre-game ritual (block rebuild)","stars":1,"cadence":"daily"},{"id":"har-backpack","what":"🎒 Pack backpack (loot ready) — daily must","stars":1,"cadence":"daily"},{"id":"har-dishes","what":"🍽️ Clean up after you · rinse · in dishwasher — daily must","stars":1,"cadence":"daily"},{"id":"har-empty","what":"🍽️ Empty dishwasher — daily must","stars":1,"cadence":"daily"},{"id":"har-trash","what":"🗑️ Trash out (clear the cave) — daily must","stars":1,"cadence":"daily"},{"id":"har-postgame","what":"⚡ Post-game · gear rinsed · bag set","stars":1,"cadence":"daily"},{"id":"har-shower","what":"🚿 Shower · brush · ready for bed","stars":1,"cadence":"daily"},{"id":"har-toys","what":"🧸 Toys reset — weekly must","stars":2,"cadence":"weekly"},{"id":"har-shoes","what":"👟 Shoes · closet / garage cubby / room — weekly must","stars":1,"cadence":"weekly"},{"id":"har-cubby","what":"🎒 Backpack + sports bag in garage cubby — weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Wed 30 · leave ~4:55 · practice","what":"⚡ FLAG practice · Timber Sage grass","hint":"YOUR practice · with Dad","tone":"hot"}],"school":[{"when":"Mon 28 · leave ~8:10","what":"🏫 SRE drop — you're on the crew","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"🚌 Boys pickup · squad ride","tone":"act"},{"when":"Wed 30 · school day","what":"👂 Hearing / vision screen at SRE","hint":"awareness · normal school","tone":"act"},{"when":"Thu 1 · PE day","what":"👟 Tennis shoes for PE","tone":"act"},{"when":"Fri 2 · leave ~8:10","what":"🏫 SRE drop · then Mom week after 3:00","hint":"Dad handoff Fri 3:00","tone":"act"},{"when":"All week","what":"🏡 YOUR BASE @ 147th with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"fun":[{"when":"Quest reward","what":"🧱 BLOCK BUILD TIME","hint":"gems → jar → payday · craft optional","tone":"fun"},{"when":"Outside","what":"🌳 Backyard boss fight (play)","hint":"ask Dad · run wild","tone":"fun"},{"when":"Tonight","what":"🍪 Snack chest raid","hint":"after quests · with Dad","tone":"fun"},{"when":"Base mission","what":"💎 Gem Jar · save with Dad","hint":"FUN · craft unlock optional","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No doctor stuff on your board — lucky!!! More play time.","streakLabel":"🔥 3-day craft streak — keep smashing","missions":[{"when":"Anytime","what":"🔥 Musts clear = gems in the jar","hint":"full week → jar $10 + $10 payday","tone":"fun"},{"when":"Weekly","what":"🧸 Toys + 👟 shoes + 🎒 garage cubby","hint":"musts · ask Dad to inspect","tone":"fun"}]},"hayes":{"id":"hayes","name":"Hayes","you":"you","theme":"drop-zone","themeLabel":"Drop Zone","gradeVoice":"3rd grade","avatar":"H","currency":{"unit":"coin","plural":"coins","symbol":"◎","label":"Victory Coins"},"bankGoal":{"id":"victory-jar","title":"Victory Jar · earn then save","blurb":"Honest Dad-week musts (Fri→Thu) hit Victory Jar $10 AND full $10 payday (1★=$1). Miss musts = short or no full payday. Jar = save what you earned — not free money.","need":10,"reward":"Payday with Dad after honest musts","dollarNeed":10,"weeklyAllowance":10,"starDollar":1},"hottest":{"when":"MON · leave ~5:40 · BASEBALL 6:15","what":"NEXT DROP · BV REC FIELD 3","where":"Sunday house day · then Mon baseball practice","badges":["LOCKED IN","BASEBALL"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"🏠 House shake / garage-sale loadout @ 147th","hint":"Help the crew · then free time","tone":"act"},{"kind":"event","when":"Anytime today","what":"⚡ Soft warm-up · yard run OK","hint":"ask Dad · Mon baseball next","tone":"fun"},{"kind":"note","when":"All day","what":"🏡 DROP ZONE HQ with Dad","hint":"through Fri Oct 2 3:00","tone":"hot"}],"quests":[{"id":"hay-bed","what":"🛏️ Make bed — pre-game ritual (daily must)","stars":1,"cadence":"daily"},{"id":"hay-backpack","what":"🎒 Backpack — loadout ready (daily must)","stars":1,"cadence":"daily"},{"id":"hay-dishes","what":"🍽️ Clean up after you · rinse · in dishwasher — daily must","stars":1,"cadence":"daily"},{"id":"hay-empty","what":"🍽️ Empty dishwasher — daily must","stars":1,"cadence":"daily"},{"id":"hay-trash","what":"🗑️ Trash out — zone clear (daily must)","stars":1,"cadence":"daily"},{"id":"hay-postgame","what":"⚡ Post-game · gear rinsed · bag set","stars":1,"cadence":"daily"},{"id":"hay-shower","what":"🚿 Shower · brush · ready for bed","stars":1,"cadence":"daily"},{"id":"hay-room","what":"🧹 Room reset — weekly must","stars":2,"cadence":"weekly"},{"id":"hay-shoes","what":"👟 Shoes · closet / garage cubby / room — weekly must (never hallway)","stars":1,"cadence":"weekly"},{"id":"hay-cubby","what":"🎒 Backpack + sports bag in garage cubby — weekly must","stars":1,"cadence":"weekly"}],"sports":[{"when":"Mon 28 · leave ~5:40 · practice 6:15","what":"⚾ BASEBALL practice · BV Rec Field 3","hint":"YOUR next challenge","tone":"hot"},{"when":"Tue 29 · leave 5:40 · 6:00","what":"🏁 FLAG practice · SRE / library fields","hint":"friend drop ~4:30 lock pending","tone":"sport"},{"when":"Thu 1 · leave ~4:55 · game 5:30","what":"⚾ BASEBALL · Falcons vs Lions · Field 24","hint":"HOME game","tone":"hot"}],"school":[{"when":"Mon · 7:30","what":"🍎 Snacks in the bag","hint":"late-lunch · Madi OK","tone":"act"},{"when":"Mon · SRE drop","what":"🏫 School drop with the boys","tone":"act"},{"when":"Tue · 8:50","what":"🤝 Madi + Randy collab at SRE","hint":"in person","tone":"act"},{"when":"Wed · school day","what":"👂 Hearing / vision screen at SRE","tone":"act"},{"when":"Thu · PE day","what":"👟 Tennis shoes for PE","tone":"act"},{"when":"Fri · field trip","what":"🚌 Museum + Meadowbrook (school day)","hint":"sack lunch · trip shirt · tennis shoes","tone":"act"},{"when":"All week","what":"🏡 DROP ZONE HQ @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"fun":[{"when":"After clears","what":"👑 Victory round — game pick with Dad","hint":"coins → jar → payday","tone":"fun"},{"when":"Outside","what":"⚡ Sports grind / run the yard","hint":"ask Dad","tone":"fun"},{"when":"Base mission","what":"☂️ Victory Jar · save with Dad","hint":"FUN · umbrella treat optional","tone":"fun"},{"when":"Squad","what":"🤝 Duo queue with Harris / crew","hint":"FUN","tone":"fun"}],"appointments":[],"appointmentsEmpty":"No appointments. Clear skies. GO PLAY.","streakLabel":"🔥 6-day fire streak — don't break it","missions":[{"when":"Every clear","what":"💥 Must done = coin banked in the jar","hint":"full week → jar $10 + $10 payday","tone":"fun"},{"when":"Weekly","what":"🧹 Room + 👟 shoes + 🎒 garage cubby","hint":"musts · ask Dad to inspect","tone":"fun"}]},"ainsley":{"id":"ainsley","name":"Ainsley","you":"you","theme":"quiet-folk","themeLabel":"Quiet Folk","gradeVoice":"8th grade","avatar":"A","currency":{"unit":"star","plural":"stars","symbol":"★","label":"Tour Stars"},"bankGoal":{"id":"tour-jar","title":"Tour Jar · earn then save","blurb":"Honest Dad-week musts (Fri→Thu) hit Tour Jar $20 AND full $20 payday (1★=$1). Miss musts = short or no full payday. Babysit $15/hr = hire add-on, not jar.","need":20,"reward":"Payday with Dad after honest musts","dollarNeed":20,"starDollar":1,"weeklyAllowance":20},"hottest":{"when":"SUN · vanity 3:00 · Jessy","what":"ON THE BOARD","where":"Vanity 3:00 · with Dad @ 147th","badges":["SUNDAY","3:00"]},"today":[{"kind":"event","when":"Morning · 9–2","what":"Garage sale / house shake with crew","hint":"Help the crew","tone":"act"},{"kind":"event","when":"3:00 LOCKED","what":"Vanity install · Jessy","hint":"your board","tone":"hot"},{"kind":"event","when":"After vanity","what":"Playlist + chill with Dad","hint":"your pick","tone":"fun"}],"quests":[{"id":"ain-bed","what":"Make bed — morning reset","stars":1,"cadence":"daily"},{"id":"ain-toys","what":"Room reset — clean pass","stars":1,"cadence":"daily"},{"id":"ain-dishwasher","what":"Clean up after you · rinse · in dishwasher","stars":1,"cadence":"daily"},{"id":"ain-empty","what":"Empty dishwasher","stars":1,"cadence":"daily"},{"id":"ain-living","what":"Shoes & coats · closet / cubby / room","stars":1,"cadence":"daily"},{"id":"ain-bath","what":"Bathroom wipe — weekly","stars":3,"cadence":"weekly"},{"id":"ain-laundry","what":"Laundry full cycle — her clothes","stars":5,"cadence":"weekly"},{"id":"ain-cubby","what":"🎒 Backpack + sports bag in garage cubby","stars":1,"cadence":"weekly"},{"id":"ain-babysit","what":"👶 Babysitting — optional hire (Dad books you)","stars":0,"cadence":"addon","optional":true,"hire":true,"hint":"not for jar · Dad handout","rateLabel":"$15/hr"}],"sports":[{"when":"Tue 29 · leave 4:25 · practice 5:00","what":"SWIM · Coach Ann · Genesis Ridgeview","hint":"YOUR set","tone":"hot"},{"when":"Thu 1 · leave 4:25 · practice 5:00","what":"SWIM · Coach Ann · Genesis Ridgeview","hint":"second set this week","tone":"sport"}],"sportsEmpty":"","school":[{"when":"Sun 27 · 9–2","what":"Garage sale / house shake with crew","tone":"act"},{"when":"Mon 28 · 3:00","what":"LKMS Homework Help","tone":"act"},{"when":"Tue 29 · school day","what":"Hearing / vision screen (volunteers)","hint":"at LKMS","tone":"act"},{"when":"Thu 1 · 3:00","what":"LKMS Homework Help","tone":"act"},{"when":"Fri 2 · due","what":"Yearbook baby photo due (email)","hint":"ask Dad if needed","tone":"act"},{"when":"All week","what":"Base @ 147th","hint":"Dad week through Fri Oct 2","tone":"hot"}],"appointments":[{"when":"Sun 27 · 3:00","what":"Vanity · Jessy","hint":"on your board","tone":"hot","herSpace":true},{"when":"Wed 30 · leave 12:40 · 1:00","what":"Midwest Anxiety · Lindsay","hint":"with Dad","tone":"act"}],"appointmentsEmpty":"","streakLabel":"◆ 4-day streak — hold the line","missions":[{"when":"Weekly","what":"Bath wipe + laundry + garage cubby = big star dump","hint":"musts · ask Dad to inspect","tone":"fun"},{"when":"Add-on","what":"Babysitting — optional · Dad books you","hint":"hire add-on · not for jar","tone":"fun"}],"goal":{"name":"Stick Season · concert save","need":40,"placeholder":"Set a goal with Dad"},"bag":{"place":"Dad","label":"This week @ Dad · bag","hint":"147th through Fri Oct 2 · pack for Dad week"},"rides":[{"id":"scooter","what":"🛴 Scooter run","when":"your call","clear":true},{"id":"bv-rec","what":"🏟️ BV Rec","when":"when you're free","clear":true},{"id":"swim","what":"🏊 Ridgeview swim","when":"Tue/Thu · leave 4:25","clear":true,"hours":"leave 4:25 · 5:00"}],"fun":[]},"dan":{"id":"dan","name":"Dad","theme":"house-dad","themeLabel":"Dad Box","avatar":"D","hottest":{"when":"Sun Sep 27 · kids with you @ 147th","what":"Dad week live","where":"through Fri Oct 2 · 3:00 handoff window","badges":["Dad week","147th"]},"today":[{"when":"Sun · 9–2","what":"Garage sale / whole-house shake @ 147th","tone":"act"},{"when":"Sun · 3:00","what":"Ainsley vanity · Jessy","tone":"hot"},{"when":"Custody","what":"Kids with Dad @ 147th through Fri Oct 2 3:00","tone":"hot"}],"week":[{"when":"Mon 28 · 7:30","what":"Hayes snacks in bag (late-lunch)","tone":"act"},{"when":"Mon 28 · 8:10 / 8:25","what":"SRE drop · Hayes + Harris","tone":"act"},{"when":"Mon 28 · 3:00","what":"Ainsley LKMS HW Help","tone":"act"},{"when":"Mon 28 · 3:15 / 3:40","what":"Boys pickup","tone":"act"},{"when":"Mon 28 · ~5:40 / 6:15","what":"Hayes baseball practice · BV Rec Field 3","tone":"sport"},{"when":"Tue 29 · 8:50","what":"Hayes · Madi + Randy collab @ SRE","tone":"act"},{"when":"Tue 29 · leave 4:25 / 5:00","what":"Ainsley swim · Genesis Ridgeview","tone":"sport"},{"when":"Tue 29 · leave 5:40 / 6:00","what":"Hayes flag practice · SRE fields (friend drop ~4:30)","tone":"sport"},{"when":"Wed 30 · 12:40 / 1:00","what":"Ainsley Midwest Anxiety · Lindsay","tone":"act"},{"when":"Wed 30 · ~4:55","what":"Harris flag practice · Timber Sage","tone":"sport"},{"when":"Thu 1 · PE","what":"Boys tennis shoes · SRE PE","tone":"act"},{"when":"Thu 1 · 3:00 / 3:15","what":"Ainsley HW Help · boys pickup","tone":"act"},{"when":"Thu 1 · leave 4:25 / 5:00","what":"Ainsley swim · Genesis","tone":"sport"},{"when":"Thu 1 · leave ~4:55 / 5:30","what":"Hayes baseball game · Falcons vs Lions · Field 24","tone":"sport"},{"when":"Fri 2 · 8:10 drop then 3:00","what":"SRE drop · handoff @ 3:00 · Mom week","tone":"hot"},{"when":"through Fri Oct 2 3:00","what":"Kids with Dad @ 147th","tone":"hot"}],"leaveBys":[{"when":"Weekday school","what":"SRE drop leave 8:10 for 8:25","tone":"act"},{"when":"Weekday pickup","what":"Leave 3:15 for 3:40 boys","tone":"act"},{"when":"Sports rule","what":"Event START = your leave-by","tone":"act"}],"picks":[{"when":"Tonight","what":"Dinner vote with crew","hint":"House · kids-safe","tone":"fun"},{"when":"This week","what":"Sports stack · Mon ball · Tue flag/swim · Wed Harris flag · Thu game/swim","hint":"Dad drives","tone":"fun"}],"note":"Kids-safe Dad box · no money · no Desk · calendar facts from dmward23 / Atlas only"}},"boardStrip":{"label":"Next up · today","time":"3:00","place":"Ainsley vanity · Jessy","detailHtml":"Garage sale <strong>9–2</strong> @ 147th · then vanity · kids with Dad @ <strong>147th</strong> through Fri Oct 2 3:00","badge":"Sun"}};

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

  function loadKeyState(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveKeyState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* */ }
  }

  /* Legacy flat blob — only for one-shot migrate into day keys */
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
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (typeof root[kidId].balance !== "number") root[kidId].balance = Number(root[kidId].balance) || 0;
    if (typeof root[kidId].lifetime !== "number") root[kidId].lifetime = Number(root[kidId].lifetime) || 0;
    if (!root[kidId].days[DAY_ISO]) root[kidId].days[DAY_ISO] = { stars: 0, earned: {} };
    return { root: root, day: root[kidId].days[DAY_ISO], bag: root[kidId] };
  }

  function questStarsFor(kidId, checkId, data) {
    return questMeta(kidId, checkId, data).stars;
  }

  function applyCheckToBank(checkId, done, data) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return null;
    var meta = questMeta(kidId, checkId, data);
    /* Daily musts bank only via syncDailyWeekBank (full-week unlock) */
    if (meta.cadence === "daily" && !meta.optional) {
      return syncDailyWeekBank(checkId, data);
    }
    var pack = kidDayBank(kidId);
    var stars = bankStarsFor(kidId, checkId, data);
    var was = !!pack.day.earned[checkId];
    if (done && !was) {
      pack.day.earned[checkId] = true;
      pack.bag.lifetime = (pack.bag.lifetime || 0) + stars;
    } else if (!done && was) {
      delete pack.day.earned[checkId];
      pack.bag.lifetime = Math.max(0, (pack.bag.lifetime || 0) - stars);
    }
    recomputeDayStars(kidId, pack.day, data);
    saveBankRoot(pack.root);
    return getBankView(kidId, data);
  }

  function allowanceCap(goal) {
    var g = goal || {};
    var cap = typeof g.weeklyAllowance === "number" ? g.weeklyAllowance : null;
    if (cap == null || isNaN(cap)) cap = typeof g.need === "number" ? g.need : 0;
    return Math.max(0, Number(cap) || 0);
  }

  function starDollarOf(goal) {
    var g = goal || {};
    return g.starDollar != null ? Number(g.starDollar) : 1;
  }

  function weekEarnDollars(kidId, data) {
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    var cap = allowanceCap(goal);
    var raw = week * (isNaN(sd) ? 1 : sd);
    return Math.min(raw, cap);
  }

  /** Move prior (completed) weeks' stars into durable balance$ so unpaid carry survives rollover. */
  function settlePriorWeeksIntoBalance(kidId, data) {
    var pack = kidDayBank(kidId);
    var bag = pack.bag;
    if (!bag.days) return;
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var curStart = weekStartIso(DAY_ISO);
    var byWeek = {};
    Object.keys(bag.days).forEach(function (iso) {
      var ws = weekStartIso(iso);
      if (ws >= curStart) return; /* current week stays as week stars */
      if (!byWeek[ws]) byWeek[ws] = 0;
      byWeek[ws] += (bag.days[iso] && bag.days[iso].stars) ? bag.days[iso].stars : 0;
    });
    var added = 0;
    Object.keys(byWeek).forEach(function (ws) {
      var stars = byWeek[ws] || 0;
      if (stars <= 0) return;
      var earn = Math.min(stars * sd, cap);
      bag.balance = (bag.balance || 0) + earn;
      added += earn;
      /* clear settled prior-week day buckets */
      var parts = ws.split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      for (var i = 0; i < DAD_WEEK_DAYS; i++) {
        var iso = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        if (bag.days[iso]) bag.days[iso] = { stars: 0, earned: {} };
        d.setDate(d.getDate() + 1);
      }
    });
    if (added) saveBankRoot(pack.root);
    return added;
  }

  function getBankView(kidId, data) {
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || { need: 8, title: "Goal", blurb: "", reward: "" };
    var cur = kid.currency || { plural: "stars", symbol: "★", label: "Stars" };
    var today = pack.day.stars || 0;
    /* Week star tally → jar / weekly allowance goal (existing need $ amounts) */
    var week = weekStarsFor(kidId);
    var life = pack.bag.lifetime || 0;
    var balance = typeof pack.bag.balance === "number" ? pack.bag.balance : (Number(pack.bag.balance) || 0);
    var weeklyAllowance = allowanceCap(goal);
    var starDollar = starDollarOf(goal);
    var weekEarn = Math.min(week * (isNaN(starDollar) ? 1 : starDollar), weeklyAllowance);
    var toward = Math.min(week, goal.need);
    var pct = goal.need ? Math.round((toward / goal.need) * 100) : 0;
    /* Available $ toward jar / personal saves = carry + this week's earn */
    var available = balance + weekEarn;
    return {
      kidId: kidId,
      today: today,
      week: week,
      weekEarn: weekEarn,
      balance: balance,
      available: available,
      weeklyAllowance: weeklyAllowance,
      starDollar: isNaN(starDollar) ? 1 : starDollar,
      lifetime: life,
      need: goal.need,
      toward: toward,
      pct: Math.min(100, pct),
      reached: week >= goal.need,
      goalTitle: goal.title,
      goalBlurb: goal.blurb,
      reward: goal.reward,
      currency: cur,
      dayIso: DAY_ISO,
      weekStart: weekStartIso(DAY_ISO),
      earned: Object.assign({}, pack.day.earned)
    };
  }

  function getCheckRaw(checkId, data, dayIso) {
    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key);
    if (Object.prototype.hasOwnProperty.call(state, checkId)) return !!state[checkId];
    /* one-shot migrate from legacy flat key into day/week key (today only) */
    if (!dayIso || dayIso === DAY_ISO) {
      var legacy = loadChecks();
      if (Object.prototype.hasOwnProperty.call(legacy, checkId)) {
        state[checkId] = !!legacy[checkId];
        saveKeyState(key, state);
        return !!state[checkId];
      }
    }
    return false;
  }

  function getCheck(checkId, data, dayIso) {
    return getCheckRaw(checkId, data, dayIso);
  }

  function setCheck(checkId, done, data, dayIso) {
    var kidId = KID_FROM_CHECK[checkId];
    var meta = kidId
      ? questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data))
      : { cadence: "daily", stars: 1, optional: false };
    var before = kidId ? getBankView(kidId, data) : null;
    var was = before ? before.reached : false;
    var beforeWeekDone = (meta.cadence === "daily" && !meta.optional)
      ? dailyWeekComplete(checkId, data)
      : false;
    var beforeEarned = false;
    if (kidId && meta.cadence !== "daily") {
      try {
        var packPre = kidDayBank(kidId);
        beforeEarned = !!(packPre.day.earned && packPre.day.earned[checkId]);
      } catch (ePre) { beforeEarned = false; }
    }

    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key);
    state[checkId] = !!done;
    saveKeyState(key, state);
    /* keep legacy blob in sync for old readers (today / weekly only) */
    try {
      if (!dayIso || dayIso === DAY_ISO || meta.cadence === "weekly") {
        var legacy = loadChecks();
        if (!!done) legacy[checkId] = true;
        else delete legacy[checkId];
        saveChecks(legacy);
      }
    } catch (eL) { /* */ }

    var bank = null;
    var newlyBanked = false;
    if (meta.cadence === "daily" && !meta.optional) {
      var afterWeekDone = dailyWeekComplete(checkId, data);
      newlyBanked = afterWeekDone && !beforeWeekDone;
      bank = syncDailyWeekBank(checkId, data);
    } else {
      newlyBanked = !!(kidId && done && !beforeEarned && !meta.optional);
      bank = applyCheckToBank(checkId, !!done, data);
    }

    if (bank && bank.reached && !was) {
      try { localStorage.setItem("house-bank-goal:" + bank.kidId, "1"); } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: bank.kidId, reward: bank.reward, bank: bank } }));
      } catch (e) {}
    }
    /* Flash $ only when week unlocks (daily) or weekly/addon newly banks — 1★=$1 */
    if (bank && newlyBanked) {
      try {
        var bucks = bankStarsFor(kidId, checkId, data);
        if (bucks > 0) {
          document.dispatchEvent(new CustomEvent("house:earn", {
            detail: { kidId: kidId, dollars: bucks, checkId: checkId, bank: bank }
          }));
        }
      } catch (eEarn) { /* */ }
    }
    return bank;
  }

  function syncBankFromChecks(data) {
    Object.keys(KID_FROM_CHECK).forEach(function (id) {
      var kidId = KID_FROM_CHECK[id];
      var meta = questMeta(kidId, id, data);
      if (meta.cadence === "daily" && !meta.optional) syncDailyWeekBank(id, data);
      else applyCheckToBank(id, getCheck(id, data), data);
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

  function questHTML(q, done, kidId, data) {
    var optional = !!(q.optional || q.cadence === "addon");
    var cadence = q.cadence || (optional ? "addon" : "daily");
    var stars = optional ? 0 : (typeof q.stars === "number" ? q.stars : 1);
    var weekPay = cadence === "daily" && !optional ? stars * dadWeekLen() : stars;
    var dayCount = 0;
    var weekDone = false;
    if (cadence === "daily" && !optional) {
      dayCount = dailyDoneCount(q.id, data);
      weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      done = weekDone;
    }
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
    } else if (cadence === "weekly") {
      hint = done ? "weekly clear · +$" + stars + " banked" : "weekly must · tap · +$" + stars + " (1★=$1)";
    } else {
      var needN = weekDayIsos(DAY_ISO).length;
      hint = weekDone
        ? needN + "/" + needN + " Dad days · +$" + weekPay + " unlocked"
        : dayCount + "/" + needN + " days · Dad week (Fri–Thu) unlocks $" + weekPay + " (1★×" + needN + ")";
    }
    var earn;
    if (optional) {
      if (q.hire && kidId === "ainsley") {
        earn = '<span class="star-earn addon-tag">' + (done ? "$15/hr ✓" : "$15/hr") + "</span>";
      } else {
        earn = '<span class="star-earn addon-tag">' + (done ? "OPTIONAL ✓" : "OPTIONAL") + "</span>";
      }
    } else if (cadence === "daily") {
      earn = '<span class="star-earn" data-stars="' + weekPay + '">' + (weekDone ? "+$" + weekPay : "$" + weekPay + " wk") + "</span>";
    } else {
      earn = '<span class="star-earn" data-stars="' + stars + '">' + (done ? "+$" + stars : "$" + stars) + "</span>";
    }
    var optAttr = optional ? ' data-optional="1"' : "";
    var hireAttr = (optional && q.hire) ? ' data-hire="1"' : "";
    var cadAttr = ' data-cadence="' + esc(cadence) + '"';
    var softClass = optional ? " addon soft" : "";
    var dailyClass = (cadence === "daily" && !optional) ? " daily-week" : "";
    var starsAttr = ' data-stars="' + (cadence === "daily" && !optional ? weekPay : stars) + '"';

    if (cadence === "daily" && !optional) {
      var days = weekDayIsos(DAY_ISO);
      var taps = "";
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var dayOn = getCheck(q.id, data, iso);
        var isToday = iso === DAY_ISO;
        var cls = "day-tap" + (dayOn ? " done" : "") + (isToday ? " is-today" : "");
        taps += '<button type="button" class="' + cls + '" data-check="' + esc(q.id) + '" data-day-iso="' + esc(iso) +
          '" data-kid-quest="1" data-cadence="daily"' + starsAttr +
          ' aria-label="' + DOW_LONG[dowIndexFromIso(iso)] + " · " + esc(q.what) + '" aria-pressed="' + (dayOn ? "true" : "false") + '">' +
          DOW_SHORT[dowIndexFromIso(iso)] + "</button>";
      }
      return (
        '<div class="quest ' + open + softClass + dailyClass + '" data-quest-id="' + esc(q.id) + '" data-kid-quest="1"' +
        optAttr + hireAttr + cadAttr + starsAttr + ">" +
        '<div class="quest-body"><div class="what">' + esc(q.what) + '</div><div class="hint">' + esc(hint) +
        '</div><div class="quest-days" role="group" aria-label="Days this week">' + taps + "</div></div>" +
        earn +
        "</div>"
      );
    }

    return (
      '<div class="quest ' + open + softClass + '" data-check="' + esc(q.id) + '" data-kid-quest="1"' + optAttr + hireAttr + cadAttr + starsAttr + ' role="button" tabindex="0">' +
      '<span class="ring">' + ring + "</span>" +
      '<div><div class="what">' + esc(q.what) + '</div><div class="hint">' + esc(hint) + "</div></div>" +
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
    el.innerHTML = (quests || []).map(function (q) {
      var optional = !!(q.optional || q.cadence === "addon");
      var cadence = q.cadence || (optional ? "addon" : "daily");
      var done = cadence === "daily" && !optional
        ? dailyWeekComplete(q.id, data)
        : getCheck(q.id, data);
      return questHTML(q, done, kidId, data);
    }).join("");
  }

  /** Upgrade static sheet-chores rows: daily musts get Fri→Thu Dad-week taps. */
  function enhanceSharedChores(root, data) {
    root = root || document;
    data = data || (global.WardKids && global.WardKids._data);
    if (!data) return;
    var nodes = root.querySelectorAll(".chore[data-check], .quest[data-check]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains("day-tap")) return;
      if (el.querySelector(".quest-days")) return;
      var id = el.getAttribute("data-check");
      if (!id || !KID_FROM_CHECK[id]) return;
      var kidId = KID_FROM_CHECK[id];
      var meta = questMeta(kidId, id, data);
      el.setAttribute("data-cadence", meta.cadence);
      var nDays = dadWeekLen();
      el.setAttribute("data-stars", String(meta.optional ? 0 : (meta.cadence === "daily" ? meta.stars * nDays : meta.stars)));
      if (meta.optional) {
        el.setAttribute("data-optional", "1");
        var earnOpt = el.querySelector(".star-earn");
        if (earnOpt && el.getAttribute("data-check") === "ain-babysit") {
          earnOpt.classList.add("addon-tag");
          earnOpt.textContent = "$15/hr";
          earnOpt.setAttribute("data-stars", "0");
        }
        return;
      }
      if (meta.cadence === "weekly") {
        var earnW = el.querySelector(".star-earn");
        if (earnW) {
          earnW.setAttribute("data-stars", String(meta.stars));
          earnW.textContent = "$" + meta.stars;
        }
        var hintW = el.querySelector(".hint");
        if (hintW && !hintW.getAttribute("data-hint-open")) {
          hintW.setAttribute("data-hint-open", hintW.textContent);
        }
        return;
      }
      if (meta.cadence !== "daily") return;

      var weekPay = meta.stars * nDays;
      var dayCount = dailyDoneCount(id, data);
      var weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      var whatEl = el.querySelector(".what");
      var what = whatEl ? whatEl.textContent : id;
      var days = weekDayIsos(DAY_ISO);
      var taps = document.createElement("div");
      taps.className = "quest-days";
      taps.setAttribute("role", "group");
      taps.setAttribute("aria-label", "Days this week");
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day-tap" + (getCheck(id, data, iso) ? " done" : "") + (iso === DAY_ISO ? " is-today" : "");
        btn.setAttribute("data-check", id);
        btn.setAttribute("data-day-iso", iso);
        btn.setAttribute("data-kid-quest", "1");
        btn.setAttribute("data-cadence", "daily");
        btn.setAttribute("data-stars", String(weekPay));
        btn.setAttribute("aria-label", DOW_LONG[dowIndexFromIso(iso)] + " · " + what);
        btn.setAttribute("aria-pressed", getCheck(id, data, iso) ? "true" : "false");
        btn.textContent = DOW_SHORT[dowIndexFromIso(iso)];
        taps.appendChild(btn);
      }
      var txt = el.querySelector(".txt") || el;
      var hint = el.querySelector(".hint");
      if (hint) {
        var needN = weekDayIsos(DAY_ISO).length;
        hint.setAttribute("data-hint-open", dayCount + "/" + needN + " days · Dad week (Fri–Thu) unlocks $" + weekPay);
        hint.textContent = weekDone
          ? needN + "/" + needN + " Dad days · +$" + weekPay + " unlocked"
          : dayCount + "/" + needN + " days · Dad week (Fri–Thu) unlocks $" + weekPay;
      }
      var earn = el.querySelector(".star-earn");
      if (earn) {
        earn.setAttribute("data-stars", String(weekPay));
        earn.textContent = weekDone ? "+$" + weekPay : "$" + weekPay + " wk";
      }
      var kids = el.children;
      for (var ri = 0; ri < kids.length; ri++) {
        if (kids[ri].classList && kids[ri].classList.contains("ring")) {
          kids[ri].style.display = "none";
          break;
        }
      }
      el.classList.add("daily-week");
      el.classList.toggle("done", weekDone);
      el.classList.toggle("open", !weekDone);
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
      /* Move data-check off the row so only day-taps toggle */
      el.setAttribute("data-quest-id", id);
      el.removeAttribute("data-check");
      if (txt && txt !== el) txt.appendChild(taps);
      else el.appendChild(taps);
    });
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

  /**
   * Payday / jar reset.
   * 1) Convert this week's stars into durable balance$ (capped by weeklyAllowance).
   * 2) Subtract what Dad paid (optional paidAmount; default 0 = full carry).
   * 3) Clear week star buckets. Never zeros lifetime (long save goals stay intact).
   */
  function resetJarCycle(kidId, paidAmount, data) {
    data = data || (global.WardKids && global.WardKids._data) || null;
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var weekEarn = Math.min(week * sd, cap);
    if (typeof pack.bag.balance !== "number") pack.bag.balance = Number(pack.bag.balance) || 0;
    /* Week stars → balance (survive rollover); unpaid stays as carry */
    pack.bag.balance = (pack.bag.balance || 0) + weekEarn;
    var paid = 0;
    if (paidAmount != null && paidAmount !== "") {
      paid = Math.max(0, Number(paidAmount));
      if (isNaN(paid)) paid = 0;
    }
    paid = Math.min(paid, pack.bag.balance);
    pack.bag.balance = Math.max(0, pack.bag.balance - paid);
    /* DO NOT zero lifetime — personal long saves use lifetime/balance separately */
    /* Clear this week's day star buckets so jar/week bar resets */
    var start = weekStartIso(DAY_ISO);
    var parts = start.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    for (var i = 0; i < DAD_WEEK_DAYS; i++) {
      var iso = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      if (pack.root[kidId] && pack.root[kidId].days) {
        pack.root[kidId].days[iso] = { stars: 0, earned: {} };
      }
      d.setDate(d.getDate() + 1);
    }
    saveBankRoot(pack.root);
    var bal = pack.bag.balance || 0;
    var stamp = paid > 0
      ? ("Paid $" + paid + " · $" + bal + " carry")
      : ("Jar reset · $" + bal + " carry");
    try {
      localStorage.removeItem("house-bank-goal:" + kidId);
      localStorage.setItem("house-bank-paid:" + kidId, stamp);
      localStorage.setItem("house-bank-paid-at:" + kidId, new Date().toISOString());
      localStorage.setItem("house-bank-paid-amount:" + kidId, String(paid));
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
    /* Prefer durable balance$ (+ this week earn) for money carry; lifetime stars remain available */
    var money = 0;
    if (bank) {
      if (bank.balance != null || bank.weekEarn != null) {
        money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
      } else if (bank.available != null) {
        money = Number(bank.available) || 0;
      } else {
        money = Number(bank.lifetime || bank.toward || 0) || 0;
      }
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: placeholder, name: name, need: need, toward: toward, met: toward >= need, unit: "$" };
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
      /* Week star tally drives the jar number */
      el.textContent = String(bank.week != null ? bank.week : bank.lifetime);
    });
    root.querySelectorAll("[data-bank-week]").forEach(function (el) {
      el.textContent = String(bank.week != null ? bank.week : bank.toward);
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
    var bal = bank.balance != null ? bank.balance : 0;
    var we = bank.weekEarn != null ? bank.weekEarn : bank.toward;
    root.querySelectorAll("[data-bank-balance]").forEach(function (el) {
      el.textContent = String(bal);
    });
    root.querySelectorAll("[data-bank-week-earn]").forEach(function (el) {
      el.textContent = String(we);
    });
    root.querySelectorAll("[data-bank-available]").forEach(function (el) {
      el.textContent = String(bank.available != null ? bank.available : (bal + we));
    });
    root.querySelectorAll("[data-bank-allowance]").forEach(function (el) {
      el.textContent = String(bank.weeklyAllowance != null ? bank.weeklyAllowance : bank.need);
    });
    root.querySelectorAll("[data-bank-meta]").forEach(function (el) {
      if (dollar) {
        el.textContent = "Balance $" + bal + " · This week $" + we + " · Jar $" + bank.toward + " / $" + bank.need;
      } else {
        el.textContent = "week " + bank.toward + " / " + bank.need + " ★";
      }
    });
    var left = Math.max(0, bank.need - bank.toward);
    root.querySelectorAll("[data-bank-left]").forEach(function (el) {
      if (bank.reached) el.textContent = "Jar full · $" + bank.need + " · Balance $" + bal;
      else if (dollar) el.textContent = "$" + left + " left on jar · Balance $" + bal;
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
      el.textContent = "JAR FULL · saved $" + bank.need + " · show Dad";
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
    try {
      renderGrow(root, bank.kidId, global.WardKids && global.WardKids._data, bank);
    } catch (eG) { /* */ }
  }


  function growGoalView(kidId, data, bank) {
    var gv = personalGoalView(kidId, data, bank);
    if (gv && gv.active && gv.need > 0) return gv;
    var kid = data && data.kids && data.kids[kidId];
    var bg = (kid && kid.bankGoal) || {};
    var need = typeof bg.dollarNeed === "number" ? bg.dollarNeed : (typeof bg.need === "number" ? bg.need : 0);
    var name = String(bg.title || "Jar").split("·")[0].trim() || "Jar";
    var money = 0;
    if (bank) {
      if (bank.available != null) money = Number(bank.available) || 0;
      else money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
    }
    if (need <= 0) {
      return { active: false, placeholder: (gv && gv.placeholder) || "Add a save", name: "", need: 0, toward: 0, met: false, unit: "$" };
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: "", name: name, need: need, toward: toward, met: toward >= need, unit: "$", fallback: true };
  }

  var GROW_THEME = {
    harris: { cls: "grow-gems", token: "◆", label: "GROW · gems" },
    hayes: { cls: "grow-coins", token: "◎", label: "GROW · victory coins" },
    ainsley: { cls: "grow-jar", token: "★", label: "GROW · jar" }
  };

  function renderGrow(root, kidId, data, bank) {
    if (!root || !bank) return;
    var theme = GROW_THEME[kidId] || GROW_THEME.harris;
    var gv = growGoalView(kidId, data || (global.WardKids && global.WardKids._data), bank);
    var bal = bank.balance != null ? Number(bank.balance) || 0 : 0;
    var we = bank.weekEarn != null ? Number(bank.weekEarn) || 0 : 0;
    var available = bank.available != null ? Number(bank.available) || 0 : (bal + we);
    var need = gv.active ? gv.need : 0;
    var toward = gv.active ? gv.toward : Math.min(available, need || available);
    var pct = need > 0 ? Math.max(0, Math.min(100, Math.round((toward / need) * 100))) : 0;

    root.querySelectorAll("[data-grow-meter]").forEach(function (meter) {
      meter.classList.remove("grow-gems", "grow-coins", "grow-jar");
      meter.classList.add("grow-meter", theme.cls);
      meter.setAttribute("data-kid", kidId);
      meter.setAttribute("aria-label", theme.label + (gv.active ? (" · " + gv.name) : ""));
      if (!meter._growWired) {
        meter._growWired = true;
        meter.addEventListener("click", function () {
          /* HouseSfx.wireGrowFx owns pointerdown poke — click = a11y fallback only */
          if (window.HouseSfx && HouseSfx.jarPoke) return;
          meter.classList.remove("is-animating", "is-poking");
          void meter.offsetWidth;
          meter.classList.add("is-animating", "is-poking");
          setTimeout(function () { meter.classList.remove("is-animating", "is-poking"); }, 750);
        });
      }
      if (window.HouseSfx && HouseSfx.wireGrowFx) HouseSfx.wireGrowFx();
    });

    var balPct = need > 0 ? Math.max(0, Math.min(100, (bal / need) * 100)) : 0;
    var weekPct = need > 0 ? Math.max(0, Math.min(100 - balPct, (we / need) * 100)) : 0;
    root.querySelectorAll("[data-grow-fill]").forEach(function (el) {
      el.style.height = pct + "%";
      el.classList.toggle("is-full", !!(gv.active && gv.met));
    });
    root.querySelectorAll("[data-grow-fill-balance]").forEach(function (el) {
      el.style.height = balPct + "%";
      el.style.bottom = "0%";
    });
    root.querySelectorAll("[data-grow-fill-week]").forEach(function (el) {
      el.style.height = weekPct + "%";
      el.style.bottom = balPct + "%";
    });
    root.querySelectorAll("[data-grow-pct]").forEach(function (el) {
      el.textContent = pct + "%";
    });
    root.querySelectorAll("[data-grow-title]").forEach(function (el) {
      el.textContent = theme.label;
    });
    root.querySelectorAll("[data-grow-jar-name]").forEach(function (el) {
      el.textContent = gv.active ? (gv.fallback ? gv.name : gv.name) : (theme.label.split("·")[0].trim() || "Jar");
      if (gv.active && !gv.fallback) {
        /* keep jar brand from theme when personal save is active — show save in Save for line */
        var brands = { harris: "Gem Jar", hayes: "Victory Jar", ainsley: "Tour Jar" };
        el.textContent = brands[kidId] || gv.name;
      } else if (gv.active) {
        el.textContent = gv.name;
      }
    });
    root.querySelectorAll("[data-grow-total]").forEach(function (el) {
      el.textContent = "$" + toward;
    });
    root.querySelectorAll("[data-grow-week-rising]").forEach(function (el) {
      el.textContent = "week +$" + we + " rising ↑";
    });
    root.querySelectorAll("[data-grow-goal-lab]").forEach(function (el) {
      el.textContent = need > 0 ? ("GOAL " + need) : "GOAL";
    });
    root.querySelectorAll("[data-grow-balance]").forEach(function (el) {
      el.textContent = "$" + bal;
    });
    root.querySelectorAll("[data-grow-week]").forEach(function (el) {
      el.textContent = "$" + we;
    });
    root.querySelectorAll("[data-grow-save-name]").forEach(function (el) {
      el.textContent = gv.active ? gv.name : (gv.placeholder || "Add a save");
    });
    root.querySelectorAll("[data-grow-save-toward]").forEach(function (el) {
      el.textContent = String(gv.active ? toward : 0);
    });
    root.querySelectorAll("[data-grow-save-need]").forEach(function (el) {
      var n = gv.active ? need : 0;
      /* money-chip already prints $ before this span — keep bare digits there */
      if (el.closest && el.closest(".grow-total")) el.textContent = "$" + n;
      else el.textContent = String(n);
    });
    root.querySelectorAll("[data-grow-save-line]").forEach(function (el) {
      if (!gv.active) el.textContent = gv.placeholder || "Add a save";
      else el.textContent = gv.name + " · $" + toward + "/$" + need;
    });

    /* Stack tokens scale with fill (max 8) */
    var n = need > 0 ? Math.max(0, Math.min(8, Math.ceil((pct / 100) * 8))) : 0;
    root.querySelectorAll("[data-grow-icons]").forEach(function (box) {
      var html = "";
      for (var i = 0; i < n; i++) {
        html += '<span class="grow-token" style="animation-delay:' + (i * 0.04) + 's">' + theme.token + "</span>";
      }
      box.innerHTML = html;
    });
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
        el.textContent = "Tell Dad — goal met · " + gv.name + " ($" + gv.need + ")";
        el.classList.add("is-met", "is-active");
      } else {
        el.textContent = gv.name + " · $" + gv.toward + "/$" + gv.need;
        el.classList.add("is-active");
      }
    });
    try { renderGrow(root, kidId, data, bank || getBankView(kidId, data)); } catch (ePG) { /* */ }
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
    checkKeyFor: checkKeyFor,
    weekStartIso: weekStartIso,
    weekDayIsos: weekDayIsos,
    dadWeekLen: dadWeekLen,
    DAD_WEEK_DAYS: DAD_WEEK_DAYS,
    dowIndexFromIso: dowIndexFromIso,
    chicagoHourNow: chicagoHourNow,
    weekStarsFor: weekStarsFor,
    dailyDoneCount: dailyDoneCount,
    dailyWeekComplete: dailyWeekComplete,
    bankStarsFor: bankStarsFor,
    syncDailyWeekBank: syncDailyWeekBank,
    enhanceSharedChores: enhanceSharedChores,
    questMeta: questMeta,
    loadChecks: loadChecks,
    saveChecks: saveChecks,
    loadKeyState: loadKeyState,
    saveKeyState: saveKeyState,
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
    settlePriorWeeksIntoBalance: settlePriorWeeksIntoBalance,
    weekEarnDollars: weekEarnDollars,
    allowanceCap: allowanceCap,
    getPaidStamp: getPaidStamp,
    personalGoalView: personalGoalView,
    growGoalView: growGoalView,
    renderGrow: renderGrow,
    buildNoSurprise: buildNoSurprise,
    boot: boot,
    loadJSON: loadJSON,
    _data: null
  };
})(window);
