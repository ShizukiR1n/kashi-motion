# kashi-motion

输入**歌曲 + 歌词 + 背景素材**，生成卡点、有设计感的歌词视频（默认 16:9 横屏，可出 9:16 竖屏）。

- 逐字对齐演唱时间，支持日语、英语、日英混合和 LRC
- 画面跟着鼓点走：镜头推拉、跟字、句间转场
- 十几种逐字浮现效果，按规则编排，不会重复使用
- 每首歌一份风格方案，先出片，再按意见迭代

## 使用

需要 Python 3.11+ 和 Node.js 18+（Windows）。

```bash
powershell -ExecutionPolicy Bypass -File setup.ps1
```

```bash
python lv.py demo --stills 7,17,30
```

```bash
python lv.py new mysong --audio song.mp3 --lyrics lyrics.txt --bg cover.jpg
```

```bash
python lv.py analyze mysong --model small
```

```bash
python lv.py render mysong --from 40 --to 100
```

成片保存在 `songs/mysong/renders/`。歌词格式、风格方案和全部命令见 [docs/workflow.md](docs/workflow.md)。和 AI 助手协作时，先让它读 [AGENTS.md](AGENTS.md)。

## 注意事项

- **素材版权**：`songs/`（音频、歌词、素材）不会进仓库。请只使用你有权使用的素材，歌词也由你自己提供。
- **渲染耗时**：1080p 成片渲染较慢，60 秒大约要 20 分钟。建议先用 `--stills` 出样帧确认效果。
- **第三方许可**：笔画数据来自 KanjiVG（CC BY-SA 3.0），字体来自 Google Fonts（OFL）。Remotion 用于公司商用时需要另行购买许可，详见 [docs/third-party.md](docs/third-party.md)。
