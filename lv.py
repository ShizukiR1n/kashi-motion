"""kashi-motion 命令入口。所有操作都通过它完成，人和 AI 用法相同。

  python lv.py doctor                                   检查环境
  python lv.py new <歌名> --audio 歌.mp3 [--lyrics 歌词.txt] [--bg 图1.jpg 图2.png ...] [--preset midnight-ink]
  python lv.py analyze <歌名> [--no-separate] [--model small]
  python lv.py render <歌名> [--tall] [--wide] [--seed 2] [--stills 5,12.5,30]
  python lv.py plan <歌名> [--from 41.4 --to 103.7] [--seed 1] [--tall]   打印编排表（每句用了什么效果；不渲染、不输出歌词）
  python lv.py studio <歌名>                            打开可拖动时间轴的预览界面
  python lv.py demo                                     用自带的原创示例歌跑通全流程

歌曲工作区结构（songs/<歌名>/）见 docs/song-folder.md。
"""
import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SONGS = ROOT / "songs"
PRESETS = ROOT / "presets"
ASSETS = ROOT / "assets"
PY = sys.executable
NPX = "npx.cmd" if sys.platform == "win32" else "npx"
AUDIO_EXT = (".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac")
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")


# ---------------- 小工具 ----------------
def run(cmd, **kw):
    print("\n>>", " ".join(str(c) for c in cmd), flush=True)
    t = time.time()
    subprocess.run([str(c) for c in cmd], check=True, cwd=ROOT, **kw)
    print(f"   完成，用时 {time.time() - t:.0f} 秒", flush=True)


def song_dir(name: str) -> Path:
    d = SONGS / name
    if not d.exists():
        raise SystemExit(f"找不到歌曲工作区：{d}（先运行 python lv.py new {name} ...）")
    return d


def find_audio(d: Path) -> Path:
    files = [p for p in (d / "input").iterdir() if p.suffix.lower() in AUDIO_EXT]
    if not files:
        raise SystemExit(f"{d / 'input'} 里没有音频文件")
    return files[0]


def read_json(p: Path, default=None):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def merge(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            out[k] = merge(a.get(k), v)
        return out
    return a if b is None else b


# ---------------- 命令 ----------------
def cmd_doctor(_):
    ok = True
    print("Python:", sys.version.split()[0], PY)
    for mod in ["librosa", "soundfile", "scipy", "numpy", "PIL", "stable_whisper", "fugashi", "imageio_ffmpeg"]:
        try:
            __import__(mod)
            print(f"  ✓ {mod}")
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"  ✗ {mod}  ({type(e).__name__})")
    try:
        __import__("demucs")
        print("  ✓ demucs（人声分离）")
    except Exception:  # noqa: BLE001
        print("  - demucs 未安装：人声分离会退回简易提取，对齐略差（可选：pip install demucs）")
    for exe in ["node", NPX]:
        print(f"  {'✓' if shutil.which(exe) else '✗'} {exe}")
        ok &= bool(shutil.which(exe))
    print(f"  {'✓' if (ROOT / 'node_modules' / 'remotion').exists() else '✗'} node_modules（npm install）")
    sys.path.insert(0, str(ROOT / "tools"))
    from audio_common import ensure_ffmpeg  # noqa: E402

    print("  ✓ ffmpeg:", ensure_ffmpeg())
    print("\n环境正常" if ok else "\n有缺失项：运行 setup.ps1（Windows）或按 README 安装")


