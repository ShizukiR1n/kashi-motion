# 第三方数据与许可

## KanjiVG（笔画拼接效果的笔顺数据）

- 来源：https://github.com/KanjiVG/kanjivg （release `r20260714`，`kanjivg-20260714-main.zip`）
- 作者：Ulrich Apel 及 KanjiVG 贡献者
- 许可：Creative Commons Attribution-Share Alike 3.0（CC BY-SA 3.0）
  https://creativecommons.org/licenses/by-sa/3.0/
- 用途：`tools/strokes.py` 从中提取歌词用到的字的笔画路径（按笔顺），生成 `strokes.json`，
  供 `engine/fx/strokes/StrokeReveal.tsx` 逐笔绘制。
- 存放：原始数据放在 `tools/data/kanjivg/`，**不进仓库**（体积大，需按上面链接自行下载 main.zip 放入该目录）。
- 派生数据：`strokes.json`（每首歌的工作目录里）和 `engine/fx/strokes/demoStrokes.ts`（演示用少量字）
  属于 KanjiVG 的派生作品，同样适用 CC BY-SA 3.0：再分发时须保留本署名并以相同许可共享。

## 字体（Google Fonts，SIL Open Font License 1.1）

- EB Garamond（拉丁文）、Shippori Mincho（日文）：渲染时通过 `@remotion/google-fonts` 加载，不随仓库分发字体文件。

## 渲染引擎

- [Remotion](https://www.remotion.dev/)：个人和小团队可免费使用；**公司（超过 3 人）商用需要购买 Remotion 的公司许可**，详见 https://www.remotion.dev/license 。

## Python 依赖（均为开源许可，按各自许可使用）

| 包 | 用途 | 许可 |
|---|---|---|
| librosa | 节拍 / 音头 / 段落分析 | ISC |
| demucs | 人声与鼓分离 | MIT |
| stable-ts（基于 OpenAI Whisper） | 歌词强制对齐 | MIT |
| fugashi + unidic-lite | 日语断句 | MIT / BSD |
| imageio-ffmpeg | 自带 ffmpeg | BSD（ffmpeg 本身为 LGPL/GPL） |
| numpy / scipy / soundfile / pillow | 通用 | BSD 系 |

## 本仓库自带素材

- `assets/` 里的背景图和颗粒贴图由 `tools/make_bg.py` 程序生成，属于本项目原创。
- `examples/demo` 的示例歌由 `tools/make_demo_song.py` 合成，占位歌词为本项目自写，不含第三方音频或歌词。
