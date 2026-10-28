import React, {CSSProperties} from 'react';
import {useCurrentFrame} from 'remotion';
import {easeOut, fontFamily, FPS, prog, rand, WHITE} from '../lib';

export type WordProps = {
  text: string;
  x: number;
  y: number;
  size: number;
  at: number; // 入场时间（秒）
  stagger?: number; // 每个字母错峰（秒）
  letterDur?: number; // 单个字母入场时长（秒）
  vertical?: boolean; // 竖排（顺时针旋转 90°）
  upright?: boolean; // 和 vertical 一起用：日文直书（字正立、从上往下），x 为列中心，y 为顶端
  anchor?: 'left' | 'center' | 'right';
  glow?: number; // 辉光强度 0..1.2
  ca?: number; // 色差偏移（像素）
  outline?: boolean; // 空心描边字（回声层）
  outlineColor?: string;
  opacity?: number;
  out?: number; // 出场开始（秒）
  outDur?: number;
  scatter?: number; // 字母入场时的上下错位幅度
  blurIn?: number; // 整词由虚到实的时长（秒）
  rotate?: number; // 额外旋转角度
  seed?: number;
  color?: string;
  weight?: number;
  box?: boolean; // 外围细线小框
  glowColor?: string; // 辉光颜色 'r,g,b'（默认粉色）
};

const glowShadow = (g: number, size: number, rgb = '255,120,180') =>
  [
    `0 0 ${Math.max(1, 0.03 * size * g)}px rgba(255,248,252,${0.9 * Math.min(1, g)})`,
    `0 0 ${0.1 * size * g}px rgba(${rgb},${0.6 * Math.min(1, g)})`,
    `0 0 ${0.26 * size * g}px rgba(${rgb},${0.34 * Math.min(1, g)})`,
  ].join(',');

export const Word: React.FC<WordProps> = (p) => {
  const f = useCurrentFrame();
  const {
    text, x, y, size, at,
    stagger = 0.035, letterDur = 0.22, vertical = false, anchor = 'left',
    glow = 0.55, ca = 1.4, outline = false, outlineColor = 'rgba(255,140,180,0.55)',
    opacity = 1, out, outDur = 0.3, scatter = 0.3, blurIn = 0, rotate = 0,
    seed = 1, color = WHITE, weight = 500, box = false, upright = false, glowColor,
  } = p;
  const tate = vertical && upright;

  if (f < at * FPS - 1) return null;
  const outO = out === undefined ? 1 : 1 - prog(f, out, outDur);
  if (outO <= 0) return null;

  const letters = [...text];
  const states = letters.map((ch, i) => {
    const e = easeOut(prog(f, at + i * stagger, letterDur));
    const r = rand(seed * 31.7 + i * 7.3);
    return {
      ch,
      o: e,
      dy: (1 - e) * (r - 0.5) * 2 * scatter * size,
      s: 0.82 + 0.18 * e,
      cax: ca + (1 - e) * size * 0.07,
      blur: (1 - e) * 3,
    };
  });

  const wordBlur = blurIn ? (1 - easeOut(prog(f, at, blurIn))) * 10 : 0;
  const shift = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0';
  const transform = tate
    ? `translate(${x}px,${y}px) rotate(${rotate}deg) translate(-50%,0)`
    : vertical
    ? `translate(${x}px,${y}px) rotate(${90 + rotate}deg) translate(0,-50%)`
    : `translate(${x}px,${y}px) rotate(${rotate}deg) translate(${shift},-50%)`;

  const base: CSSProperties = {
    position: 'absolute', left: 0, top: 0, transform, transformOrigin: '0 0',
    fontFamily, fontSize: size, lineHeight: 1, whiteSpace: 'pre', fontWeight: weight,
    opacity: opacity * outO, filter: wordBlur > 0.05 ? `blur(${wordBlur}px)` : undefined,
    writingMode: tate ? 'vertical-rl' : undefined, textOrientation: tate ? 'mixed' : undefined,
  };

  const layer = (kind: 'c' | 'm' | 'w') => (
    <div style={{position: kind === 'w' ? 'relative' : 'absolute', left: 0, top: 0, mixBlendMode: kind === 'w' ? 'normal' : 'screen'}}>
      {states.map((s, i) => {
        const dx = kind === 'c' ? -s.cax : kind === 'm' ? s.cax : 0;
        const col = outline ? 'transparent' : kind === 'c' ? 'rgba(0,235,255,0.75)' : kind === 'm' ? 'rgba(255,40,120,0.8)' : color;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block', opacity: s.o, color: col,
              transform: tate ? `translate(${dx + s.dy}px,0) scale(${s.s})` : `translate(${dx}px,${s.dy}px) scale(${s.s})`,
              filter: s.blur > 0.05 ? `blur(${s.blur}px)` : undefined,
              WebkitTextStroke: outline ? `1.2px ${outlineColor}` : undefined,
              textShadow: kind === 'w' && !outline && glow > 0 ? glowShadow(glow, size, glowColor) : undefined,
            }}
          >
            {s.ch}
          </span>
        );
      })}
    </div>
  );

  return (
    <div style={base}>
      {!outline && ca > 0 && layer('c')}
      {!outline && ca > 0 && layer('m')}
      {layer('w')}
      {box && (
        <div style={{position: 'absolute', left: -0.18 * size, right: -0.18 * size, top: -0.08 * size, bottom: -0.12 * size,
          border: '1px solid rgba(255,255,255,0.45)', opacity: states[0].o}} />
      )}
    </div>
  );
};
