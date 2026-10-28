import {isCJK, rand, vlen} from '../util';
import type {Analysis, LyricLine, LyricWord, Lyrics} from './types';
import {AccentName, BackdropName, EntranceName, scheduleFx, ShotMode, tierOf} from './schedule';
import {LinePlan, LineMode, planLine} from './lines';

// ---------------- 导演：把歌词 + 音频分析 变成一组镜头 ----------------
// 模板按"竖屏 1080×1920 的设计稿"书写（x 以 540 为中心、y 以 CY=930 为中心），
// 再通过版面参数 L 映射到实际画布：竖屏原样输出；横屏 1920×1080 横向拉宽、纵向压缩、字号略缩。
export const VW = 1080;
export const VH = 1920;
const CY = 930;

export type Aspect = 'tall' | 'wide';
export type LayoutSpec = {
  w: number; h: number; cx: number; cy: number;
  sx: number; sy: number; // 设计稿坐标 → 画布的横/纵缩放
  fs: number; // 字号与间距缩放
  maxV: number; maxH: number; // 竖排 / 横排主词允许的最大长度（像素）
  hMin: number; hMax: number; // 横排主词字号上下限
  wide: boolean;
};
export const LAYOUTS: Record<Aspect, LayoutSpec> = {
  // 抖音上下各有界面遮挡，竖屏内容尽量放在 y 260–1660
  tall: {w: 1080, h: 1920, cx: 540, cy: 930, sx: 1, sy: 1, fs: 1, maxV: 1150, maxH: 850, hMin: 130, hMax: 270, wide: false},
  wide: {w: 1920, h: 1080, cx: 960, cy: 540, sx: 1.55, sy: 0.56, fs: 0.82, maxV: 740, maxH: 1300, hMin: 120, hMax: 300, wide: true},
};

export type Placed = {
  text: string; x: number; y: number; size: number; vertical: boolean;
  anchor: 'left' | 'center' | 'right'; at: number; stagger: number; letterDur: number;
  role: 'main' | 'small' | 'echo'; glow: number; ca: number; outline?: boolean;
  rotate?: number; box?: boolean; seed: number; opacity?: number; upright?: boolean;
};
export type DecoSpec = {kind: string; at: number; p: Record<string, unknown>};
export type Box = {x: number; y: number; w: number; h: number; at: number; end: number};
// 句间转场：cut 直切 / flash 闪白 / iris 睁眼 / slab 灰板扫过 / push 推穿 / whip 甩镜 / pullout 拉远换构图
export type Transition = 'cut' | 'slices' | 'flash' | 'iris' | 'slab' | 'push' | 'whip' | 'pullout';
export type Shot = {
  id: number; start: number; end: number; template: string; section: string; energy: number;
  words: Placed[]; decos: DecoSpec[]; hits: {t: number; strength: number}[];
  cam: {tx: [number, number]; ty: [number, number]; s: [number, number]; rot: number};
  transIn: Transition; exitSlices: boolean; mainBox: Box; long: boolean;
  // 剪辑编排的结果（见 schedule.ts）
  entrance: EntranceName; accent: AccentName; backdrop: BackdropName;
  secEnergy: number; // 所在段落的能量 0..1
  sectionStart: boolean; // 新段落的第一句
  peak: boolean; // 包含全曲最高点
  mode: ShotMode; // 整句逐字浮现方式，或 'layout'（排版模板）
  line?: LinePlan; // mode 不是 layout 时：每个字的位置/时间 + 镜头路线
  wind: boolean;
  order: 'sequential' | 'shuffle';
};

// 按歌手动指定（style.json 的 directives）：时间点落在哪个镜头里，就覆盖那个镜头的做法
export type Directive = {
  at: number; // 秒（原曲时间）
  mode?: ShotMode; wind?: boolean; order?: 'sequential' | 'shuffle';
  accent?: AccentName; entrance?: EntranceName; backdrop?: BackdropName;
  emphasize?: boolean; // 主词再放大强调
  note?: string; // 设计理由（只写意象，不写歌词）
};
export type Plan = {
  shots: Shot[]; introEnd: number; outroStart: number; duration: number;
  peak: number; title: string; artist: string; L: LayoutSpec;
};

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'i', 'im', "i'm", 'is', 'it', 'be', 'me', 'my', 'you', 'we', 'so', 'but', 'if', 'for', 'with', 'that', 'this', 'just']);

