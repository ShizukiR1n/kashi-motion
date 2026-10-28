// 笔画拼接浮现：每个字按 KanjiVG 的真实笔顺一笔一划写出来，跟着演唱时间完成。
// order='sequential'：每个字在自己的时间窗里按笔顺写；
// order='shuffle'：整句的笔画打乱顺序（固定种子），各自从随机偏移/旋转处飞入就位，
//                  但每一笔都保证在它所属的字被唱到（t+0.1）之前完成。
// 无状态：画面只由当前帧决定，可乱序渲染。
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, FPS} from '../../lib';
import {rand} from '../../util';
import type {CharSlot, RevealProps} from '../reveals/types';

export type StrokeGlyph = {viewBox: number[]; strokes: string[]};
export type StrokeData = Record<string, StrokeGlyph>;
export type StrokeRevealProps = RevealProps & {strokes: StrokeData; order?: 'sequential' | 'shuffle'};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const LEAD = 0.45; // 字唱到前多久开始写
const DONE = 0.1; // 字唱到后多久写完

type StrokePlan = {ci: number; si: number; d: string; start: number; dur: number; dx: number; dy: number; rot: number};

// 给每一笔排时间
const planStrokes = (chars: CharSlot[], data: StrokeData, order: 'sequential' | 'shuffle', seed: number): StrokePlan[] => {
  const out: StrokePlan[] = [];
  if (order === 'sequential') {
    chars.forEach((c, ci) => {
      const g = data[c.ch];
      if (!g) return;
      const n = g.strokes.length;
      const ws = c.t - LEAD;
      const W = LEAD + DONE;
      const dur = Math.min(0.28, Math.max(0.1, (W / n) * 1.8));
      const step = n > 1 ? (W - dur) / (n - 1) : 0;
      g.strokes.forEach((d, si) => out.push({ci, si, d, start: ws + si * step, dur, dx: 0, dy: 0, rot: 0}));
    });
    return out;
  }
  // 乱序：整句的笔画在 [句首-0.7, 各自字的截止时间] 之间随机分布
  const first = chars.length ? Math.min(...chars.map((c) => c.t)) : 0;
  const lineStart = first - 0.7;
  chars.forEach((c, ci) => {
    const g = data[c.ch];
    if (!g) return;
    const deadline = c.t + DONE;
    const dur = Math.min(0.32, Math.max(0.14, 1.1 / g.strokes.length));
    g.strokes.forEach((d, si) => {
      const r = rand(seed * 7.3 + ci * 31.1 + si * 3.7);
      const latest = deadline - dur;
      const span = Math.max(0, Math.min(latest - lineStart, 1.3));
      const start = latest - r * span;
      const a = rand(seed * 1.9 + ci * 13.7 + si * 5.3) * Math.PI * 2;
      const dist = 0.25 + 0.3 * rand(seed * 2.3 + ci * 7.1 + si * 11.9);
      out.push({ci, si, d, start, dur, dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, rot: (rand(seed + ci * 3 + si * 17) - 0.5) * 50});
    });
  });
  return out;
};

export const StrokeReveal: React.FC<StrokeRevealProps> = ({chars, end, seed, colors, intensity, strokes, order = 'sequential'}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = frame / FPS;
  const plan = React.useMemo(() => planStrokes(chars, strokes, order, seed), [chars, strokes, order, seed]);
  const exit = 1 - clamp01((t - (end - 0.3)) / 0.3);
  if (exit <= 0) return null;
  const first = chars.length ? Math.min(...chars.map((c) => c.t)) : 0;
  if (t < first - 0.9) return null;

  const glow = `rgb(${colors.glow})`;
  const byChar = new Map<number, StrokePlan[]>();
  plan.forEach((p) => {
    const l = byChar.get(p.ci) ?? [];
    l.push(p);
    byChar.set(p.ci, l);
  });

  return (
    <AbsoluteFill style={{opacity: exit, pointerEvents: 'none'}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {chars.map((c, ci) => {
          const g = strokes[c.ch];
          if (!g) return null;
          const vbw = g.viewBox[2] || 109;
          const k = c.size / vbw;
          // 写完后轻微加粗、变实
          const settle = easeOut(clamp01((t - (c.t + DONE)) / 0.35));
          const baseW = (0.055 * vbw) * (1 + 0.18 * settle) * (c.emph ? 1.08 : 1);
          const list = byChar.get(ci) ?? [];
          return (
            <g key={ci} transform={`translate(${c.x - c.size / 2},${c.y - c.size / 2}) scale(${k})`}>
              {list.map((p) => {
                const q = clamp01((t - p.start) / p.dur);
                if (q <= 0) return null;
                const draw = easeInOut(q);
                const fly = 1 - easeOut(q); // 乱序时：从偏移处飞入
                const tf = p.dx || p.dy || p.rot
                  ? `translate(${p.dx * vbw * fly},${p.dy * vbw * fly}) rotate(${p.rot * fly} ${vbw / 2} ${vbw / 2})`
                  : undefined;
                const writing = q < 1;
                return (
                  <g key={p.si} transform={tf}>
                    {/* 柔光：同一笔画加宽、低透明度 */}
                    <path d={p.d} fill="none" stroke={glow} strokeOpacity={0.22 * Math.min(1.3, intensity)} strokeWidth={baseW * 2.6}
                      strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
                    <path d={p.d} fill="none" stroke={colors.text} strokeWidth={baseW}
                      strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
                    {/* 笔尖亮点：沿当前正在写的笔画移动 */}
                    {writing && (
                      <circle r={baseW * 0.9} fill="#ffffff"
                        style={{offsetPath: `path('${p.d}')`, offsetDistance: `${draw * 100}%`, offsetRotate: '0deg',
                          filter: `drop-shadow(0 0 ${baseW * 1.2}px ${glow})`} as React.CSSProperties} />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {/* 没有笔画数据的字（英文、标点等）：普通文字，淡入上浮 */}
      {chars.map((c, ci) => {
        if (strokes[c.ch]) return null;
        const p = easeOut(clamp01((t - (c.t - 0.2)) / 0.35));
        if (p <= 0) return null;
        return (
          <div key={`f${ci}`} style={{position: 'absolute', left: c.x, top: c.y, transform: `translate(-50%,-50%) translateY(${(1 - p) * c.size * 0.25}px)`,
            fontFamily, fontSize: c.size, lineHeight: 1, color: colors.text, opacity: p,
            textShadow: `0 0 ${c.size * 0.08}px rgba(${colors.glow},0.6)`}}>{c.ch}</div>
        );
      })}
    </AbsoluteFill>
  );
};
