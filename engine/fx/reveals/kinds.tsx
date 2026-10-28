// 逐字浮现的四种方式 + 风吹散粒子。全部只由当前帧决定（无状态），可乱序渲染。
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {rand} from '../../lib';
import {fbm1, hashId} from '../noise';
import {
  clamp, DotCanvas, easeInOutSine, easeOutCubic, easeOutQuart, exitFade, Glyph, glyphPoints, Pt, smooth, useT,
} from './common';
import type {CharSlot, RevealProps} from './types';

// =====================================================================
// 1. rise：参考视频里的基础浮现 —— 轻微上浮 + 由虚到实 + 0.92→1，约 0.35 秒，无回弹
// =====================================================================
export const Rise: React.FC<RevealProps> = ({chars, end, colors}) => {
  const t = useT();
  const out = exitFade(t, end);
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {chars.map((c, i) => {
        const e = easeOutCubic(clamp((t - (c.t - 0.12)) / 0.38));
        if (e <= 0) return null;
        const g = c.emph ? 1 : 0.75;
        return (
          <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={g * (0.6 + 0.4 * e)} ca={0.6 + (1 - e) * 3}
            style={{opacity: e * out, transform: `translateY(${(1 - e) * 16}px) scale(${0.92 + 0.08 * e})`,
              filter: e < 0.98 ? `blur(${(1 - e) * 6}px)` : undefined}} />
        );
      })}
    </AbsoluteFill>
  );
};

// =====================================================================
// 2. water：从水中浮现 —— 字从水线下 0.6em 慢慢升起，穿过柔和水线；
//    水波折射扭曲逐渐平息、由虚到实，水线上有倒影和扩散的涟漪圈
// =====================================================================
const RIPPLE_DUR = 0.75;
const WaterChar: React.FC<{c: CharSlot; i: number; id: string; t: number; out: number; colors: RevealProps['colors']; vertical: boolean; last: boolean}> = ({c, i, id, t, out, colors, vertical, last}) => {
  const frame = useCurrentFrame();
  const t0 = c.t - 0.38; // 从这里开始上浮，大约在 c.t + 0.35 时完全清晰
  const p = clamp((t - t0) / RIPPLE_DUR);
  if (p <= 0) return null;
  const e = easeOutQuart(p);
  const s = c.size;
  const waterY = c.y + s * 0.5; // 水线：字的下沿
  const rise = (1 - e) * s * 0.6;
  const amt = 18 * Math.pow(1 - p, 1.6); // 折射扭曲强度：从 18px 衰减到 0
  const fid = `wv-${hashId(`${id}-${i}`)}`;
  const on = amt > 0.4;
  const seed = Math.floor(frame / 2) % 89;
  // 水面以下的部分：只露出一点点、并且更暗更模糊（像在水里）
  const above = clamp((waterY - (c.y + rise - s * 0.5)) / s); // 字有多少比例已经出水
  const maskStop = clamp(above, 0, 1) * 100;
  // 倒影：出水后逐渐出现、再淡掉
  const refl = vertical && !last ? 0 : smooth(0.3, 0.7, p) * (1 - smooth(1.2, 2.4, t - c.t)) * 0.28;
  // 涟漪圈：在 c.t 附近从字中心扩散
  const rp = clamp((t - (c.t - 0.1)) / 1.1);
  return (
    <>
      {/* 涟漪：水线上扩散的扁椭圆，两圈 */}
      {rp > 0 && rp < 1 && (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}} width={1} height={1}>
          {[0, 0.22].map((d, k) => {
            const q = clamp(rp - d);
            if (q <= 0) return null;
            const rx = s * (0.25 + (vertical ? 0.45 : 0.75) * easeOutCubic(q));
            return <ellipse key={k} cx={c.x} cy={waterY} rx={rx} ry={rx * 0.14} fill="none"
              stroke={`rgba(${colors.glow},${0.55 * (1 - q) * out})`} strokeWidth={1.4 * (1 - q) + 0.4} />;
          })}
        </svg>
      )}
      {/* 水线：一道柔和的亮线，字浮出时最亮 */}
      <div style={{position: 'absolute', left: c.x - s * 0.75, top: waterY - 1, width: s * 1.5, height: 2,
        background: `linear-gradient(90deg, transparent, rgba(${colors.glow},${0.45 * (1 - e) * out}), transparent)`}} />
      {/* 字本体：上浮 + 折射扭曲 + 由虚到实；水下部分用遮罩隐去 */}
      <div style={{position: 'absolute', inset: 0, filter: on ? `url(#${fid})` : undefined}}>
        {on && (
          <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'hidden'}} aria-hidden>
            <defs>
              <filter id={fid} x={c.x - s} y={c.y - s} width={s * 2} height={s * 2} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency={`${0.006 + 0.004 * Math.sin(t * 2)} ${0.06}`} numOctaves={2} seed={seed} result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale={amt} xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>
        )}
        <Glyph c={c} color={colors.text} glow={colors.glow} g={(c.emph ? 1 : 0.75) * (0.4 + 0.6 * e)} ca={0.5 + (1 - e) * 2}
          style={{opacity: Math.min(1, e * 1.4) * out, transform: `translateY(${rise}px)`,
            filter: e < 0.97 ? `blur(${(1 - e) * 7}px)` : undefined,
            WebkitMaskImage: `linear-gradient(180deg, black ${Math.max(0, maskStop - 12)}%, rgba(0,0,0,0.25) ${maskStop}%, transparent ${Math.min(100, maskStop + 18)}%)`}} />
      </div>
      {/* 倒影：上下翻转、横向轻微波动 */}
      {refl > 0.01 && (
        <Glyph c={{...c, y: waterY + s * 0.5}} color={colors.text} glow={colors.glow} g={0.3} ca={0}
          style={{opacity: refl * out, transform: `scaleY(-1) translateX(${Math.sin(t * 6 + i) * 2}px)`, filter: 'blur(2.5px)',
            WebkitMaskImage: 'linear-gradient(0deg, transparent 10%, black 100%)'}} />
      )}
    </>
  );
};