export const energyAt = (a: Analysis, t: number) => {
  const i = Math.round(t / a.energy.hop);
  return a.energy.values[Math.max(0, Math.min(a.energy.values.length - 1, i))] ?? 0.5;
};

const pickMain = (ws: LyricWord[]) => {
  const flagged = ws.findIndex((w) => w.emph);
  if (flagged >= 0) return flagged;
  const longNote = ws.findIndex((w) => w.long);
  if (longNote >= 0) return longNote;
  let best = 0;
  let score = -1;
  ws.forEach((w, i) => {
    let base: number;
    if (isCJK(w.text)) {
      const kanji = [...w.text].filter((c) => /[㐀-鿿]/.test(c)).length;
      base = kanji * 1.6 + (nch(w.text) - kanji) * 0.5;
    } else {
      const clean = w.text.toLowerCase().replace(/[^a-z']/g, '');
      base = STOP.has(clean) ? 0 : clean.length;
    }
    const s = base + i * 0.3 + (w.end - w.start);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const nch = (t: string) => [...t].length;
const stag = (w: LyricWord) => clamp(((w.end - w.start) / Math.max(1, nch(w.text))) * 0.6, 0.02, 0.09);
const smallSize = (t: string) => clamp(280 / Math.max(1.5, vlen(t)), 54, 84);

// 主词框的大致尺寸（用于粒子、线框）
const boxOf = (p: Placed, end: number): Box => {
  const len = vlen(p.text) * p.size;
  const th = 0.85 * p.size;
  if (p.vertical) return {x: p.x - th / 2, y: p.y, w: th, h: len, at: p.at, end};
  const x0 = p.anchor === 'center' ? p.x - len / 2 : p.anchor === 'right' ? p.x - len : p.x;
  return {x: x0, y: p.y - th / 2, w: len, h: th, at: p.at, end};
};

type Ctx = {seed: number; a: Analysis; end: number; L: LayoutSpec};
// 设计稿坐标 → 画布坐标
const mapper = (L: LayoutSpec, seed = 0) => {
  const jx = (rand(seed + 91) - 0.5) * 2 * 45 * L.sx; // 每个镜头整体随机偏移，避免同模板两次完全重合
  const jy = (rand(seed + 92) - 0.5) * 2 * 35 * L.sy;
  return {
  X: (x: number) => L.cx + (x - 540) * L.sx + jx,
  Y: (y: number) => L.cy + (y - CY) * L.sy + jy,
  CX: L.cx, C: L.cy, f: L.fs,
  };
};
type TplOut = {words: Placed[]; decos: DecoSpec[]; main: Placed};

const mk = (w: LyricWord, o: Partial<Placed> & Pick<Placed, 'x' | 'y' | 'size'>, seed: number, role: Placed['role'] = 'small'): Placed => ({
  text: w.text, vertical: false, anchor: 'left', at: w.start, stagger: stag(w), letterDur: 0.22,
  role, glow: role === 'main' ? 0.9 : 0.45, ca: role === 'main' ? 2.4 : 1.2, seed, ...o,
});

// ---- 模板 1：竖排主词居中，前后小词分列两侧 ----
const tplVHero = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const m = ws[mi];
  const size = clamp(c.L.maxV / Math.max(1.5, vlen(m.text)), 160 * f, 300 * f);
  const len = vlen(m.text) * size;
  const main = mk(m, {x: X(600), y: C - len / 2, size, vertical: true}, c.seed, 'main');
  const words: Placed[] = [main];
  const before = ws.slice(0, mi);
  const after = ws.slice(mi + 1);
  before.forEach((w, i) => words.push(mk(w, {x: X(300), y: C - (before.length - 1) * 55 * f + i * 110 * f, size: smallSize(w.text) * f, anchor: 'center', box: i === 0}, c.seed + i)));
  after.forEach((w, i) => words.push(mk(w, {x: X(880), y: C - (after.length - 1) * 55 * f + i * 110 * f, size: smallSize(w.text) * f, anchor: 'center'}, c.seed + 20 + i)));
  words.push({...main, role: 'echo', vertical: false, outline: true, size: size * 1.35, x: X(80), y: Y(CY - 420), rotate: -12, glow: 0, ca: 0, opacity: 0.6, at: main.at + 0.1});
  const b = boxOf(main, c.end);
  const decos: DecoSpec[] = [
    {kind: 'rect', at: m.start - 0.1, p: {x: b.x - 40, y: b.y - 50, w: b.w + 80, h: b.h + 100}},
    {kind: 'flower', at: m.start + 0.2, p: {x: X(250), y: Y(CY - 330), r: 34 * f}},
    {kind: 'cross', at: m.start + 0.3, p: {x: X(880), y: Y(CY + 300)}},
    {kind: 'hex', at: m.start + 0.4, p: {x: X(820), y: Y(CY - 380), r: 14 * f}},
    {kind: 'line', at: m.start, p: {x1: X(160), y1: Math.min(c.L.h - 60, b.y + b.h + 80 * f), x2: X(960), y2: Math.min(c.L.h - 60, b.y + b.h + 80 * f), dash: '6 8'}},
  ];
  return {words, decos, main};
};

// ---- 模板 2：横排主词居中强发光，前句在上、后句在下 ----
const tplCenter = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const m = ws[mi];
  const size = clamp(c.L.maxH / Math.max(1.5, vlen(m.text)), c.L.hMin, c.L.hMax);
  const main = mk(m, {x: CX, y: C, size, anchor: 'center', glow: 1.15, ca: 3}, c.seed, 'main');
  const words: Placed[] = [main];
  const row = (list: LyricWord[], y: number, s0: number) => {
    const sizes = list.map((w) => smallSize(w.text) * 0.9 * f);
    const widths = list.map((w, i) => vlen(w.text) * sizes[i] + 26);
    let x = CX - widths.reduce((p, q) => p + q, 0) / 2;
    list.forEach((w, i) => {
      words.push(mk(w, {x, y: y + (rand(s0 + i) - 0.5) * 30, size: sizes[i]}, s0 + i));
      x += widths[i];
    });
  };
  row(ws.slice(0, mi), C - size * 0.95, c.seed + 3);
  row(ws.slice(mi + 1), C + size * 0.95, c.seed + 9);
  const decos: DecoSpec[] = [
    {kind: 'ring', at: m.start, p: {x: CX, y: C, r: size * 1.5}},
    {kind: 'ring', at: m.start + 0.1, p: {x: CX, y: C, r: size * 1.7, expand: true, color: 'rgba(255,95,147,0.5)'}},
    {kind: 'corners', at: m.start - 0.1, p: {x: X(110), y: C - Math.min(size * 1.6, c.L.h * 0.44), w: 860 * c.L.sx, h: Math.min(size * 3.2, c.L.h * 0.88), len: 22}},
    {kind: 'sparkle', at: m.start + 0.15, p: {x: X(860), y: C - size * 0.9, s: 14}},
    {kind: 'sparkle', at: m.start + 0.3, p: {x: X(230), y: C + size * 1.1, s: 10, color: '#ff8fb4'}},
    {kind: 'flower', at: m.start + 0.25, p: {x: X(900), y: Math.min(c.L.h - 80, C + size * 1.4), r: 30 * f}},
  ];
  return {words, decos, main};
};

// ---- 模板 3：杂志式阶梯排版，主词放大，左侧淡紫竖条 ----
const tplStack = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const words: Placed[] = [];
  let main = null as unknown as Placed;
  const sizes = ws.map((w, i) => (i === mi ? clamp((c.L.maxH * 0.88) / Math.max(1.5, vlen(w.text)), 120 * f, 240 * f) : smallSize(w.text) * f));
  const total = sizes.reduce((p, q) => p + q * 1.05, 0);
  let y = C - total / 2;
  ws.forEach((w, i) => {
    const s = sizes[i];
    y += s * 0.525;
    const p = mk(w, {x: X(150) + Math.min(i, 5) * 34 * f, y, size: s}, c.seed + i, i === mi ? 'main' : 'small');
    words.push(p);
    if (i === mi) main = p;
    y += s * 0.525;
  });
  words.push({...main, role: 'echo', outline: true, size: main.size * 1.6, x: X(120), y: main.y + main.size * 0.15, glow: 0, ca: 0, opacity: 0.5, at: main.at + 0.1});
  const decos: DecoSpec[] = [
    {kind: 'purple', at: ws[0].start - 0.1, p: {x: X(70), y: C - total / 2 - 40, w: 60 * f, h: total + 80}},
    {kind: 'hatch', at: ws[0].start, p: {x: X(700), y: Math.max(30, C - total / 2 - 120 * f), w: 260 * c.L.sx, h: 80 * f}},
    {kind: 'flower', at: main.at + 0.2, p: {x: X(900), y: Y(CY - 160), r: 40 * f}},
    {kind: 'flower', at: main.at + 0.4, p: {x: X(860), y: Y(CY + 60), r: 20 * f}},
    {kind: 'hex', at: main.at + 0.5, p: {x: X(930), y: Y(CY + 260), r: 14 * f}},
    {kind: 'rect', at: ws[0].start, p: {x: X(640), y: C - total / 2 - 60 * f, w: 360 * c.L.sx, h: total + 120 * f}},
  ];
  return {words, decos, main};
};

// ---- 模板 4：小词装在细线盒里排成一列，主词竖排在旁边 ----
const tplColumn = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const m = ws[mi];
  const size = clamp(c.L.maxV / Math.max(1.5, vlen(m.text)), 160 * f, 280 * f);
  const len = vlen(m.text) * size;
  const main = mk(m, {x: X(380), y: C - len / 2, size, vertical: true}, c.seed, 'main');
  const words: Placed[] = [main];
  const rest = ws.filter((_, i) => i !== mi);
  rest.forEach((w, i) => words.push(mk(w, {x: X(780), y: C - (rest.length - 1) * 62 * f + i * 124 * f, size: smallSize(w.text) * f, anchor: 'center', box: true}, c.seed + 5 + i)));
  const decos: DecoSpec[] = [
    {kind: 'tri', at: ws[0].start - 0.15, p: {pts: [[X(660), Y(260)], [X(460), Y(600)], [X(860), Y(600)]], fill: 'gray', drop: true}},
    {kind: 'tri', at: ws[0].start, p: {pts: [[X(160), Y(CY + 120)], [X(620), Y(CY + 120)], [X(390), Y(CY + 520)]]}},
    {kind: 'meteor', at: m.start + 0.1, p: {from: [X(180), Y(CY - 300)], to: [X(300), Y(CY - 420)], ctrl: [X(200), Y(CY - 420)]}},
    {kind: 'line', at: ws[0].start, p: {x1: X(700), y1: C - rest.length * 62 * f - 30, x2: X(700), y2: C + rest.length * 62 * f + 30}},
    {kind: 'dots', at: m.start + 0.3, p: {x: X(860), y: C + rest.length * 62 * f + 60}},
  ];
  return {words, decos, main};
};

// ---- 模板 5：横排主词 + 竖排空心回声大字，小词散布 ----
const SLOTS: [number, number][] = [[170, 620], [600, 560], [230, 1300], [700, 1360], [140, 820], [860, 760], [520, 1480]];
const tplEcho = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const m = ws[mi];
  const size = clamp(c.L.maxH / Math.max(1.5, vlen(m.text)), c.L.hMin, Math.min(250, c.L.hMax));
  const main = mk(m, {x: CX, y: Y(CY + 60), size, anchor: 'center', glow: 1, ca: 2.6}, c.seed, 'main');
  const words: Placed[] = [main];
  words.push({...main, role: 'echo', vertical: true, anchor: 'left', outline: true, size: size * 1.7, x: X(860), y: Y(280), glow: 0, ca: 0, opacity: 0.55, at: main.at + 0.1});
  ws.forEach((w, i) => {
    if (i === mi) return;
    const k = i < mi ? i : i - 1;
    const [x, y] = SLOTS[k % SLOTS.length];
    words.push(mk(w, {x: X(x), y: Y(y), size: smallSize(w.text) * f}, c.seed + 30 + i));
  });
  const decos: DecoSpec[] = [
    {kind: 'bar', at: ws[0].start - 0.1, p: {x: X(260), y: Math.max(40, C - size * 1.3), w: 560 * c.L.sx, h: 110 * f}},
    {kind: 'rect', at: ws[0].start, p: {x: X(120), y: C - size * 1.45, w: 420 * c.L.sx, h: size * 3.3, rot: 18}},
    {kind: 'rect', at: ws[0].start + 0.1, p: {x: X(560), y: C - size * 1.2, w: 300 * c.L.sx, h: size * 2.6, rot: 18}},
    {kind: 'flower', at: m.start + 0.3, p: {x: X(860), y: Math.min(c.L.h - 80, C + size * 1.4), r: 38 * f}},
    {kind: 'sparkle', at: m.start + 0.2, p: {x: X(220), y: Math.min(c.L.h - 60, C + size * 1.2), s: 12, color: '#ff8fb4'}},
  ];
  return {words, decos, main};
};

