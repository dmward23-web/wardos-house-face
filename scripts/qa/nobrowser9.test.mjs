/* DAYPKG1 item 3 · static proof (reads source only, runs nothing) that the 9 Chrome-launching test files honor QA_NO_BROWSER=1:
   puppeteer-core is only ever required behind `if (!NO_BROWSER)`, CHROME is null under it, every test that launches is gated
   by a skip that is set under it, there is no static puppeteer import and no spawn/exec of a browser binary. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const QA = path.dirname(fileURLToPath(import.meta.url));
const NINE = ["coldname-h1", "framebudget1", "h1p2d3", "h1p2d4-fit", "lhpath3-stones", "livewx1", "moon1-scene", "softgl1", "wide2560"];

for (const f of NINE) test("QA_NO_BROWSER=1 guard: " + f + ".test.mjs", () => {
  const src = fs.readFileSync(path.join(QA, f + ".test.mjs"), "utf8");
  const lines = src.split("\n");
  assert.equal(lines.filter((l) => l.startsWith('const NO_BROWSER = process.env.QA_NO_BROWSER === "1";')).length, 1, "one NO_BROWSER flag");
  const req = lines.filter((l) => /puppeteer/.test(l) && /createRequire|require\(|import\(/.test(l));
  assert.equal(req.length, 1, "one puppeteer load site");
  assert.match(req[0], /^let pp = null; if \(!NO_BROWSER\) for \(/, "puppeteer-core load is behind !NO_BROWSER");
  assert.doesNotMatch(src, /^\s*import[^;\n]*["'](puppeteer|puppeteer-core|playwright)[^"']*["']/m, "no static browser import");
  assert.doesNotMatch(src, /(spawn|exec|execFile|spawnSync|execSync|execFileSync)\s*\([^)]*(chrom|puppeteer|playwright)/i, "no spawn/exec of a browser");
  assert.equal(lines.filter((l) => /^const CHROME = NO_BROWSER \? null : \(/.test(l)).length, 1, "CHROME is null under QA_NO_BROWSER=1");
  const skipDecl = lines.find((l) => l.startsWith("const SKIP = "));
  if (skipDecl) assert.match(skipDecl, /^const SKIP = NO_BROWSER \? "SKIP QA_NO_BROWSER=1 \(no Chrome launch\)" : /);
  /* every launch / dynamic page work sits inside a test whose options carry that skip */
  const starts = [...src.matchAll(/^(?:for \([^\n]*?\) )?test\(/gm)].map((m) => m.index);
  const launches = [...src.matchAll(/\bpp\.launch\(|\.launch\(\{/g)].map((m) => m.index);
  assert.ok(launches.length >= 1, "file does launch Chrome when allowed");
  const gated = (at, why) => {
    const st = starts.filter((s) => s < at).pop();
    assert.ok(st !== undefined, why + " outside any test at " + at);
    const head = src.slice(st, src.indexOf("=>", st));
    assert.match(head, /skip: (SKIP|NO_BROWSER \? "SKIP QA_NO_BROWSER=1)/, why + " inside a skip-gated test: " + head.slice(0, 120));
  };
  const fns = [...src.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => ({ at: m.index, name: m[1] }));
  for (const at of launches) {
    const st = starts.filter((s) => s < at).pop() ?? -1;
    const fn = fns.filter((x) => x.at < at).pop();
    if (fn && fn.at > st) {   /* launch inside a top-level helper: every call of that helper must be in a skip-gated test */
      const calls = [...src.matchAll(new RegExp("\\b" + fn.name + "\\(", "g"))].map((m) => m.index).filter((i) => i !== fn.at + src.slice(fn.at).indexOf(fn.name));
      assert.ok(calls.length >= 1, fn.name + " is called");
      for (const c of calls) gated(c, "call of " + fn.name);
    } else gated(at, "launch");
  }
});

test("QA_NO_BROWSER=1 guard: the 9 files are exactly the excluded list", () => {
  const ex = "/workspace/wright-scratch/hj1d-excluded-chrome-files.txt";
  if (!fs.existsSync(ex)) return;
  const names = fs.readFileSync(ex, "utf8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => path.basename(l).replace(/\.test\.mjs$/, "")).sort();
  assert.deepEqual(names, [...NINE].sort());
});
