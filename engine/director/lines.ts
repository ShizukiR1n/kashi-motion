// 「整句逐字浮现」镜头：排版每个字的位置 + 规划镜头路线（推近 → 跟着字走 → 拉回全景）。
// 纯 TypeScript（不依赖 Remotion），导演和命令行都能用。
import {isCJK, vlen} from '../util';
import type {CharSlot} from '../fx/reveals/types';
import type {LyricLine} from './types';

// 浮现方式：
//   follow  横排，镜头推近后从左到右跟着字走，最后拉回整体（可带风吹散）
//   tate    直书，镜头从上往下跟着字走，最后拉回整体
//   water   水中浮现：缓推缓拉
//   cursor  光标走到哪字显到哪：镜头跟着光标
//   strokes 笔画拼接（可乱序）
//   dust    逐字出现，句末碎成光尘上飘
//   shatter   碎片从四面八方飞来拼成字（镜头环绕平移 + 推近）
//   depth     字从画面深处飞向镜头，景深由虚到实（镜头前推）
//   maskslide 词从看不见的基线后滑上来，整句斜切错位后对齐（镜头横移）
//   punch     单字特写快切：一个字一个字全屏闪现，最后切回整句（屏幕空间，不跟镜头）
export type LineMode = 'follow' | 'tate' | 'water' | 'cursor' | 'strokes' | 'dust' | 'shatter' | 'depth' | 'maskslide' | 'punch';
export type Echo = {text: string; x: number; y: number; size: number; rotate: number; at: number; vertical: boolean};
export type CamKey = {t: number; cx: number; cy: number; z: number}; // 在 t 时刻，画面中心对准 (cx, cy)，放大 z 倍
export type LinePlan = {
  mode: LineMode;
  vertical: boolean;
  chars: CharSlot[];
  cam: CamKey[];
  wind: boolean; // 句末风吹散
  windFrom: number; // 风吹散开始时间（镜头先拉回整句、停留后才吹）
  order: 'sequential' | 'shuffle'; // 笔画拼接的顺序
  echo: Echo | null; // 主词的空心描边回声大字（杂志式层级）
  screen: boolean; // true = 屏幕空间（不受镜头推拉影响，例如单字特写快切）
};

const charW = (ch: string, size: number) => (isCJK(ch) ? size : size * 0.56);

// ---------- 排版 ----------
// 横排：一行放下就一行，放不下在词之间断成两行；主词字号放大 1.3 倍
export const layoutRow = (line: LyricLine, W: number, H: number, mainIdx: number): CharSlot[] => {
  const words = line.words;
  const maxW = W * 0.82;
  const totalV = words.reduce((n, w, i) => n + vlen(w.text) * (i === mainIdx ? 1.3 : 1), 0) + 0.3 * (words.length - 1);
  let size = Math.min(200, Math.max(96, maxW / Math.max(1, totalV)));
  // 分行：一行放不下且字号已到下限时，按词拆成两行
  const rows: number[][] = [[]];
  if (totalV * size > maxW * 1.02) {
    const half = totalV / 2;
    let acc = 0;
    words.forEach((w, i) => {
      if (acc > half * 0.9 && rows.length === 1) rows.push([]);
      rows[rows.length - 1].push(i);
      acc += vlen(w.text) * (i === mainIdx ? 1.3 : 1) + 0.3;
    });
    const rowV = Math.max(...rows.map((r) => r.reduce((n, i) => n + vlen(words[i].text) * (i === mainIdx ? 1.3 : 1), 0) + 0.3 * (r.length - 1)));
    size = Math.min(180, Math.max(84, maxW / Math.max(1, rowV)));
  } else {
    rows[0] = words.map((_, i) => i);
  }
  const slots: CharSlot[] = [];
  const lineH = size * 1.45;
  rows.forEach((r, ri) => {
    const rowWidth = r.reduce((n, i) => n + [...words[i].text].reduce((m, ch) => m + charW(ch, size * (i === mainIdx ? 1.3 : 1)), 0), 0) + size * 0.3 * (r.length - 1);
    let x = (W - rowWidth) / 2;
    const y = H / 2 + (ri - (rows.length - 1) / 2) * lineH;
    r.forEach((i) => {
      const w = words[i];
      const s = size * (i === mainIdx ? 1.3 : 1);
      const ct = w.chars ?? [...w.text].map((c, k) => ({c, t: w.start + ((w.end - w.start) * k) / Math.max(1, [...w.text].length)}));
      ct.forEach(({c, t}) => {
        const cw = charW(c, s);
        if (c.trim()) slots.push({ch: c, x: x + cw / 2, y, t, size: s, emph: i === mainIdx});
        x += cw;
      });
      x += size * 0.3;
    });
  });
  return slots;
};

