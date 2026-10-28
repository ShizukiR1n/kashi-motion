# style.json 字段说明

每首歌一份，放在 `songs/<歌名>/style.json`。没写的字段沿用 `preset` 指定的预设（`presets/*.json`），再缺的沿用 `engine/style/style.ts` 里的默认值。

```json
{
  "preset": "midnight-ink",
  "notes": "设计理由（只写意象，不写歌词）",
  "palette": {
    "bg": "#0b1026", "accent": "#c3b4ff", "text": "#f4f1ff", "shade": "4,6,20",
    "glow": "170,150,255",
    "particles": ["255,255,255", "225,215,255", "180,165,255"]
  },
  "decor": "seraph",
  "background": {"images": [], "blur": 6, "dim": 0.3, "drift": 1, "glow": "rgba(150,140,255,0.16)", "views": true},
  "grain": 0.22, "vignette": 0.6, "hud": true,
  "intro": "fade", "outro": "collapse",
  "camera": {"punch": 1, "wiggle": 1},
  "beat": {"kick": 1.2, "hat": 1, "snareGlitch": 1},
  "particles": {"dust": 60, "swirl": 1, "feathers": 26},
  "peakGlitch": true, "motionBlur": true,
  "directives": [
    {"at": 62.9, "mode": "water", "accent": "none", "note": "融化的意象"}
  ]
}
```

| 字段 | 说明 |
|---|---|
| `palette.bg` / `accent` / `text` | 底色、强调色（字卡、细线、光标、回声字）、文字颜色 |
| `palette.shade` | 暗角颜色，格式 `r,g,b` |
| `palette.glow` | 文字辉光颜色，格式 `r,g,b` |
| `palette.particles` | 粒子色板，格式是 `r,g,b` 列表 |
| `decor` | `flora`（花和细线框）或 `seraph`（锁链、几何纹样、羽毛、星点） |
| `background.images` | 背景素材文件名（来自 `input/bg/`）；空数组表示自动取素材文件夹里的图，没有素材时用引擎自带的背景 |
| `background.blur` / `dim` / `drift` | 基础模糊、压暗、推拉漂移的幅度 |
| `background.views` | 按段落换取景：主歌看上半、安静段转 180° 看另一半、副歌拉远看全图，段落交界处做镜像翻转。适合方形的封面类素材 |
| `grain` / `vignette` | 胶片颗粒强度（0 到 0.3）、暗角强度 |
| `hud` | 四角的细线界面装饰 |
| `intro` / `outro` | 开场用 `window`（小窗放大）或 `fade`；结尾用 `collapse`（压成一条线）或 `fade` |
| `camera.punch` / `wiggle` | 鼓点带来的镜头冲击力度、持续漂移幅度（倍数） |
| `beat.kick` / `hat` / `snareGlitch` | 底鼓推亮背景、镲让粒子闪烁、副歌军鼓触发轻微 RGB 错位（倍数，0 表示关闭） |
| `particles.dust` / `swirl` / `feathers` | 漂浮灰尘数量、主词点缀强度倍数、飘落羽毛数量 |
| `peakGlitch` | 全曲能量最高点放一次 RGB 爆发 |
| `motionBlur` | 快速镜头运动时开启运动模糊（会明显变慢） |

## directives：按时间点手动指定

`at` 填原曲时间（秒）。落在哪一句上，就覆盖那一句的设置；如果几个镜头的时间范围都覆盖到 `at`，取开始时间离 `at` 最近的那个。

| 字段 | 可选值 |
|---|---|
| `mode` | 整句浮现方式：`follow` `tate` `water` `cursor` `strokes` `dust` `shatter` `depth` `maskslide` `punch`，或 `layout`（排版模板），说明见 [effects.md](effects.md) |
| `wind` | 句末被风吹散，只配合 `follow` 使用 |
| `order` | 笔画拼接的顺序：`sequential` 或 `shuffle` |
| `accent` / `entrance` / `backdrop` | 指定这一句的主词点缀、词入场方式、背景处理 |
| `emphasize` | 主词再放大强调 |
| `note` | 理由，只写意象 |

手动指定会先占位，其余句子再由编排器按"不重复"上限自动分配，所以自动分配的句子会主动避开你指定的做法。
