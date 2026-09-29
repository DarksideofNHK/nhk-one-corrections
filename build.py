#!/usr/bin/env python3
"""src/nhk-one-corrections.js → dist/bookmarklet.txt と docs/index.html（インストール用ページ）を作る。

  python3 build.py
"""
import html
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
    page = (HERE / "docs" / "index.template.html").read_text(encoding="utf-8")
    page = page.replace("__BOOKMARKLET_HREF__", html.escape(bm, quote=True))
    (HERE / "docs" / "index.html").write_text(page, encoding="utf-8")
    print(f"dist/bookmarklet.txt（{len(bm):,}字）・docs/index.html を作りました")


if __name__ == "__main__":
    main()
