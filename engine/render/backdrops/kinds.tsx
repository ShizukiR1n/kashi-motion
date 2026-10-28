// 9 种背景处理。全部是 (帧, seed) 的纯函数，可乱序渲染。
import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {FPS} from '../../lib';
import {BackdropProps, BlurFill, brightOf, r, shotProg, ViewImg} from './common';

const useT = () => useCurrentFrame() / FPS;

// 1) drift：原来的效果——强模糊铺底 + 取景图缓慢漂移 + 底鼓推亮
export const Drift: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const s = 1.06 + 0.03 * Math.sin(t * 0.2) + 0.022 * p.kick;
  const b = brightOf(p);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <BlurFill p={p} bright={0.42 * b} scale={1.15 + 0.02 * p.kick} />
      <ViewImg p={p} transform={`translate(${Math.sin(t * 0.13) * 24}px,${Math.cos(t * 0.11) * 30}px) scale(${s})`}
        filter={`blur(${p.blur * (p.view === 'full' ? 0.5 : 1)}px) brightness(${b * (p.view === 'full' ? 0.85 : 1)})`} />
    </AbsoluteFill>
  );
};

// 2) pan：在图的不同局部之间缓慢平移推拉（每句一个不同的细节）
export const Pan: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const k = shotProg(t, p.t0, p.t1);
  const zin = r(p.seed, 1) > 0.5;
  const z0 = zin ? 1.6 : 1.95;
  const z1 = zin ? 1.95 : 1.6;
  const z = z0 + (z1 - z0) * k;
  const Smin = Math.max(p.w, p.h) * 1.6;
  const S = Math.max(p.w, p.h) * z;
  // 取景中心的可选范围（按最小缩放算，保证画面始终被图铺满，且避开上下边缘印的文字）
  const uLo = p.w / 2 / Smin;
  const uHi = 1 - uLo;
  const vLo = 0.12 + p.h / 2 / Smin;
  const vHi = 0.84 - p.h / 2 / Smin;
  const [va, vb] = p.view === 'light' ? [vLo, Math.max(vLo, 0.5)] : p.view === 'dark' ? [Math.min(vHi, 0.5), vHi] : [0.42, 0.58];
  const [ua, ub] = p.view === 'full' ? [0.4, 0.6] : [uLo, uHi];
  const pick = (a: number, b: number, k2: number) => a + (b - a) * r(p.seed, k2);
  const u = pick(ua, ub, 2) + (pick(ua, ub, 3) - pick(ua, ub, 2)) * k;
  const v = pick(va, vb, 4) + (pick(va, vb, 5) - pick(va, vb, 4)) * k;
  const ox = u * S;
  const oy = v * S;
  const b = brightOf(p);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <Img src={p.src} style={{position: 'absolute', width: S, height: S, left: p.w / 2 - ox, top: p.h / 2 - oy, objectFit: 'cover',
        transformOrigin: `${ox}px ${oy}px`, transform: `rotate(${p.view === 'dark' ? 180 : 0}deg) scale(${1 + 0.02 * p.kick})`,
        filter: `blur(${p.blur * 0.6}px) brightness(${b * 0.92})`}} />
    </AbsoluteFill>
  );
};

// 3) tilt：透视倾斜 + 前后两层视差
export const Tilt: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const k = shotProg(t, p.t0, p.t1);
  const amp = 5 + 7 * p.energy;
  const dir = r(p.seed, 1) > 0.5 ? 1 : -1;
  const ry = dir * (-amp + 2 * amp * k);
  const rx = Math.sin(t * 0.7 + p.seed) * amp * 0.5;
  const b = brightOf(p);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden', perspective: 1500}}>
      <BlurFill p={p} bright={0.32 * b} />
      <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `rotateX(${rx}deg) rotateY(${ry}deg)`}}>
        {/* 后层：更大、更暗，离得远 */}
        <AbsoluteFill style={{transform: 'translateZ(-260px)'}}>
          <ViewImg p={p} zoom={1.25} opacity={0.4} filter={`blur(${p.blur + 6}px) brightness(${0.6 * b})`} />
        </AbsoluteFill>
        {/* 前层 */}
        <AbsoluteFill style={{transform: `translateZ(${40 + 30 * p.kick}px)`}}>
          <ViewImg p={p} zoom={0.92} filter={`blur(${p.blur * 0.5}px) brightness(${b * 0.95})`} />
        </AbsoluteFill>
        {/* 最前：细线框，视差最大 */}
        <AbsoluteFill style={{transform: 'translateZ(160px)'}}>
          <div style={{position: 'absolute', left: p.w * 0.12, top: p.h * 0.12, width: p.w * 0.76, height: p.h * 0.76,
            border: `1px solid ${p.accent}`, opacity: 0.35}} />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 4) mirror：左右（或四向）镜像的万花筒，内容缓慢旋转