// 杂志式：主词独占一行、放到很大；前面的词缩小放在左上，后面的词缩小放在右下
export const layoutMagazine = (line: LyricLine, W: number, H: number, mainIdx: number): CharSlot[] => {
  const words = line.words;
  const main = words[mainIdx];
  const mainV = vlen(main.text);
  const big = Math.min(300, Math.max(150, (W * 0.72) / Math.max(1, mainV)));
  const before = words.slice(0, mainIdx);
  const after = words.slice(mainIdx + 1);
  const smallFor = (ws: typeof words) => {
    const v = ws.reduce((n, w) => n + vlen(w.text), 0) + 0.3 * Math.max(0, ws.length - 1);
    return Math.min(big * 0.42, Math.max(56, (W * 0.6) / Math.max(1, v)));
  };
  const charTimes = (w: (typeof words)[number]) =>
    w.chars ?? [...w.text].map((c, k) => ({c, t: w.start + ((w.end - w.start) * k) / Math.max(1, [...w.text].length)}));
  const rowWidth = (ws: typeof words, size: number) =>
    ws.reduce((n, w) => n + [...w.text].reduce((m, ch) => m + charW(ch, size), 0), 0) + size * 0.3 * Math.max(0, ws.length - 1);
  const slots: CharSlot[] = [];
  const mainW = rowWidth([main], big);
  const mainX0 = (W - mainW) / 2;
  const mainY = H / 2 + (before.length ? big * 0.12 : 0) - (after.length ? big * 0.12 : 0);
  // 前面的小词：在主词左上方
  if (before.length) {
    const s = smallFor(before);
    let x = Math.max(W * 0.08, mainX0 + big * 0.05);
    const y = mainY - big * 0.62 - s * 0.35;
    before.forEach((w) => {
      charTimes(w).forEach(({c, t}) => {
        const cw = charW(c, s);
        if (c.trim()) slots.push({ch: c, x: x + cw / 2, y, t, size: s});
        x += cw;
      });
      x += s * 0.3;
    });
  }
  // 主词
  let x = mainX0;
  charTimes(main).forEach(({c, t}) => {
    const cw = charW(c, big);
    if (c.trim()) slots.push({ch: c, x: x + cw / 2, y: mainY, t, size: big, emph: true});
    x += cw;
  });
  // 后面的小词：在主词右下方
  if (after.length) {
    const s = smallFor(after);
    const aw = rowWidth(after, s);
    let ax = Math.min(W * 0.92 - aw, mainX0 + mainW - aw - big * 0.05);
    ax = Math.max(W * 0.08, ax);
    const y = mainY + big * 0.62 + s * 0.35;
    after.forEach((w) => {
      charTimes(w).forEach(({c, t}) => {
        const cw = charW(c, s);
        if (c.trim()) slots.push({ch: c, x: ax + cw / 2, y, t, size: s});
        ax += cw;
      });
      ax += s * 0.3;
    });
  }
  return slots.sort((a, b) => a.t - b.t);
};

// 直书：从右往左分列，每列从上往下；一个词尽量不拆到两列
export const layoutColumns = (line: LyricLine, W: number, H: number, mainIdx: number): CharSlot[] => {
  const words = line.words;
  const maxH = H * 0.8;
  const total = words.reduce((n, w, i) => n + [...w.text].length * (i === mainIdx ? 1.6 : 0.8), 0);
  const cols = Math.max(1, Math.ceil((total * 120) / maxH));
  let size = Math.min(170, Math.max(80, maxH / Math.max(1, Math.ceil(total / cols))));
  // 按词分配到列
  const colsOf: number[][] = [[]];
  let used = 0;
  const cap = maxH / size;
  words.forEach((w, i) => {
    const n = [...w.text].length * (i === mainIdx ? 1.6 : 0.8);
    if (used + n > cap && colsOf[colsOf.length - 1].length) {
      colsOf.push([]);
      used = 0;
    }
    colsOf[colsOf.length - 1].push(i);
    used += n + 0.4;
  });
  size = Math.min(size, (W * 0.8) / (colsOf.length * 1.5));
  const colGap = size * 1.5;
  const slots: CharSlot[] = [];
  colsOf.forEach((c, ci) => {
    const x = W / 2 + ((colsOf.length - 1) / 2 - ci) * colGap; // 第一列在右
    const colLen = c.reduce((n, i) => n + [...words[i].text].length * size * (i === mainIdx ? 1.6 : 0.8), 0) + size * 0.4 * (c.length - 1);
    let y = (H - colLen) / 2;
    c.forEach((i) => {
      const w = words[i];
      const s = size * (i === mainIdx ? 1.6 : 0.8);
      const ct = w.chars ?? [...w.text].map((ch, k) => ({c: ch, t: w.start + ((w.end - w.start) * k) / Math.max(1, [...w.text].length)}));
      ct.forEach(({c: ch, t}) => {
        if (ch.trim()) slots.push({ch, x, y: y + s / 2, t, size: s, emph: i === mainIdx});
        y += s;
      });
      y += size * 0.4;
    });
  });
  return slots;
};