export const Water: React.FC<RevealProps> = ({id, chars, end, colors, vertical}) => {
  const t = useT();
  const out = exitFade(t, end);
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {chars.map((c, i) => <WaterChar key={i} c={c} i={i} id={id} t={t} out={out} colors={colors} vertical={vertical} last={i === chars.length - 1} />)}
    </AbsoluteFill>
  );
};

// =====================================================================
// 3. cursor：发光光标沿阅读方向移动，速度跟着演唱节奏；字在光标身后显出
// =====================================================================
const cursorAt = (chars: CharSlot[], vertical: boolean, t: number) => {
  // 每个字的"到达点"：字的前沿稍后（横排在字右侧、直书在字下方）
  const lead = (c: CharSlot) => (vertical ? {x: c.x, y: c.y + c.size * 0.55} : {x: c.x + c.size * 0.5, y: c.y});
  const first = chars[0];
  const start = vertical ? {x: first.x, y: first.y - first.size * 0.6} : {x: first.x - first.size * 0.6, y: first.y};
  const pts = [{...start, t: first.t - 0.28}, ...chars.map((c) => ({...lead(c), t: c.t + 0.08}))];
  if (t <= pts[0].t) return {...pts[0], k: 0};
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t <= b.t) {
      const q = easeInOutSine(clamp((t - a.t) / Math.max(0.01, b.t - a.t)));
      return {x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, k: i + q};
    }
  }
  const last = pts[pts.length - 1];
  return {x: last.x, y: last.y, k: pts.length - 1};
};