// ---- 模板 6：拖长音——一个词撑满时长，字母逐个出现，圆环和花陆续弹出 ----
const tplLong = (ws: LyricWord[], mi: number, c: Ctx): TplOut => {
  const {X, Y, CX, C, f} = mapper(c.L, c.seed);
  const m = ws[mi];
  const dur = Math.max(0.6, m.end - m.start);
  const size = clamp((c.L.maxV * 1.13) / Math.max(1, vlen(m.text)), 220 * f, 360 * f);
  const len = vlen(m.text) * size;
  const main = {...mk(m, {x: X(560), y: C - len / 2, size, vertical: true, glow: 1.1, ca: 2.6}, c.seed, 'main'),
    stagger: clamp((dur * 0.7) / Math.max(1, nch(m.text)), 0.05, 1.2), letterDur: 0.4};
  const words: Placed[] = [main];
  ws.forEach((w, i) => {
    if (i === mi) return;
    words.push(mk(w, {x: X(i < mi ? 260 : 820), y: i < mi ? Y(420) + i * 100 * f : Y(1380) + (i - mi) * 100 * f, size: smallSize(w.text) * f, anchor: 'center'}, c.seed + i));
  });
  words.push({...main, role: 'echo', vertical: false, outline: true, size: size * 1.4, x: X(40), y: Y(CY + 80), glow: 0, ca: 0, opacity: 0.5, at: m.start + 0.2, stagger: 0.05});
  const decos: DecoSpec[] = [
    {kind: 'ring', at: m.start, p: {x: CX, y: C, r: 300 * f, color: 'rgba(255,95,147,0.35)'}},
    {kind: 'ring', at: m.start + 0.1, p: {x: CX, y: C, r: 260 * f, color: 'rgba(255,95,147,0.3)'}},
    {kind: 'ring', at: m.start + 0.2, p: {x: CX, y: C, r: 340 * f, expand: true, color: 'rgba(255,95,147,0.5)'}},
    {kind: 'rect', at: m.start, p: {x: X(140), y: C - len / 2 - 60 * f, w: 800 * c.L.sx, h: len + 120 * f}},
  ];
  const n = clamp(Math.floor(dur / 0.45), 3, 8);
  for (let i = 0; i < n; i++) {
    decos.push({kind: 'flower', at: m.start + 0.3 + i * (dur / n), p: {x: X(880 + (rand(c.seed + i) - 0.5) * 220), y: Y(380 + rand(c.seed + i * 3) * 1150), r: (18 + rand(i + 9) * 22) * f}});
  }
  return {words, decos, main};
};

