// 逐字浮现的公共部件：单字渲染（辉光 + 轻微色差）、字形采样（粒子只从笔画里出来）、粒子画布、排版辅助。
import React, {CSSProperties, useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FPS, fontFamily, rand} from '../../lib';
import type {CharSlot} from './types';

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeOutQuart = (p: number) => 1 - Math.pow(1 - p, 4);
export const easeInOutSine = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const useT = () => useCurrentFrame() / FPS;

// 镜头末尾的统一淡出（end 前 0.3 秒）
export const exitFade = (t: number, end: number) => 1 - smooth(end - 0.3, end, t);

const glowShadow = (size: number, rgb: string, g: number) =>
  [
    `0 0 ${Math.max(1, 0.03 * size * g)}px rgba(255,250,255,${0.85 * Math.min(1, g)})`,
    `0 0 ${0.1 * size * g}px rgba(${rgb},${0.55 * Math.min(1, g)})`,
    `0 0 ${0.24 * size * g}px rgba(${rgb},${0.3 * Math.min(1, g)})`,
  ].join(',');

// 单个字：中心对齐在 (x, y)，带辉光和轻微青/品红色差边。style 作用在整个字上（透明度、位移、模糊、遮罩……）
export const Glyph: React.FC<{
  c: CharSlot; color: string; glow: string; g?: number; ca?: number;
  style?: CSSProperties; inner?: CSSProperties; children?: React.ReactNode;
}> = ({c, color, glow, g = 0.8, ca = 1.1, style, inner, children}) => {
  const base: CSSProperties = {
    position: 'absolute', left: 0, top: 0, fontFamily, fontSize: c.size, lineHeight: 1, fontWeight: 500,
    whiteSpace: 'pre', width: c.size * 1.4, height: c.size, textAlign: 'center',
  };
  const layer = (col: string, dx: number, blend?: CSSProperties['mixBlendMode'], shadow?: string) => (
    <div style={{...base, color: col, transform: `translateX(${dx}px)`, mixBlendMode: blend, textShadow: shadow, ...inner}}>{c.ch}</div>
  );
  return (
    <div style={{position: 'absolute', left: c.x - c.size * 0.7, top: c.y - c.size / 2, width: c.size * 1.4, height: c.size, ...style}}>
      {ca > 0.05 && layer('rgba(0,235,255,0.6)', -ca, 'screen')}
      {ca > 0.05 && layer('rgba(255,50,130,0.6)', ca, 'screen')}
      {layer(color, 0, undefined, g > 0 ? glowShadow(c.size, glow, g) : undefined)}
      {children}
    </div>
  );
};

// ---------- 字形采样：把字画到离屏画布，取有墨的像素点 ----------
const glyphCache = new Map<string, [number, number][]>();
export const glyphPoints = (ch: string, size: number, max = 260): [number, number][] => {
  const key = `${ch}|${Math.round(size)}|${max}`;
  const hit = glyphCache.get(key);
  if (hit) return hit;
  const W = Math.ceil(size * 1.4);
  const H = Math.ceil(size * 1.2);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d', {willReadFrequently: true})!;
  g.fillStyle = '#fff';
  g.font = `500 ${size}px ${fontFamily}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, W / 2, H / 2);
  const data = g.getImageData(0, 0, W, H).data;
  const step = Math.max(1, Math.floor(size / 48));
  const all: [number, number][] = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 120) all.push([x - W / 2, y - H / 2]);
    }
  }
  // 确定性抽样到 max 个点
  let pts = all;
  if (all.length > max) {
    pts = [];
    const stride = all.length / max;
    for (let i = 0; i < max; i++) pts.push(all[Math.floor(i * stride + rand(i * 7.1 + size) * stride * 0.9)]);
  }
  glyphCache.set(key, pts);
  return pts;
};

// ---------- 粒子画布（铺满画面，"lighter" 叠加的柔光点） ----------
export type Pt = {x: number; y: number; r: number; a: number; c: [number, number, number]};
const sprites = new Map<string, HTMLCanvasElement>();
const dotSprite = (c: [number, number, number]) => {
  const k = c.join(',');
  let s = sprites.get(k);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 32;
  const g = s.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, `rgba(${k},0.9)`);
  grd.addColorStop(0.6, `rgba(${k},0.25)`);
  grd.addColorStop(1, `rgba(${k},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  sprites.set(k, s);
  return s;
};

export const DotCanvas: React.FC<{draw: (t: number) => Pt[]}> = ({draw}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, width, height);
    g.globalCompositeOperation = 'lighter';
    for (const p of draw(frame / FPS)) {
      if (p.a <= 0.004 || p.r <= 0.05) continue;
      g.globalAlpha = Math.min(1, p.a);
      const s = p.r * 4;
      g.drawImage(dotSprite(p.c), p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  });
  return <canvas ref={ref} width={width} height={height} style={{position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none'}} />;
};

// ---------- 排版辅助（演示用；导演也可以用）：按真实字宽把一句排成 CharSlot ----------
let measureCv: HTMLCanvasElement | null = null;
export const advanceOf = (ch: string, size: number) => {
  if (!measureCv) measureCv = document.createElement('canvas');
  const g = measureCv.getContext('2d')!;
  g.font = `500 ${size}px ${fontFamily}`;
  return g.measureText(ch).width;
};
export const layoutLine = (text: string, x: number, y: number, size: number, vertical: boolean, t0: number, dt: number, anchor: 'center' | 'start' = 'center'): CharSlot[] => {
  const chars = [...text].filter((c) => c !== ' ');
  const gaps = [...text];
  if (vertical) {
    const total = chars.length * size * 1.02;
    let yy = anchor === 'center' ? y - total / 2 + size / 2 : y + size / 2;
    return chars.map((ch, i) => {
      const s = {ch, x, y: yy, t: t0 + i * dt, size};
      yy += size * 1.02;
      return s;
    });
  }
  const adv = gaps.map((ch) => (ch === ' ' ? size * 0.3 : advanceOf(ch, size)));
  const total = adv.reduce((a, b) => a + b, 0);
  let xx = anchor === 'center' ? x - total / 2 : x;
  const out: CharSlot[] = [];
  let k = 0;
  gaps.forEach((ch, i) => {
    if (ch !== ' ') {
      out.push({ch, x: xx + adv[i] / 2, y, t: t0 + k * dt, size});
      k++;
    }
    xx += adv[i];
  });
  return out;
};
