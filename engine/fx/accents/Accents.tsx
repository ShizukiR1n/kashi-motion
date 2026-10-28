// 主词点缀效果库：每种都围绕主词的外框播放，彼此一眼可分。
// 全部是"无状态"的：画面只由（当前帧, seed）决定，可多进程乱序渲染。
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp01, easeInOut, easeOut, FPS, rand} from '../../lib';
import {FeatherShape} from '../../components/Seraph';
import {ParticleBurst, ParticleSwirl, setParticlePalette} from '../Particles';
import type {AccentProps} from './index';

// ---------- 公共 ----------
const useAcc = (p: AccentProps, life: number) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const dt = t - p.at;
  const span = Math.max(0.6, Math.min(life, p.end - p.at));
  const shown = dt >= -0.02 && t < p.end && dt <= span + 0.6;
  const fade = clamp01((p.end - t) / 0.25); // 镜头结束前 0.25 秒淡出
  const {x, y, w, h} = p.box;
  return {t, dt, span, shown, fade, cx: x + w / 2, cy: y + h / 2, R: Math.max(w, h) / 2};
};

const Svg: React.FC<{children: React.ReactNode; blend?: React.CSSProperties['mixBlendMode']; opacity?: number}> = ({children, blend = 'screen', opacity = 1}) => {
  const {width, height} = useVideoConfig();
  return (
    <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', mixBlendMode: blend, opacity}}>
      {children}
    </svg>
  );
};

const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const star4 = (s: number) => `M0,${-s} Q0,0 ${s},0 Q0,0 0,${s} Q0,0 ${-s},0 Q0,0 0,${-s}Z`;
const uid = (kind: string, p: AccentProps) => `acc-${kind}-${Math.round(p.seed * 1000)}-${Math.round(p.at * 100)}`;

// ---------- swirl：沿用原有的粒子缠绕 ----------
export const Swirl: React.FC<AccentProps> = (p) => {
  setParticlePalette(p.colors.particles);
  const dur = Math.max(1.2, Math.min(4, p.end - p.at));
  return (
    <ParticleSwirl x={p.box.x} y={p.box.y} w={p.box.w} h={p.box.h} at={p.at} dur={dur}
      count={Math.round(120 * p.intensity)} seed={p.seed} intensity={p.intensity} tilt={p.vertical ? 90 : 0} layer="both" />
  );
};

// ---------- burst：只有一次放射爆散 ----------
export const Burst: React.FC<AccentProps> = (p) => {
  setParticlePalette(p.colors.particles);
  return (
    <ParticleBurst x={p.box.x + p.box.w / 2} y={p.box.y + p.box.h / 2} at={p.at} count={Math.round(75 * p.intensity)}
      speed={900 * p.intensity} seed={p.seed} spread={p.vertical ? 1 : 0.7} intensity={p.intensity} />
  );
};

// ---------- streak：一道斜向光带扫过字面 + 横向镜头光晕 ----------
export const Streak: React.FC<AccentProps> = (p) => {
  const {dt, span, shown, fade, cx, cy, R} = useAcc(p, 2.2);
  if (!shown) return null;
  const {x, y, w, h} = p.box;
  const g = p.colors.glow;
  const id = uid('streak', p);
  // 局部坐标：长轴沿 X。竖排字旋转 90°
  const major = p.vertical ? h : w;
  const minor = p.vertical ? w : h;
  const pad = Math.max(16, minor * 0.25);
  const bandW = Math.max(50, minor * 0.9);
  const skew = minor * 0.6;
  const frame = p.vertical ? `translate(${x + w},${y}) rotate(90)` : `translate(${x},${y})`;
  const sweep = (start: number, dur: number) => easeInOut(clamp01((dt - start) / dur));
  const band = (s: number, k: number, key: string) => {
    if (s <= 0 || s >= 1) return null;
    const p0 = -bandW - skew + s * (major + 2 * bandW + 2 * skew);
    return (
      <polygon key={key} points={`${p0},${-pad} ${p0 + bandW},${-pad} ${p0 + bandW - skew},${minor + pad} ${p0 - skew},${minor + pad}`}
        fill={`url(#${id}-g)`} opacity={k} />
    );
  };
  // 镜头光晕：一条细长的横线，先拉长再淡出
  const fl = clamp01((dt - 0.05) / 0.25);
  const flFade = 1 - clamp01((dt - 0.35) / 0.8);
  const flLen = R * 5 * p.intensity * easeOut(fl);
  const flA = fl * flFade;
  return (
    <Svg opacity={fade}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={`rgb(${g})`} stopOpacity={0} />
          <stop offset="0.45" stopColor={`rgb(${g})`} stopOpacity={0.5} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="1" stopColor={`rgb(${g})`} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={`rgb(${g})`} stopOpacity={0} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="1" stopColor={`rgb(${g})`} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect x={-pad} y={-pad} width={major + pad * 2} height={minor + pad * 2} rx={pad} />
        </clipPath>
      </defs>
      <g transform={frame} clipPath={`url(#${id}-c)`}>
        {band(sweep(0.08, 0.5), 0.9 * Math.min(1.2, p.intensity), 'a')}
        {span > 1.4 && band(sweep(1.05, 0.55), 0.5, 'b')}
      </g>
      {flA > 0.01 && (
        <g opacity={flA}>
          <rect x={cx - flLen} y={cy - 1.5} width={flLen * 2} height={3} fill={`url(#${id}-f)`} />
          <rect x={cx - flLen * 0.6} y={cy - 6} width={flLen * 1.2} height={12} fill={`url(#${id}-f)`} opacity={0.25} />
          <path d={star4(26 * p.intensity * (0.6 + 0.4 * fl))} transform={`translate(${cx},${cy})`} fill="#ffffff" />
        </g>
      )}
    </Svg>
  );
};