const TPL: Record<string, (ws: LyricWord[], mi: number, c: Ctx) => TplOut> = {
  vhero: tplVHero, center: tplCenter, stack: tplStack, column: tplColumn, echo: tplEcho, long: tplLong,
};
const CHORUS_TPL = ['center', 'vhero', 'echo', 'center', 'vhero'];
const VERSE_TPL = ['stack', 'column', 'vhero', 'echo', 'stack', 'center'];
// 横屏：横排模板更合适，竖排模板少用
const CHORUS_TPL_WIDE = ['center', 'echo', 'vhero', 'center', 'echo'];
const VERSE_TPL_WIDE = ['stack', 'center', 'column', 'echo', 'stack', 'vhero'];

// 句子太长时拆成多个镜头（每镜头最多 6 个词）
const splitLine = (l: LyricLine): LyricLine[] => {
  if (l.words.length <= 6) return [l];
  const out: LyricLine[] = [];
  const n = Math.ceil(l.words.length / 6);
  const per = Math.ceil(l.words.length / n);
  for (let i = 0; i < l.words.length; i += per) {
    const ws = l.words.slice(i, i + per);
    out.push({...l, words: ws, text: ws.map((w) => w.text).join(' '), start: ws[0].start, end: ws[ws.length - 1].end});
  }
  return out;
};

