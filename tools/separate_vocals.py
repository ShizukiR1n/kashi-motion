"""人声分离（可选）：用 demucs 把歌曲拆出人声，输出 <out_dir>/vocals.wav。
没装 demucs 或运行失败时，退回到简单的中置声道提取（效果较弱，但不阻塞流程）。

用法：python tools/separate_vocals.py <音频> <输出目录>
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_common import ensure_ffmpeg, to_wav  # noqa: E402


def with_demucs(src, out_dir):
    ensure_ffmpeg()
    tmp = tempfile.mkdtemp()
    try:
        wav = to_wav(src, sr=44100, mono=False)
        # 四轨分离：vocals（对齐歌词）/ drums（识别底鼓、军鼓、镲）/ bass / other
        cmd = [sys.executable, "-m", "demucs", "-n", "htdemucs", "-d", "cpu", "-o", tmp, wav]
        subprocess.run(cmd, check=True)
        name = os.path.splitext(os.path.basename(wav))[0]
        for stem in ("vocals", "drums", "bass", "other"):
            got = os.path.join(tmp, "htdemucs", name, f"{stem}.wav")
            if os.path.exists(got):
                shutil.copy(got, os.path.join(out_dir, f"{stem}.wav"))
        os.remove(wav)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def with_center_extract(src, out_dir):
    """退路：用 ffmpeg 做中置声道增强 + 人声频段带通，人声通常在中间。"""
    ff = ensure_ffmpeg()
    out = os.path.join(out_dir, "vocals.wav")
    af = "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=150,lowpass=f=6000,dynaudnorm"
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vn", "-af", af, "-ar", "44100", out], check=True)


def main():
    ap = argparse.ArgumentParser(description="人声分离 → vocals.wav")
    ap.add_argument("audio")
    ap.add_argument("out_dir")
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    try:
        import demucs  # noqa: F401

        if with_demucs(a.audio, a.out_dir):
            print("demucs 分离完成 →", os.path.join(a.out_dir, "vocals.wav"))
            return
    except Exception as e:  # noqa: BLE001
        print(f"demucs 不可用（{type(e).__name__}: {e}），改用简易中置人声提取")
    with_center_extract(a.audio, a.out_dir)
    print("简易人声提取完成（精度较低）→", os.path.join(a.out_dir, "vocals.wav"))


if __name__ == "__main__":
    main()