// ---------- halo：两道光环从字的外围扩散并淡出 ----------
export const HaloRings: React.FC<AccentProps> = (p) => {
  const {dt, shown, fade, cx, cy} = useAcc(p, 1.8);
  if (!shown) return null;
  const {w, h} = p.box;
  const pad = 24;
  const ax = w / 2 + pad;
  const ay = h / 2 + pad;
  const c = p.colors.accent;
  const id = uid('halo', p);
  const ring = (k: number) => {
    const q = clamp01((dt - k * 0.18) / 1.15);
    if (q <= 0 || q >= 1) return null;
    const s = 1 + 0.95 * easeOut(q) * p.intensity;
    // 光环保持一定的扁度，看起来像倾斜的圆环
    const rx = Math.max(ax, ay * 0.45) * s * 1.05;
    const ry = Math.max(ay, ax * 0.32) * s * 1.1;
    const a = Math.pow(1 - q, 1.4);
    return (
      <g key={k} opacity={a}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={c} strokeWidth={16} opacity={0.14} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={c} strokeWidth={0.8 + 3 * (1 - q)} />
        <ellipse cx={cx} cy={cy} rx={rx * 0.97} ry={ry * 0.97} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.6} />
      </g>
    );
  };
  const flash = Math.pow(1 - clamp01(dt / 0.45), 2);
  return (
    <Svg opacity={fade}>
      <defs>
        <radialGradient id={`${id}-r`}>
          <stop offset="0" stopColor={`rgb(${p.colors.glow})`} stopOpacity={0.5} />
          <stop offset="1" stopColor={`rgb(${p.colors.glow})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {flash > 0.01 && <ellipse cx={cx} cy={cy} rx={ax * 1.4} ry={ay * 1.4} fill={`url(#${id}-r)`} opacity={flash} />}
      {ring(0)}
      {ring(1)}
    </Svg>
  );
};

// ---------- feathers：羽毛从字里迸出，然后轻轻飘落 ----------
export const Feathers: React.FC<AccentProps> = (p) => {
  const {dt, shown, fade, cx, cy} = useAcc(p, 2.8);
  if (!shown || dt < 0) return null;
  const {w, h} = p.box;
  const n = Math.round(6 + 4 * p.intensity);
  const col = rgb(p.colors.particles[1] ?? [230, 222, 252]);
  return (
    <Svg blend="normal" opacity={fade}>
      {Array.from({length: n}, (_, i) => {
        const r1 = rand(p.seed * 7.1 + i * 3.3);
        const r2 = rand(p.seed * 2.9 + i * 5.1);
        const r3 = rand(p.seed * 4.7 + i * 1.9);
        const d = dt - i * 0.02;
        if (d <= 0) return null;
        const ang = -Math.PI / 2 + (r1 - 0.5) * Math.PI * 1.7; // 大多朝上、向两侧
        const sp = (240 + 300 * r2) * p.intensity;
        const k = 3.2;
        const dist = (sp * (1 - Math.exp(-k * d))) / k;
        const fall = 55 * Math.pow(d, 1.35);
        const sway = Math.sin(d * 2.4 + i) * 20 * Math.min(1, d);
        const x0 = cx + (r3 - 0.5) * w * 0.5;
        const y0 = cy + (r1 - 0.5) * h * 0.5;
        const px = x0 + Math.cos(ang) * dist + sway;
        const py = y0 + Math.sin(ang) * dist + fall;
        const rot = r3 * 360 + d * (r2 - 0.5) * 140 + Math.sin(d * 3 + i) * 22;
        const s = (22 + 20 * r2) * p.intensity * Math.min(1, d * 6);
        const a = Math.min(1, d * 8) * (1 - clamp01((d - 1.7) / 0.9));
        if (a <= 0.01) return null;
        return (
          <g key={i} transform={`translate(${px},${py}) rotate(${rot})`}>
            <FeatherShape s={s} color={col} opacity={a} />
          </g>
        );
      })}
    </Svg>
  );
};

// ---------- shards：几何碎片向外飞散、旋转、淡出 ----------
export const Shards: React.FC<AccentProps> = (p) => {
  const {dt, shown, fade, cx, cy} = useAcc(p, 1.6);
  if (!shown || dt < 0) return null;
  const {w, h} = p.box;
  const n = Math.round(10 + 9 * p.intensity);
  const c = p.colors.accent;
  return (
    <Svg opacity={fade}>
      {Array.from({length: n}, (_, i) => {
        const r1 = rand(p.seed * 5.3 + i * 2.1);
        const r2 = rand(p.seed * 9.7 + i * 1.3);
        const r3 = rand(p.seed * 3.1 + i * 4.4);
        const d = dt - i * 0.012;
        if (d <= 0) return null;
        // 从字框内随机一点出发，沿"离开中心"的方向飞出
        const sx = cx + (r1 - 0.5) * w * 0.9;
        const sy = cy + (r2 - 0.5) * h * 0.9;
        const ang = Math.atan2(sy - cy + 0.01, sx - cx + 0.01) + (r3 - 0.5) * 0.9;
        const sp = (380 + 620 * r2) * p.intensity;
        const k = 4;
        const dist = (sp * (1 - Math.exp(-k * d))) / k;
        const px = sx + Math.cos(ang) * dist;
        const py = sy + Math.sin(ang) * dist + 30 * d * d;
        const rot = r1 * 360 + d * (r3 - 0.5) * 900;
        const s = (6 + 12 * r3) * p.intensity;
        const a = Math.min(1, d * 12) * (1 - clamp01(d / (0.9 + 0.5 * r1)));
        if (a <= 0.01) return null;
        const pts = r2 > 0.5
          ? `0,${-s} ${s * 0.9},${s * 0.7} ${-s * 0.8},${s * 0.6}` // 三角
          : `0,${-s * 1.3} ${s * 0.55},0 0,${s * 1.3} ${-s * 0.55},0`; // 菱形
        return (
          <polygon key={i} points={pts} transform={`translate(${px},${py}) rotate(${rot})`} opacity={a}
            fill={c} fillOpacity={r1 > 0.35 ? 0.4 : 0} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.1} />
        );
      })}
    </Svg>
  );
};

