/* PIIGUARD1/2/3/4 · pii-guard tests. Every fixture is SYNTHETIC (invented street, ocean-floor coordinates, 555 phones).
   Real lists are switched off (PII_GUARD_NO_BOX_DEFAULT) so the test never reads or prints the box denylist. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { main, scanText, loadAllow, hmac } from "./pii-guard.mjs";
import { addressEntries } from "./pii-guard-gen.mjs";
const I31 = String(2 ** 31 - 1), U32 = String(2 ** 32 - 1); // int32/uint32 limits, built at runtime (no literal in source)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE_ADDR = ["4321", "Fakeview", "Terrace"].join(" ");          /* synthetic, no such street */
const FAKE_LAT = ["-12", "3456"].join("."), FAKE_LON = ["-65", "4321"].join(".");  /* open ocean, synthetic */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piiguard-test-"));
process.env.PII_GUARD_NO_BOX_DEFAULT = "1";
delete process.env.PII_GUARD_DENYLIST; delete process.env.PII_GUARD_KEY;

function genFixtureDenylist() {
  const priv = path.join(tmp, "priv"), cfg = path.join(tmp, "cfg");
  fs.mkdirSync(priv, { recursive: true }); fs.mkdirSync(path.join(cfg, "filter-repo"), { recursive: true });
  fs.writeFileSync(path.join(priv, "calendar-dump.json"), JSON.stringify([{ summary: "Synthetic", location: FAKE_ADDR + ", Nowhere, ZZ 00000" }]));
  const out = execFileSync(process.execPath, [path.join(HERE, "pii-guard-gen.mjs"), "--out", path.join(tmp, "deny.txt"), "--key", path.join(tmp, "k.key")],
    { env: { ...process.env, WARDOS_PRIVATE_DIR: priv, PII_GUARD_CFG_DIR: cfg } }).toString();
  assert.match(out, /hashed windows/);
  assert.equal(fs.statSync(path.join(tmp, "k.key")).mode & 0o777, 0o600);
  assert.ok(!fs.readFileSync(path.join(tmp, "deny.txt"), "utf8").toLowerCase().includes("fakeview"), "denylist holds hashes only");
  process.env.PII_GUARD_DENYLIST_FILE = path.join(tmp, "deny.txt");
  process.env.PII_GUARD_KEY_FILE = path.join(tmp, "k.key");
}
function repo(files) {
  const d = fs.mkdtempSync(path.join(tmp, "r-"));
  execFileSync("git", ["init", "-q", d]);
  for (const [f, s] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), s); }
  execFileSync("git", ["-C", d, "add", "-A"]);
  return d;
}
function run(args, cwd) {
  const lines = []; const orig = console.log; console.log = (s) => lines.push(String(s));
  try { return { code: main(args, cwd), out: lines.join("\n") }; } finally { console.log = orig; }
}
genFixtureDenylist();