export const Mirror: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const four = r(p.seed, 1) > 0.55;
  const dir = r(p.seed, 2) > 0.5 ? 1 : -1;
  const rot = (t - p.t0) * (3 + 6 * p.energy) * dir;
  const b = brightOf(p);
  const content = (
    <AbsoluteFill style={{transform: `rotate(${rot}deg) scale(${1.25 + 0.02 * p.kick})`}}>
      <ViewImg p={p} filter={`blur(${p.blur * 0.7}px) brightness(${b * 0.88})`} />
    </AbsoluteFill>
  );
  const quads: [number, number][] = four ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 1], [-1, 1]];
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <BlurFill p={p} bright={0.3 * b} />
      {quads.map(([sx, sy], i) => (
        <AbsoluteFill key={i} style={{transform: `scale(${sx},${sy})`}}>
          <AbsoluteFill style={{clipPath: four ? 'inset(0 50% 50% 0)' : 'inset(0 50% 0 0)'}}>{content}</AbsoluteFill>
        </AbsoluteFill>
      ))}
      {/* 镜像轴 */}
      <div style={{position: 'absolute', left: p.w / 2, top: 0, width: 1, height: p.h, background: p.accent, opacity: 0.25}} />
      {four && <div style={{position: 'absolute', top: p.h / 2, left: 0, height: 1, width: p.w, background: p.accent, opacity: 0.25}} />}
    </AbsoluteFill>
  );
};

// 5) void：几乎全黑的留白，只剩极淡的图影和一束缓慢移动的柔光，让歌词单独站出来
export const Void: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const cx = 0.5 + 0.18 * Math.sin(t * 0.25 + p.seed);
  const cy = 0.45 + 0.1 * Math.cos(t * 0.21 + p.seed);
  return (
    <AbsoluteFill style={{background: '#04050c', overflow: 'hidden'}}>
      <BlurFill p={p} radius={60} bright={0.6} opacity={0.24} rotate={p.view === 'dark' ? 180 : 0} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${p.w * 0.38}px ${p.h * 0.5}px at ${cx * 100}% ${cy * 100}%, ${p.accent}${Math.round((0.12 + 0.1 * p.kick) * 255).toString(16).padStart(2, '0')}, transparent 70%)`}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.75) 100%)'}} />
    </AbsoluteFill>
  );
};

// 6) zoomburst：放射状变焦——几层放大的半透明副本叠加，随底鼓向外冲
export const ZoomBurst: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const b = brightOf(p, 0.22);
  const push = 0.025 + 0.06 * p.kick * (0.5 + p.energy);
  const rot = Math.sin(t * 0.3 + p.seed) * 2;
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <BlurFill p={p} bright={0.35 * b} />
      <ViewImg p={p} transform={`rotate(${rot}deg) scale(${1.04 + 0.02 * p.kick})`} filter={`blur(${p.blur * 0.6}px) brightness(${b * 0.85})`} />
      {[1, 2, 3, 4].map((i) => (
        <ViewImg key={i} p={p} mix="screen" opacity={0.22 / i}
          transform={`rotate(${rot}deg) scale(${1.04 + i * push})`} filter={`brightness(${b * 0.7})`} />
      ))}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.08 * p.kick}), transparent 55%)`}} />
    </AbsoluteFill>
  );
};

