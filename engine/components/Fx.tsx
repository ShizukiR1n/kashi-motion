import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FPS, H, inRange, rand, W} from '../lib';

// 背景：程序生成的模糊墨线图，缓慢呼吸漂移
export const Background: React.FC<{dx?: number; dy?: number}> = ({dx = 0, dy = 0}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = f / FPS;
  const s = 1.06 + 0.025 * Math.sin(t * 0.21);
  const x = Math.sin(t * 0.13) * 22 + dx;
  const y = Math.cos(t * 0.17) * 14 + dy;
  return (
    <AbsoluteFill style={{background: '#1a0d14', overflow: 'hidden'}}>
      <Img src={staticFile(width >= height ? 'bg_wide.jpg' : 'bg_tall.jpg')} style={{position: 'absolute', left: 0, top: 0, width, height, objectFit: 'cover',
        transform: `translate(${x}px,${y}px) scale(${s})`, filter: 'blur(3px) saturate(1.05)'}} />
      {/* 左侧品红光晕 */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${width * 0.38}px ${height * 0.4}px at 0px ${height * 0.36}px, rgba(255,60,130,0.28), transparent 70%)`}} />
    </AbsoluteFill>
  );
};

// 胶片颗粒
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.13}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <Img src={staticFile(`grain_${Math.floor(f / 2) % 8}.png`)}
      style={{position: 'absolute', left: 0, top: 0, width, height, mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}} />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 80% at 50% 50%, transparent 55%, rgba(10,0,6,0.55) 100%)', pointerEvents: 'none'}} />
);

// 全片常驻的角落界面元素
export const Hud: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity}}>
    <g stroke="rgba(255,255,255,0.75)" strokeWidth={1.2} fill="none">
      <line x1={58} y1={37} x2={78} y2={37} strokeWidth={2} />
      <line x1={58} y1={45} x2={58} y2={115} strokeOpacity={0.5} />
      <line x1={1096} y1={48} x2={1108} y2={48} /><line x1={1102} y1={42} x2={1102} y2={54} />
      <line x1={1100} y1={565} x2={1100} y2={680} strokeOpacity={0.5} />
      <line x1={995} y1={684} x2={1092} y2={684} strokeOpacity={0.5} />
      <line x1={1100} y1={674} x2={1100} y2={688} strokeWidth={2} />
    </g>
    <circle cx={58} cy={684} r={2.2} fill="rgba(255,255,255,0.8)" />
    <rect x={1143} y={68} width={4} height={4} fill="rgba(255,255,255,0.6)" transform="rotate(45 1145 70)" />
  </svg>
);

// 场景容器：只在 [from, to) 秒内渲染
export const Scene: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => {
  const f = useCurrentFrame();
  return inRange(f, from, to) ? <>{children}</> : null;
};

// 镜头：整组平移 / 缩放 / 旋转 / 失焦 / 透明度
export const Cam: React.FC<{tx?: number; ty?: number; s?: number; rot?: number; blur?: number; opacity?: number; children: React.ReactNode}> = ({
  tx = 0, ty = 0, s = 1, rot = 0, blur = 0, opacity = 1, children,
}) => (
  <AbsoluteFill style={{transform: `translate(${tx}px,${ty}px) scale(${s}) rotate(${rot}deg)`, transformOrigin: '50% 50%',
    filter: blur > 0.05 ? `blur(${blur}px)` : undefined, opacity}}>
    {children}
  </AbsoluteFill>
);

// 横向切片错位（glitch 退场）：把内容按水平条带复制多份并随机左右错开
export const Slices: React.FC<{active: boolean; amount?: number; bands?: number; seed?: number; children: React.ReactNode}> = ({
  active, amount = 40, bands = 9, seed = 1, children,
}) => {
  const f = useCurrentFrame();
  if (!active) return <>{children}</>;
  const step = Math.floor(f / 2);
  const cuts = [0, ...Array.from({length: bands - 1}, (_, i) => rand(seed * 13 + i * 3.1 + step * 0.7)).sort(), 1];
  return (
    <AbsoluteFill>
      {cuts.slice(0, -1).map((c, i) => {
        const off = (rand(seed * 7 + i * 11 + step * 3) - 0.5) * 2 * amount;
        return (
          <AbsoluteFill key={i} style={{clipPath: `inset(${c * 100}% 0 ${(1 - cuts[i + 1]) * 100}% 0)`, transform: `translateX(${off}px)`}}>
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// 纯色覆盖层（黑场、压暗）
export const Shade: React.FC<{opacity: number; color?: string}> = ({opacity, color = '#000'}) =>
  opacity > 0.001 ? <AbsoluteFill style={{background: color, opacity}} /> : null;
