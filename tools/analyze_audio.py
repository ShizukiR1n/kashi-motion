"""音频分析：节拍、音头、响度曲线、段落、能量峰值 → analysis.json（格式见 engine/director/types.ts 的 Analysis）。

用法：python tools/analyze_audio.py <音频> <输出.json> [--vocals 人声.wav]
"""
import argparse
import json
import os
import string
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_common import to_wav  # noqa: E402

import librosa  # noqa: E402
import scipy.ndimage  # noqa: E402

SR = 22050
ENERGY_HOP_S = 1 / 30


def r3(x):
    return round(float(x), 3)


def norm01(a):
    a = np.asarray(a, dtype=float)
    lo, hi = np.percentile(a, 2), np.percentile(a, 99.5)
    if hi - lo < 1e-9:
        return np.zeros_like(a)
    return np.clip((a - lo) / (hi - lo), 0, 1)


def load(path):
    wav = to_wav(path, sr=SR, mono=True)
    try:
        y, _ = librosa.load(wav, sr=SR, mono=True)
    finally:
        os.remove(wav)
    return y


def beats_and_bpm(y):
    tempo, frames = librosa.beat.beat_track(y=y, sr=SR, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(frames, sr=SR)
    # 重拍：在 4 种相位里挑音头强度总和最大的那组
    env = librosa.onset.onset_strength(y=y, sr=SR)
    if len(frames) >= 8:
        scores = [env[np.clip(frames[k::4], 0, len(env) - 1)].sum() for k in range(4)]
        k = int(np.argmax(scores))
        downbeats = beats[k::4]
    else:
        downbeats = beats[::4]
    return tempo, beats, downbeats


def onsets(y_src):
    env = librosa.onset.onset_strength(y=y_src, sr=SR)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=SR, backtrack=False, units="frames")
    times = librosa.frames_to_time(frames, sr=SR)
    strength = norm01(env[frames]) if len(frames) else np.array([])
    return [{"t": r3(t), "strength": r3(s)} for t, s in zip(times, strength)]


def energy_curve(y, duration):
    hop = int(round(SR * ENERGY_HOP_S))
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    rms = scipy.ndimage.gaussian_filter1d(rms, sigma=3)  # 约 0.1 秒的轻度平滑
    n = int(np.ceil(duration / ENERGY_HOP_S)) + 1
    rms = np.pad(rms, (0, max(0, n - len(rms))), mode="edge")[:n]
    return norm01(rms)


def bframes_times(y):
    _, fr = librosa.beat.beat_track(y=y, sr=SR)
    return librosa.frames_to_time(fr, sr=SR)


def split_long(edges, energy, beat_times, max_len=20.0):
    """超长的段在能量变化最大的拍点处切开（每次切一刀，直到都不超过 max_len）。"""
    def e_at(t, w=1.5):
        a, b = int(max(0, t - w) / ENERGY_HOP_S), int(t / ENERGY_HOP_S)
        c = int((t + w) / ENERGY_HOP_S)
        before = energy[a:max(a + 1, b)].mean()
        after = energy[b:max(b + 1, c)].mean()
        return abs(after - before)

    out = list(edges)
    changed = True
    while changed:
        changed = False
        for i in range(len(out) - 1):
            a, b = out[i], out[i + 1]
            if b - a > max_len:
                cands = [t for t in beat_times if a + 4.0 <= t <= b - 4.0]
                if not cands:
                    continue
                cut = max(cands, key=e_at)
                out.insert(i + 1, float(cut))
                changed = True
                break
    return out


