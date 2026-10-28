"""从 KanjiVG 提取歌词用到的字的笔画数据 → strokes.json（供"笔画拼接"浮现效果使用）。

用法：
  python -I tools/strokes.py <lyrics.json> <out.json> [--data tools/data/kanjivg]
  python -I tools/strokes.py --chars "天使の輪" <out.json>          # 演示用：直接给字

输出：{ "<字>": {"viewBox": [0,0,109,109], "strokes": ["<svg path d>", ...]} }，笔画按正确笔顺排列。
只输出"字 → 笔画"映射，不输出、不保存歌词文本。没有笔画数据的字（英文字母、标点等）只报告数量。

数据：KanjiVG（https://github.com/KanjiVG/kanjivg，CC BY-SA 3.0），放在 tools/data/kanjivg/（不进仓库）。
首次使用请下载 release 里的 kanjivg-<日期>-main.zip 放进该目录（见 docs/third-party.md）。
"""
import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = "{http://www.w3.org/2000/svg}"
STROKE_ID = re.compile(r"-s(\d+)$")


class Source:
    """从 zip（优先）或解压后的目录读取 kanji/<5位十六进制>.svg。"""

    def __init__(self, data: Path):
        self.zip = None
        self.dir = None
        zips = sorted(data.glob("*.zip")) if data.is_dir() else ([data] if data.suffix == ".zip" else [])
        if zips:
            self.zip = zipfile.ZipFile(zips[-1])
            self.names = set(self.zip.namelist())
        elif (data / "kanji").is_dir():
            self.dir = data / "kanji"
        else:
            raise SystemExit(f"找不到 KanjiVG 数据：{data}（请下载 kanjivg-*-main.zip 放进该目录）")

    def read(self, ch: str):
        name = f"{ord(ch):05x}.svg"
        if self.zip is not None:
            key = f"kanji/{name}"
            return self.zip.read(key) if key in self.names else None
        p = self.dir / name
        return p.read_bytes() if p.exists() else None


def parse_svg(raw: bytes):
    # KanjiVG 的 DOCTYPE 里有内部 DTD，expat 能处理；不解析外部实体
    root = ET.fromstring(raw)
    vb = [float(v) for v in root.get("viewBox", "0 0 109 109").split()]
    strokes = []
    for el in root.iter(f"{SVG_NS}path"):
        m = STROKE_ID.search(el.get("id", ""))
        d = el.get("d")
        if m and d:
            strokes.append((int(m.group(1)), d))
    strokes.sort(key=lambda x: x[0])
    return vb, [d for _, d in strokes]


def collect_chars(lyrics_path: Path) -> list:
    data = json.loads(lyrics_path.read_text(encoding="utf-8"))
    seen = []
    for ln in data.get("lines", []):
        for w in ln.get("words", []):
            for ch in w.get("text", ""):
                if not ch.isspace() and ch not in seen:
                    seen.append(ch)
    return seen


def main():
    ap = argparse.ArgumentParser(description="KanjiVG 笔画提取 → strokes.json")
    ap.add_argument("inputs", nargs="+", help="<lyrics.json> <out.json>，或配合 --chars 只给 <out.json>")
    ap.add_argument("--chars", help="直接指定要提取的字（演示用）")
    ap.add_argument("--data", default=str(Path(__file__).resolve().parent / "data" / "kanjivg"))
    a = ap.parse_args()
    if a.chars is not None:
        if len(a.inputs) != 1:
            raise SystemExit("用 --chars 时只需要给输出路径")
        chars = [c for c in dict.fromkeys(a.chars) if not c.isspace()]
        out = Path(a.inputs[0])
    else:
        if len(a.inputs) != 2:
            raise SystemExit("用法：strokes.py <lyrics.json> <out.json>")
        chars = collect_chars(Path(a.inputs[0]))
        out = Path(a.inputs[1])

    src = Source(Path(a.data))
    result, missing = {}, 0
    for ch in chars:
        raw = src.read(ch)
        if raw is None:
            missing += 1
            continue
        vb, strokes = parse_svg(raw)
        if strokes:
            result[ch] = {"viewBox": vb, "strokes": strokes}
        else:
            missing += 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    total_strokes = sum(len(v["strokes"]) for v in result.values())
    print(f"字符 {len(chars)} 个：有笔画数据 {len(result)} 个（共 {total_strokes} 笔），缺失 {missing} 个 → {out}")


if __name__ == "__main__":
    sys.exit(main())
