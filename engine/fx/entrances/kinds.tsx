// 新增的 10 种文字入场方式。全部基于 Glyphs（定位与 Word 一致），都是帧的纯函数。
// 横排、日文直书（vertical + upright）、旋转竖排（vertical）三种排法都支持。
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {backOut, clamp01, easeInOut, easeOut, FPS, isCJK, prog, rand} from '../../lib';
import type {EntranceProps} from '../Entrances';
import {alongAcross, Glyphs, modeOf, physical} from './Glyphs';

const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const LATIN = 'abcdefghijklmnopqrstuvwxyz';

const bounceOut = (x: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

// 默认错峰：没给 stagger 时，让整词在 ~maxSpread 秒内铺开
const spread = (p: {text: string; stagger?: number}, def: number, maxSpread = 0.4) => {
  if (p.stagger !== undefined) return p.stagger;
  const n = [...p.text].length;
  return n > 1 ? Math.min(def, maxSpread / (n - 1)) : def;
};

/** 打字机：逐字出现，最后一个出现的字后面有闪烁光标 */
export const TypeIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const st = spread(p, 0.07, 0.5);
  const n = [...p.text].length;
  const done = p.at + (n - 1) * st;
  const typing = t < done + 0.05;
  const blinkOn = typing || Math.floor((t - done) / 0.25) % 2 === 0;
  const caretGone = t > done + 0.75;
  let last = -1;
  for (let i = 0; i < n; i++) if (t >= p.at + i * st) last = i;
  return (
    <Glyphs {...p} state={(i) => {
      const on = t >= p.at + i * st;
      return {o: on ? clamp01((t - (p.at + i * st)) * FPS / 2) : 0, caret: i === last && blinkOn && !caretGone};
    }} />
  );
};

/** 遮罩擦入：柔边遮罩沿阅读方向推过去 */
export const WipeIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const q = easeInOut(prog(f, p.at, 0.5));
  const m = modeOf(p);
  const soft = 28;
  const head = q * (100 + soft);
  const mask = q < 1 ? `linear-gradient(${m === 'tate' ? 'to bottom' : 'to right'}, black ${head - soft}%, transparent ${head}%)` : undefined;
  return (
    <Glyphs {...p} state={() => ({})}
      innerStyle={{WebkitMaskImage: mask, maskImage: mask}} />
  );
};

/** 对焦：由虚到实，同时从 114% 轻轻收到 100% */
export const FocusIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const q = easeOut(prog(f, p.at, 0.5));
  const blur = (1 - q) * 16;
  return (
    <Glyphs {...p} state={() => ({})}
      innerStyle={{transform: `scale(${1.14 - 0.14 * q})`, filter: blur > 0.1 ? `blur(${blur}px)` : undefined, opacity: clamp01(prog(f, p.at, 0.2) * 1.2)}} />
  );
};

/** 从极小放大：带过冲回弹 */
export const ZoomIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const q = prog(f, p.at, 0.45);
  const s = 0.06 + 0.94 * backOut(q);
  return (
    <Glyphs {...p} state={() => ({})}
      innerStyle={{transform: q < 1 ? `scale(${s})` : undefined, opacity: clamp01(q * 3)}} />
  );
};

/** 拆半合拢：横排上下两半、竖排左右两半，沿阅读方向从两侧滑入对齐 */
export const SplitIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const q = easeOut(prog(f, p.at, 0.45));
  const m = modeOf(p);
  const d = (1 - q) * p.size * 1.4;
  const tate = m === 'tate';
  return (
    <Glyphs {...p} state={() => ({})}
      innerStyle={{opacity: clamp01(prog(f, p.at, 0.12) * 3)}}
      inner={(content) => q >= 1 ? content : (
        <>
          <div style={{position: 'relative', clipPath: tate ? 'inset(-20% 50% -20% -20%)' : 'inset(-20% -20% 50% -20%)', transform: alongAcross(m, -d, 0)}}>{content}</div>
          <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', clipPath: tate ? 'inset(-20% -20% -20% 50%)' : 'inset(50% -20% -20% -20%)', transform: alongAcross(m, d, 0)}}>{content}</div>
        </>
      )} />
  );
};