def sections(y, duration, energy):
    """用色度+MFCC 的递归相似矩阵做聚类分段，再按相似度给段落贴 A/B/C 标签。"""
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=SR, hop_length=hop, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma, axis=0), librosa.util.normalize(mfcc, axis=1)])
    # 每拍同步，减少噪声
    _, bframes = librosa.beat.beat_track(y=y, sr=SR, hop_length=hop)
    if len(bframes) < 16:
        bframes = np.arange(0, feat.shape[1], max(1, feat.shape[1] // 64))
    sync = librosa.util.sync(feat, bframes, aggregate=np.median)
    k = int(np.clip(round(duration / 12), 4, 10))
    k = min(k, max(2, sync.shape[1] - 1))
    bounds_idx = librosa.segment.agglomerative(sync, k)
    bound_frames = np.concatenate([[0], np.array(bframes)[np.clip(bounds_idx, 0, len(bframes) - 1)]])
    times = librosa.frames_to_time(bound_frames, sr=SR, hop_length=hop)
    times = sorted(set([0.0] + [float(t) for t in times if 0 < t < duration - 1.0]))
    # 合并太短的段（< 4 秒）
    merged = [times[0]]
    for t in times[1:]:
        if t - merged[-1] >= 4.0:
            merged.append(t)
    edges = merged + [duration]
    edges = split_long(edges, energy, bframes_times(y), max_len=20.0)

    segs, means = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        fa, fb = librosa.time_to_frames([a, b], sr=SR, hop_length=hop)
        fb = max(fb, fa + 1)
        means.append(feat[:, fa:fb].mean(axis=1))
        ea, eb = int(a / ENERGY_HOP_S), max(int(a / ENERGY_HOP_S) + 1, int(b / ENERGY_HOP_S))
        segs.append([a, b, float(np.mean(energy[ea:eb]))])

    # 相似度贴标签：先在各段之间做标准化（突出段与段的差异），再用余弦相似度聚类
    M = np.array(means)
    M = (M - M.mean(axis=0)) / (M.std(axis=0) + 1e-6)
    labels, reps = [], []
    for m in M:
        m = m / (np.linalg.norm(m) + 1e-9)
        sims = [float(np.dot(m, r)) for r in reps]
        if sims and max(sims) > 0.55:
            labels.append(string.ascii_uppercase[int(np.argmax(sims))])
        else:
            reps.append(m)
            labels.append(string.ascii_uppercase[min(len(reps) - 1, 25)])

    es = norm01([s[2] for s in segs]) if len(segs) > 1 else np.ones(len(segs))
    return [{"start": r3(s[0]), "end": r3(s[1]), "label": lab, "energy": r3(e)} for s, lab, e in zip(segs, labels, es)]


DRUM_HOP = 256
# 频段（Hz）与同类鼓点的最小间隔（秒）
DRUM_BANDS = {"kick": (30, 130, 0.10), "snare": (1500, 5000, 0.09), "hat": (7000, 11000, 0.05)}


def drum_hits(path):
    """在鼓分轨里按频段找鼓点：底鼓（低频）/ 军鼓（中高频噪声）/ 镲（高频）。
    用对数能量的正向变化（spectral flux）找峰值，strength 归一化到 0..1。"""
    y = load(path)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=DRUM_HOP))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    times = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=DRUM_HOP)
    out = {}
    for name, (lo, hi, gap) in DRUM_BANDS.items():
        e = np.log1p(S[(freqs >= lo) & (freqs < hi)].sum(axis=0))
        flux = np.maximum(0, np.diff(e, prepend=e[0]))
        flux = flux / (np.percentile(flux, 99.5) + 1e-9)
        peaks = librosa.util.peak_pick(flux, pre_max=3, post_max=3, pre_avg=12, post_avg=12, delta=0.12,
                                       wait=max(1, int(gap * SR / DRUM_HOP)))
        out[name] = [{"t": r3(times[k]), "strength": r3(min(1.0, flux[k]))} for k in peaks if flux[k] > 0.18]
    return out


def downbeats_from_kicks(beats, kicks):
    """小节第一拍的相位：选 4 种相位里"拍上有底鼓"总强度最大的那一种。"""
    if len(beats) < 8 or not kicks:
        return None
    kt = np.array([k["t"] for k in kicks])
    ks = np.array([k["strength"] for k in kicks])

    def kick_at(t):
        i = np.searchsorted(kt, t)
        best = 0.0
        for j in (i - 1, i):
            if 0 <= j < len(kt) and abs(kt[j] - t) < 0.07:
                best = max(best, ks[j])
        return best

    scores = [sum(kick_at(t) for t in beats[k::4]) for k in range(4)]
    return beats[int(np.argmax(scores))::4]


def main():
    ap = argparse.ArgumentParser(description="音频分析 → analysis.json")
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--vocals", help="人声分轨 wav（可选，用来检测人声音头）")
    ap.add_argument("--drums", help="鼓分轨 wav（可选，用来识别底鼓/军鼓/镲并校正小节）")
    a = ap.parse_args()

    y = load(a.audio)
    duration = len(y) / SR
    tempo, beats, downbeats = beats_and_bpm(y)
    y_on = load(a.vocals) if a.vocals else y
    ons = onsets(y_on)
    energy = energy_curve(y, duration)
    secs = sections(y, duration, energy)
    drums = drum_hits(a.drums) if a.drums else None
    if drums:
        db = downbeats_from_kicks(beats, drums["kick"])
        if db is not None:
            downbeats = db

    # 峰值：在能量最高的段落里找最响的时刻
    top = max(secs, key=lambda s: s["energy"])
    ia, ib = int(top["start"] / ENERGY_HOP_S), int(top["end"] / ENERGY_HOP_S)
    peak = (ia + int(np.argmax(energy[ia:ib]))) * ENERGY_HOP_S if ib > ia else float(np.argmax(energy)) * ENERGY_HOP_S

    out = {
        "duration": r3(duration),
        "bpm": round(tempo, 2),
        "beats": [r3(t) for t in beats],
        "downbeats": [r3(t) for t in downbeats],
        "onsets": ons,
        "energy": {"hop": round(ENERGY_HOP_S, 6), "values": [round(float(v), 3) for v in energy]},
        "sections": secs,
        "peak": r3(peak),
    }
    if drums:
        out["drums"] = drums
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"时长 {duration:.1f}s | BPM {tempo:.1f} | 拍 {len(beats)} | 重拍 {len(downbeats)} | 音头 {len(ons)} | "
          f"段落 {len(secs)}（{' '.join(s['label'] for s in secs)}）| 峰值 {peak:.2f}s → {a.out}")
    if drums:
        print("鼓点：" + "  ".join(f"{k} {len(v)}" for k, v in drums.items()))


if __name__ == "__main__":
    main()
