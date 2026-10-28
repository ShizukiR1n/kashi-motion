"""歌词强制对齐：把用户提供的歌词文本对到音频上，得到每个词的起止时间 → lyrics.json
（格式见 engine/director/types.ts 的 Lyrics）。只做对齐，不做听写。

用法：python tools/align_lyrics.py <音频> <lyrics.txt> <输出.json> [--vocals 人声.wav] [--model base]

lyrics.txt 格式：
  # title: 歌名
  # artist: 歌手
  [chorus]            段落标签（可选）
  some *words* here   *word* = 主词
  hold this note~     word~  = 拖长音
  （空行 = 换一个画面组，对应输出里每行的 group 字段）
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_common import ensure_ffmpeg, to_wav  # noqa: E402

LONG_S = 1.2
MAX_CHUNK = 6  # 日文自动断句时每块最多几个字
MIN_WORD_S = 0.08

# 日文字符：平假名、片假名、汉字、半角片假名、长音符
CJK = re.compile(r"[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ々ー]")
JP_PUNCT = "、。！？「」『』（）・…　,.!?"


def r3(x):
    return round(float(x), 3)


def has_cjk(s):
    return bool(CJK.search(s))


_tagger = None


def jp_chunks(text):
    """把一段没有空格的日文切成文节：实词开头，后面的助词/助动词/记号并进前一块。"""
    global _tagger
    try:
        import fugashi

        if _tagger is None:
            _tagger = fugashi.Tagger()
        morphs = [(m.surface, m.feature.pos1) for m in _tagger(text)]
    except Exception:  # 没装 fugashi：退回按标点切
        return [p for p in re.split(r"[、。！？\s]+", text) if p]
    attach = {"助詞", "助動詞", "補助記号", "接尾辞"}
    chunks = []  # 每块 = [语素列表, 首个语素的词性]
    for surf, pos in morphs:
        if chunks and (pos in attach or (pos == "動詞" and chunks[-1][1] == "動詞")):
            chunks[-1][0].append(surf)
        else:
            chunks.append([[surf], pos])
    # 太长的块（动词后接一串助动词时常见）在语素边界处拆开，每块不超过 MAX_CHUNK 个字
    pieces = []
    for ms, _ in chunks:
        if sum(len(m) for m in ms) <= MAX_CHUNK:
            pieces.append("".join(ms))
            continue
        cur = ""
        for m in ms:
            if cur and len(cur) + len(m) > MAX_CHUNK - 1:
                pieces.append(cur)
                cur = ""
            cur += m
        if cur:
            pieces.append(cur)
    # 太短的块（单个假名）并到前一块
    out = []
    for s in pieces:
        if out and len(s) == 1 and not re.match(r"[㐀-鿿]", s):
            out[-1] += s
        else:
            out.append(s)
    return [c.strip(JP_PUNCT) or c for c in out if c.strip(JP_PUNCT)]


def split_tokens(s):
    """一行歌词 → 词块列表。英文按空格；日文按空格或 / 断开，没断开的长日文自动切文节。"""
    parts = [p for p in re.split(r"[\s/]+", s) if p]
    out = []
    for p in parts:
        bare = p.replace("*", "").replace("~", "")
        if has_cjk(bare) and len(bare) > 4 and "*" not in p and "~" not in p:
            out.extend(jp_chunks(bare))
        else:
            out.append(p)
    return out


LRC_STAMP = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
LRC_LINE = re.compile(r"^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$")
LRC_TAG = re.compile(r"^\[(ti|ar|al|by|offset|length|re|ve):(.*)\]$", re.I)
# 歌词开头的制作信息行（歌名、作词、作曲……）：不参与对齐，放进片头信息
CREDIT = re.compile(r"作詞|作曲|編曲|歌唱|唄|ボーカル|Vocal|Lyric|Music|Arrange|Composer|[:：]|\s-\s", re.I)


def parse_lyrics(path):
    """返回 (meta, lines)，lines 里每行 = {section, group, lrc, tokens:[{text, emph, long}]}
    支持两种格式：普通文本（每行一句）和 LRC（每行开头带 [分:秒.毫秒] 时间戳）。"""
    meta, lines = {}, []
    section, group, prev_blank = "", 0, False
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            s = raw.strip()
            if not s:
                if lines:
                    prev_blank = True
                continue
            m = LRC_TAG.match(s)
            if m:
                key = {"ti": "title", "ar": "artist"}.get(m.group(1).lower())
                if key and m.group(2).strip():
                    meta[key] = m.group(2).strip()
                continue
            lrc = None
            m = LRC_LINE.match(s)
            if m:
                mm, ss = LRC_STAMP.findall(m.group(1))[0]
                lrc = int(mm) * 60 + float(ss)
                s = m.group(2).strip()
                if not s:
                    continue
                if not lines and CREDIT.search(s):
                    meta.setdefault("credits", []).append(s)
                    continue
            m = re.match(r"^#\s*(title|artist)\s*:\s*(.+)$", s, re.I)
            if m:
                meta[m.group(1).lower()] = m.group(2).strip()
                continue
            if s.startswith("#"):
                continue
            m = re.match(r"^\[([^\]]+)\]$", s)
            if m:
                section = m.group(1).strip().lower()
                if lines:
                    prev_blank = True
                continue
            if prev_blank:
                group += 1
                prev_blank = False
            tokens = []
            for tok in split_tokens(s):
                emph = tok.startswith("*") or tok.rstrip("~").endswith("*") or "*" in tok
                long = tok.endswith("~") or "~" in tok
                text = tok.replace("*", "").replace("~", "")
                if text:
                    tokens.append({"text": text, "emph": bool(emph), "long": bool(long)})
            if tokens:
                lines.append({"section": section, "group": group, "lrc": lrc, "tokens": tokens})
    return meta, lines


def norm(w):
    """只保留字母数字和日文字符，用来逐字比对。"""
    return "".join(ch for ch in w.lower() if re.match(r"[a-z0-9']", ch) or CJK.match(ch))


def line_text(ln):
    # 日文行不加空格（空格会干扰日语对齐），英文行用空格连接
    sep = "" if has_cjk("".join(t["text"] for t in ln["tokens"])) else " "
    return sep.join(t["text"] for t in ln["tokens"])


def align(audio, lines, model_name, language):
    ensure_ffmpeg()
    import stable_whisper  # 延迟导入，避免 --help 也要加载 torch

    model = stable_whisper.load_model(model_name, device="cpu")
    # 每行占一行，帮助 stable-ts 保持分句
    text = "\n".join(line_text(ln) for ln in lines)
    result = model.align(audio, text, language=language, fast_mode=False)
    words = [w for seg in result.segments for w in seg.words]
    return words


class _W:
    def __init__(self, word, start, end):
        self.word, self.start, self.end = word, start, end


def align_windowed(wav, lines, model_name, language, duration):
    """LRC 模式：每一句只在 [本句时间戳, 下一句时间戳] 的窗口里对齐，错误不会传染到后面。
    窗口长度按字数封顶，避免句尾被拉进长间奏。返回每句对齐成功与否。"""
    ensure_ffmpeg()
    import numpy as np
    import soundfile as sf
    import stable_whisper

    model = stable_whisper.load_model(model_name, device="cpu")
    y, sr = sf.read(wav, dtype="float32")
    if y.ndim > 1:
        y = y.mean(axis=1)
    ok = []
    for i, ln in enumerate(lines):
        text = line_text(ln)
        nchar = len(norm(text))
        t0 = max(0.0, ln["lrc"] - 0.35)
        nxt = lines[i + 1]["lrc"] if i + 1 < len(lines) else duration
        t1 = min(nxt + 0.15, ln["lrc"] + 1.5 + 0.35 * nchar, duration)
        seg = np.ascontiguousarray(y[int(t0 * sr):int(t1 * sr)])
        words = []
        try:
            res = model.align(seg, text, language=language, fast_mode=False, verbose=None)
            words = [_W(w.word, w.start + t0, w.end + t0) for sg in res.segments for w in sg.words]
        except Exception as e:  # noqa: BLE001
            print(f"  第 {i + 1} 句对齐失败（{type(e).__name__}），改用均分")
        assign([ln], words)
        good = all(t.get("start") is not None for t in ln["tokens"])
        if not good:  # 兜底：在窗口里按字数均分
            span_s, span_e = ln["lrc"], min(t1, ln["lrc"] + 0.9 + 0.22 * nchar)
            total = sum(max(1, len(norm(t["text"]))) for t in ln["tokens"])
            acc = 0
            for t in ln["tokens"]:
                k = max(1, len(norm(t["text"])))
                t["start"] = span_s + (span_e - span_s) * acc / total
                acc += k
                t["end"] = span_s + (span_e - span_s) * acc / total
        ok.append(good)
    return ok


def assign(lines, aligned):
    """逐字映射：把对齐结果展开成"每个字符的时间"，再按每个词块在全文中的字符区间取起止时间。
    对齐器对日文常常一个字一个"词"、对英文可能合并或拆开标点，逐字映射对两种情况都稳。"""
    import difflib

    flat = [tok for ln in lines for tok in ln["tokens"]]
    # 目标文本：每个字符属于哪个 token
    tgt, owner = [], []
    for k, tok in enumerate(flat):
        nt = norm(tok["text"])
        tok["ctimes"] = [None] * len(nt)  # 每个（规范化后的）字的开始时间
        for ci, ch in enumerate(nt):
            tgt.append(ch)
            owner.append((k, ci))
    # 对齐结果：每个字符的时间（一个"词"的时长平均分给它的字符）
    src, times = [], []
    for w in aligned:
        piece = norm(w.word)
        if not piece:
            continue
        n = len(piece)
        for i, ch in enumerate(piece):
            src.append(ch)
            times.append((w.start + (w.end - w.start) * i / n, w.start + (w.end - w.start) * (i + 1) / n))
    sm = difflib.SequenceMatcher(None, tgt, src, autojunk=False)
    for blk in sm.get_matching_blocks():
        for d in range(blk.size):
            k, ci = owner[blk.a + d]
            s, e = times[blk.b + d]
            tok = flat[k]
            tok["ctimes"][ci] = s
            tok["start"] = s if tok.get("start") is None else min(tok["start"], s)
            tok["end"] = e if tok.get("end") is None else max(tok["end"], e)
    return flat


def char_times(tok):
    """每个显示字符的开始时间：对上的用对齐结果，其余（标点、没对上的字）在词的起止之间插值；保证单调。"""
    text = tok["text"]
    ct = tok.get("ctimes") or []
    s, e = float(tok["start"]), float(tok["end"])
    raw, ni = [], 0
    for ch in text:
        if norm(ch):
            raw.append(ct[ni] if ni < len(ct) else None)
            ni += 1
        else:
            raw.append(None)
    n = len(raw)
    out = []
    for i, v in enumerate(raw):
        lin = s + (e - s) * i / max(1, n)
        v = lin if v is None or not (s - 0.05 <= v <= e + 0.05) else v
        if out:
            v = max(v, out[-1])
        out.append(min(max(v, s), e))
    return [{"c": ch, "t": r3(t)} for ch, t in zip(text, out)]


def fix_times(flat, duration):
    # 缺失的时间：用前后邻居插值
    n = len(flat)
    for i, t in enumerate(flat):
        if t.get("start") is None:
            prev_end = flat[i - 1]["end"] if i > 0 and flat[i - 1].get("end") is not None else 0.0
            nxt = next((flat[k]["start"] for k in range(i + 1, n) if flat[k].get("start") is not None), None)
            nxt = nxt if nxt is not None else min(duration, prev_end + 0.4)
            t["start"], t["end"] = prev_end, max(prev_end + MIN_WORD_S, min(nxt, prev_end + 0.4))
    # 单调、无重叠、最短时长、不超出歌曲长度
    last = 0.0
    for i, t in enumerate(flat):
        s = max(float(t["start"]), last)
        e = max(float(t["end"]), s + MIN_WORD_S)
        if i + 1 < n and flat[i + 1].get("start") is not None:
            e = min(e, max(s + MIN_WORD_S, float(flat[i + 1]["start"])))
        s, e = min(s, duration), min(e, duration)
        t["start"], t["end"] = s, max(e, s)
        last = t["end"]


def voice_intervals(wav):
    """人声出声区间（秒）。对纯人声分轨很准；对整首混音基本是一整段，不起作用。"""
    import librosa

    y, sr = librosa.load(wav, sr=16000)
    iv = librosa.effects.split(y, top_db=35, frame_length=512, hop_length=128)
    return [(a / sr, b / sr) for a, b in iv if (b - a) / sr > 0.05]


def snap_to_voice(flat, intervals, gap=0.15):
    """词的开始时间如果落在静音里（且离下一段出声超过 gap 秒），挪到下一段出声的开头。"""
    if len(intervals) < 2:
        return 0
    moved = 0
    for t in flat:
        s, e = t["start"], t["end"]
        inside = any(a - 0.03 <= s <= b for a, b in intervals)
        if inside:
            continue
        nxt = next((a for a, b in intervals if a > s), None)
        if nxt is not None and nxt - s > gap and nxt < e:
            t["start"] = nxt
            moved += 1
    return moved


def main():
    ap = argparse.ArgumentParser(description="歌词强制对齐 → lyrics.json")
    ap.add_argument("audio")
    ap.add_argument("lyrics")
    ap.add_argument("out")
    ap.add_argument("--vocals", help="人声分轨 wav（推荐，对齐更准）")
    ap.add_argument("--model", default="base", help="whisper 模型：base（快）或 small（更准，日语推荐）")
    ap.add_argument("--language", help="强制对齐语言 en / ja；默认：歌词里有日文就用 ja")
    ap.add_argument("--parse-only", action="store_true", help="只解析歌词并打印断词结果，不对齐（检查断句用）")
    a = ap.parse_args()

    meta, lines = parse_lyrics(a.lyrics)
    if not lines:
        raise SystemExit("歌词文件里没有歌词行")
    if a.parse_only:
        for ln in lines:
            print(f"[{ln['section'] or '-'}|g{ln['group']}] " + " | ".join(
                ("*" if t["emph"] else "") + t["text"] + ("~" if t["long"] else "") for t in ln["tokens"]))
        return

    src = a.vocals or a.audio
    wav = to_wav(src, sr=16000, mono=True)
    try:
        import soundfile as sf

        duration = sf.info(wav).duration
        jp = any(has_cjk(t["text"]) for ln in lines for t in ln["tokens"])
        language = a.language or ("ja" if jp else "en")
        print(f"对齐语言：{language}")
        lrc_mode = all(ln.get("lrc") is not None for ln in lines)
        if lrc_mode:
            print(f"检测到 LRC 时间戳：逐句对齐（{len(lines)} 句）")
            ok = align_windowed(wav, lines, a.model, language, duration)
            print(f"逐句对齐成功 {sum(ok)}/{len(ok)} 句")
        else:
            aligned = align(wav, lines, a.model, language)
        intervals = voice_intervals(wav)
    finally:
        os.remove(wav)

    flat = [t for ln in lines for t in ln["tokens"]] if lrc_mode else assign(lines, aligned)
    fix_times(flat, duration)
    moved = snap_to_voice(flat, intervals)
    if moved:
        print(f"修正了 {moved} 个落在静音里的词的开始时间")

    out_lines = []
    for ln in lines:
        ws = []
        for t in ln["tokens"]:
            ws.append({
                "text": t["text"],
                "start": r3(t["start"]),
                "end": r3(t["end"]),
                "emph": t["emph"],
                "long": bool(t["long"] or (t["end"] - t["start"]) >= LONG_S),
                "lang": "ja" if has_cjk(t["text"]) else "en",
                "chars": char_times(t),
            })
        out_lines.append({
            "text": line_text(ln),
            "start": ws[0]["start"],
            "end": ws[-1]["end"],
            "section": ln["section"],
            "group": ln["group"],
            "words": ws,
        })
    if lrc_mode:
        dev = [abs(ln["words"][0]["start"] - src["lrc"]) for ln, src in zip(out_lines, lines)]
        print(f"句首与 LRC 时间戳的偏差：平均 {sum(dev) / len(dev):.2f}s，最大 {max(dev):.2f}s")
        for ln, src in zip(out_lines, lines):
            ln["lrc"] = src["lrc"]
    out = {"lines": out_lines}
    if meta.get("credits"):
        out["credits"] = meta["credits"]
    if "title" in meta:
        out["title"] = meta["title"]
    if "artist" in meta:
        out["artist"] = meta["artist"]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    nwords = sum(len(l["words"]) for l in out_lines)
    print(f"对齐完成：{len(out_lines)} 行 / {nwords} 个词 → {a.out}")


if __name__ == "__main__":
    main()
