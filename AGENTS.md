# AGENTS.md — 给 AI 助手的入口说明

> 任何 AI（Claude、Codex、Cursor、Copilot……）打开本仓库，请先读完本文件。
> 这里是 **kashi-motion**：输入「歌曲音频 + 用户提供的歌词 + 背景素材」，输出**卡点、有设计感的歌词视频**（默认 16:9 横屏，也支持 9:16 竖屏）。
> 技术栈：Remotion 4（React 渲染视频）+ Python（音频分析、歌词对齐）。所有操作通过 `python lv.py <命令>` 完成。
>
> **必读：[docs/lessons.md](docs/lessons.md)** —— 第一个完整项目里发现的每个问题、原因、修法和沉淀的规则（素材复用、卡点、排版、动画、特效、运镜、质感、协作）。动手前先读。

---

## 0. 必须遵守的规矩

1. **歌词只用用户提供的**。不要去网上找歌词、不要听写/转录歌曲、不要在对话或日志里复述歌词全文。对齐脚本只做「把用户给的文本对到音频上」。
2. **`songs/` 不进仓库**（音频、歌词、背景素材通常有版权）。`tools/data/`（KanjiVG 原始数据）也不进仓库。
3. **改代码前先跑 `npx tsc -p .`，改完再跑一次**；出片前先出样帧（`--stills`）自查。
4. 说明文件、注释、编排理由用中文写；**理由只写意象，不抄歌词**。
5. 用户是导演，你是执行 + 美术指导：方案先给用户确认，再大规模渲染；用户的意见优先于本文件里的默认值。

## 1. 命令速查

```bash
python lv.py doctor                                   # 检查环境
python lv.py demo --stills 7,17,30                    # 用自带的原创示例歌跑通全流程
python lv.py new <歌名> --audio 歌.mp3 --lyrics 歌词.txt --bg 封面.jpg   # 建工作区
python lv.py analyze <歌名> --model small             # 人声/鼓分离 → 节拍鼓点分析 → 逐字对齐 → 笔画数据
python lv.py render <歌名> --debug --from 36 --to 58  # 调试版：画面叠拍子/鼓点/每个字的时间轴，用来验卡点
python lv.py plan <歌名> --from 41.4 --to 103.7       # 编排表：每句用了哪种浮现/点缀/入场/背景/转场（不渲染）
python lv.py render <歌名> --stills 43,52,61          # 样帧
python lv.py render <歌名> --from 41.4 --to 103.7     # 成片（默认横屏；加 --tall 出竖屏）
python lv.py studio <歌名>                            # 浏览器里拖时间轴预览
```

成片在 `songs/<歌名>/renders/`。

## 2. 标准流程（详细版见 docs/workflow.md）

1. **收素材**：音频、歌词（支持普通文本和 LRC 时间戳；日文/英文/日英混合）、背景素材。歌词格式见 docs/workflow.md。
2. **分析**：`lv analyze`。看输出里的 BPM、段落、鼓点数、对齐成功率、句首偏差。
3. **验卡点**：`lv render --debug` 出一小段，对照时间轴。不准就先修对齐，**卡点不对不要往下做**。
4. **美术指导**（docs/art-direction.md）：看素材、读歌词意象、听段落起伏 → 写 `songs/<歌名>/style.json`：配色、装饰套件、背景取景、颗粒、以及 `directives`（按时间点指定某句的做法）。
5. **查编排**：`lv plan`，确认没有违反「不重复」规则。
6. **样帧 → 成片**：先 `--stills` 自查，再出成片；给用户 720p 预览（大文件传不上去时用 ffmpeg 压一份）。
7. **按用户意见迭代**：把意见整理成修改清单 → 用户确认 → 改 → 重渲。

## 3. 用户已经明确的审美规则（迭代中沉淀下来的，默认遵守；完整来龙去脉见 docs/lessons.md）

- **不要**：放射光（rays）、光环/光圈扩散（halo）、绕字转圈的粒子（swirl）。这些已从自动编排里移除。
- **不重复**：同一种浮现方式，招牌型（水中浮现、光尘、单字快切、碎片聚合、光标）一分钟内只用 1 次；其余最多 2 次且间隔 ≥15 秒；相邻句一定不同。背景、点缀、入场、转场同样有冷却。
- **镜头要一直在动**：全局 100%→108% 慢呼吸 + 微漂移；逐字浮现时镜头推近跟字、最后拉回整句；句间用推穿 / 甩镜 / 拉远转场，不要全是硬切。
- **层级**：每句「1 个巨大主词 + 若干小词 + 1 个空心描边回声字」的杂志式排版；字不能小到看不出重点。
- **可读性**：字出完要有停留（拉回整句后至少停 0.6 秒）再做消散类效果；时间不够就柔和淡出。
- **质感**：胶片颗粒、景深（背景/装饰虚，字最清楚；切镜时背景先虚后实）、背景缓慢推拉漂移。
- **按歌词意象设计**：例如「祈愿」→ 顺序笔画书写；「堆积」→ 乱序笔画拼合；「融化」→ 水中浮现；「孤独/结束」→ 碎成光尘。
- 日文竖排一律用正立直书；英文句不用直书和笔画拼接。

## 4. 目录地图

| 位置 | 内容 |
|---|---|
| `lv.py` | 统一命令入口 |
| `engine/director/` | 导演：`director.ts`（镜头、模板、编排上限、转场、手动指定）、`lines.ts`（整句逐字排版 + 镜头路线）、`schedule.ts`（点缀/入场/背景编排与冷却）、`types.ts`（数据格式） |
| `engine/render/` | 总装：`Lyric.tsx`（背景、镜头、转场、片头尾）、`LineView.tsx`（整句浮现）、`backdrops/`（9 种背景处理）、`BeatLayer.tsx`（鼓点包络 + 调试时间轴） |
| `engine/fx/` | 效果库：`reveals/`、`reveals2/`（逐字浮现）、`strokes/`（KanjiVG 笔画）、`entrances/`（14 种词入场）、`accents/`（主词点缀）、`CameraRig`、`Particles`、`Distort`、`MotionBlur` |
| `engine/components/` | `Word`（色差/辉光/直书）、`Deco`、`Seraph`（光环外的天使装饰：锁链/几何纹样/羽毛） |
| `engine/style/style.ts` | `style.json` 的字段定义与默认值（详见 docs/style-spec.md） |
| `presets/` | 风格预设 |
| `tools/` | Python：分离、分析、对齐（含 LRC、日语断句、逐字时间）、笔画提取、示例歌、背景生成 |
| `songs/` | 每首歌的工作区（不进仓库），结构见 docs/song-folder.md |
| `docs/` | 流程、风格字段、效果目录、美术指导清单、常见坑、第三方许可 |

## 5. 扩展效果的约定

- 新效果必须**无状态**：画面只由「当前帧 + seed」决定（Remotion 多进程乱序渲染）。
- 新的逐字浮现实现 `engine/fx/reveals/types.ts` 的 `RevealProps`，在 `LineView.tsx` 里接上，在 `director.ts` 的 `TIER_MODES` / `ONCE` 里登记，并写进 docs/effects.md。
- 每类效果都有一个 `Demo` 画面（Root.tsx 里注册），做完先渲染样帧自查。
- 常见坑先看 docs/troubleshooting.md（SVG 滤镜变黑、Windows 大小写冲突等）。
