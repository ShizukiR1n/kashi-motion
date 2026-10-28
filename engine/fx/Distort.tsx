import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS} from '../lib';
import {hashId} from './noise';

/**
 * 扭曲包装：SVG feTurbulence + feDisplacementMap。
 * amount：位移幅度（像素），0 时完全不挂滤镜（零开销）。
 * id：每个实例要唯一（同一帧里出现多个 Distort 时必须不同）。
 * 滤镜定义和使用者放在同一个子树里，svg 用 1×1 的可见尺寸（0×0 在无头渲染里会失效）。
 */
export const Distort: React.FC<{
  id: string;
  amount: number;
  freq?: [number, number]; // 噪声频率（横、纵）
  speed?: number; // 噪声流动速度
  fill?: boolean; // true：包装成铺满的 AbsoluteFill；false：普通 div
  children: React.ReactNode;
}> = ({id, amount, freq = [0.012, 0.045], speed = 1, fill = true, children}) => {
  const frame = useCurrentFrame();
  const fid = `dst-${hashId(id)}`;
  const on = amount > 0.3;
  const t = frame / FPS;
  // 让噪声随时间流动：微调频率 + 每 2 帧换一次 seed，避免每帧都跳
  const fx = freq[0] * (1 + 0.15 * Math.sin(t * 3 * speed));
  const fy = freq[1] * (1 + 0.15 * Math.cos(t * 2.3 * speed));
  const seed = Math.floor(frame / 2) % 97;
  const Wrap = fill ? AbsoluteFill : 'div';
  return (
    <Wrap style={{filter: on ? `url(#${fid})` : undefined}}>
      {on && (
        <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'hidden', pointerEvents: 'none'}} aria-hidden>
          <defs>
            <filter id={fid} x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={`${fx} ${fy}`} numOctaves={2} seed={seed} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={amount} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </Wrap>
  );
};

/**
 * 方向模糊：只沿一个轴模糊（feGaussianBlur 的 stdDeviation 可以分横纵）。
 * dx / dy：两个方向的模糊强度（像素）。
 */
export const DirBlur: React.FC<{id: string; dx: number; dy?: number; fill?: boolean; children: React.ReactNode}> = ({
  id, dx, dy = 0, fill = true, children,
}) => {
  const fid = `dbl-${hashId(id)}`;
  const on = Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3;
  const Wrap = fill ? AbsoluteFill : 'div';
  return (
    <Wrap style={{filter: on ? `url(#${fid})` : undefined}}>
      {on && (
        <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'hidden', pointerEvents: 'none'}} aria-hidden>
          <defs>
            <filter id={fid} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${Math.abs(dx)} ${Math.abs(dy)}`} />
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </Wrap>
  );
};

/** 入场扭曲幅度：at 秒时最强，指数衰减；peak 为峰值像素 */
export const entryDistort = (frame: number, at: number, peak = 60, decay = 5) => {
  const dt = frame / FPS - at;
  if (dt < 0) return 0;
  const a = peak * Math.exp(-dt * decay);
  return a < 0.3 ? 0 : a;
};