export const Cursor: React.FC<RevealProps> = ({chars, vertical, end, colors, seed}) => {
  const t = useT();
  const out = exitFade(t, end);
  if (out <= 0 || !chars.length) return null;
  const cur = cursorAt(chars, vertical, t);
  const last = chars[chars.length - 1];
  const curFade = (smooth(chars[0].t - 0.4, chars[0].t - 0.2, t)) * (1 - smooth(last.t + 0.15, last.t + 0.6, t));
  const s = chars[0].size;
  // 光标前一小段时间的位置 → 尾迹
  const trail = Array.from({length: 7}, (_, k) => cursorAt(chars, vertical, t - (k + 1) * 0.035));
  // 光标掉落的火花：每 0.05 秒生成一颗，存活 0.5 秒
  const sparks: Pt[] = [];
  const span0 = chars[0].t - 0.3;
  const span1 = last.t + 0.2;
  for (let k = Math.floor((t - 0.5 - span0) / 0.05); k <= Math.floor((t - span0) / 0.05); k++) {
    if (k < 0) continue;
    const bt = span0 + k * 0.05;
    if (bt > span1 || bt > t) continue;
    const age = t - bt;
    if (age > 0.5) continue;
    const at = cursorAt(chars, vertical, bt);
    const r1 = rand(seed * 31 + k * 3.7);
    const r2 = rand(seed * 17 + k * 5.3);
    const col = colors.particles[Math.floor(r1 * colors.particles.length)] ?? [255, 255, 255];
    const back = vertical ? {x: (r1 - 0.5) * 40, y: -60} : {x: -60, y: (r1 - 0.5) * 40};
    sparks.push({x: at.x + back.x * age + (r2 - 0.5) * s * 0.5, y: at.y + back.y * age + 30 * age * age + (r2 - 0.5) * s * 0.3,
      r: 1.2 + r2 * 1.8, a: (1 - age / 0.5) * 0.9 * curFade, c: col});
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {chars.map((c, i) => {
        // 光标经过这个字的进度（沿阅读方向）
        const pos = vertical ? (cur.y - (c.y - c.size / 2)) / c.size : (cur.x - (c.x - c.size * 0.7)) / (c.size * 1.4);
        const f = clamp(pos);
        if (f <= 0) return null;
        const flash = 1 - smooth(0, 0.4, t - c.t); // 刚显出时的亮边
        const dir = vertical ? '180deg' : '90deg';
        return (
          <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={(c.emph ? 1 : 0.75) + flash * 0.6} ca={0.8}
            style={{opacity: out, filter: flash > 0.05 ? `brightness(${1 + flash * 0.5})` : undefined,
              WebkitMaskImage: f >= 1 ? undefined : `linear-gradient(${dir}, black ${f * 100 - 14}%, transparent ${f * 100 + 4}%)`}} />
        );
      })}
      {curFade > 0.01 && (
        <>
          {/* 尾迹 */}
          {trail.map((p, k) => (
            <div key={k} style={{position: 'absolute', left: p.x - 3, top: p.y - 3, width: 6, height: 6, borderRadius: 6,
              background: `rgba(${colors.glow},${(0.35 - k * 0.045) * curFade})`, boxShadow: `0 0 10px rgba(${colors.glow},${0.4 * curFade})`}} />
          ))}
          {/* 光标本体：一根发光细条 + 中心光点 */}
          <div style={{position: 'absolute', left: cur.x - (vertical ? s * 0.55 : 2), top: cur.y - (vertical ? 2 : s * 0.55),
            width: vertical ? s * 1.1 : 4, height: vertical ? 4 : s * 1.1, borderRadius: 4, opacity: curFade,
            background: `linear-gradient(${vertical ? 90 : 180}deg, transparent, rgba(255,255,255,0.95), transparent)`,
            boxShadow: `0 0 14px 3px rgba(${colors.glow},0.75), 0 0 40px 8px rgba(${colors.glow},0.3)`}} />
          <div style={{position: 'absolute', left: cur.x - 7, top: cur.y - 7, width: 14, height: 14, borderRadius: 14, opacity: curFade,
            background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.6) 35%, transparent 70%)'}} />
        </>
      )}
      <DotCanvas draw={() => sparks} />
    </AbsoluteFill>
  );
};

