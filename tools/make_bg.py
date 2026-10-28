"""生成引擎自带的默认背景（原创程序化素材：模糊墨线 + 品红光晕）。

用法：python tools/make_bg.py            # 生成 assets/bg_tall.jpg 和 assets/bg_wide.jpg
没有提供背景素材的歌会用它们。"""
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets"


def make(W, H, out, seed=11):
    rnd = random.Random(seed)

    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    t = x / W
    base = np.stack([
        150 - 100 * t, 62 + 10 * np.sin(t * 3), 100 - 60 * t,
    ], -1)
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert("RGBA")

    blob = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(blob)
    d.ellipse((-300, 200, 450, 1300), fill=(220, 70, 125, 190))
    d.ellipse((-200, 1300, 380, 2100), fill=(185, 55, 100, 140))
    d.rectangle((480, -50, 820, H + 50), fill=(150, 120, 130, 60))
    img = Image.alpha_composite(img, blob.filter(ImageFilter.GaussianBlur(80)))

    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ink)
    for x0, wdt in [(420, 44), (500, 16), (940, 24), (1190, 30)]:
        d.line([(x0 + rnd.uniform(-12, 12), yy) for yy in range(-40, H + 80, 70)], fill=(25, 14, 20, 210), width=wdt, joint="curve")

    def stroke(x, y, n, step, ang, width, alpha):
        pts = [(x, y)]
        for _ in range(n):
            ang += rnd.uniform(-0.35, 0.35)
            x += np.cos(ang) * step; y += np.sin(ang) * step
            pts.append((x, y))
        d.line(pts, fill=(22, 12, 18, alpha), width=width, joint="curve")

    for _ in range(150):
        stroke(rnd.uniform(380, W), rnd.uniform(0, H), rnd.randint(4, 14), rnd.uniform(12, 30), rnd.uniform(0, 6.28), rnd.randint(2, 7), rnd.randint(90, 200))
    for _ in range(30):
        stroke(rnd.uniform(40, 400), rnd.uniform(300, 2000), rnd.randint(5, 10), rnd.uniform(14, 26), rnd.uniform(-0.8, 0.8), rnd.randint(4, 10), 150)
    for _ in range(40):
        cx, cy, r = rnd.uniform(500, 1150), rnd.uniform(60, 2100), rnd.uniform(6, 22)
        d.ellipse((cx - r, cy - r * 0.6, cx + r, cy + r * 0.6), fill=(150, 30, 55, 140))
    img = Image.alpha_composite(img, ink.filter(ImageFilter.GaussianBlur(5)))
    arr = np.asarray(img.filter(ImageFilter.GaussianBlur(2.5)).convert("RGB")).astype(np.float32) * 0.8
    Image.fromarray(arr.clip(0, 255).astype(np.uint8)).save(OUT / out, quality=90)


if __name__ == "__main__":
    make(1300, 2200, "bg_tall.jpg")
    make(2200, 1300, "bg_wide.jpg", seed=12)
    print("ok ->", OUT)
