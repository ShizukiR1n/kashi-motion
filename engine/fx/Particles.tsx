import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {FPS, rand} from '../lib';

/*
 * 粒子系统：全部是“无状态”的——每个粒子的位置都由（时间, 种子）直接算出，
 * 所以 Remotion 多进程乱序渲染每一帧，结果都一致。
 * 画在 <canvas> 上，发光点和星点用预渲染的小贴图 drawImage，速度快。
 */

type RGB = [number, number, number];
let PALETTE: RGB[] = [[255, 255, 255], [255, 200, 220], [255, 120, 170], [255, 95, 147]];
/** 由风格方案设置粒子色板（白 + 两三个主题色）。渲染开始前调用一次即可。 */
export const setParticlePalette = (colors: RGB[]) => {
  if (colors.length) PALETTE = colors;
};

// ---------- 贴图缓存 ----------
const spriteCache = new Map<string, HTMLCanvasElement>();
const glowSprite = (c: RGB) => {
  const key = `g${c.join(',')}`;
  let s = spriteCache.get(key);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, `rgba(${c[0]},${c[1]},${c[2]},0.95)`);
  grd.addColorStop(0.45, `rgba(${c[0]},${c[1]},${c[2]},0.28)`);
  grd.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(key, s);
  return s;
};
const sparkSprite = (c: RGB) => {
  const key = `s${c.join(',')}`;
  let s = spriteCache.get(key);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d')!;
  g.translate(32, 32);
  g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  g.beginPath();
  g.moveTo(0, -30); g.quadraticCurveTo(0, 0, 30, 0); g.quadraticCurveTo(0, 0, 0, 30);
  g.quadraticCurveTo(0, 0, -30, 0); g.quadraticCurveTo(0, 0, 0, -30);
  g.fill();
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 14);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(-14, -14, 28, 28);
  spriteCache.set(key, s);
  return s;
};

type Dot = {x: number; y: number; r: number; a: number; c: RGB; spark?: boolean; rot?: number};

