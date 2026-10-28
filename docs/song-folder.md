# 歌曲工作区结构（songs/<歌名>/）

```
songs/<歌名>/
  input/
    audio.mp3          原始音频（lv new 时复制进来）
    lyrics.txt         用户提供的歌词（普通文本或 LRC）
    bg/                背景素材
  style.json           这首歌的风格方案和手动指定（美术指导的结果，可以手改）
  work/                都可以重新生成
    stems/             demucs 分离出的 vocals / drums / bass / other.wav
    analysis.json      节拍、重拍、段落、能量、鼓点、高潮点
    lyrics.json        逐句、逐词、逐字的对齐结果（想微调时间就改这里）
    strokes.json       这首歌用到的字的 KanjiVG 笔画
    public/            渲染时组装的素材目录（每次渲染都会重建）
  renders/
    <歌名>_wide_seed1[_from-to].mp4   成片
    stills/                            样帧
    schedule_*.md                      编排表（只有时间和效果名）
```

- 整个 `songs/` 都不进仓库，只保留 `songs/README.md`。
- 换一种排版组合：`--seed 2`。手动改了 `lyrics.json` 或 `style.json` 后，直接重新 `render`，不需要再跑 `analyze`。
