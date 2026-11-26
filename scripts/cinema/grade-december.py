#!/usr/bin/env python3
"""Turn the Cycles frames into the December cinema plates.

The render is Cycles at Standard view, exposure 0. The plates are written
the way Blender's Standard view writes exposure +1.3 stops (linear multiply
by 2**1.3, then the sRGB transfer). That lands the graded centre luma inside
the existing 42.98..48.52 band. The house cube is then applied with the same
8-bit trilinear sample the cinema shader uses, so the high tier's live grade
matches the still and the loop.

  python3 scripts/cinema/grade-december.py /tmp/dec-room/raw /tmp/dec-room/out
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CUBE = ROOT / "art/cinema/xmas-2026/wardos-xmas.cube"
STOPS = 1.3
EXPOSURE = 2.0 ** STOPS


def load_lut(path):
    vals = []
    size = 0
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("LUT_3D_SIZE"):
            size = int(line.split()[1])
            continue
        if line[0].isalpha():
            continue
        p = line.split()
        if len(p) >= 3:
            vals.append((float(p[0]), float(p[1]), float(p[2])))
    if len(vals) != size ** 3:
        raise SystemExit("cube length %d size %d" % (len(vals), size))
    lut = np.zeros((size, size, size, 3), np.float32)
    for z in range(size):
        for y in range(size):
            for x in range(size):
                r, g, b = vals[z * size * size + y * size + x]
                lut[z, y, x] = (round(r * 255) / 255.0, round(g * 255) / 255.0, round(b * 255) / 255.0)
    return lut


def srgb_to_lin(img):
    c = img.astype(np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(lin):
    lin = np.clip(lin, 0.0, None)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1.0 / 2.4) - 0.055)
    return np.clip(np.round(s * 255.0), 0, 255).astype(np.uint8)


def apply_lut(img, lut):
    n = lut.shape[0] - 1
    rgb = np.clip(img.astype(np.float32) / 255.0, 0.0, 1.0)
    x = rgb[:, :, 0] * n
    y = rgb[:, :, 1] * n
    z = rgb[:, :, 2] * n
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    z0 = np.floor(z).astype(np.int32)
    x1 = np.minimum(x0 + 1, n)
    y1 = np.minimum(y0 + 1, n)
    z1 = np.minimum(z0 + 1, n)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    fz = (z - z0)[..., None]
    c00 = lut[z0, y0, x0] * (1 - fx) + lut[z0, y0, x1] * fx
    c01 = lut[z0, y1, x0] * (1 - fx) + lut[z0, y1, x1] * fx
    c10 = lut[z1, y0, x0] * (1 - fx) + lut[z1, y0, x1] * fx
    c11 = lut[z1, y1, x0] * (1 - fx) + lut[z1, y1, x1] * fx
    c0 = c00 * (1 - fy) + c01 * fy
    c1 = c10 * (1 - fy) + c11 * fy
    return np.clip(np.round((c0 * (1 - fz) + c1 * fz) * 255.0), 0, 255).astype(np.uint8)


def centre_luma(im):
    sl = im[140:900, 160:1760].astype(np.float32)
    return float((0.2126 * sl[:, :, 0] + 0.7152 * sl[:, :, 1] + 0.0722 * sl[:, :, 2]).mean())


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/dec-room/raw")
    dst = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/dec-room/out")
    dst.mkdir(parents=True, exist_ok=True)
    frames = sorted(src.glob("f_*.png"))
    if not frames:
        raise SystemExit("no frames in " + str(src))
    lut = load_lut(CUBE)
    print("frames", len(frames), "exposure stops", STOPS, flush=True)
    for i, fp in enumerate(frames, 1):
        raw = np.array(Image.open(fp).convert("RGB"))
        exposed = lin_to_srgb(srgb_to_lin(raw) * EXPOSURE)
        graded = apply_lut(exposed, lut)
        Image.fromarray(graded).save(dst / fp.name, optimize=False)
        if i == 1:
            Image.fromarray(exposed).save(dst / "ungraded.png")
            Image.fromarray(graded).save(dst / "graded.png")
            print("frame1 raw luma %.2f exposed %.2f graded %.2f" % (
                centre_luma(raw), centre_luma(exposed), centre_luma(graded)), flush=True)
        if i % 25 == 0 or i == len(frames):
            print("graded", i, "/", len(frames), flush=True)
    # loop check: first and the would-be next frame. The sine is exact, so
    # frame 1 and a synthetic t=1 are the same pose; report the pixel gap
    # between frame 1 and frame N, which is one step before the join.
    a = np.array(Image.open(dst / frames[0].name))
    b = np.array(Image.open(dst / frames[-1].name))
    gap = np.abs(a.astype(np.int16) - b.astype(np.int16)).max()
    print("max channel gap frame1 vs last", int(gap), flush=True)


if __name__ == "__main__":
    main()
