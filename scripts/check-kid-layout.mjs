#!/usr/bin/env node
/** Fail if a chore marker or its label overlaps another, or a label is clipped.
    Phone is 440×956 CSS (Dan's 3× viewport). Wall is 1080×1920.
    Calendar World is the day path on each kid. Not wired into house-face-qa. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(fs.readFileSync(path.join(ROOT, "art/world-manifest.js"), "utf8"), sandbox, {
  filename: "art/world-manifest.js"
});
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "art/kid-layout.js"), "utf8"), sandbox, {
  filename: "art/kid-layout.js"
});

const week = JSON.parse(fs.readFileSync(path.join(ROOT, "kids-week.json"), "utf8"));
const labels = {};
for (const id of ["hayes", "harris", "ainsley"]) {
  const quests = (week.kids[id] && week.kids[id].quests) || [];
  labels[id] = quests
    .filter((q) => !q.optional && (q.cadence || "daily") === "daily")
    .map((q) => q.what);
  const shown = labels[id].map((s) => sandbox.KidLayout.shortLabel(s));
  console.log(id, shown.join(" | "));
}

const errors = sandbox.KidLayout.audit(labels);

const painter = fs.readFileSync(path.join(ROOT, "kid-world.js"), "utf8");
if (/happy_squish|fed_splash/.test(painter)) {
  errors.push("painter still swaps in happy_squish or fed_splash");
}
if (!/KidLayout\.creatureSprite/.test(painter)) {
  errors.push("painter does not draw KidLayout.creatureSprite");
}
for (const world of ["hayes", "harris", "ainsley"]) {
  let sprite = null;
  for (let t = 0; t <= 15; t += 0.25) {
    const motion = sandbox.KidLayout.creatureMotion(world, t);
    if (!sprite) sprite = motion.sprite;
    else if (motion.sprite !== sprite) errors.push(`${world} sprite swap at t=${t}: ${sprite} -> ${motion.sprite}`);
  }
  console.log("creature", world, sprite);
}

const edge = spawnSync("python3", ["-c", `
from PIL import Image
import numpy as np, sys
ZOOM=1.22
W,H=440,956
P={"sky":0.05,"far":0.15,"mid":0.35,"near":0.6,"fg":1.0}
def cover(path, ox):
    im=Image.open(path).convert("RGBA")
    scale=max(W/im.width, H/im.height)*ZOOM
    dw,dh=int(round(im.width*scale)), int(round(im.height*scale))
    im=im.resize((dw,dh), Image.Resampling.BILINEAR)
    mx=max(0,(dw-W)/2-3)
    x=max(-mx, min(mx, ox))
    canvas=Image.new("RGBA",(W,H),(0,0,0,0))
    canvas.paste(im,(int(round((W-dw)/2+x)), int(round((H-dh)/2))), im)
    return canvas
def stack(world, pan):
    bg=Image.new("RGBA",(W,H),(7,16,24,255))
    base=f"assets/ori/{world}/portrait"
    for name,p in P.items():
        ox=pan*p
        if world=="harris":
            # match drawPlate: keep the dark left curtain cropped
            im=Image.open(f"{base}/{name}.webp")
            scale=max(W/im.width, H/im.height)*ZOOM
            dw=im.width*scale
            mx=max(0,(dw-W)/2-3)
            ox=min(max(-mx,min(mx,ox)), max(0, mx-38))
        bg=Image.alpha_composite(bg, cover(f"{base}/{name}.webp", ox if world=="harris" else pan*p))
    return np.array(bg.convert("RGB")).astype(float)
def hard_strip(arr, side):
    h,w=arr.shape[:2]
    y0,y1=int(h*0.25), int(h*0.75)
    band=arr[y0:y1]
    if side=="left":
        edge=band[:,0:7].mean()
        inset=band[:,28:45].mean()
        cols=[band[:,x].mean() for x in range(0,9)]
    else:
        edge=band[:,w-7:w].mean()
        inset=band[:,w-45:w-28].mean()
        cols=[band[:,w-1-x].mean() for x in range(0,9)]
    flat=max(cols)-min(cols)<12
    fail=edge < inset*0.72 and flat and (inset-edge)>28
    return fail, round(edge,1), round(inset,1)
bad=[]
for world in ["hayes","harris","ainsley"]:
    for pan in (14,-14,0):
        arr=stack(world, pan)
        for side in ("left","right"):
            fail,edge,inset=hard_strip(arr, side)
            print(f"edge {world} pan {pan:+d} {side} edge {edge} inset {inset} {'FAIL' if fail else 'ok'}")
            if fail: bad.append(f"{world} pan {pan} {side} strip {edge} vs {inset}")
sys.exit(1 if bad else 0)
`], { cwd: ROOT, encoding: "utf8" });
process.stdout.write(edge.stdout || "");
if (edge.stderr) process.stderr.write(edge.stderr);
if (edge.status) {
  errors.push("edge strip darker than the vignette spec");
}
if (errors.length) {
  const uniq = [];
  const seen = new Set();
  for (const e of errors) {
    if (seen.has(e)) continue;
    seen.add(e);
    uniq.push(e);
  }
  console.error("layout check failed:", uniq.length);
  uniq.slice(0, 60).forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("layout check ok");
