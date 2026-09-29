#!/usr/bin/env python3
"""src/nhk-one-corrections.js から、ブックマークレット（dist/bookmarklet.txt・docs/index.html のインストール用ページ）と
拡張機能（extension/。配布用の zip は dist/）を作る。

  python3 build.py
"""
import html
import json
import shutil
import zipfile
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src" / "nhk-one-corrections.js"


def bookmarklet(code):
    # 行頭の // コメントと字下げを落とす。改行は残す（%0A のまま動く）
    lines = [ln.strip() for ln in code.splitlines()]
    body = "\n".join(ln for ln in lines if ln and not ln.startswith("//"))
    return "javascript:" + urllib.parse.quote(body, safe="!'()*-._~=:;,/?&+@$[]{}<>|^`")


def main():
    bm = bookmarklet(SRC.read_text(encoding="utf-8"))
    (HERE / "dist").mkdir(exist_ok=True)
    (HERE / "dist" / "bookmarklet.txt").write_text(bm + "\n", encoding="utf-8")
    page = (HERE / "src" / "index.template.html").read_text(encoding="utf-8")
    page = page.replace("__BOOKMARKLET_HREF__", html.escape(bm, quote=True))
    (HERE / "docs" / "index.html").write_text(page, encoding="utf-8")
    # 拡張機能: 同じコードをそのまま入れる（ツールバーのボタンで、いまのタブに差し込む）
    shutil.copyfile(SRC, HERE / "extension" / "nhk-one-corrections.js")
    ver = json.loads((HERE / "extension" / "manifest.json").read_text(encoding="utf-8"))["version"]
    zpath = HERE / "dist" / f"nhk-one-corrections-extension-{ver}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted((HERE / "extension").rglob("*")):
            if f.is_file() and f.name != ".DS_Store":
                z.write(f, f.relative_to(HERE / "extension"))
    print(f"dist/bookmarklet.txt（{len(bm):,}字）・docs/index.html・extension/・{zpath.relative_to(HERE)} を作りました")


if __name__ == "__main__":
    main()