def cmd_new(a):
    d = SONGS / a.name
    if d.exists() and not a.force:
        raise SystemExit(f"{d} 已存在（加 --force 覆盖输入文件）")
    for sub in ["input/bg", "work", "renders"]:
        (d / sub).mkdir(parents=True, exist_ok=True)
    src = Path(a.audio).resolve()
    shutil.copyfile(src, d / "input" / f"audio{src.suffix.lower()}")
    if a.lyrics:
        shutil.copyfile(Path(a.lyrics).resolve(), d / "input" / "lyrics.txt")
    for i, img in enumerate(a.bg or []):
        p = Path(img).resolve()
        shutil.copyfile(p, d / "input" / "bg" / p.name)
    style_p = d / "style.json"
    if not style_p.exists():
        style = {"preset": a.preset, "notes": "美术指导写在这里：为什么这样选（看 docs/art-direction.md）"}
        style_p.write_text(json.dumps(style, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已创建 {d}\n下一步：python lv.py analyze {a.name}")


def cmd_analyze(a):
    d = song_dir(a.name)
    audio = find_audio(d)
    work = d / "work"
    vocals = work / "stems" / "vocals.wav"
    if not a.no_separate:
        run([PY, "tools/separate_vocals.py", audio, work / "stems"])
    voc = ["--vocals", vocals] if (vocals.exists() and not a.no_separate) else []
    drums = work / "stems" / "drums.wav"
    drm = ["--drums", drums] if (drums.exists() and not a.no_separate) else []
    run([PY, "tools/analyze_audio.py", audio, work / "analysis.json", *voc, *drm])
    lyr = d / "input" / "lyrics.txt"
    if lyr.exists():
        run([PY, "tools/align_lyrics.py", audio, lyr, work / "lyrics.json", *voc, "--model", a.model])
        if (ROOT / "tools" / "data" / "kanjivg").exists():
            run([PY, "-I", "tools/strokes.py", work / "lyrics.json", work / "strokes.json"])
        else:
            print("没有 KanjiVG 数据（tools/data/kanjivg）：笔画拼接会退回普通浮现。见 docs/third-party.md")
    else:
        print("没有 input/lyrics.txt：渲染时会用占位词演示卡点")
    print(f"\n下一步：python lv.py render {a.name} --stills 10,30  （先看样帧）")


def build_public(d: Path) -> Path:
    """组装渲染素材目录 work/public：引擎素材 + 本歌的音频、分析、歌词、合并后的风格、背景素材。"""
    pub = d / "work" / "public"
    if pub.exists():
        shutil.rmtree(pub)
    (pub / "bg").mkdir(parents=True)
    for f in ASSETS.iterdir():
        if f.is_file():
            shutil.copyfile(f, pub / f.name)
    audio = find_audio(d)
    shutil.copyfile(audio, pub / audio.name)
    for name in ["analysis.json", "lyrics.json", "strokes.json"]:
        if (d / "work" / name).exists():
            shutil.copyfile(d / "work" / name, pub / name)
    if not (pub / "analysis.json").exists():
        raise SystemExit(f"还没分析：先运行 python lv.py analyze {d.name}")
    bgs = sorted(p.name for p in (d / "input" / "bg").glob("*") if p.suffix.lower() in IMG_EXT)
    for b in bgs:
        shutil.copyfile(d / "input" / "bg" / b, pub / "bg" / b)
    song_style = read_json(d / "style.json", {})
    preset = read_json(PRESETS / f"{song_style.get('preset', 'midnight-ink')}.json", {})
    style = merge(preset, {k: v for k, v in song_style.items() if k not in ("preset", "notes")})
    if bgs and not style.get("background", {}).get("images"):
        style.setdefault("background", {})["images"] = bgs  # 没指定就用素材文件夹里的图
    (pub / "style.json").write_text(json.dumps(style, ensure_ascii=False, indent=2), encoding="utf-8")
    return pub


def cmd_render(a):
    d = song_dir(a.name)
    pub = build_public(d)
    audio = find_audio(d).name
    aspects = [x for x, on in (("wide", a.wide), ("tall", a.tall)) if on] or ["wide"]  # 默认横屏
    out_dir = d / "renders"
    out_dir.mkdir(exist_ok=True)
    for asp in aspects:
        props = d / "work" / f"_props_{asp}.json"
        clip = None
        if getattr(a, "frm", None) is not None or getattr(a, "to", None) is not None:
            dur = read_json(pub / "analysis.json")["duration"]
            clip = {"start": a.frm or 0.0, "end": min(a.to or dur, dur)}
        props.write_text(json.dumps({"audio": audio, "seed": a.seed, "aspect": asp, "clip": clip,
                                     "debug": bool(getattr(a, "debug", False))}), encoding="utf-8")
        tag = "_debug" if getattr(a, "debug", False) else ""
        common = ["engine/index.ts", "Lyric", f"--public-dir={pub}", f"--props={props}", "--log=error"]
        if a.stills:
            for sec in [float(s) for s in a.stills.split(",")]:
                frame = int(round(sec * 30))
                out = out_dir / "stills" / f"{asp}_seed{a.seed}{tag}_{sec:06.2f}s.png"
                out.parent.mkdir(exist_ok=True)
                run([NPX, "remotion", "still", *common[:2], out, f"--frame={frame}", *common[2:]])
        else:
            out = out_dir / f"{d.name}_{asp}_seed{a.seed}{tag}.mp4"
            rng = []
            if getattr(a, "frm", None) is not None or getattr(a, "to", None) is not None:
                f0 = int((a.frm or 0) * 30)
                f1 = int(a.to * 30) - 1 if a.to else int(read_json(pub / "analysis.json")["duration"] * 30) - 1
                rng = [f"--frames={f0}-{f1}"]
                out = out.with_name(out.stem + f"_{a.frm or 0:g}-{a.to or 'end'}s.mp4")
            run([NPX, "remotion", "render", *common[:2], out, *common[2:], f"--concurrency={a.concurrency}", *rng])
            print(f"成片：{out}")


def cmd_plan(a):
    d = song_dir(a.name)
    pub = build_public(d)
    dur = read_json(pub / "analysis.json")["duration"]
    out = d / "renders" / f"schedule_seed{a.seed}_{a.frm or 0:g}-{a.to or round(dur, 1):g}.md"
    out.parent.mkdir(exist_ok=True)
    res = subprocess.run([NPX, "tsx", "engine/cli/plan.ts", pub, str(a.seed), "tall" if a.tall else "wide",
                          str(a.frm or 0), str(a.to or dur)], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8")
    out.write_text(res.stdout, encoding="utf-8")
    print(res.stdout)
    print(f"编排表已保存：{out}")


def cmd_studio(a):
    d = song_dir(a.name)
    pub = build_public(d)
    run([NPX, "remotion", "studio", "engine/index.ts", f"--public-dir={pub}"])


def cmd_demo(a):
    """原创示例歌：合成伴奏 + 自写占位歌词（已带逐字时间，跳过人声分离和对齐），用来验证环境和效果。"""
    demo = ROOT / "examples" / "demo"
    run([PY, "tools/make_demo_song.py", demo])
    cmd_new(argparse.Namespace(name="demo", audio=str(demo / "demo_song.wav"), lyrics=None, bg=None,
                               preset="midnight-ink", force=True))
    cmd_analyze(argparse.Namespace(name="demo", no_separate=True, model="base"))
    work = SONGS / "demo" / "work"
    shutil.copyfile(demo / "lyrics.json", work / "lyrics.json")
    if (ROOT / "tools" / "data" / "kanjivg").exists():
        run([PY, "-I", "tools/strokes.py", work / "lyrics.json", work / "strokes.json"])
    cmd_render(argparse.Namespace(name="demo", wide=True, tall=a.tall, seed=1, stills=a.stills, concurrency=4,
                                  debug=False, frm=None, to=None))


def main():
    ap = argparse.ArgumentParser(description="kashi-motion：歌 + 歌词 + 背景素材 → 卡点歌词视频")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor", help="检查环境")
    p = sub.add_parser("new", help="创建歌曲工作区")
    p.add_argument("name")
    p.add_argument("--audio", required=True)
    p.add_argument("--lyrics")
    p.add_argument("--bg", nargs="*", help="背景素材（图片）")
    p.add_argument("--preset", default="midnight-ink", help="起始风格预设（presets/ 下的文件名）")
    p.add_argument("--force", action="store_true")
    p = sub.add_parser("analyze", help="人声分离 + 节拍分析 + 歌词对齐")
    p.add_argument("name")
    p.add_argument("--no-separate", action="store_true", help="跳过人声分离（快，但对齐略差）")
    p.add_argument("--model", default="base", help="对齐模型 base / small（日语推荐 small）")
    p = sub.add_parser("render", help="渲染成片或样帧")
    p.add_argument("name")
    p.add_argument("--wide", action="store_true", help="16:9 横屏（默认）")
    p.add_argument("--tall", action="store_true", help="9:16 竖屏")
    p.add_argument("--seed", type=int, default=1, help="排版随机种子，换数字换组合")
    p.add_argument("--stills", help="只渲染这些时间点（秒）的样帧，逗号分隔")
    p.add_argument("--debug", action="store_true", help="叠加调试时间轴：拍子、鼓点、每个字的对齐时间")
    p.add_argument("--from", dest="frm", type=float, help="只渲染一段：起始秒")
    p.add_argument("--to", type=float, help="只渲染一段：结束秒")
    p.add_argument("--concurrency", type=int, default=4)
    p = sub.add_parser("plan", help="打印编排表（不渲染）")
    p.add_argument("name")
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--tall", action="store_true")
    p.add_argument("--from", dest="frm", type=float)
    p.add_argument("--to", type=float)
    p = sub.add_parser("studio", help="打开预览界面")
    p.add_argument("name")
    p = sub.add_parser("demo", help="用原创示例歌跑通全流程")
    p.add_argument("--tall", action="store_true", help="同时出竖屏")
    p.add_argument("--stills", help="只出样帧，例如 5,15,25")
    a = ap.parse_args()
    {"doctor": cmd_doctor, "new": cmd_new, "analyze": cmd_analyze, "render": cmd_render,
     "plan": cmd_plan, "studio": cmd_studio, "demo": cmd_demo}[a.cmd](a)


if __name__ == "__main__":
    main()