/** 逐字落下：每个字从上方落到位并回弹 */
export const DropIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const st = spread(p, 0.05);
  const m = modeOf(p);
  return (
    <Glyphs {...p} state={(i) => {
      const q = prog(f, p.at + i * st, 0.45);
      const off = -(1 - bounceOut(q)) * p.size * 1.1;
      return {o: clamp01(q * 4), tf: physical(m, 0, off)};
    }} />
  );
};

/** 翻转入场：每个字绕自身轴翻转进来（横排绕竖轴，直书绕横轴） */
export const SpinIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const st = spread(p, 0.045);
  const m = modeOf(p);
  return (
    <Glyphs {...p} state={(i) => {
      const q = easeOut(prog(f, p.at + i * st, 0.42));
      const a = (1 - q) * 100;
      return {o: clamp01(q * 2), tf: q < 1 ? `perspective(${p.size * 4}px) ${m === 'tate' ? 'rotateX' : 'rotateY'}(${a}deg)` : undefined};
    }} />
  );
};

/** 先描边后填色：空心描边沿阅读方向画出，随后填色淡入（描边淡淡留着） */
export const StrokeIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const m = modeOf(p);
  const q1 = easeInOut(prog(f, p.at, 0.32));
  const q2 = easeOut(prog(f, p.at + 0.22, 0.33));
  const soft = 18;
  const head = q1 * (100 + soft);
  const mask = q1 < 1 ? `linear-gradient(${m === 'tate' ? 'to bottom' : 'to right'}, black ${head - soft}%, transparent ${head}%)` : undefined;
  return (
    <Glyphs {...p} state={() => ({})} outlineColor2={`rgba(${p.glowColor ?? '255,200,230'},0.95)`}
      inner={(content, outline) => (
        <>
          <div style={{position: 'relative', WebkitMaskImage: mask, maskImage: mask, opacity: 1 - 0.65 * q2}}>{outline}</div>
          {q2 > 0 && <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: q2}}>{content}</div>}
        </>
      )} />
  );
};

/** 解码：每个位置先快速闪过随机字形（日文用片假名、拉丁用字母），依次定格成正确的字 */
export const DecodeIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const st = spread(p, 0.05, 0.35);
  const seed = p.seed ?? 1;
  const step = Math.floor(f / 2);
  return (
    <Glyphs {...p} state={(i, ch) => {
      if (ch.trim() === '') return {};
      const resolve = p.at + 0.14 + i * st + rand(seed * 5.1 + i * 2.3) * 0.12;
      const appear = p.at + i * st * 0.4;
      if (t < appear) return {o: 0};
      if (t >= resolve) return {o: 1};
      const pool = isCJK(ch) ? KATAKANA : LATIN;
      let g = pool[Math.floor(rand(seed * 13 + i * 7.7 + step * 3.1) * pool.length)];
      if (!isCJK(ch) && ch === ch.toUpperCase() && ch !== ch.toLowerCase()) g = g.toUpperCase();
      return {o: 0.85, ghost: g, cax: (p.ca ?? 1.4) + 4};
    }} />
  );
};

/** 残影收拢：几层逐渐变淡的错位副本沿阅读方向收拢到正位，主体随之显形 */
export const EchoIn: React.FC<EntranceProps> = ({id: _id, ...p}) => {
  const f = useCurrentFrame();
  const q = easeOut(prog(f, p.at, 0.55));
  const m = modeOf(p);
  const copies = [1, 2, 3, 4];
  return (
    <Glyphs {...p} state={() => ({})}
      inner={(content) => (
        <>
          <div style={{position: 'relative', opacity: 0.25 + 0.75 * q}}>{content}</div>
          {q < 1 && copies.map((k) => {
            const off = (k % 2 ? -1 : 1) * k * (1 - q) * p.size * 0.3;
            return (
              <div key={k} style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                transform: alongAcross(m, off, 0), opacity: ((1 - q) * 0.6) / k, filter: `blur(${k * 0.8}px)`}}>{content}</div>
            );
          })}
        </>
      )} />
  );
};
