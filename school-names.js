/* SCHOOLNAMES1 · school names never live in git (PRIVNAME1, role "school"). Same sources and token rule as
 * livinghouse/lh-rules.js (LHRules.setSchools / schoolTokens / isSchoolText / stripSchool), so both lines agree.
 *
 * Runtime sources, first hit wins:
 *   setSchools([...])                       tests (synthetic token, e.g. "QXS")
 *   window.WARDOS_PRIVATE_NAMES.school      browser: set by private-feed.js from the hub's token-only
 *                                           /api/private/private-names.json (role school only); never in git
 *   node: WARDOS_NAMES "school=X;..." · WARDOS_PRIVATE_NAMES=<path> · ~/.local/share/wardos-private/private-names.tsv
 *         · ~/.config/wardos/private-names.tsv  (TAB separated "school<TAB>NAME" rows, mode 600, box only)
 * Rows: a short code (letters only, 2 to 8, same rule as LHRules) is a TOKEN; a name of 2 to 4 words
 * (letters, single spaces) is a FULL NAME. Anything else is dropped.
 * Nothing found = empty lists: every pattern built from them matches nothing (school words alone never classify).
 * Callers build their regexes at call time (rx() / alt() / fullAlt()), so names that arrive later are picked up. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SchoolNames = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function (root) {
  "use strict";
  var TOKEN = /^[A-Za-z]{2,8}$/;
  var FULL = /^[A-Za-z]{2,}(?: [A-Za-z]{2,}){1,3}$/;
  var LIST = null;

  function readRows() {
    var out = [];
    try {
      var w = typeof window !== "undefined" && window.WARDOS_PRIVATE_NAMES;
      if (w && w.school) return [].concat(w.school);
      if (typeof process !== "undefined" && process.env && typeof require === "function") {
        var env = process.env;
        if (env.WARDOS_NAMES) {
          env.WARDOS_NAMES.split(";").forEach(function (kv) {
            var i = kv.indexOf("=");
            if (i > 0 && kv.slice(0, i).trim().toLowerCase() === "school") out.push(kv.slice(i + 1).trim());
          });
          return out;
        }
        var fs = require("fs"), path = require("path"), H = require("os").homedir();
        var fps = [env.WARDOS_PRIVATE_NAMES, path.join(env.WARDOS_PRIVATE_DIR || path.join(H, ".local/share/wardos-private"), "private-names.tsv"), path.join(H, ".config/wardos/private-names.tsv")];
        for (var i = 0; i < fps.length; i++) {
          if (!fps[i] || !fs.existsSync(fps[i])) continue;
          fs.readFileSync(fps[i], "utf8").split("\n").forEach(function (ln) {
            if (!ln.trim() || ln.charAt(0) === "#") return;
            var c = ln.split("\t");
            if (String(c[0]).trim().toLowerCase() === "school" && c[1]) out.push(c[1].trim());
          });
          return out;
        }
      }
    } catch (e) { /* no private names = empty */ }
    return out;
  }
  function clean(list) {
    return [].concat(list || []).map(function (t) { return String(t || "").trim().replace(/\s+/g, " "); })
      .filter(function (t) { return TOKEN.test(t) || FULL.test(t); });
  }
  function all() {
    if (LIST) return LIST;
    var l = clean(readRows());
    if (l.length) LIST = l; /* empty is never cached: the browser feed may deliver names later */
    return l;
  }
  function setSchools(list) { LIST = list ? clean(list) : null; }
  function schoolTokens() { return all().filter(function (t) { return TOKEN.test(t); }); }
  function fullNames() { return all().filter(function (t) { return FULL.test(t); }); }
  var NEVER = "(?!)";
  /* regex source: "A|B" for the tokens, or a never-matching group when none are known */
  function alt() { var t = schoolTokens(); return t.length ? t.join("|") : NEVER; }
  function fullAlt() { var t = fullNames(); return t.length ? t.map(function (n) { return n.split(" ").join("\\s+"); }).join("|") : NEVER; }
  function schoolRe(flags) { var t = schoolTokens(); return t.length ? new RegExp("\\b(?:" + t.join("|") + ")\\b", flags || "i") : null; }
  function isSchoolText(s) { var re = schoolRe(); return !!(re && re.test(String(s || ""))); }
  function stripSchool(s) { var t = schoolTokens(); s = String(s || ""); return t.length ? s.replace(new RegExp("\\b(?:" + t.join("|") + ")\\s+", "g"), "") : s; }
  /* rx(src, flags): a regex from source text where "§" stands for the tokens and "¶" for the full names */
  function rx(src, flags) { return new RegExp(String(src).split("§").join("(?:" + alt() + ")").split("¶").join("(?:" + fullAlt() + ")"), flags || ""); }
  /* display word: the first token (private, box/device only), else the plain word */
  function label(fallback) { var t = schoolTokens(); return t.length ? t[0] : (fallback == null ? "School" : fallback); }
  return { setSchools: setSchools, schoolTokens: schoolTokens, fullNames: fullNames, alt: alt, fullAlt: fullAlt, schoolRe: schoolRe, rx: rx, isSchoolText: isSchoolText, stripSchool: stripSchool, label: label, NEVER: NEVER };
});