test("generator makes number+street windows", () => {
  const e = addressEntries("meet at " + FAKE_ADDR + " then");
  assert.ok(e.has("4321 fakeview ter") && e.has("4321 fakeview"));
  assert.equal(addressEntries("at 10 at the Court we play").size, 0);
});
test("synthetic fake address is blocked (HMAC denylist), also abbreviated, and never printed", () => {
  for (const v of [FAKE_ADDR, "4321 FAKEVIEW TER.", "4321 Fakeview"]) {
    const r = run(["--staged"], repo({ "notes.md": `drop-off: ${v}\n` }));
    assert.equal(r.code, 1, v); assert.match(r.out, /PII denylist {2}notes\.md:1 {2}sha16=[0-9a-f]{16}/);
    assert.ok(!/fakeview/i.test(r.out), "plaintext never printed");
  }
});
test("synthetic precise coordinates are blocked (keyed and bare pair)", () => {
  const r = run(["--staged"], repo({ "a.js": `var LAT = ${FAKE_LAT};\nvar LON = ${FAKE_LON};\n`, "b.json": `{"home":[${FAKE_LAT},${FAKE_LON}]}\n` }));
  assert.equal(r.code, 1);
  assert.equal((r.out.match(/PII precise_coords/g) || []).length, 3);
  assert.ok(!r.out.includes(FAKE_LAT.slice(1)), "coords never printed");
});
test("the coarse 38.9/-94.7 cell passes", () => {
  const r = run(["--tree"], repo({ "house-weather.js": "var LAT = 38.9;\nvar LON = -94.7;\n", "wall.html": "<script>HOME={lat:38.9,lon:-94.7};</script>\n" }));
  assert.equal(r.code, 0, r.out);
});
test("a pair planted in a non-listed html file is caught (--tree covers every served file, tracked or not)", () => {
  const d = repo({ "index.html": "<p>ok</p>\n" });
  fs.writeFileSync(path.join(d, "sheet-planted-zz.html"), `<div data-x="${FAKE_LAT}, ${FAKE_LON}"></div>\n`); /* untracked */
  const r = run(["--tree"], d);
  assert.equal(r.code, 1); assert.match(r.out, /PII precise_coords {2}sheet-planted-zz\.html:1/);
});
test("phones/emails outside the allow-list fail; allow-listed and 555/example pass; tokens fail", () => {
  const ctx = { deny: { n: 0, byK: new Map() }, allow: loadAllow("email desk@biz.example.org\nphone 8165550000\n"), priv: null }; /* privacy-scan:allow email */
  const hits = (s) => scanText("x.md", s, ctx).map((h) => h.cat);
  assert.deepEqual(hits("mail someone.private@gmail.com"), ["email"]); /* privacy-scan:allow email · pii-guard:allow email */
  assert.deepEqual(hits("call 913-26" + "4-7788"), ["phone"]);
  assert.deepEqual(hits("call 816-555-0123"), []); /* privacy-scan:allow phone */
  assert.deepEqual(hits("or a@example.com"), []); /* privacy-scan:allow email */
  assert.deepEqual(hits("tok ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"), ["token"]);
  assert.deepEqual(hits('"clientSecret": "YOUR_CLIENT_SECRET"'), []);
});
test("denylist set but key missing is a config failure (exit 2), --require-denylist with none is exit 2", () => {
  const k = process.env.PII_GUARD_KEY_FILE; process.env.PII_GUARD_KEY_FILE = path.join(tmp, "nope.key");
  try { assert.equal(run(["--staged"], repo({ "a.md": "x\n" })).code, 2); } finally { process.env.PII_GUARD_KEY_FILE = k; }
  const f = process.env.PII_GUARD_DENYLIST_FILE; delete process.env.PII_GUARD_DENYLIST_FILE;
  try {
    const r = run(["--staged", "--require-denylist"], repo({ "a.md": "x\n" }));
    assert.equal(r.code, 2); assert.match(r.out, /WARN: no private pii-guard denylist/);
  } finally { process.env.PII_GUARD_DENYLIST_FILE = f; }
});
test("the repo allow-list holds only email/phone/id-hash/marker lines (ids by sha16, never the value)", () => {
  for (const ln of fs.readFileSync(path.join(HERE, "pii-guard-allow.txt"), "utf8").split("\n"))
    if (ln.trim() && !ln.startsWith("#")) assert.match(ln.replace(/\s*#.*$/, ""), /^(email \S+@\S+|phone \d{10,11}|id sha16:[0-9a-f]{16}|marker [\w.\/-]+)$/);
});

/* ---------------- PIIGUARD2 ---------------- */
const D = (a, b) => a + "." + b;                       /* every number below is built at run time: no literal in this file */
const LA = D("-12", "3456"), LO = D("-65", "4321"), LAp = D("12", "3456"), LOp = D("65", "4321");
const PH3 = ["913", "264", "7788"];                     /* invented, not 555 */
const one = (rel, body) => { const d = repo({ "index.html": "<p>ok</p>\n" }); fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), body); return run(["--tree"], d); };
const caught = (r, cat) => { assert.equal(r.code, 1, r.out); assert.match(r.out, new RegExp("PII " + cat + " ")); };
const clean = (r) => assert.equal(r.code, 0, r.out);

/* Alfred's 38 planted cases (ship-2026-10-23T2211-piiguard1), rebuilt from his descriptions: 1-25 were already caught,
   26-38 were his 13 false negatives. One test each. */
