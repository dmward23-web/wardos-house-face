/* Round 42. Appointment rows render only with the show marker. The 301-probe matrix is vendored. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function boot() {
  const ctx = {
    Intl, Date, console, WeakSet, decodeURIComponent,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["house-event-display.js", "house-face-law.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
  }
  return ctx.HouseEventDisplay;
}

function runMatrix(D) {
const W = "2026-11-12T22:30:00-06:00";
const AUD = ["dan", "dad", "shared", "ainsley", "hub", "hayes", "harris"];
const show = (r, who) => { try { return D.summarize(r, who); } catch (e) { return null; } };
const NAMES=["Hayes","Harris"];
const mapS=(s,f)=>[...s].map(f).join("");
const cp=(base,c)=>{const l=c.toLowerCase(); return String.fromCodePoint(base+(l.charCodeAt(0)-97));};
const pct=s=>mapS(s,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,"0"));
const pctUtf8=s=>encodeURIComponent(s);
const dec=s=>mapS(s,c=>"&#"+c.codePointAt(0)+";"), hex=s=>mapS(s,c=>"&#x"+c.codePointAt(0).toString(16)+";");
const C39={}; { const C=C39;
for(const n of NAMES){ const a=n.slice(0,2), b=n.slice(2);
 (C.ent_dec??=[]).push(dec(n), a+"&#"+b.charCodeAt(0)+";"+b.slice(1), "&#0072;"+n.slice(1));
 (C.ent_hex??=[]).push(hex(n), "&#x48;"+n.slice(1), "&#X48;"+n.slice(1), a+"&#x"+b.charCodeAt(0).toString(16)+";"+b.slice(1));
 (C.ent_named??=[]).push(n.replace(/a/,"&aacute;"), "&Hscr;"+n.slice(1), a+"&ZeroWidthSpace;"+b, a+"&nbsp;"+b, a+"&shy;"+b, a+"&SHY;"+b);
 (C.ent_double??=[]).push("&amp;#72;"+n.slice(1), "&amp;amp;#72;"+n.slice(1), "&#38;#72;"+n.slice(1), "&#x26;#x48;"+n.slice(1), a+"&amp;shy;"+b);
 (C.tags??=[]).push(a+"<wbr>"+b, "<b>"+a+"</b>"+b, a+"<!-- -->"+b, a+'<span class="x">'+b+"</span>", "<i>"+n+"</i>", a+"<br/>"+b);
 (C.pct??=[]).push(pct(n), a+pct(b[0])+b.slice(1), n.slice(0,-1)+pct(n.slice(-1)));
 (C.pct_double??=[]).push(a+"%25"+b.charCodeAt(0).toString(16)+b.slice(1), a+"%2525"+b.charCodeAt(0).toString(16)+b.slice(1));
 (C.pct_utf8??=[]).push(pctUtf8(n.replace("a","\u00E1")), a+pctUtf8("\u200B")+b, a+pctUtf8("\u00AD")+b, pctUtf8("\uFF28")+n.slice(1));
 (C.pct_entity??=[]).push("%26%2372%3B"+n.slice(1), a+"%26shy%3B"+b);
 (C.regional??=[]).push(mapS(n,c=>cp(0x1F1E6,c)), cp(0x1F1E6,"h")+n.slice(1), a+mapS(b,c=>cp(0x1F1E6,c)));
 (C.squared??=[]).push(mapS(n,c=>cp(0x1F130,c)), cp(0x1F130,"h")+n.slice(1));
 (C.neg_squared??=[]).push(mapS(n,c=>cp(0x1F170,c)), cp(0x1F170,"h")+n.slice(1));
 (C.circled??=[]).push(mapS(n,c=>cp(0x24B6,c)), mapS(n,c=>cp(0x24D0,c)), cp(0x24B6,"h")+n.slice(1));
 (C.neg_circled??=[]).push(mapS(n,c=>cp(0x1F150,c)), cp(0x1F150,"h")+n.slice(1));
 (C.paren??=[]).push(mapS(n,c=>cp(0x249C,c)), mapS(n,c=>cp(0x1F110,c)), cp(0x1F110,"h")+n.slice(1));
 (C.math_alnum??=[]).push(mapS(n,c=>/[A-Z]/.test(c)?cp(0x1D400,c):cp(0x1D41A,c)), mapS(n,c=>/[A-Z]/.test(c)?cp(0x1D56C,c):cp(0x1D586,c)));
 (C.fullwidth??=[]).push(mapS(n,c=>String.fromCharCode(c.charCodeAt(0)+0xFEE0)), "\uFF28"+n.slice(1));
 (C.superscript??=[]).push(n==="Hayes"?"\u1D34\u1D43\u02B8\u1D49\u02E2":"\u1D34\u1D43\u02B3\u02B3\u2071\u02E2");
 (C.combining??=[]).push(mapS(n,c=>c+"\u0301"), a+"\u0336"+b, mapS(n,c=>c+"\u20DD"), a+"\u034F"+b, a+"\uFE0F"+b);
 (C.zero_width_cf??=[]).push(a+"\u200B"+b, a+"\u200C"+b, a+"\u200D"+b, a+"\u2060"+b, a+"\uFEFF"+b, a+"\u00AD"+b, a+"\u200E"+b, a+"\u202E"+b, a+"\u180E"+b, a+"\u{E0041}"+b, a+"\u2061"+b);
}
C.digit_swaps=["H4yes","Harr1s","Hay3s","HAYE5","H4rr15","H4Y35","Harri5","h4y3s","HARR1S","Harrl5","H4rris","Hayes1"];
C.mixed=["H&#52;y%65s","<b>H4</b>y&#101;s","H\u200B4y3s","\uFF28arr1s","&#x1F1ED;ayes","Ha%26%23121%3Bes","H&shy;4&shy;yes",
 String.fromCodePoint(0x1F1ED)+"4yes","Ha"+String.fromCodePoint(0x1F188)+"3s","H%34yes","H&#x34;rr&#x31;s","\u0397\u0430y3s","H\u00E4rr1s","H<wbr>&#97;%79e5"];
}
const entAmp=s=>s.replace(/&/g,"&amp;"), entPct=s=>s.replace(/%/g,"&#37;"), pctAll=s=>s.replace(/[%&#;]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
function nest(seed,depth,mode){ let s=seed; for(let i=0;i<depth;i++){ s = mode==="amp"? entAmp(s) : mode==="pct"? s.replace(/%/g,"%25") : (i%2? pctAll(s) : entPct(entAmp(s))); } return s; }
const C40={
 r39_leaks:["H&aacute;yes","&Hscr;ayes","Ha&ZeroWidthSpace;yes","H&aacute;rris","&Hscr;arris","Ha&ZeroWidthSpace;rris","Ha%E2%80%8Byes","Ha%C2%ADyes","%EF%BC%A8ayes","Ha%E2%80%8Brris","Ha%C2%ADrris","%EF%BC%A8arris",
  "%26%2372%3Bayes","Ha%26shy%3Byes","%26%2372%3Barris","Ha%26shy%3Brris",mapS("Hayes",c=>cp(0x1F150,c)),cp(0x1F150,"h")+"ayes",mapS("Harris",c=>cp(0x1F150,c)),cp(0x1F150,"h")+"arris","Ha%26%23121%3Bes"],
 new_named:["&Hfr;ayes","&hfr;ayes","Ha&hairsp;yes","Ha&NoBreak;yes","Har&NoBreak;ris","&Hopf;arris","&hscr;ayes","H&acy;yes","H&Acy;rris","Ha&InvisibleTimes;yes","Ha&NegativeThinSpace;rris","Ha&zwj;yes","Har&zwnj;ris","H&Aring;yes","&Hcirc;ayes","Harri&scaron;","Ha&#x200B;yes","H&#x0430;yes","&#x210C;ayes","Ha&ThickSpace;yes"],
 new_triple_nest:[1,2,3].flatMap(d=>["&#72;ayes","Har&shy;ris","Hay%65s"].map(s=>nest(s,d,"mix"))),
 new_cap_boundary:[5,6,7].map(d=>nest("&#72;ayes",d,"amp")).concat([5,6,7].map(d=>nest("Hay%65s",d,"pct"))),
 new_cap_over:[8,9,10,12].map(d=>nest("&#72;ayes",d,"amp")).concat([8,9,10].map(d=>nest("Hay%65s",d,"pct"))),
 new_invalid_utf8:["Ha%79%FFes","Hay%65%80s","Ha%C0%B9es","H%C1%A1yes","Ha%E0%81%B9es","Hay%ED%A0%80es","Har%F4%90%80%80ris","Hay%65s%","Hay%6","Hay%%65s","Ha%F0%9F%87%BEes"],
 new_enclosed_other:["Ha"+String.fromCodePoint(0x1F12C)+String.fromCodePoint(0x1F12C)+"is","Haye"+String.fromCodePoint(0x1F12A),"\u{1d4d7}\u{1d4ea}\u{1d502}\u{1d4ee}\u{1d4fc}","\u2148arris".replace("\u2148","H"),"\u210Bayes","\u210Carris","\u210Dayes",mapS("hayes",c=>cp(0x1D5BA,c)),mapS("harris",c=>cp(0x1D68A,c)),"\u029C\u1D00\u028F\u1D07\uA731","H\u0251yes","Ha\u0263es","H\u2C6Dyes"],
 new_bidi:["Har\u2066ris\u2069","Ha\u2067yes\u2069","Ha\u2068yes","Ha\u061Cyes","Ha\u202Ayes\u202C","Ha\u202Byes","H\u202Dayes","\u200Fharris","\u202Esey\u0061H","\u202Esirra\u0048"],
 new_digit_punct:["H4yes.","(H4yes)","H4yes,","'H4rr1s'","H4yes's","[Harr1s]","H4yes!","\"Hay3s\"","H4yes:","Harr1s;","H4yes/","#H4yes"],
 new_digit_split:["H4-yes","H 4 y e s","H.4.y.e.s","H4 yes","Harr 1s","Ha y3s","H4_yes","Harr1-s"],
};
const BIDI_REV=["\u202eseyaH","\u202esirraH","\u202Esey\u0061H","\u202Esirra\u0048","\u2067seyaH\u2069","\u202Eseyah","\u200F\u202EseyaH\u202C"];
const SEP=["H4 yes","H-4-yes","H.4.y.e.s","Harr 1s","Ha y3s","H4_yes","Harr1-s","H 4 y e s","H4-yes"];
const CLASSES={}; for(const [k,v] of Object.entries(C39)) CLASSES["r39_"+k]=v; for(const [k,v] of Object.entries(C40)) CLASSES["r40_"+k]=v; CLASSES.sep_split=SEP; CLASSES.bidi_reversed=BIDI_REV;
const TYPES=["Appointment","Session","Dentist","Therapy","Ainsley dentist","Ainsley therapy","Dad session","Dan dentist","d3ntist"];
const fields=["what","notes","hint","where","detail","who","with","kidName","location","description","summary","htmlLink"];
function rowsFor(nm){ const r=[]; for(const w of TYPES){
 for(const f of fields) r.push(f==="what"?{what:w+" "+nm}:f==="htmlLink"?{what:w,htmlLink:"https://www.google.com/calendar/event?eid=x&text="+nm}:{what:w,[f]:nm});
 r.push({what:w,attendees:[nm]}); r.push({what:w,attendees:[{email:"attendee-token-hayes",displayName:nm}]}); r.push({what:w,x:{y:[{z:nm}]}});
 r.push({what:w,meta:{[nm]:true}}); r.push({what:w,tags:{nested:{[nm+"_id"]:1}}}); r.push({what:w,notes:"see "+nm+" at 4:30 PM"}); r.push({what:nm+" "+w}); }
 return r.map(x=>Object.assign({startIso:W},x)); }
const out={classes:{},leakProbes:[],controls:[],benign:[],bidi:[],sepInfo:[]};
let N=0,B=0;
for(const [cls,list] of Object.entries(CLASSES)){ let n=0,b=0; for(const nm of list){ let pn=0,pb=0; const ex=[]; for(const r of rowsFor(nm)) for(const who of AUD){ n++;pn++; const v=show(r,who); if(v){b++;pb++; if(ex.length<2) ex.push(who+" "+JSON.stringify(r).slice(0,90)+" -> "+JSON.stringify(v.title));} } if(pb) out.leakProbes.push({cls,probe:nm,leaks:pb,rows:pn,ex}); }
 out.classes[cls]={probes:list.length,rows:n,leaks:b}; N+=n; B+=b; console.log(cls.padEnd(24),"probes",String(list.length).padStart(3),"rows",String(n).padStart(6),"leaks",b); }
console.log("TOTAL leak rows",N,"leaks",B); out.total={rows:N,leaks:B};
for(const p of out.leakProbes) console.log("  LEAK",p.cls,JSON.stringify(p.probe),p.leaks+"/"+p.rows,p.ex.join(" | "));


  return out;
}

const VIEWS = ["dan", "dad", "shared", "ainsley", "hub", "hayes", "harris"];
const WHEN = "2026-11-12T22:30:00-06:00";
const MARK = { description: "Bring the form\n#wardos-show\n" };

test("r42 the 301-probe matrix leaks nothing", () => {
  const out = runMatrix(boot());
  assert.equal(out.total.leaks, 0, "leaks " + out.total.leaks + " of " + out.total.rows);
  assert.ok(out.total.rows > 90000, "rows " + out.total.rows);
});

test("r42 marker, near-miss, soccer, and literal controls", () => {
  const D = boot();
  const boy = { what: "Hayes dentist", notes: "Harris", startIso: WHEN };
  for (const who of ["hub", "shared", "ainsley", "dan", "dad"]) {
    const view = D.summarize(Object.assign({}, boy, MARK), who);
    assert.equal(view && view.title, "Appointment", who);
    assert.equal(/hayes|harris|dentist|ainsley/i.test(view.title), false, who);
  }
  const misses = [
    "please #wardos-show today",
    "#WARDOS-SHOW",
    "x #wardos-show",
    "#wardos-show2",
    "\u200B#wardos-show",
    "#wardos-show\u202E",
    "#wardos-show\u200B"
  ];
  for (const description of misses) {
    for (const who of VIEWS) {
      assert.equal(D.summarize({ what: "Hayes dentist", description, startIso: WHEN }, who), null, who + " " + description);
    }
  }
  assert.equal(D.summarize({ what: "Ainsley dentist", startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ what: "Ainsley dentist", startIso: WHEN }, "hub"), null);
  assert.equal(D.summarize({ what: "Hayes soccer", startIso: "2026-11-12T18:00:00-06:00" }, "ainsley").title, "Soccer");
  for (const what of ["Q&A; then lunch", "R&D; sync", "P&L; review", "&bogus;"]) {
    for (const who of ["ainsley", "shared", "hub", "dan"]) {
      const view = D.summarize({ what, startIso: WHEN }, who);
      assert.equal(view && view.title, what, who + " " + what);
    }
  }
  const plain = D.summarize({
    what: "Pack snacks",
    htmlLink: "https://example.test/secret-link-token",
    meta: { SecretKey: true },
    nest: { y: [{ z: "nested-value-token" }] },
    startIso: WHEN
  }, "ainsley");
  assert.equal(plain && plain.title, "Pack snacks");
  const dumped = JSON.stringify(plain);
  assert.equal(dumped.includes("secret-link-token"), false);
  assert.equal(dumped.includes("SecretKey"), false);
  assert.equal(dumped.includes("nested-value-token"), false);
});
