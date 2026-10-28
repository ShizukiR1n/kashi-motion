// 「天使」装饰套件（style.decor = 'seraph'）：光环、锁链、几何纹样、羽毛。
// 全部是原创的通用几何图形；位置、动画都由时间直接算出（无状态），可乱序渲染。
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {backOut, easeOut, FPS, prog, rand, vis} from '../lib';

type Base = {at: number; out?: number; outDur?: number; opacity?: number; color?: string};

const useV = (p: Base, inDur = 0.5) => {
  const f = useCurrentFrame();
  return {f, t: f / FPS, ...vis(f, p.at, inDur, p.out, p.outDur)};
};

// 光环：倾斜的椭圆光圈（粗的柔光 + 细的亮线），出现时沿圆周描出，之后缓慢旋转
export const Halo: React.FC<Base & {x: number; y: number; r: number; tilt?: number; spin?: number}> = (p) => {
  const {f, t, o, shown} = useV(p);
  if (!shown) return null;
  const {x, y, r, tilt = 68, spin = 8, color = '#d9ccff', opacity = 1} = p;
  const ry = r * Math.cos((tilt * Math.PI) / 180);
  const draw = easeOut(prog(f, p.at, 0.6));
  const rot = (t - p.at) * spin;
  const bob = Math.sin(t * 1.6 + x) * 4;
  return (
    <g transform={`translate(${x},${y + bob}) rotate(${-8 + Math.sin(t * 0.5) * 4})`} opacity={o * opacity}>
      <ellipse rx={r} ry={ry} fill="none" stroke={color} strokeWidth={r * 0.09} opacity={0.18} />
      <ellipse rx={r} ry={ry} fill="none" stroke={color} strokeWidth={2.2} pathLength={1}
        strokeDasharray={`${draw} 1`} transform={`rotate(${rot} 0 0) scale(1,1)`} />
      <ellipse rx={r * 0.9} ry={ry * 0.9} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.5 * draw} />
    </g>
  );
};

// 锁链：沿直线依次出现的链环，轻微摆动
export const Chain: React.FC<Base & {x1: number; y1: number; x2: number; y2: number; link?: number}> = (p) => {
  const {f, t, o, shown} = useV(p);
  if (!shown) return null;
  const {x1, y1, x2, y2, link = 18, color = '#cfc6ee', opacity = 1} = p;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.floor(len / (link * 1.25)));
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const grow = easeOut(prog(f, p.at, 0.8));
  const sway = Math.sin(t * 1.4 + x1) * 1.5;
  return (
    <g transform={`translate(${x1},${y1}) rotate(${ang + sway})`} opacity={o * opacity} fill="none" stroke={color} strokeWidth={2}>
      {Array.from({length: n}, (_, i) => {
        if (i / n > grow) return null;
        const cx = i * link * 1.25;
        return i % 2 === 0
          ? <ellipse key={i} cx={cx} cy={0} rx={link * 0.75} ry={link * 0.38} />
          : <line key={i} x1={cx - link * 0.5} y1={0} x2={cx + link * 0.5} y2={0} strokeWidth={3.2} strokeLinecap="round" />;
      })}
    </g>
  );
};

