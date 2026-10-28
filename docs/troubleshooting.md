# 常见坑

| 现象 | 原因 / 解决 |
|---|---|
| 用了 CSS `filter: url(#id)` 的 SVG 滤镜后，整个画面渲染成**全黑** | 宽高为 0 的 `<svg>` 里定义的滤镜，在无头浏览器里会失效。改成在被处理元素的同一层放一个 1×1 的 svg，并给每个实例一个唯一 id，参考 `engine/fx/Distort.tsx`。整画面的 RGB 错位不要用 SVG 滤镜，改用三份副本各保留一个颜色通道再叠加（`RgbSplit`） |
| TypeScript 报错 `differs only in casing`（Windows） | `fx/Entrances.tsx` 和 `fx/entrances/` 文件夹在 Windows 上大小写冲突。引用文件夹时要写全路径：`../fx/entrances/index` |
| ffmpeg `drawtext` 报 `No option name near ...` | 标签文字里的冒号（比如 `0:02`）会被当成参数分隔符。把文字写进文件，改用 `textfile=` |
| 有 LRC 时间戳时，句首和 LRC 的偏差整齐地停在约 0.3 秒 | 这是测量方法的问题，不一定真偏了。要用人声起音点核对（见 docs/workflow.md），别只和时间戳比 |
| 某一句的字明显早了或晚了 | 改 `work/lyrics.json` 里那句的 `start`、`end` 和 `chars[].t`，然后只重渲那一段（`--from/--to`） |
| 日文整块不断开 | 词块里带了 `*` 或 `~` 时不会自动断句。请用空格或 `/` 手动断开，比如 `夜明けの 光を *探して*` |
| 拖长音判断太多 | 现在的规则是总时长 ≥1.4 秒，并且每个字平均 ≥0.35 秒。日文一个 6 字词块唱满 1.2 秒很正常，不算拖长音 |
| 片段开头和结尾怪怪的 | 用 `--from/--to` 只出一段时，开场效果放在 from、收线放在 to，片头片尾字卡不出现。这是设计如此 |
| 1080p 成片发不出去 | 体积通常超过 100 MB。压一份 720p 预览，命令见 docs/workflow.md |
| 渲染很慢 | 主要耗时在运动模糊（style 里 `motionBlur: false` 可以关掉）、水中浮现的滤镜、碎片聚合飞行阶段。先出样帧，确认后再出成片 |
| 笔画拼接退回成普通字 | 没有装 KanjiVG 数据（`tools/data/kanjivg/*.zip`），或者这个字不在 KanjiVG 里（拉丁字母、标点、生僻异体字）。重新跑一次 setup.ps1 即可 |
| 封面印的标题字露出来了 | `background.views` 的取景已经按方图上下边缘裁掉了。换比例不同的素材时，请用样帧确认，必要时关掉 `views` |
