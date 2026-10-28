import {Easing, interpolate} from 'remotion';
import {loadFont} from '@remotion/google-fonts/EBGaramond';
import {getInfo as jpInfo, loadFont as loadJp} from '@remotion/google-fonts/ShipporiMincho';
import {clamp01} from './util';

export {clamp01, isCJK, rand, vlen} from './util';

export const FPS = 30;
export const W = 1160;
export const H = 720;
export const DURATION = 1747; // 58.23 秒

const {fontFamily: latinFamily} = loadFont('normal', {weights: ['500', '600'], subsets: ['latin']});
// 英文用 Garamond；遇到日文字符时浏览器自动换成明朝体
export const fontFamily = `${latinFamily}, "${jpInfo().fontFamily}", serif`;

// 日文字体有 120 个子集包，只加载歌词里实际用到的字所在的子集
const parseRanges = (s: string): [number, number][] =>
  s.split(',').map((p) => p.trim().replace(/^U\+/i, '')).filter(Boolean).map((p) => {
    const [a, b] = p.split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
const loadedJp = new Set<string>();
export const loadJapaneseFor = (text: string) => {
  const info = jpInfo();
  const ranges = info.unicodeRanges as Record<string, string>;
  const cps = new Set([...text].map((c) => c.codePointAt(0) ?? 0).filter((c) => c > 0x2fff));
  const need = Object.keys(ranges).filter((k) => !loadedJp.has(k) && parseRanges(ranges[k]).some(([a, b]) => [...cps].some((c) => c >= a && c <= b)));
  if (need.length === 0) return;
  need.forEach((k) => loadedJp.add(k));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadJp('normal', {weights: ['500', '600'], subsets: need as any});
};


export const PINK = '#ff5f93';
export const WHITE = '#fff6fa';



// 从 at 秒开始，经过 dur 秒，从 0 走到 1
export const prog = (frame: number, at: number, dur: number) =>
  clamp01((frame - at * FPS) / Math.max(1, dur * FPS));

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const backOut = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

// 关键帧插值，时间单位为秒：kf(frame, [[秒, 值], ...])
export const kf = (frame: number, keys: [number, number][], ease = Easing.inOut(Easing.cubic)) => {
  if (keys.length === 1) return keys[0][1];
  return interpolate(
    frame,
    keys.map((k) => k[0] * FPS),
    keys.map((k) => k[1]),
    {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
};

// 元素可见度：入场进度 e（0→1）与出场透明度 o
export const vis = (frame: number, at: number, inDur = 0.3, out?: number, outDur = 0.3) => {
  const e = prog(frame, at, inDur);
  const o = out === undefined ? 1 : 1 - prog(frame, out, outDur);
  return {e, o, shown: frame >= at * FPS && o > 0};
};

export const inRange = (frame: number, from: number, to: number) => frame >= from * FPS && frame < to * FPS;
