"""音频脚本共用：定位 ffmpeg、把任意音频转成 wav。"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
BIN = TOOLS / "bin"  # 不进仓库（.gitignore），首次运行时自动生成


def _bundled_ffmpeg():
    """pip 包 imageio-ffmpeg 自带一个 ffmpeg，可跨平台使用。"""
    try:
        import imageio_ffmpeg

        return Path(imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:
        return None


def ensure_ffmpeg() -> str:
    """确保 PATH 里有名为 ffmpeg 的程序（stable-ts / whisper 会直接调用它），返回可执行路径。
    查找顺序：tools/bin/ffmpeg → 系统 PATH → imageio-ffmpeg 自带的（复制到 tools/bin/）。"""
    exe = BIN / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if not exe.exists():
        found = shutil.which("ffmpeg")
        if found:
            return found
        bundled = _bundled_ffmpeg()
        if bundled and bundled.exists():
            BIN.mkdir(exist_ok=True)
            shutil.copy(bundled, exe)
    if exe.exists():
        os.environ["PATH"] = str(BIN) + os.pathsep + os.environ.get("PATH", "")
        return str(exe)
    raise SystemExit("找不到 ffmpeg：运行 setup.ps1 安装依赖，或把 ffmpeg 放进系统 PATH")


def to_wav(src: str, sr: int = 44100, mono: bool = True) -> str:
    """转成临时 wav 文件并返回路径（调用者负责删除）。"""
    ff = ensure_ffmpeg()
    fd, out = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cmd = [ff, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vn", "-ar", str(sr)]
    if mono:
        cmd += ["-ac", "1"]
    cmd += [out]
    subprocess.run(cmd, check=True)
    return out
