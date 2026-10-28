// 逐字浮现的共用接口：导演先把一句歌词排好每个字的位置和出现时间，浮现组件只负责"怎么出现"。
// 所有组件必须是无状态的（画面只由当前帧决定），可以乱序渲染。

export type CharSlot = {
  ch: string; // 单个字符（日文一个字 / 英文一个字母；空格不会出现在这里）
  x: number; // 字的中心点（画布坐标，px）
  y: number;
  t: number; // 这个字唱到的时间（秒）：浮现应在 t 附近完成主要动作（可以从 t-0.15 开始，最迟 t+0.35 清晰可读）
  size: number; // 字号（px）
  emph?: boolean; // 属于主词（可更亮/更大）
};

export type RevealColors = {
  text: string; // 字的颜色
  glow: string; // 辉光 'r,g,b'
  accent: string; // 强调色
  particles: [number, number, number][]; // 粒子色板
};

export type RevealProps = {
  id: string; // 本镜头唯一 id（SVG 滤镜等需要）
  chars: CharSlot[]; // 已排好版的字（按演唱顺序）
  vertical: boolean; // true = 日文直书（字正立，从上到下）；false = 横排
  end: number; // 本镜头结束时间（秒）；字应保持可读直到 end，可在 end 前 0.3 秒内开始退场
  seed: number;
  colors: RevealColors;
  intensity: number; // 0.5..1.5，副歌更高
  beats?: number[]; // 本镜头内的拍点时间（秒），需要跟拍的浮现方式用（如单字特写快切）
  start?: number; // 本镜头开始时间（秒）
};