// 几何纹样：同心圆 + 放射刻度 + 八角星，缓慢旋转
export const Sacred: React.FC<Base & {x: number; y: number; r: number; spin?: number}> = (p) => {
  const {f, t, o, shown} = useV(p, 0.8);
  if (!shown) return null;
  const {x, y, r, spin = 5, color = '#cfc6ee', opacity = 1} = p;
  const d = easeOut(prog(f, p.at, 0.9));
  const rot = (t - p.at) * spin;
  const star = Array.from({length: 16}, (_, i) => {
    const a = (i * Math.PI) / 8;
    const rr = i % 2 === 0 ? r * 0.42 : r * 0.2;
    return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
  }).join(' ');
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={o * opacity} fill="none" stroke={color}>
      <circle r={r} strokeWidth={1.4} pathLength={1} strokeDasharray={`${d} 1`} />
      <circle r={r * 0.86} strokeWidth={0.8} opacity={0.6} pathLength={1} strokeDasharray={`${d} 1`} />
      {Array.from({length: 36}, (_, i) => {
        const a = (i * Math.PI) / 18;
        const k = i % 3 === 0 ? 0.74 : 0.8;
        return i / 36 <= d ? <line key={i} x1={Math.cos(a) * r * k} y1={Math.sin(a) * r * k} x2={Math.cos(a) * r * 0.86} y2={Math.sin(a) * r * 0.86} strokeWidth={1} opacity={0.7} /> : null;
      })}
      <polygon points={star} strokeWidth={1.2} opacity={d} transform={`rotate(${-rot * 2})`} />
      <circle r={r * 0.08} fill={color} opacity={0.6 * d} />
    </g>
  );
};

// 单片羽毛（原创矢量形状）：羽轴 + 两侧羽片 + 几道羽纹
export const FeatherShape: React.FC<{s: number; color: string; opacity: number}> = ({s, color, opacity}) => (
  <g opacity={opacity}>
    <path d={`M0,${-s} C${s * 0.42},${-s * 0.55} ${s * 0.36},${s * 0.35} 0,${s * 0.8} C${-s * 0.3},${s * 0.3} ${-s * 0.4},${-s * 0.6} 0,${-s}Z`}
      fill={color} fillOpacity={0.55} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.8} />
    <path d={`M0,${-s * 0.95} L0,${s * 1.15}`} stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1.1} />
    {[-0.5, -0.2, 0.1, 0.4].map((k, i) => (
      <path key={i} d={`M0,${s * k} L${s * 0.28},${s * (k - 0.22)} M0,${s * (k + 0.08)} L${-s * 0.26},${s * (k - 0.12)}`}
        stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.7} />
    ))}
  </g>
);

// 全屏飘落的羽毛（无状态：位置 = f(时间, 种子)）
export const FeatherFall: React.FC<{count: number; seed?: number; color?: string; intensity?: number}> = ({count, seed = 5, color = '#e6defc', intensity = 1}) => {
  const t = useCurrentFrame() / FPS;
  const {width, height} = useVideoConfig();
  if (count <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={width} height={height}>
        {Array.from({length: count}, (_, i) => {
          const r1 = rand(seed * 97 + i * 3.1);
          const r2 = rand(seed * 31 + i * 7.7);
          const r3 = rand(seed * 13 + i * 5.3);
          const depth = 0.35 + r3 * 0.65; // 远处小而慢、近处大而快
          const speed = (40 + 70 * depth) * (0.8 + r2 * 0.4);
          const span = height + 240;
          const y = ((t * speed + r1 * span) % span) - 120;
          const x0 = r2 * width;
          const x = x0 + Math.sin(t * (0.6 + r1) + i) * (30 + 50 * depth);
          const rot = Math.sin(t * (0.9 + r2 * 0.6) + i * 1.7) * 50 + r3 * 40;
          const s = (10 + 22 * depth) * intensity;
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${rot})`} style={{filter: depth < 0.55 ? 'blur(1.5px)' : undefined}}>
              <FeatherShape s={s} color={color} opacity={0.25 + 0.55 * depth} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// 单片羽毛弹出（替代花朵类点缀）
export const FeatherPop: React.FC<Base & {x: number; y: number; s?: number; rot?: number}> = (p) => {
  const {t, e, o, shown} = useV(p, 0.45);
  if (!shown) return null;
  const {x, y, s = 26, rot = -20, color = '#e6defc', opacity = 1} = p;
  const k = backOut(e);
  const drift = Math.sin(t * 1.2 + x) * 6;
  return (
    <g transform={`translate(${x},${y + drift}) rotate(${rot + Math.sin(t + y) * 10}) scale(${k})`} opacity={o * opacity}>
      <FeatherShape s={s} color={color} opacity={0.9} />
    </g>
  );
};