const PLANTED = [
  ["01 keyed LAT var (js)", "a.js", () => `var LAT = ${LA};\n`, "precise_coords"],
  ["02 keyed LON var (js)", "a.js", () => `var LON = ${LO};\n`, "precise_coords"],
  ["03 json lat key", "a.json", () => `{"lat": ${LA}}\n`, "precise_coords"],
  ["04 json lng key", "a.json", () => `{"lng": ${LO}}\n`, "precise_coords"],
  ["05 pair in an html attribute", "p.html", () => `<div data-x="${LA}, ${LO}"></div>\n`, "precise_coords"],
  ["06 pair in a json array", "a.json", () => `{"home":[${LA},${LO}]}\n`, "precise_coords"],
  ["07 geojson lon,lat", "g.json", () => `{"coordinates":[${LO},${LA}]}\n`, "precise_coords"],
  ["08 query string lat=&lon=", "u.md", () => `https://api.example.com/w?lat=${LA}&lon=${LO}\n`, "precise_coords"],
  ["09 maps url @lat,lon", "m.md", () => `https://maps.example.com/@${LA},${LO},17z\n`, "precise_coords"],
  ["10 phone dashed", "c.md", () => `call ${PH3.join("-")}\n`, "phone"],
  ["11 phone parens", "c.md", () => `call (${PH3[0]}) ${PH3[1]}-${PH3[2]}\n`, "phone"],
  ["12 phone +1 dots", "c.md", () => `call +1 ${PH3.join(".")}\n`, "phone"],
  ["13 email plain", "e.md", () => `mail ${"some.one"}${"@"}gmail.com\n`, "email"],
  ["14 email %40", "e.md", () => `mailto:some.one${"%"}40gmail.com\n`, "email"],
  ["15 email &#64;", "e.html", () => `<a>some.one${"&#"}64;gmail.com</a>\n`, "email"],
  ["16 github token", "t.md", () => `tok ${"ghp_"}${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"}\n`, "token"],
  ["17 aws key id", "t.md", () => `${"AKIA"}${"ABCDEFGH12345678"}\n`, "token"],
  ["18 slack bot token", "t.md", () => `${"xoxb"}-${"1234567890-abcdefghij"}\n`, "token"],
  ["19 google api key", "t.md", () => `${"AIza"}${"SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q"}\n`, "token"],
  ["20 private key header", "t.md", () => `-----BEGIN ${"RSA PRIVATE"} KEY-----\n`, "token"],
  ["21 jwt", "t.md", () => `${"eyJ"}hbGciOiJIUzI1.${"eyJ"}zdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4\n`, "token"],
  ["22 mac address", "d.md", () => `${["a4", "77", "33", "1c", "9e", "0b"].join(":")}\n`, "device_id"],
  ["23 nest device path", "d.md", () => `${"enterprises"}/proj123abc/devices/dev456def\n`, "device_id"],
  ["24 denylisted address", "n.md", () => `drop-off: ${FAKE_ADDR}\n`, "denylist"],
  ["25 denylisted address, caps + abbreviated", "n.md", () => `${FAKE_ADDR.toUpperCase().replace("TERRACE", "TER.")}\n`, "denylist"],
  ["26 pretty-printed json pair (split lines)", "a.json", () => `{"home": [\n  ${LA},\n  ${LO}\n]}\n`, "precise_coords"],
  ["27 lat key with the value on the next line", "a.json", () => `{"lat":\n  ${LA}}\n`, "precise_coords"],
  ["28 space-separated pair", "a.md", () => `home ${LA} ${LO}\n`, "precise_coords"],
  ["29 degree + N/W form", "a.md", () => `${LAp}° S, ${LOp}° W\n`, "precise_coords"],
  ["30 latitude X longitude Y without colon", "a.md", () => `latitude ${LAp} longitude ${LOp}\n`, "precise_coords"],
  ["31 pair in a css comment", "s.css", () => `/* home ${LA}, ${LO} */\nbody{margin:0}\n`, "precise_coords"],
  ["32 pair in svg text", "i.svg", () => `<svg><text x="1" y="2">${LA}, ${LO}</text></svg>\n`, "precise_coords"],
  ["33 pair on a line that also has transform=", "i.svg", () => `<g transform="translate(1 2)"><title>${LA},${LO}</title></g>\n`, "precise_coords"],
  ["34 bare 10-digit phone (json)", "c.json", () => `{"phone":"${PH3.join("")}"}\n`, "phone"],
  ["35 tel:+1 link", "c.html", () => `<a href="tel:+1${PH3.join("")}">call</a>\n`, "phone"],
  ["36 planted in the guard's own path (no SELF skip)", "scripts/qa/pii-guard.test.mjs", () => `// ${"some.one"}${"@"}gmail.com\n`, "email"],
  ["37 text under a binary extension", "img/x.png", () => `home ${LA}, ${LO}\n`, "text_in_binary"],
  ["38 NUL byte in a text file", "n.txt", () => `home ${LA}, ${LO}\0\n`, "nul_in_text"],
];
for (const [name, rel, body, cat] of PLANTED) test("planted " + name, () => caught(one(rel, body()), cat));