// 一个铺满画面的画布；draw 返回本帧要画的所有点
const ParticleCanvas: React.FC<{draw: (t: number) => Dot[]; blend?: GlobalCompositeOperation; style?: React.CSSProperties}> = ({draw, blend = 'lighter', style}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, width, height);
    g.globalCompositeOperation = blend;
    for (const d of draw(frame / FPS)) {
      if (d.a <= 0.003 || d.r <= 0.1) continue;
      g.globalAlpha = Math.min(1, d.a);
      const img = d.spark ? sparkSprite(d.c) : glowSprite(d.c);
      const size = d.r * (d.spark ? 2 : 4); // 发光点贴图的光晕比实心半径大
      if (d.rot) {
        g.save();
        g.translate(d.x, d.y);
        g.rotate(d.rot);
        g.drawImage(img, -size / 2, -size / 2, size, size);
        g.restore();
      } else {
        g.drawImage(img, d.x - size / 2, d.y - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
  });
  return <canvas ref={ref} width={width} height={height} style={{position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none', ...style}} />;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ================= ParticleSwirl：缠绕文字的粒子 =================
export type SwirlProps = {
  x: number; y: number; w: number; h: number; // 文字外框（左上角 + 宽高，画面坐标）
  at: number; // 出现时间（秒）
  dur?: number; // 存在时长（秒），之后散开消失
  count?: number; // 粒子数（默认 140）
  seed?: number;
  intensity?: number; // 亮度/尺寸倍数
  tilt?: number; // 椭圆轨道倾角（度），竖排字建议 90
  layer?: 'back' | 'front' | 'both'; // 只画轨道后半圈 / 前半圈 / 全部
  children?: React.ReactNode; // 传入文字时：自动画成 后半圈 → 文字 → 前半圈，形成“缠绕”
};

const swirlDots = (p: SwirlProps, t: number, side: 'back' | 'front' | 'both'): Dot[] => {
  const {x, y, w, h, at, dur = 3.2, count = 140, seed = 1, intensity = 1, tilt = 0} = p;
  const dt = t - at;
  if (dt < -0.05 || dt > dur + 1.4) return [];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ta = (tilt * Math.PI) / 180;
  const cosT = Math.cos(ta);
  const sinT = Math.sin(ta);
  const out: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = rand(seed * 17.3 + i * 1.11);
    const r2 = rand(seed * 5.7 + i * 2.37);
    const r3 = rand(seed * 9.1 + i * 3.73);
    const r4 = rand(seed * 2.9 + i * 4.19);
    const born = r1 * 0.35; // 错峰出生
    const lt = dt - born;
    if (lt < 0) continue;
    // 轨道：椭圆，半径从 0.25 螺旋展开到 1
    const grow = 0.25 + 0.75 * (1 - Math.exp(-lt * 3.2));
    const rx = (w / 2) * (0.85 + r2 * 0.65) * grow + 20;
    const ry = (h / 2) * (0.7 + r3 * 1.3) * grow + 14;
    const dir = r4 < 0.78 ? 1 : -1;
    const omega = dir * (1.1 + r2 * 1.8);
    const th = r3 * Math.PI * 2 + omega * lt + Math.sin(lt * 1.3 + i) * 0.15;
    // 消散：dur 之后向外、向上飘散
    const fade = dt > dur ? (dt - dur) / 1.4 : 0;
    const scatter = 1 + fade * (1.4 + r1);
    let px = Math.cos(th) * rx * scatter;
    let py = Math.sin(th) * ry * 0.38 * scatter + Math.sin(th * 2 + i) * 6; // 扁椭圆，像一圈环带
    py -= fade * (60 + r2 * 120);
    const z = Math.sin(th); // 前后：>0 在文字前面
    if (side === 'back' && z > 0) continue;
    if (side === 'front' && z <= 0) continue;
    // 倾斜轨道
    const qx = px * cosT - py * sinT;
    const qy = px * sinT + py * cosT;
    px = qx; py = qy;
    const depth = 0.55 + 0.45 * ((z + 1) / 2);
    const birthA = smooth(0, 0.25, lt);
    const life = 1 - smooth(0, 1, fade);
    const flick = 0.75 + 0.25 * Math.sin(t * (8 + r1 * 10) + i);
    const spark = r2 > 0.9;
    out.push({
      x: cx + px, y: cy + py,
      r: (spark ? 12 + r3 * 12 : 3.5 + r3 * 5.5) * depth * intensity,
      a: birthA * life * depth * flick,
      c: PALETTE[Math.floor(r4 * PALETTE.length)],
      spark, rot: spark ? t * 1.5 + i : 0,
    });
    // 拖尾：沿轨道往回补两颗更暗更小的点
    if (!spark && r1 > 0.45) {
      for (let k = 1; k <= 2; k++) {
        const th2 = th - omega * 0.035 * k;
        let ex = Math.cos(th2) * rx * scatter;
        let ey = Math.sin(th2) * ry * 0.38 * scatter + Math.sin(th2 * 2 + i) * 6 - fade * (60 + r2 * 120);
        const ux = ex * cosT - ey * sinT;
        const uy = ex * sinT + ey * cosT;
        ex = ux; ey = uy;
        out.push({x: cx + ex, y: cy + ey, r: (3 + r3 * 3.5) * depth * intensity * (1 - k * 0.25), a: birthA * life * depth * 0.5 / k, c: PALETTE[1]});
      }
    }
  }
  return out;
};

export const ParticleSwirl: React.FC<SwirlProps> = (p) => {
  const t = useCurrentFrame() / FPS;
  const layer = p.layer ?? 'both';
  const alive = t >= p.at - 0.05 && t <= p.at + (p.dur ?? 3.2) + 1.4;
  if (!alive) return p.children ? <>{p.children}</> : null;
  if (p.children) {
    return (
      <AbsoluteFill>
        <ParticleCanvas draw={(t) => swirlDots(p, t, 'back')} />
        {p.children}
        <ParticleCanvas draw={(t) => swirlDots(p, t, 'front')} />
      </AbsoluteFill>
    );
  }
  return <ParticleCanvas draw={(t) => swirlDots(p, t, layer)} />;
};

// ================= ParticleBurst：音头上的放射爆散 =================
export type BurstProps = {
  x: number; y: number; at: number;
  count?: number; // 默认 70
  speed?: number; // 初速度（像素/秒），默认 900
  dur?: number; // 默认 1.1 秒
  seed?: number;
  spread?: number; // 椭圆扁度：1 为正圆，<1 横向扁
  intensity?: number;
};

const burstDots = (p: BurstProps, t: number): Dot[] => {
  const {x, y, at, count = 70, speed = 900, dur = 1.1, seed = 1, spread = 0.7, intensity = 1} = p;
  const dt = t - at;
  if (dt < 0 || dt > dur) return [];
  const out: Dot[] = [];
  const k = 4.5; // 阻尼：越大减速越快
  for (let i = 0; i < count; i++) {
    const r1 = rand(seed * 3.3 + i * 1.7);
    const r2 = rand(seed * 8.1 + i * 2.9);
    const r3 = rand(seed * 1.9 + i * 5.3);
    const ang = r1 * Math.PI * 2;
    const v = speed * (0.25 + r2 * 0.9);
    const dist = (v * (1 - Math.exp(-k * dt))) / k;
    const life = 1 - dt / (dur * (0.5 + r3 * 0.5));
    if (life <= 0) continue;
    const spark = r3 > 0.85;
    out.push({
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist * spread + dt * dt * 60, // 轻微下坠
      r: (spark ? 11 + r2 * 10 : 3 + r2 * 5) * intensity,
      a: life * (0.6 + 0.4 * Math.sin(dt * 30 + i)),
      c: PALETTE[Math.floor(r2 * PALETTE.length)],
      spark, rot: dt * 4 + i,
    });
  }
  return out;
};

// 不在播放时段时不创建画布（全屏画布即使是空的也有合成开销）
export const ParticleBurst: React.FC<BurstProps> = (p) => {
  const t = useCurrentFrame() / FPS;
  if (t < p.at - 0.05 || t > p.at + (p.dur ?? 1.1)) return null;
  return <ParticleCanvas draw={(tt) => burstDots(p, tt)} />;
};

// ================= AmbientDust：全画面漂浮的灰尘/光斑 =================
export type DustProps = {
  count?: number; // 默认 90
  seed?: number;
  opacity?: number; // 整体透明度，默认 1
  bokeh?: number; // 大光斑数量，默认 10
  drift?: number; // 漂移速度倍数
};

export const AmbientDust: React.FC<DustProps> = ({count = 90, seed = 3, opacity = 1, bokeh = 10, drift = 1}) => {
  const {width, height} = useVideoConfig();
  const draw = (t: number): Dot[] => {
    const out: Dot[] = [];
    const n = count + bokeh;
    for (let i = 0; i < n; i++) {
      const r1 = rand(seed * 4.1 + i * 1.3);
      const r2 = rand(seed * 7.7 + i * 2.1);
      const r3 = rand(seed * 2.3 + i * 3.7);
      const big = i >= count;
      const vy = -(8 + r2 * 22) * drift * (big ? 0.4 : 1);
      const vx = (r3 - 0.5) * 12 * drift;
      const W2 = width + 200;
      const H2 = height + 200;
      const px = ((((r1 * W2 + vx * t + Math.sin(t * 0.5 + i) * 18) % W2) + W2) % W2) - 100;
      const py = ((((r2 * H2 + vy * t) % H2) + H2) % H2) - 100;
      const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + r3 * 2.5) + i * 1.7);
      out.push({
        x: px, y: py,
        r: big ? 26 + r3 * 55 : 1.6 + r3 * 3.4,
        a: (big ? 0.1 + r1 * 0.1 : 0.35 + r2 * 0.55) * tw * opacity,
        c: PALETTE[big ? 2 + (i % 2) : Math.floor(r1 * 2)],
      });
    }
    return out;
  };
  return <ParticleCanvas draw={draw} />;
};