// =====================================================================
// 4. dust：字快速柔和地出现；镜头末尾 0.9 秒内从一侧开始碎成发光尘埃，向上飘散
// =====================================================================
const CRUMBLE = 0.9;
export const Dust: React.FC<RevealProps> = ({chars, vertical, end, colors, seed, intensity}) => {
  const t = useT();
  if (!chars.length || t > end + 1.6) return null;
  const c0 = end - CRUMBLE;
  // 每个字开始碎裂的时间：从第一个字那一侧扫到最后一个字
  const startOf = (i: number) => c0 + (chars.length > 1 ? i / (chars.length - 1) : 0) * 0.45;
  const draw = (tt: number): Pt[] => {
    const pts: Pt[] = [];
    chars.forEach((c, i) => {
      const cs = startOf(i);
      if (tt < cs) return;
      const gp = glyphPoints(c.ch, c.size, Math.round(150 * intensity));
      gp.forEach(([px, py], k) => {
        const r1 = rand(seed * 13 + i * 101 + k * 1.7);
        const r2 = rand(seed * 29 + i * 53 + k * 2.3);
        // 沿扫过方向晚一点出发：越靠后的像素越晚
        const along = vertical ? (py / c.size + 0.5) : (px / (c.size * 1.4) + 0.5);
        const born = cs + along * 0.3 + r1 * 0.12;
        const age = tt - born;
        if (age < 0 || age > 1.5) return;
        const sway = fbm1(age * 1.6 + r1 * 10, seed + i) * 26;
        const col = colors.particles[Math.floor(r2 * colors.particles.length)] ?? [255, 255, 255];
        pts.push({
          x: c.x + px + sway + (r2 - 0.5) * 30 * age,
          y: c.y + py - (40 + 110 * r1) * age - 35 * age * age,
          r: 0.9 + r2 * 1.6,
          a: (1 - age / 1.5) * 0.85,
          c: col,
        });
      });
    });
    return pts;
  };
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {chars.map((c, i) => {
        const e = easeOutCubic(clamp((t - (c.t - 0.1)) / 0.25));
        if (e <= 0) return null;
        const cs = startOf(i);
        const gone = smooth(cs, cs + 0.45, t); // 碎掉的比例
        if (gone >= 1) return null;
        const dir = vertical ? '180deg' : '90deg';
        return (
          <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={c.emph ? 1 : 0.75} ca={0.8}
            style={{opacity: e, filter: e < 0.98 ? `blur(${(1 - e) * 4}px)` : undefined,
              WebkitMaskImage: gone > 0 ? `linear-gradient(${dir}, transparent ${gone * 120 - 20}%, black ${gone * 120}%)` : undefined}} />
        );
      })}
      <DotCanvas draw={draw} />
    </AbsoluteFill>
  );
};

// =====================================================================
// 5. WindScatter：整句完成后，粒子从句尾一侧被风吹散，横向流走（不绕圈）
// =====================================================================
export const WindScatter: React.FC<RevealProps & {from?: number; dir?: number}> = ({chars, end, colors, seed, intensity, from, dir = 1}) => {
  const t = useT();
  const f0 = from ?? end - 1.0;
  if (!chars.length || t < f0 || t > f0 + 2.4) return null;
  // 句尾一侧先被吹：dir=+1 时，最右边的字先开始
  const xs = chars.map((c) => c.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = Math.max(1, maxX - minX);
  const draw = (tt: number): Pt[] => {
    const pts: Pt[] = [];
    chars.forEach((c, i) => {
      const lead = dir > 0 ? (maxX - c.x) / spanX : (c.x - minX) / spanX; // 0 = 最先被吹到
      const gp = glyphPoints(c.ch, c.size, Math.round(110 * intensity));
      gp.forEach(([px, py], k) => {
        const r1 = rand(seed * 41 + i * 97 + k * 1.3);
        const r2 = rand(seed * 7 + i * 61 + k * 3.1);
        const born = f0 + lead * 0.5 + r1 * 0.35;
        const age = tt - born;
        if (age < 0 || age > 1.6) return;
        const speed = 160 + 320 * r2;
        const gust = fbm1(tt * 0.9 + r1 * 6, seed + 3) * 0.5 + 1; // 阵风
        const col = colors.particles[Math.floor(r1 * colors.particles.length)] ?? [255, 255, 255];
        pts.push({
          x: c.x + px + dir * (speed * age + 140 * age * age) * gust,
          y: c.y + py + fbm1(age * 2.2 + r2 * 9, seed + i) * 40 * age - 25 * age,
          r: 0.8 + r2 * 1.5,
          a: Math.min(1, age * 6) * (1 - age / 1.6) * 0.8,
          c: col,
        });
      });
    });
    return pts;
  };
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <DotCanvas draw={draw} />
    </AbsoluteFill>
  );
};

// 风吹散时字本体的淡出（给导演用：把它乘到字的透明度上，字会随粒子一起散去）
export const windFadeAt = (c: CharSlot, chars: CharSlot[], t: number, from: number, dir = 1) => {
  const xs = chars.map((q) => q.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const lead = dir > 0 ? (maxX - c.x) / Math.max(1, maxX - minX) : (c.x - minX) / Math.max(1, maxX - minX);
  return 1 - smooth(from + lead * 0.5, from + lead * 0.5 + 0.5, t);
};
