# 完整流程

## 1. 准备素材

| 素材 | 要求 |
|---|---|
| 音频 | mp3 / m4a / wav / flac，用质量最好的版本 |
| 歌词 `lyrics.txt` | UTF-8。按演唱顺序一句一行；重复唱的句子每次都写出来，不能写"×2"。日语、英语、日英混合都可以 |
| 背景素材 | 图片（方图、横图、竖图都行），放几张都可以；目前取第一张作为主素材 |

### 歌词格式

普通文本：

```
# title: 歌名
# artist: 歌手名
[verse]
first line of the *song*
静かな 夜に 光を *探す*

[chorus]
hold this note~
```

LRC（每行开头带时间戳）也可以直接用。歌词开头的"歌名、作词、作曲"这类信息行会被自动识别出来放进片头，不参与对齐。

| 写法 | 作用 |
|---|---|
| `*词*` | 指定这一句的主词：放大、发光、作为杂志式排版的主角 |
| `词~` | 拖长音 |
| `[verse]` `[chorus]` | 段落标签，`chorus` 会用更有冲击力的做法 |
| 空行 | 画面分组 |
| 日文里的空格或 `/` | 手动指定断句；不写就按文节自动切开，每块不超过 6 个字 |

## 2. 建工作区并分析

```bash
python lv.py new mysong --audio song.mp3 --lyrics lyrics.txt --bg cover.jpg
```

```bash
python lv.py analyze mysong --model small
```

分析会依次做这些事：
1. 用 demucs 分离出四轨：人声、鼓、贝斯、其他。
2. 分析节拍、小节、段落和能量曲线，从鼓轨里识别底鼓、军鼓、镲，并找出全曲的能量最高点。
3. 把歌词逐句、逐字对齐到人声上。有 LRC 时间戳时，每一句只在它自己的时间窗里对齐。
4. 生成笔画数据 `strokes.json`，需要事先装好 KanjiVG。

检查输出里的几项数字：对齐成功了几句、句首和时间戳的偏差、BPM、鼓点数量。

## 3. 验卡点

```bash
python lv.py render mysong --debug --from 30 --to 50
```

调试版的画面底部有一条时间轴：
- 黄线是当前时刻；
- 粉色和白色色块是每个词的对齐时间；
- 红、黄、青三色的点分别是底鼓、军鼓、镲；
- 紫色虚线是切镜头的位置。

此外，底鼓响时画面边框会闪红，军鼓响时闪黄。哪里不准，就修对齐：重新跑对齐，或者直接改 `songs/mysong/work/lyrics.json` 里的时间，再用 `--from/--to` 重渲这一段。

## 4. 美术指导 → `style.json`

按 [art-direction.md](art-direction.md) 的清单看素材、读歌词意象、听段落起伏，然后写 `songs/mysong/style.json`，字段说明见 [style-spec.md](style-spec.md)。至少要定下这几项：
- 配色（从素材里取）
- 装饰套件
- 背景是否按段落换取景
- 颗粒和景深
- 若干条 `directives`：按时间点指定某一句用哪种浮现方式，理由写在 `note` 里，只写意象，不写歌词

## 5. 查编排

```bash
python lv.py plan mysong --from 40 --to 100
```

逐句检查浮现方式、点缀、入场、背景和转场有没有违反"不重复"规则（见 AGENTS.md 第 3 节），以及手动指定是否落在了想要的那一句上。

## 6. 样帧 → 成片

```bash
python lv.py render mysong --from 40 --to 100 --stills 42,55,70,88
```

```bash
python lv.py render mysong --from 40 --to 100
```

- 只出一段时，开头淡入、结尾收成一条线；出整首时会加上片头和片尾字卡。
- 1080p 成片通常超过 100 MB。给别人看时，可以压一份 720p 预览：

```bash
ffmpeg -i in.mp4 -vf scale=1280:720 -b:v 3200k -c:a aac -b:a 160k preview.mp4
```

## 7. 迭代

把意见整理成修改清单（具体到时间点和做法），先和用户确认，再改、再出片。能通用的规则沉淀进 AGENTS.md 第 3 节；只对这首歌有效的，写进它的 `directives`。

## 渲染耗时参考

1920×1080、4 个并发时，62 秒的成片大约要渲染 20 到 25 分钟。最费时的是这几样：
- 运动模糊
- 水中浮现的 SVG 滤镜
- 碎片聚合飞行阶段的大量字形副本