// ---------- ink：字背后晕开的墨/烟（柔和的径向斑块，深色核心 + 发光边缘） ----------
export const Ink: React.FC<AccentProps> = (p) => {
  const {dt, span, shown, fade, cx, cy} = useAcc(p, 4);
  if (!shown) return null;
  const {w, h} = p.box;
  const id = uid('ink', p);
  const g = p.colors.glow;
  const grow = easeOut(clamp01(dt / 1.4));
  const life = Math.min(1, clamp01(dt / 0.35)) * (1 - 0.45 * clamp01((dt - span + 0.8) / 0.8));
  const n = 6;
  const blob = (i: number, dark: boolean) => {
    const r1 = rand(p.seed * 6.7 + i * 2.3 + (dark ? 50 : 0));
    const r2 = rand(p.seed * 1.3 + i * 7.9 + (dark ? 50 : 0));
    const r3 = rand(p.seed * 8.9 + i * 3.7 + (dark ? 50 : 0));
    const ang = r1 * Math.PI * 2 + dt * 0.35 * (r2 - 0.5);
    const ox = Math.cos(ang) * w * 0.32 * (0.5 + r3);
    const oy = Math.sin(ang) * h * 0.32 * (0.5 + r3);
    const base = Math.max(w, h) * (dark ? 0.3 : 0.42) * (0.6 + 0.6 * r2);
    const r = base * (0.45 + 0.85 * grow) * (dark ? 1 : p.intensity);
    return <ellipse key={`${dark ? 'd' : 'g'}${i}`} cx={cx + ox * grow} cy={cy + oy * grow} rx={r * (p.vertical ? 0.8 : 1.25)} ry={r * (p.vertical ? 1.25 : 0.8)}
      fill={`url(#${id}-${dark ? 'd' : 'g'})`} />;
  };
  return (
    <>
      {/* 深色墨核：压暗字背后的背景，让字更清楚 */}
      <Svg blend="normal" opacity={fade * life * 0.85}>
        <defs>
          <radialGradient id={`${id}-d`}>
            <stop offset="0" stopColor="#04060f" stopOpacity={0.55} />
            <stop offset="0.6" stopColor="#04060f" stopOpacity={0.22} />
            <stop offset="1" stopColor="#04060f" stopOpacity={0} />
          </radialGradient>
        </defs>
        {Array.from({length: 4}, (_, i) => blob(i, true))}
      </Svg>
      {/* 发光的烟边 */}
      <Svg opacity={fade * life}>
        <defs>
          <radialGradient id={`${id}-g`}>
            <stop offset="0" stopColor={`rgb(${g})`} stopOpacity={0} />
            <stop offset="0.55" stopColor={`rgb(${g})`} stopOpacity={0.22} />
            <stop offset="0.8" stopColor={`rgb(${g})`} stopOpacity={0.12} />
            <stop offset="1" stopColor={`rgb(${g})`} stopOpacity={0} />
          </radialGradient>
        </defs>
        {Array.from({length: n}, (_, i) => blob(i, false))}
      </Svg>
    </>
  );
};