/* PIIGUARD2 one test per new case beyond the 38 */
test("coords: semicolon separator", () => caught(one("a.md", `home ${LA}; ${LO}\n`), "precise_coords"));
test("coords: degree pair with negatives", () => caught(one("a.md", `${LA}°, ${LO}°\n`), "precise_coords"));
test("coords: N/E form", () => caught(one("a.md", `${LAp}N ${LOp}E\n`), "precise_coords"));
test("coords: lat key next-line in yaml", () => caught(one("a.yml", `lat:\n  ${LA}\n`), "precise_coords"));
test("coords: svg path d= values are exempt, svg text is not", () => {
  clean(one("i.svg", `<svg><path d="M ${LA} ${LO} L 10.25 -30.75"/><polygon points="${LA},${LO} 1,2"/></svg>\n`));
  caught(one("i.svg", `<svg><path d="M1 2"/><desc>${LA} ${LO}</desc></svg>\n`), "precise_coords");
});
test("coords: css transform/cubic-bezier args exempt, comment caught", () => {
  clean(one("s.css", `.a{transition:all 1s cubic-bezier(${D("0", "25")},${D("0", "10")},${D("0", "25")},${D("1", "00")});transform:translate(${LA}px,${LO}px)}\n`));
  caught(one("s.css", `.a{transform:translate(1px,2px)} /* ${LA} ${LO} */\n`), "precise_coords");
});
test("coords: canvas translate() args exempt but the rest of the line is scanned", () => {
  clean(one("a.js", `ctx.translate(${LA}, ${LO});\n`));
  caught(one("a.js", `ctx.translate(1, 2); var home = [${LA}, ${LO}];\n`), "precise_coords");
});
test("coords: coarse cell still passes in pretty json", () => clean(one("a.json", `{"lat":\n ${D("38", "9")},\n "lon": ${D("-94", "7")}}\n`)));
test("phones: bare 11-digit with leading 1 (json)", () => caught(one("c.json", `{"p":"1${PH3.join("")}"}\n`), "phone"));
test("phones: tel: with dashes in js", () => caught(one("a.js", `href = "tel:${PH3.join("-")}";\n`), "phone"));
test("phones: vCard TEL field", () => caught(one("c.vcf", `TEL;TYPE=CELL:${PH3.join("")}\n`), "phone"));
test("phones: css z-index int max in html passes", () => clean(one("x.html", `<div style="z-index:${I31}"></div>\n`)));
test("phones: PRNG modulus and epoch timestamps in html scripts pass", () => clean(one("x.html", `<script>h=(h*${"16807"})%${I31};t=${"1729728000"};</script>\n`)));
test("phones: bare 10-digit in a .js file is not a phone (ids, numbers)", () => clean(one("a.js", `var n = ${PH3.join("")};\n`)));
test("skips: counts printed by reason; real png skipped as binary_ext", () => {
  const r = one("img/real.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0xff, 0xfe]));
  clean(r); assert.match(r.out, /skips \{"path_filter":0,"binary_ext":1,"unreadable":0\}/);
});
test("hex: bare 64-hex key caught; a pinned sha256 (pin/sha256 context) passes", () => {
  const h = "ab".repeat(32);
  caught(one("k.md", `key ${h}\n`), "hex_key");
  clean(one("k.md", `sha256 ${h}\n`));
});
test("uuid: bare UUID caught", () => caught(one("u.md", `id ${["1b4e28ba", "2fa1", "11d2", "883f", "0016d3cca427"].join("-")}\n`), "uuid"));
test("uuid/hex: an id allow-listed by sha16 passes", () => {
  const u = ["1b4e28ba", "2fa1", "11d2", "883f", "0016d3cca427"].join("-");
  const ctx = { deny: { n: 0, byK: new Map() }, allow: loadAllow("id sha16:" + crypto.createHash("sha256").update(u).digest("hex").slice(0, 16) + "\n"), priv: null };
  assert.deepEqual(scanText("u.md", `id ${u}\n`, ctx), []);
});
test("denylist: address split across lines is caught", () => caught(one("n.md", FAKE_ADDR.split(" ").join("\n") + "\n"), "denylist"));
test("denylist: number glued to the street is caught", () => caught(one("n.md", FAKE_ADDR.replace(" ", "") + "\n"), "denylist"));
test("allow audit: a marker outside the listed files is itself a hit; listed markers are printed", () => {
  const r = one("a.md", `mail some.one${"@"}gmail.com ${"pii-guard"}:allow email\n`);
  caught(r, "allow_unlisted"); assert.match(r.out, /ALLOW email {2}a\.md:1 {2}\(UNLISTED\)/);
  const ctx = { deny: { n: 0, byK: new Map() }, allow: loadAllow("marker a.md\n"), priv: null, audit: [] };
  assert.deepEqual(scanText("a.md", `mail some.one${"@"}gmail.com ${"pii-guard"}:allow email\n`, ctx), []);
  assert.equal(ctx.audit.length, 1);
});
test("allow markers never cover denylist", () => caught(one("n.md", `${FAKE_ADDR} ${"pii-guard"}:allow denylist\n`), "denylist"));
test("force-push range: clean FAIL, exit 2, no stack trace", () => {
  const d = repo({ "a.md": "x\n" });
  execFileSync("git", ["-C", d, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "c"]); /* privacy-scan:allow email */
  for (const range of ["0123456789abcdef0123456789abcdef01234567..HEAD", "0".repeat(40) + "..HEAD"]) {
    const r = run(["--range", range], d);
    assert.equal(r.code, 2, r.out); assert.match(r.out, /^FAIL: pii-guard: /m); assert.ok(!/\n\s+at /.test(r.out), "no stack");
  }
});
test("missing denylist in CI is a ::warning::", () => {
  const f = process.env.PII_GUARD_DENYLIST_FILE; delete process.env.PII_GUARD_DENYLIST_FILE; process.env.GITHUB_ACTIONS = "true";
  try { assert.match(run(["--staged"], repo({ "a.md": "x\n" })).out, /^::warning::no private pii-guard denylist/m); }
  finally { process.env.PII_GUARD_DENYLIST_FILE = f; delete process.env.GITHUB_ACTIONS; }
});

/* ---------------- PIIGUARD3 ---------------- */
/* 15 SYNTHETIC ordinal streets (invented numbers/streets): the no-suffix window "number [dir] N th" must be generated
   and caught. These are the 15 forms Alfred planted (ship-2026-10-23T2238-piiguard2 finding 0), rebuilt synthetically. */
const ORD15 = [
  ["9871", "N", "45th", "St"], ["9872", "S", "1st", "Ave"], ["9873", "E", "2nd", "Street"], ["9874", "W", "3rd", "Terrace"],
  ["9875", "NE", "11th", "Ter"], ["9876", "SW", "12th", "Dr"], ["9877", "", "13th", "Ct"], ["9878", "", "21st", "Pl"],
  ["9879", "NW", "22nd", "Way"], ["9880", "SE", "23rd", "Blvd"], ["9881", "N.", "101st", "Rd"], ["9882", "W", "136th", "Ln"],
  ["9883", "", "4th", "Pkwy"], ["9884", "S", "99TH", "CIR"], ["9885", "E", "250th", "Trail"],
];
const ordStr = ([n, d, o, s], withSuffix = true) => [n, d, o, withSuffix ? s : ""].filter(Boolean).join(" ");
test("denylist: all 15 ordinal no-suffix windows are generated", () => {
  for (const f of ORD15) {
    const e = addressEntries("meet at " + ordStr(f) + " then");
    const ns = ordStr(f, false).toLowerCase().replace(/\./g, "").replace(/(\d)([a-z])/g, "$1 $2").replace(/\s+/g, " ");
    assert.ok(e.has(ns), "no-suffix window for form " + f[0]);
    /* PIIGUARD4: a direction + 3+ digit number also adds the direction-less full and no-suffix windows */
    assert.equal(e.size, f[1] ? 4 : 2, "full + no-suffix (+ direction-less pair) for form " + f[0]);
  }
  assert.ok(!addressEntries("at " + ["9890", "Oak", "St"].join(" ") + " now").has("9890 oak"), "3-letter word no-suffix window stays out");
});
test("denylist: all 15 ordinal forms caught without their suffix (and with it)", () => {
  const key = crypto.randomBytes(32); const byK = new Map(); let n = 0;
  for (const f of ORD15) for (const w of addressEntries(ordStr(f))) { const k = w.split(" ").length; if (!byK.has(k)) byK.set(k, new Set()); byK.get(k).add(hmac(key, w)); n++; }
  const ctx = { deny: { key, byK, n }, allow: loadAllow(""), priv: null };
  for (const f of ORD15) {
    assert.deepEqual(scanText("n.md", `drop-off ${ordStr(f, false)} today\n`, ctx).map((h) => h.cat), ["denylist"], "no-suffix " + f[0]);
    assert.ok(scanText("n.md", `drop-off ${ordStr(f)}\n`, ctx).some((h) => h.cat === "denylist"), "full " + f[0]);
  }
});
test("coords: block comment between key and value (js)", () => caught(one("a.js", `var lat = /* note */ ${LA};\n`), "precise_coords"));
test("coords: block comment between pair members (js)", () => caught(one("a.js", `var p = [${LA}, /* x */ ${LO}];\n`), "precise_coords"));
test("coords: line comment between key and next-line value (js)", () => caught(one("a.js", `var lat = // note\n  ${LA};\n`), "precise_coords"));
test("coords: percent-encoded comma in a url query", () => caught(one("u.md", `https://maps.example.com/?q=${LA}%2C${LO}\n`), "precise_coords"));
test("coords: double-encoded comma and %3D key", () => {
  caught(one("u.md", `https://maps.example.com/?q=${LA}%252C${LO}\n`), "precise_coords");
  caught(one("u.md", `https://x.example.com/?lat%3D${LA}\n`), "precise_coords");
});
const FW = (s) => s.replace(/[0-9.,-]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)); /* fullwidth forms */
test("coords: fullwidth digits (NFKC)", () => caught(one("a.md", `home ${FW(LA)}, ${FW(LO)}\n`), "precise_coords"));
test("coords: one hit per line and pair across shadow copies", () => {
  const r = one("a.js", `var home = [${LA}, ${LO}]; /* ok */\n`);
  assert.equal((r.out.match(/PII precise_coords/g) || []).length, 1, r.out);
});
test("phones: fullwidth digits (NFKC)", () => caught(one("c.md", `call ${FW(PH3.join("-"))}\n`), "phone"));
test("phones: js quoted bare 10-digit string", () => caught(one("a.js", `const p = "${PH3.join("")}";\n`), "phone"));
test("phones: js quoted +1 11-digit string", () => caught(one("a.mjs", `const p = '+1${PH3.join("")}';\n`), "phone"));
test("phones: js number on a phone key", () => caught(one("a.js", `const c = { phone: ${PH3.join("")} };\n`), "phone"));
test("phones: ts/cjs number on mobile/cell/sms/tel keys", () => {
  caught(one("a.ts", `const mobile = 1${PH3.join("")};\n`), "phone");
  caught(one("a.cjs", `module.exports = { cellPhone: ${PH3.join("")} };\n`), "phone");
  caught(one("a.js", `x.sms = '${PH3.join("")}';\n`), "phone");
  caught(one("a.js", `var o = { tel: ${PH3.join("")} };\n`), "phone");
});
test("phones: js controls stay clean (unkeyed number, zIndex max quoted or not, uint32 max, quoted epoch, 555)", () => {
  clean(one("a.js", `var n = ${PH3.join("")};\nvar s = { zIndex: ${I31} };\nel.style.zIndex = "${I31}";\nvar maxU32 = '${U32}';\nvar t = "${"1729728000"}";\nvar q = { phone: "${PH3[0]}555${PH3[2]}" };\n`));
});
test("coords: masked span pair with 4+ decimals and a geo word nearby is caught", () => {
  caught(one("i.svg", `<svg><g id="home-pin"><path d="M ${LA} ${LO} L 1 2"/></g></svg>\n`), "precise_coords");
  caught(one("a.js", `var geo = 1; ctx.arc(${LA}, ${LO}, 5, 0, 7);\n`), "precise_coords");
  caught(one("s.css", `.location{transform:translate(${LA}px ${LO}px)}\n`), "precise_coords");
});
test("coords: masked span pair without a geo word, or under 4 decimals, stays exempt", () => {
  clean(one("i.svg", `<svg><path d="M ${LA} ${LO} L 1 2"/></svg>\n`));
  clean(one("i.svg", `<svg><g id="home"><path d="M ${D("-12", "345")} ${D("-65", "432")}"/></g></svg>\n`));
});
const B64 = (s) => Buffer.from(s).toString("base64");
test("base64 data: URIs with text MIME types are decoded and scanned", () => {
  caught(one("a.html", `<a href="data:text/plain;base64,${B64(`home ${LA}, ${LO}`)}">x</a>\n`), "precise_coords");
  caught(one("a.js", `const u = "data:application/json;base64,${B64(`{"phone":"${PH3.join("")}"}`)}";\n`), "phone");
  caught(one("a.css", `.x{background:url("data:image/svg+xml;charset=utf-8;base64,${B64(`<svg><desc>${LA} ${LO}</desc></svg>`)}")}\n`), "precise_coords");
  const r = one("n.md", `x\nsee data:text/plain;base64,${B64(`mail some.one${"@"}gmail.com`)}\n`);
  caught(r, "email"); assert.match(r.out, /PII email {2}n\.md:2 /);
});
test("base64 data: URIs: image/png is not decoded; oversize (>64 KB) text is skipped", () => {
  clean(one("a.html", `<img src="data:image/png;base64,${B64(`home ${LA}, ${LO}`)}">\n`));
  clean(one("a.html", `<a href="data:text/plain;base64,${B64("z".repeat(70000))}">x</a>\n`));
});