// 排版后统一检查：主词和小词超出可用空间时缩小字号，并保持原来的中心位置（回声描边字是装饰，允许出画）
const fitWords = (ws: Placed[], L: LayoutSpec) => {
  for (const p of ws) {
    if (p.role === 'echo') continue;
    const len = vlen(p.text) * p.size;
    const room = p.vertical ? L.h * (L.wide ? 0.86 : 0.7) : L.w * 0.88;
    if (len <= room) continue;
    const ns = room / vlen(p.text);
    if (p.vertical) p.y += (len - room) / 2; // 竖排：y 是顶端，保持中心
    else if (p.anchor === 'center') { /* 中心锚点不用动 */ }
    else if (p.anchor === 'left') p.x = Math.max(L.w * 0.06, Math.min(p.x, L.w * 0.94 - room));
    p.size = ns;
  }
};

// 半拍网格（拍点 + 两拍之间的中点）
const halfBeats = (a: Analysis) => {
  const out: number[] = [];
  a.beats.forEach((b, i) => {
    out.push(b);
    const n = a.beats[i + 1];
    if (n !== undefined) out.push((b + n) / 2);
  });
  return out;
};
const snapCut = (grid: number[], firstWord: number) => {
  let best: number | null = null;
  for (const g of grid) {
    if (g >= firstWord - 0.4 && g <= firstWord + 0.03) best = g; // 取最靠近首字的那个
    if (g > firstWord + 0.03) break;
  }
  return best ?? firstWord - 0.12;
};