// ---------- 镜头路线 ----------
// follow：推近到第一个字 → 按演唱时间跟着字走（快歌隔几个字才移一次）→ 句末拉回全景
export const followCam = (chars: CharSlot[], start: number, end: number, W: number, H: number): CamKey[] => {
  if (!chars.length) return [{t: start, cx: W / 2, cy: H / 2, z: 1}];
  const dur = Math.max(0.5, chars[chars.length - 1].t - chars[0].t);
  const rate = chars.length / dur; // 每秒唱几个字
  const z = rate > 6 ? 1.45 : rate > 3.5 ? 1.7 : 2.0; // 唱得越快推得越浅
  const step = rate > 6 ? 3 : rate > 3.5 ? 2 : 1; // 唱得越快，镜头隔几个字才移一次
  const keys: CamKey[] = [{t: start, cx: chars[0].x, cy: chars[0].y, z: z * 0.92}];
  for (let i = 0; i < chars.length; i += step) keys.push({t: chars[i].t, cx: chars[i].x, cy: chars[i].y, z});
  const last = chars[chars.length - 1];
  keys.push({t: last.t + 0.3, cx: last.x, cy: last.y, z});
  // 唱完后拉回整句（0.6 秒），在镜头结束前完成；之后停在整句上
  const pullEnd = Math.min(end - 0.1, last.t + 0.9);
  keys.push({t: pullEnd, cx: W / 2, cy: H / 2, z: 1.0});
  keys.push({t: Math.max(end, pullEnd + 0.01), cx: W / 2, cy: H / 2, z: 0.98});
  return keys.sort((a, b) => a.t - b.t);
};

// push：缓慢推近再略拉开（水中浮现 / 光标 / 笔画用）；光标模式中心略跟着进度移动
export const pushCam = (chars: CharSlot[], start: number, end: number, W: number, H: number, track = false): CamKey[] => {
  const mid = (start + end) / 2;
  if (!track || !chars.length) {
    return [{t: start, cx: W / 2, cy: H / 2, z: 1.0}, {t: mid, cx: W / 2, cy: H / 2, z: 1.14}, {t: end, cx: W / 2, cy: H / 2, z: 1.06}];
  }
  const keys: CamKey[] = [{t: start, cx: chars[0].x, cy: H / 2, z: 1.28}];
  chars.forEach((c, i) => {
    if (i % 2 === 0) keys.push({t: c.t, cx: W / 2 + (c.x - W / 2) * 0.6, cy: H / 2 + (c.y - H / 2) * 0.6, z: 1.28});
  });
  const last = chars[chars.length - 1];
  keys.push({t: Math.min(end - 0.1, last.t + 0.9), cx: W / 2, cy: H / 2, z: 1.0});
  return keys.sort((a, b) => a.t - b.t);
};

// 在 t 时刻插值镜头（平滑缓动）
export const camAtTime = (keys: CamKey[], t: number): CamKey => {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const p = (t - a.t) / Math.max(1e-3, b.t - a.t);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // 缓入缓出
      return {t, cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, z: a.z + (b.z - a.z) * e};
    }
  }
  return keys[keys.length - 1];
};

export const planLine = (line: LyricLine, mode: LineMode, start: number, end: number, W: number, H: number, mainIdx: number,
  opts: {wind?: boolean; order?: 'sequential' | 'shuffle'} = {}): LinePlan => {
  const vertical = mode === 'tate';
  // 按句排：需要阅读顺序的用整行（光标、笔画、遮罩上滑、快切），其余用杂志式层级
  const rowModes: LineMode[] = ['cursor', 'strokes', 'maskslide', 'punch'];
  const chars = vertical ? layoutColumns(line, W, H, mainIdx)
    : rowModes.includes(mode) || line.words.length < 2 ? layoutRow(line, W, H, mainIdx) : layoutMagazine(line, W, H, mainIdx);
  const cam = mode === 'follow' || mode === 'tate' ? followCam(chars, start, end, W, H)
    : mode === 'cursor' || mode === 'maskslide' ? pushCam(chars, start, end, W, H, true)
      : mode === 'punch' ? [{t: start, cx: W / 2, cy: H / 2, z: 1}, {t: end, cx: W / 2, cy: H / 2, z: 1}]
        : pushCam(chars, start, end, W, H);
  // 风吹散：拉回整句并停留 0.6 秒后才开始；剩余时间不够 0.9 秒就不吹（改为柔和淡出）
  const lastT = chars.length ? chars[chars.length - 1].t : start;
  const windFrom = Math.min(end - 0.1, lastT + 0.9) + 0.6;
  const wind = Boolean(opts.wind) && mode === 'follow' && end - windFrom >= 0.9;
  // 空心描边回声：主词放大、略旋转，垫在后面
  const mainChars = chars.filter((c) => c.emph);
  const mw = line.words[mainIdx];
  const echo: Echo | null = mode === 'punch' || !mainChars.length ? null : {
    text: mw.text, vertical,
    x: vertical ? Math.max(...chars.map((c) => c.x)) + mainChars[0].size * 1.4 : W * 0.08,
    y: vertical ? H * 0.12 : Math.min(H * 0.86, mainChars[0].y + mainChars[0].size * 0.9),
    size: mainChars[0].size * (vertical ? 1.5 : 1.7), rotate: vertical ? 0 : -6, at: mainChars[0].t,
  };
  return {mode, vertical, chars, cam, wind, windFrom, order: opts.order ?? 'sequential', echo, screen: mode === 'punch'};
};