/* ---------------- PIIGUARD4 ---------------- */
/* F1 · SYNTHETIC direction addresses (invented numbers and streets). DIR5: direction + 4-5 digit number + 3-letter
   street word, each checked in Alfred's 5 contexts (prose, end of sentence, comma-city, JSON, odd suffix "Str"). DIR22:
   22 direction addresses (DIR5 + 5 more + the 12 directional ORD15 forms), each caught with the direction dropped. */
const DIR5 = [["9891", "N", "Elm", "St"], ["98765", "SW", "Ash", "Ave"], ["9892", "E", "Fir", "Dr"], ["9893", "NE", "Oak", "Ln"], ["9894", "W", "Yew", "Ct"]];
const DIR22 = [...DIR5, ["9895", "S", "Maple", "Rd"], ["9896", "NW", "Cedar", "Way"], ["9897", "SE", "Birch", "Pl"], ["9898", "N", "Willow", "Pkwy"],
  ["9899", "E", "Pine", "Blvd"], ...ORD15.filter((f) => f[1])];
const J = (a) => a.filter(Boolean).join(" ");
const denyCtx = (forms) => {
  const key = crypto.randomBytes(32); const byK = new Map(); let n = 0;
  for (const f of forms) for (const w of addressEntries("at " + J(f) + " now")) { const k = w.split(" ").length; if (!byK.has(k)) byK.set(k, new Set()); byK.get(k).add(hmac(key, w)); n++; }
  return { deny: { key, byK, n }, allow: loadAllow(""), priv: null };
};
const denyHit = (ctx, s, rel = "n.md") => scanText(rel, s, ctx).some((h) => h.cat === "denylist");
test("denylist F1: direction + 3+ digit number keeps the 3-letter no-suffix window (5 addresses x 5 contexts)", () => {
  const ctx = denyCtx(DIR5); let n = 0;
  const C = [(x) => `meet at ${x} tomorrow`, (x) => `the pickup is at ${x}.`, (x) => `${x}, Springfield`, (x) => JSON.stringify({ loc: x }), (x) => `${x} Str`];
  for (const f of DIR5) for (const c of C) { assert.ok(denyHit(ctx, c(J(f.slice(0, 3))) + "\n", "n.json"), "form " + f[0]); n++; }
  assert.equal(n, 25);
});
test("denylist F1: direction dropped is caught, with and without the suffix (22 addresses)", () => {
  const ctx = denyCtx(DIR22); assert.equal(DIR22.length, 22);
  for (const f of DIR22) {
    assert.ok(denyHit(ctx, `drop-off ${J([f[0], ...f.slice(2)])} today\n`), "no-dir full " + f[0]);
    assert.ok(denyHit(ctx, `drop-off ${J([f[0], ...f.slice(2, -1)])} today\n`), "no-dir no-suffix " + f[0]);
  }
});
test("denylist F1: digit rule — a 2-digit number gets no 3-letter or direction-less window; no direction, no 3-letter window", () => {
  const e = addressEntries("at " + J(["12", "N", "Oak", "St"]) + " now");
  assert.deepEqual([...e], ["12 n oak st"]);
  assert.ok(!addressEntries("at " + J(["9890", "Oak", "St"]) + " now").has("9890 oak"));
  const d = addressEntries("at " + J(["9891", "N", "Elm", "St"]) + " now");
  assert.deepEqual([...d].sort(), ["9891 elm", "9891 elm st", "9891 n elm", "9891 n elm st"]);
});
/* F3 · coordinate pair glued to an SVG path command letter */
test("coords F3: masked d= pair glued to M/L (comma, space, sign-split), also in inline HTML", () => {
  caught(one("i.svg", `<svg><g id="home"><path d="M${LA},${LO}L1 2"/></g></svg>\n`), "precise_coords");
  caught(one("i.svg", `<svg><g id="home"><path d="M1 2L${LA} ${LO}"/></g></svg>\n`), "precise_coords");
  caught(one("i.svg", `<svg><g id="home"><path d="M${LA}${LO}"/></g></svg>\n`), "precise_coords");
  caught(one("p.html", `<div class="location"><svg><path d="M${LAp},${LOp}z"/></svg></div>\n`), "precise_coords");
});
test("coords F3: glued pair in a JS path string (not a d= attribute) with a geo word", () => {
  caught(one("a.js", `const homePath = "M${LA},${LO}";\n`), "precise_coords");
});
test("coords F3: glued pair without a geo word, or under 4 decimals, stays exempt", () => {
  clean(one("i.svg", `<svg><path d="M${LA},${LO}L1 2"/></svg>\n`));
  clean(one("i.svg", `<svg><g id="home"><path d="M${D("-12", "345")},${D("-65", "432")}"/></g></svg>\n`));
});
/* F4 · the int32/uint32 exemption is context-limited: Alfred's abuse cases all catch */
test("phones F4: tel:+1, formatted and keyed int-limit-shaped numbers are caught", () => {
  const I = ["214", "748", "3647"], I2 = ["214", "748", "3648"], U = ["429", "496", "7295"];
  for (const rel of ["a.js", "a.md", "a.html"]) {
    caught(one(rel, `<a href="tel:+1 ${I.join("")}">x</a>\n`), "phone");
    caught(one(rel, `call '(${I[0]}) ${I[1]}-${I[2]}'\n`), "phone");
    caught(one(rel, `call '(${I2[0]}) ${I2[1]}-${I2[2]}'\n`), "phone");
  }
  caught(one("a.js", `const c = { phone: ${I2.join("")} };\n`), "phone");
  caught(one("a.js", `const c = { cell: '${U.join("-")}' };\n`), "phone");
  caught(one("a.js", `const contact = "${I.join("")}";\n`), "phone");
  caught(one("a.json", `{"contact": "${U.join("")}"}\n`), "phone");
});
test("phones F4: bare int limits in z-index / numeric context stay clean", () => {
  const I = ["214", "748", "3647"].join(""), U = ["429", "496", "7295"].join("");
  clean(one("a.js", `el.style.zIndex = "${I}";\nvar m = x % "${U}";\n`));
  clean(one("a.html", `<div style="z-index: ${I}">x</div>\n`));
  caught(one("a.html", `<td>${I}</td>\n`), "phone"); /* element text is not a numeric context */
  caught(one("a.js", `var m = '${U}';\n`), "phone");  /* PIIGUARD4: a plain assignment is not a numeric context */
});
/* F5 · hemisphere letters glued or slash-separated */
test("coords F5: glued and slashed N/S/E/W pairs are caught", () => {
  const a = D("12", "3456"), b = D("65", "4321");
  caught(one("a.md", `at ${a}S${b}W\n`), "precise_coords");
  caught(one("a.md", `at ${a}S/${b}W\n`), "precise_coords");
  caught(one("a.md", `at ${a} S / ${b} W\n`), "precise_coords");
  caught(one("a.md", `at S${a}/W${b}\n`), "precise_coords");
  caught(one("a.md", `at S ${a} W ${b}\n`), "precise_coords");
});
/* P4 · HEX_OK: a label must directly precede the 64-hex value */
test("hex: a comment word alone no longer exempts a 64-hex value; a direct label or sha256sum line does", () => {
  const h = () => crypto.randomBytes(32).toString("hex");
  caught(one("a.js", `const key = "${h()}"; // pin\n`), "hex_key");
  caught(one("a.js", `/* hash */ const secret = "${h()}";\n`), "hex_key");
  clean(one("a.md", `sha256: ${h()}\n`));
  clean(one("a.js", `const PIN_GUARD = "${h()}";\n`));
  clean(one("a.js", `var PIN = ["${h()}", "${h()}"];\n`));
  clean(one("SHA256SUMS.txt", `${h()}  dist/app.js\n`));
});
test("workflow: every actions/checkout step sets persist-credentials: false", () => {
  const y = fs.readFileSync(path.join(HERE, "..", "..", ".github", "workflows", "privacy-scan.yml"), "utf8").split("\n");
  const idx = y.map((l, i) => (/uses: actions\/checkout@/.test(l) ? i : -1)).filter((i) => i >= 0);
  assert.ok(idx.length >= 3);
  for (const i of idx) assert.ok(y.slice(i + 1, i + 4).some((l) => /^\s+persist-credentials: false\b/.test(l)), "checkout at line " + (i + 1));
});
