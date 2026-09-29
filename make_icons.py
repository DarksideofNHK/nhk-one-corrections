#!/usr/bin/env python3
"""拡張機能のアイコン（extension/icons/icon{16,32,48,128}.png）を作る。macOS のヒラギノ角ゴシック W7 を使う。

  python3 make_icons.py
"""
import glob
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "extension" / "icons"
BG = (179, 38, 30)       # 訂正の赤
FG = (255, 255, 255)


def font_path():
    # ファイル名は NFD で入っていることがあるので、正規化して探す
    for p in glob.glob("/System/Library/Fonts/*.ttc"):
        if unicodedata.normalize("NFC", Path(p).name) == "ヒラギノ角ゴシック W7.ttc":
            return p
    raise SystemExit("ヒラギノ角ゴシック W7 が見つかりません")


def icon(size, font_file):
    scale = 8  # 大きく描いてから縮める
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    f = ImageFont.truetype(font_file, int(s * 0.74))
    box = d.textbbox((0, 0), "訂", font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), "訂", font=f, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fp = font_path()
    for size in (16, 32, 48, 128):
        icon(size, fp).save(OUT / f"icon{size}.png")
    print(f"{OUT} にアイコンを作りました")


if __name__ == "__main__":
    main()
