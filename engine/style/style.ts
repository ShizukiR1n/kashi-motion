import type {Directive} from '../director/director';
// 风格方案（style.json）。每首歌一份，放在 songs/<歌名>/style.json。
// 没写的字段沿用预设（presets/*.json）或下面的默认值。字段说明见 docs/style-spec.md。

export type Style = {
  name: string;
  palette: {
    bg: string; // 背景底色（素材加载前、或没有素材时）
    accent: string; // 强调色：片头片尾字卡、闪白转场的色调、开场小窗光晕
    text: string; // 字卡正文颜色
    shade: string; // 暗角颜色（rgb，不带透明度，如 '10,0,6'）
    glow: string; // 文字辉光颜色（'r,g,b'）
    particles: string[]; // 粒子色板（'r,g,b' 列表，第一个通常是白色）
  };
  decor: 'flora' | 'seraph'; // 装饰套件：花与细线框 / 光环·锁链·几何纹样·羽毛
  background: {
    images: string[]; // 背景素材，相对于歌曲文件夹的 input/bg/；为空时使用引擎自带的程序生成背景
    blur: number; // 背景模糊（像素）
    dim: number; // 背景压暗 0..1
    drift: number; // 缓慢推拉漂移的幅度倍数，0 = 静止
    glow: string; // 叠加在左侧的色光（CSS 颜色），'' = 不加
    views: boolean; // 按段落换取景：主歌看上半、安静段旋转 180° 看另一半、副歌拉远看全图；段落交界镜像翻转
  };
  grain: number; // 胶片颗粒强度 0..0.3
  vignette: number; // 暗角强度 0..1
  hud: boolean; // 角落的细线界面装饰
  intro: 'window' | 'fade'; // 开场：圆角小窗放大 / 淡入
  outro: 'collapse' | 'fade'; // 结尾：压成一条线 / 淡出
  camera: {punch: number; wiggle: number}; // 镜头冲击力度、持续漂移幅度（倍数，1 = 默认）
  beat: {kick: number; hat: number; snareGlitch: number}; // 跟拍强度：底鼓→背景推亮，镲→粒子闪烁，军鼓→副歌里的轻微 RGB 错位（倍数，0 = 关）
  particles: {dust: number; swirl: number; feathers: number}; // 漂浮灰尘数量、主词缠绕粒子倍数、飘落羽毛数量
  peakGlitch: boolean; // 高潮点是否放一次 RGB 错位爆发
  motionBlur: boolean; // 快速镜头运动时开运动模糊（明显增加渲染时间）
  directives: Directive[]; // 按时间手动指定某句的做法（见 director.ts 的 Directive）
};

// 默认风格：暗夜墨线（midnight-ink）
export const DEFAULT_STYLE: Style = {
  name: 'midnight-ink',
  palette: {bg: '#1a0d14', accent: '#ff5f93', text: '#fff6fa', shade: '10,0,6', glow: '255,120,180',
    particles: ['255,255,255', '255,200,220', '255,120,170', '255,95,147']},
  decor: 'flora',
  background: {images: [], blur: 3, dim: 0, drift: 1, glow: 'rgba(255,60,130,0.25)', views: false},
  grain: 0.14,
  vignette: 0.6,
  hud: true,
  intro: 'window',
  outro: 'collapse',
  camera: {punch: 1, wiggle: 1},
  beat: {kick: 1, hat: 1, snareGlitch: 0},
  particles: {dust: 70, swirl: 1, feathers: 0},
  peakGlitch: true,
  motionBlur: true,
  directives: [],
};

// 深合并：预设 ← 歌曲自己的 style.json
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mergeStyle = (...layers: any[]): Style => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merge = (a: any, b: any): any => {
    if (b === undefined || b === null) return a;
    if (Array.isArray(a) || Array.isArray(b) || typeof a !== 'object' || typeof b !== 'object') return b;
    const out = {...a};
    for (const k of Object.keys(b)) out[k] = merge(a[k], b[k]);
    return out;
  };
  return layers.reduce((acc, l) => merge(acc, l), DEFAULT_STYLE);
};