// ---------- trail：一颗星沿字的外框走一圈，身后留下渐隐的光迹和星点 ----------
const rectPath = (x: number, y: number, w: number, h: number, r: number, n: number) => {
  // 圆角矩形周长上均匀取 n 个点（从顶边中点顺时针）
  const pts: [number, number][] = [];
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const per = 2 * straightW + 2 * straightH + 4 * arc;
  const seg = [straightW / 2, arc, straightH, arc, straightW, arc, straightH, arc, straightW / 2];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * per;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const cxs = [x + w - r, x + w - r, x + r, x + r];
    const cys = [y + r, y + h - r, y + h - r, y + r];
    switch (i) {
      case 0: pts.push([x + w / 2 + d, y]); break;
      case 1: { const a = -Math.PI / 2 + d / r; pts.push([cxs[0] + Math.cos(a) * r, cys[0] + Math.sin(a) * r]); break; }
      case 2: pts.push([x + w, y + r + d]); break;
      case 3: { const a = d / r; pts.push([cxs[1] + Math.cos(a) * r, cys[1] + Math.sin(a) * r]); break; }
      case 4: pts.push([x + w - r - d, y + h]); break;
      case 5: { const a = Math.PI / 2 + d / r; pts.push([cxs[2] + Math.cos(a) * r, cys[2] + Math.sin(a) * r]); break; }
      case 6: pts.push([x, y + h - r - d]); break;
      case 7: { const a = Math.PI + d / r; pts.push([cxs[3] + Math.cos(a) * r, cys[3] + Math.sin(a) * r]); break; }
      default: pts.push([x + r + d, y]);
    }
  }
  return pts;
};