// 7) duotone：双色调（暗部 = 底色，亮部 = 强调色）
export const Duotone: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const k = shotProg(t, p.t0, p.t1);
  const b = brightOf(p, 0.2);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{isolation: 'isolate'}}>
        <ViewImg p={p} transform={`scale(${1.04 + 0.06 * k + 0.02 * p.kick})`}
          filter={`grayscale(1) contrast(1.3) brightness(${b * 1.05}) blur(${p.blur * 0.4}px)`} />
        <AbsoluteFill style={{background: p.accent, mixBlendMode: 'multiply'}} />
        <AbsoluteFill style={{background: p.bg, mixBlendMode: 'lighten'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 8) frame：画中画——图放在一个内嵌细线框里，外面是压暗的模糊版
export const Frame: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const k = shotProg(t, p.t0, p.t1);
  const side = r(p.seed, 1) - 0.5; // 框的左右位置
  const fw = p.wide ? p.w * 0.42 : p.w * 0.78;
  const fh = p.wide ? p.h * 0.66 : p.h * 0.42;
  const fx = (p.w - fw) / 2 + side * (p.wide ? p.w * 0.3 : 0);
  const fy = (p.h - fh) / 2 + (p.wide ? 0 : side * p.h * 0.2);
  const s = 1 + 0.01 * p.kick;
  // 框内：图放大到框长边的 2 倍，焦点放在框中心，绕焦点旋转（dark 转 180°）；可见范围始终避开素材上下边缘的文字
  const S = Math.max(fw, fh) * (2.0 + 0.25 * k);
  const fu = 0.5 + (r(p.seed, 2) - 0.5) * 0.16;
  const fv = p.view === 'light' ? 0.38 : p.view === 'dark' ? 0.62 : 0.5;
  const b = brightOf(p);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <BlurFill p={p} bright={0.28 * b} />
      <div style={{position: 'absolute', left: fx, top: fy, width: fw, height: fh, overflow: 'hidden', transform: `scale(${s})`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)'}}>
        <Img src={p.src} style={{position: 'absolute', width: S, height: S, left: fw / 2 - fu * S, top: fh / 2 - fv * S, objectFit: 'cover',
          transformOrigin: `${fu * S}px ${fv * S}px`, transform: `rotate(${p.view === 'dark' ? 180 : 0}deg)`,
          filter: `brightness(${b * 0.95})`}} />
      </div>
      {/* 双线框 + 角标 */}
      <div style={{position: 'absolute', left: fx - 10, top: fy - 10, width: fw + 20, height: fh + 20, border: `1px solid ${p.accent}`, opacity: 0.55}} />
      <div style={{position: 'absolute', left: fx - 22, top: fy - 22, width: fw + 44, height: fh + 44, border: '1px solid rgba(255,255,255,0.18)'}} />
      {[[fx - 22, fy - 22], [fx + fw + 22, fy - 22], [fx - 22, fy + fh + 22], [fx + fw + 22, fy + fh + 22]].map(([x, y], i) => (
        <div key={i} style={{position: 'absolute', left: x - 6, top: y - 6, width: 12, height: 12, borderLeft: `2px solid ${p.accent}`, borderTop: `2px solid ${p.accent}`,
          transform: `rotate(${[0, 90, 270, 180][i]}deg)`}} />
      ))}
    </AbsoluteFill>
  );
};

// 9) strips：图被切成竖条，各条以略不同的速度上下错动
export const Strips: React.FC<BackdropProps> = (p) => {
  const t = useT();
  const k = shotProg(t, p.t0, p.t1);
  const n = 7 + Math.floor(r(p.seed, 1) * 4);
  const sw = p.w / n;
  const b = brightOf(p);
  return (
    <AbsoluteFill style={{background: p.bg, overflow: 'hidden'}}>
      <BlurFill p={p} bright={0.25 * b} />
      {Array.from({length: n}, (_, i) => {
        const amp = (r(p.seed, 10 + i) - 0.5) * 140 * (0.5 + p.energy);
        const dy = amp * (1 - 2 * k) + Math.sin(t * 0.6 + i) * 10 + (i % 2 === 0 ? 1 : -1) * 14 * p.kick;
        return (
          <div key={i} style={{position: 'absolute', left: i * sw, top: 0, width: sw - 4, height: p.h, overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: -i * sw, top: 0, width: p.w, height: p.h, transform: `translateY(${dy}px)`}}>
              <ViewImg p={p} zoom={1.12} filter={`blur(${p.blur * 0.5}px) brightness(${b * (0.8 + 0.2 * r(p.seed, 30 + i))})`} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
