"""生成自带的原创示例歌：合成伴奏 + 一条正弦波旋律（代替人声）+ 预先写好时间的占位歌词。
不含任何第三方音频或歌词，克隆仓库后可直接跑通全流程：python lv.py demo

用法：python tools/make_demo_song.py <输出目录>
输出：demo_song.wav、lyrics.txt（LRC 格式，供参考）、lyrics.json（已带逐字时间，演示时跳过对齐）
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align_lyrics import has_cjk, parse_lyrics  # noqa: E402

SR = 44100
BPM = 110
BEAT = 60 / BPM
BARS = 18
DUR = BARS * 4 * BEAT  # 约 39 秒

# 占位歌词：本项目作者自写的示例句，不是任何歌曲的歌词。每句从第 2、4、6…小节开始。
LINES = [
    "夜明けの 光を *探して*",
    "fading *signal* in the rain",
    "窓の外で 雨が *揺れる*",
    "君の声が 遠く *響く*~",
    "星の 欠片を *集めて*",
    "明日へ 続く *道*",
    "hold this *note*~",
]


def tone(freq, dur, kind="sine", amp=0.3):
    t = np.arange(int(dur * SR)) / SR
    if kind == "saw":
        w = 2 * (t * freq % 1) - 1
    else:
        w = np.sin(2 * np.pi * freq * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return (w * env * amp).astype(np.float32)


def add(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "examples/demo")
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    mix = np.zeros(int(DUR * SR) + SR, dtype=np.float32)

    # ---- 鼓：底鼓 1、3 拍，军鼓 2、4 拍，镲 8 分音符 ----
    t = np.arange(int(0.35 * SR)) / SR
    kick = (np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 9) * 0.9).astype(np.float32)
    snare = (rng.normal(0, 1, int(0.2 * SR)) * np.exp(-np.arange(int(0.2 * SR)) / SR * 22) * 0.35).astype(np.float32)
    hat = (np.diff(rng.normal(0, 1, int(0.05 * SR) + 1)) * np.exp(-np.arange(int(0.05 * SR)) / SR * 90) * 0.12).astype(np.float32)
    for b in range(4, BARS * 4):  # 第 2 小节起进鼓
        at = b * BEAT
        if b % 4 in (0, 2):
            add(mix, kick, at)
        else:
            add(mix, snare, at)
        add(mix, hat, at)
        add(mix, hat * 0.7, at + BEAT / 2)

    # ---- 和弦铺底 + 贝斯：Am - F - C - G ----
    prog = [(220.0, [220.0, 261.63, 329.63]), (174.61, [174.61, 220.0, 261.63]), (130.81, [196.0, 261.63, 329.63]), (196.0, [196.0, 246.94, 293.66])]
    for bar in range(BARS):
        root, chord = prog[bar % 4]
        at = bar * 4 * BEAT
        for f in chord:
            add(mix, tone(f, 4 * BEAT, "saw", 0.05), at)
        for k in range(4):
            add(mix, tone(root / 2, BEAT * 0.9, "sine", 0.25), at + k * BEAT)

    # ---- 占位歌词 → 逐字时间；旋律在每个字上响一个音（代替人声）----
    tmp = out / "lyrics.txt"
    tmp.write_text("# title: demo song\n# artist: kashi-motion\n" + "\n".join(LINES) + "\n", encoding="utf-8")
    meta, lines = parse_lyrics(tmp)
    scale = [440.0, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88]
    out_lines, lrc = [], []
    for li, ln in enumerate(lines):
        start = (li * 2 + 1) * 4 * BEAT  # 第 2、4、6…小节的第一拍
        chars = [(tk, c) for tk in ln["tokens"] for c in tk["text"]]
        step = min(0.32, 2.6 / max(1, len(chars)))
        t_cur = start
        words = []
        for tk in ln["tokens"]:
            cs = []
            for c in tk["text"]:
                cs.append({"c": c, "t": round(t_cur, 3)})
                if c.strip():
                    add(mix, tone(scale[(len(cs) + li) % len(scale)], step * 0.95, "sine", 0.18), t_cur)
                t_cur += step
            end = t_cur + (1.4 if tk["long"] else 0.0)
            if tk["long"]:
                add(mix, tone(scale[li % len(scale)], 1.5, "sine", 0.18), t_cur - step)
                t_cur = end
            words.append({"text": tk["text"], "start": cs[0]["t"], "end": round(end, 3), "emph": tk["emph"],
                          "long": tk["long"], "lang": "ja" if has_cjk(tk["text"]) else "en", "chars": cs})
            t_cur += step * 0.6
        sep = "" if has_cjk("".join(w["text"] for w in words)) else " "
        out_lines.append({"text": sep.join(w["text"] for w in words), "start": words[0]["start"], "end": words[-1]["end"],
                          "section": "chorus" if li >= 4 else "verse", "group": li // 2, "words": words})
        lrc.append(f"[{int(start // 60):02d}:{start % 60:05.2f}]{sep.join(w['text'] for w in words)}")

    mix = mix[: int(DUR * SR)]
    mix /= max(1e-6, np.abs(mix).max()) / 0.9
    sf.write(out / "demo_song.wav", mix, SR)
    (out / "lyrics.json").write_text(json.dumps({"lines": out_lines, "title": "demo song", "artist": "kashi-motion"}, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.write_text("# title: demo song\n# artist: kashi-motion\n" + "\n".join(lrc) + "\n", encoding="utf-8")
    print(f"示例歌 → {out}（{DUR:.1f} 秒，{len(out_lines)} 句占位歌词）")


if __name__ == "__main__":
    main()