export const Trail: React.FC<AccentProps> = (p) => {
  const {dt, shown, fade} = useAcc(p, 2.4);
  if (!shown || dt < 0) return null;
  const {x, y, w, h} = p.box;
  const pad = Math.max(14, Math.min(w, h) * 0.18);
  const N = 160;
  const pts = rectPath(x - pad, y - pad, w + pad * 2, h + pad * 2, Math.min(w, h) * 0.25 + pad, N);
  const start = Math.floor(rand(p.seed * 3.7) * N);
  const LOOP = 1.25;
  const u = clamp01((dt - 0.05) / LOOP); // 头部走过的比例
  const head = Math.floor(u * N);
  const tail = Math.round(0.24 * N);
  const g = p.colors.glow;
  const at = (k: number) => pts[(((start + Math.floor(k)) % N) + N) % N];
  const done = clamp01((dt - 0.05 - LOOP) / 0.7); // 走完一圈后整圈亮一下再淡出
  const segs = [];
  if (done < 1) {
    for (let k = Math.max(0, head - tail); k < head; k++) {
      const a = (1 - (head - k) / tail) * (1 - done);
      const [x1, y1] = at(k);
      const [x2, y2] = at(k + 1);
      segs.push(<line key={`g${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`rgb(${g})`} strokeOpacity={a * 0.45} strokeWidth={4 + 8 * a} strokeLinecap="round" />);
      segs.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeOpacity={a} strokeWidth={1.5 + 3 * a} strokeLinecap="round" />);
    }
  }
  // 头部走过时撒下的小星点
  const drops = [];
  const nd = 14;
  for (let k = 0; k < nd; k++) {
    const pos = (k + 0.5) / nd;
    const tPass = 0.05 + pos * LOOP;
    const age = dt - tPass;
    if (age < 0 || age > 0.9) continue;
    const [px, py] = at(Math.floor(pos * N));
    const a = 1 - age / 0.9;
    const s = (5 + 5 * rand(p.seed + k)) * p.intensity * a;
    drops.push(<path key={`s${k}`} d={star4(s)} transform={`translate(${px},${py + age * 12})`} fill={`rgb(${g})`} opacity={a} />);
  }
  const [hx, hy] = at(head);
  const headA = 1 - done;
  const loopGlow = done > 0 ? Math.sin(Math.PI * done) : 0;
  return (
    <Svg opacity={fade}>
      {loopGlow > 0.01 && (
        <polygon points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={`rgb(${g})`} strokeWidth={2} opacity={0.7 * loopGlow} />
      )}
      {segs}
      {drops}
      {headA > 0.01 && (
        <g transform={`translate(${hx},${hy})`} opacity={headA}>
          <circle r={28 * p.intensity} fill={`rgb(${g})`} opacity={0.3} />
          <circle r={12 * p.intensity} fill="#ffffff" opacity={0.6} />
          <path d={star4(24 * p.intensity)} fill="#ffffff" />
        </g>
      )}
    </Svg>
  );
};

// ---------- rays：字背后的放射光束，缓慢旋转、随时间脉动 ----------
export const Rays: React.FC<AccentProps> = (p) => {
  const {dt, span, shown, fade, cx, cy} = useAcc(p, 4);
  if (!shown) return null;
  const {w, h} = p.box;
  const id = uid('rays', p);
  const g = p.colors.glow;
  const N = 16;
  const inA = easeOut(clamp01(dt / 0.35));
  const pulse = 0.78 + 0.22 * Math.sin(dt * 5.5);
  const settle = 1 - 0.55 * clamp01((dt - 0.6) / 1.2); // 入场时最亮，之后变柔和地留着
  const late = 1 - clamp01((dt - span + 0.4) / 0.4);
  const rot = rand(p.seed) * Math.PI * 2 + dt * 0.14;
  const reach = (a: number) => Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * h / 2 + 90;
  const Lmax = Math.max(w, h) * 1.6 + 200;
  return (
    <Svg opacity={fade * inA * pulse * settle * late}>
      <defs>
        <radialGradient id={`${id}-g`} cx={cx} cy={cy} r={Lmax} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="0.15" stopColor={`rgb(${g})`} stopOpacity={0.4} />
          <stop offset="0.55" stopColor={`rgb(${g})`} stopOpacity={0.1} />
          <stop offset="1" stopColor={`rgb(${g})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {Array.from({length: N}, (_, i) => {
        const r1 = rand(p.seed * 4.1 + i * 2.7);
        const a = (i / N) * Math.PI * 2 + rot;
        const hw = 0.035 + 0.045 * r1;
        const L = reach(a) * (1.4 + 0.9 * r1) * p.intensity * (0.7 + 0.3 * inA);
        return (
          <polygon key={i} fill={`url(#${id}-g)`}
            points={`${cx},${cy} ${cx + Math.cos(a - hw) * L},${cy + Math.sin(a - hw) * L} ${cx + Math.cos(a + hw) * L},${cy + Math.sin(a + hw) * L}`} />
        );
      })}
      <ellipse cx={cx} cy={cy} rx={w * 0.55 + 40} ry={h * 0.55 + 40} fill={`url(#${id}-g)`} opacity={0.6} />
    </Svg>
  );
};

export const NoAccent: React.FC<AccentProps> = () => null;