export const direct = (lyrics: Lyrics, a: Analysis, seed = 1, aspect: Aspect = 'tall', directives: Directive[] = []): Plan => {
  const L = LAYOUTS[aspect];
  const lines = lyrics.lines.flatMap(splitLine).filter((l) => l.words.length > 0);
  const sectionOf = (t: number) => a.sections.find((s) => t >= s.start && t < s.end);
  // 能量最高的段落视为副歌
  const maxE = Math.max(...a.sections.map((s) => s.energy), 0.01);
  const isChorus = (l: LyricLine) => /chorus|hook/i.test(l.section) || (sectionOf(l.start)?.energy ?? 0) >= maxE * 0.85;

  const grid = halfBeats(a);
  const cuts = lines.map((l) => snapCut(grid, l.start));
  const shots: Shot[] = [];
  const gaps: number[] = [];
  const srcLines: {line: LyricLine; mi: number}[] = [];
  let prevTpl = '';
  let prevTpl2 = '';
  let vi = 0;
  let ci = 0;
  lines.forEach((l, idx) => {
    const next = lines[idx + 1];
    const start = cuts[idx];
    const end = next ? cuts[idx + 1] : Math.min(a.duration, l.end + 1.6);
    const mi = pickMain(l.words);
    const chorus = isChorus(l);
    let tpl: string;
    const mw = l.words[mi];
    const mdur = mw.end - mw.start;
    if (mw.long && mdur >= 1.4 && mdur / Math.max(1, [...mw.text].length) >= 0.35) tpl = 'long';
    else {
      const list = L.wide ? (chorus ? CHORUS_TPL_WIDE : VERSE_TPL_WIDE) : chorus ? CHORUS_TPL : VERSE_TPL;
      const pool = [...new Set(list)].filter((x) => x !== prevTpl && x !== prevTpl2);
      tpl = pool[Math.floor(rand(seed * 7919 + idx * 31 + (chorus ? ci++ : vi++)) * pool.length)] ?? list[0];
    }
    prevTpl2 = prevTpl;
    prevTpl = tpl;
    const sd = seed * 1000 + idx * 17;
    const out = TPL[tpl](l.words, mi, {seed: sd, a, end, L});
    out.words.forEach((p) => (p.upright = p.vertical && isCJK(p.text)));
    fitWords(out.words, L);

    const prev = lines[idx - 1];
    const sec = sectionOf(l.start);
    const newSection = !prev || sectionOf(prev.start)?.label !== sec?.label || prev.section !== l.section;
    const gapBefore = prev ? l.start - prev.end : l.start;
    const transIn: Transition = 'cut'; // 占位，下面由编排器统一分配
    gaps.push(gapBefore);
    const nextNewSection = next && (sectionOf(next.start)?.label !== sec?.label || next.section !== l.section);

    const en = energyAt(a, l.start);
    const hits = l.words.map((w, i) => ({t: w.start, strength: (i === mi ? 1 : 0.35) * (0.55 + 0.45 * energyAt(a, w.start))}));
    if (a.drums) {
      a.drums.kick.filter((h) => h.t > start && h.t < end).forEach((h) => hits.push({t: h.t, strength: (0.16 + 0.22 * energyAt(a, h.t)) * h.strength}));
      a.drums.snare.filter((h) => h.t > start && h.t < end).forEach((h) => hits.push({t: h.t, strength: 0.22 * h.strength}));
    } else {
      a.downbeats.filter((t) => t > start && t < end).forEach((t) => hits.push({t, strength: 0.18 + 0.2 * energyAt(a, t)}));
    }

    const dir = rand(sd + 1) > 0.5 ? 1 : -1;
    const amp = 30 + 40 * rand(sd + 2);
    shots.push({
      id: idx, start, end, template: tpl, section: sec?.label ?? '', energy: en,
      words: out.words, decos: out.decos, hits,
      cam: {tx: [amp * dir, -amp * dir], ty: [20 * (rand(sd + 3) - 0.5), 30 * (rand(sd + 4) - 0.5)],
        s: tpl === 'long' ? [1.0, 1.1] : [1.0, 1.05 + 0.04 * en], rot: (rand(sd + 6) - 0.5) * 2},
      transIn, exitSlices: Boolean(nextNewSection) || rand(sd + 8) < 0.15,
      mainBox: boxOf(out.main, end), long: tpl === 'long',
      entrance: 'letters', accent: 'none', backdrop: 'drift', // 占位，下面由编排器统一分配
      secEnergy: sec?.energy ?? en, sectionStart: newSection, peak: a.peak >= start && a.peak < end,
      mode: 'layout', wind: false, order: 'sequential',
    });
    srcLines.push({line: l, mi});
  });

  // 剪辑编排：给每个镜头分配点缀 / 入场 / 背景
  const picks = scheduleFx(shots.map((s) => ({
    tier: tierOf(s.secEnergy), sectionStart: s.sectionStart, peak: s.peak, long: s.long,
    vertical: s.mainBox.h > s.mainBox.w * 1.3,
  })), seed);
  shots.forEach((s, i) => Object.assign(s, picks[i]));
  // 手动指定覆盖自动编排
  const emph = new Set<number>();
  for (const d of directives) {
    // 有多个镜头覆盖这个时间点时（切镜吸附拍点会让相邻镜头略有重叠），选开始时间最接近的那个
    const s = shots.filter((sh) => d.at >= sh.start - 0.3 && d.at < sh.end + 0.3)
      .sort((x, y) => Math.abs(x.start - d.at) - Math.abs(y.start - d.at))[0];
    if (!s) continue;
    if (d.mode) s.mode = d.mode;
    if (d.wind !== undefined) s.wind = d.wind;
    if (d.order) s.order = d.order;
    if (d.accent) s.accent = d.accent;
    if (d.entrance) s.entrance = d.entrance;
    if (d.backdrop) s.backdrop = d.backdrop;
    if (d.emphasize) emph.add(s.id);
  }
  // 指定优先：自动选的镜头若和相邻镜头浮现方式相同，换一个；风吹散只配“跟字推镜”（除非明确指定）
  const fixed = new Set<number>();
  const windSet = new Set<number>();
  for (const d of directives) {
    const s0 = shots.filter((sh) => d.at >= sh.start - 0.3 && d.at < sh.end + 0.3)
      .sort((x, y) => Math.abs(x.start - d.at) - Math.abs(y.start - d.at))[0];
    if (s0 && d.mode) fixed.add(s0.id);
    if (s0 && d.wind !== undefined) windSet.add(s0.id);
  }
  // 浮现方式的使用上限：同一种方式 60 秒内最多 2 次、两次至少隔 15 秒（排版模板只要求隔 8 秒）；
  // 手动指定的镜头先占位，其余镜头按顺序在满足上限的候选里挑
  const TIER_MODES: Record<string, ShotMode[]> = {
    low: ['tate', 'water', 'strokes', 'follow', 'depth', 'maskslide', 'layout'],
    mid: ['follow', 'tate', 'water', 'cursor', 'strokes', 'depth', 'maskslide', 'shatter', 'layout'],
    high: ['follow', 'cursor', 'dust', 'strokes', 'shatter', 'depth', 'punch', 'maskslide', 'layout'],
  };
  const assigned = new Map<number, ShotMode>();
  shots.forEach((s0) => fixed.has(s0.id) && assigned.set(s0.id, s0.mode));
  // 招牌型效果（水中浮现、光尘、单字快切、碎片聚合、光标）一分钟内只用一次；其余最多两次且间隔 ≥15 秒
  const ONCE = new Set<ShotMode>(['water', 'dust', 'punch', 'shatter', 'cursor']);
  const ok = (m: ShotMode, s0: Shot) => {
    const same = shots.filter((o) => o.id !== s0.id && assigned.get(o.id) === m);
    if (m === 'layout') return !same.some((o) => Math.abs(o.start - s0.start) < 6);
    if (same.some((o) => Math.abs(o.start - s0.start) < 15)) return false;
    const limit = ONCE.has(m) ? 1 : 2;
    return same.filter((o) => Math.abs(o.start - s0.start) < 60).length < limit;
  };
  shots.forEach((s0, i) => {
    if (fixed.has(s0.id)) return;
    let tierModes = s0.long ? ['water', 'strokes', 'tate', 'depth', 'layout'] as ShotMode[] : TIER_MODES[tierOf(s0.secEnergy)];
    // 没有日文的句子：不用直书（字母竖排很别扭）和笔画拼接（笔画数据只有汉字/假名）
    if (!isCJK(srcLines[i].line.text)) tierModes = tierModes.filter((m) => m !== 'tate' && m !== 'strokes');
    const prev = shots[i - 1] ? assigned.get(shots[i - 1].id) : undefined;
    const order = [...tierModes].sort((a, b) => rand(seed * 97 + i * 13 + a.length) - rand(seed * 97 + i * 13 + b.length));
    // 都用满了就用排版模板兜底（模板本身有多种，换着用不显重复）
    const pickM = order.find((m) => m !== prev && ok(m, s0)) ?? 'layout';
    s0.mode = pickM;
    assigned.set(s0.id, pickM);
  });
  shots.forEach((s0) => { if (s0.mode !== 'follow' && !windSet.has(s0.id)) s0.wind = false; });

  // 整句逐字浮现：排版每个字 + 镜头路线
  shots.forEach((s, i) => {
    if (s.mode === 'layout') {
      // 排版模板：主词至少放大到一定字号，小词不超过主词的一半，避免“看不出重点”
      const main = s.words.find((w) => w.role === 'main');
      if (main) {
        const k = emph.has(s.id) ? 1.35 : 1.15;
        main.size *= k;
        s.words.filter((w) => w.role === 'small').forEach((w) => (w.size = Math.min(w.size * 1.25, main.size * 0.5)));
        s.mainBox = boxOf(main, s.end);
      }
      return;
    }
    const {line, mi} = srcLines[i];
    s.line = planLine(line, s.mode as LineMode, s.start, s.end, L.w, L.h, mi, {wind: s.wind, order: s.order});
    if (emph.has(s.id)) s.line.chars.forEach((c) => c.emph && (c.size *= 1.18));
    // 点缀以整句外框为准
    const xs = s.line.chars.map((c) => c.x);
    const ys = s.line.chars.map((c) => c.y);
    const pad = (s.line.chars[0]?.size ?? 100) * 0.6;
    s.mainBox = {x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + pad * 2, at: s.line.chars[0]?.t ?? s.start, end: s.end};
  });
  // 转场：段落开头闪白（副歌）/ 灰板（其他段落）；句间在 直切 / 推穿 / 甩镜 / 拉远 里轮换，同一种不连用；
  // 两句之间空档很长时偶尔用“睁眼”
  let lastSpecial = -99;
  let prevTr: Transition = 'cut';
  shots.forEach((s, i) => {
    const t = tierOf(s.secEnergy);
    let tr: Transition;
    if (s.sectionStart && i > 0) tr = t === 'high' ? 'flash' : 'slab';
    else if (i - lastSpecial > 6 && gaps[i] > 2.5) tr = 'iris';
    else {
      const pool: Transition[] = t === 'high' ? ['push', 'whip', 'cut', 'pullout'] : t === 'low' ? ['pullout', 'cut', 'push'] : ['push', 'pullout', 'whip', 'cut'];
      const cands = pool.filter((x) => x !== prevTr);
      tr = cands[Math.floor(rand(seed * 77 + i * 3) * cands.length)];
    }
    if (tr === 'iris' || tr === 'slab') lastSpecial = i;
    prevTr = tr;
    s.transIn = tr;
  });

  const introEnd = shots.length ? shots[0].start : a.duration;
  const lastEnd = lines.length ? lines[lines.length - 1].end : 0;
  const outroStart = Math.min(a.duration - 1.5, lastEnd + 1.2);
  if (shots.length) shots[shots.length - 1].end = Math.min(shots[shots.length - 1].end, outroStart);
  return {shots, introEnd, outroStart, duration: a.duration, peak: a.peak,
    title: lyrics.title ?? 'song title', artist: lyrics.artist ?? 'ARTIST NAME', L};
};
