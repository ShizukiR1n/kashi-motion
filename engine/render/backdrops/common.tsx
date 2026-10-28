// 背景处理共用：取景几何、低分辨率预模糊铺底、时间进度
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {rand} from '../../lib';

export type BackdropView = 'light' | 'dark' | 'full';
export type BackdropProps = {
  src: string; // 已经是 staticFile() 后的图片地址（实际多为方形专辑封面，任意比例也能用）
  w: number; h: number; wide: boolean; // 画布尺寸
  view: BackdropView; // 本段落看图的哪一部分：light 上半 / dark 旋转 180° 看下半 / full 中间圆形全图
  t0: number; t1: number; // 本镜头起止（秒），运动按这个区间规划
  seed: number;
  energy: number; // 段落能量 0..1，越高运动和对比越强
  kick: number; // 当前底鼓包络 0..~1.5
  blur: number; dim: number; // 风格里的基础模糊（px）和压暗（0..1）
  bg: string; accent: string; // 配色
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (p: number) => p * p * (3 - 2 * p);
// 镜头内进度 0..1（平滑）
export const shotProg = (t: number, t0: number, t1: number) => smooth(clamp01((t - t0) / Math.max(0.3, t1 - t0)));
export const r = (seed: number, k: number) => rand(seed * 17.31 + k * 3.7);

// 取景框：和原 Background 一致。light/dark 方图放大后上下各裁掉一截（避开素材上下边缘印的文字），
// dark 再旋转 180°；full 只保留中间圆形主体。
export const viewBox = (p: Pick<BackdropProps, 'w' | 'h' | 'wide' | 'view'>, zoom = 1): React.CSSProperties => {
  if (p.view === 'full') {
    const side = Math.min(p.w, p.h) * 1.24 * zoom;
    return {position: 'absolute', width: side, height: side, left: (p.w - side) / 2, top: (p.h - side) / 2};
  }
  const side0 = Math.max(p.w, p.h) * (p.wide ? 1.0 : 1.15);
  const cy = -side0 * 0.17 + side0 / 2; // 原取景框的中心（顶边在 -0.17·边长）
  const side = side0 * zoom;
  return {position: 'absolute', width: side, height: side, left: (p.w - side) / 2, top: cy - side / 2};
};
// full 视图的圆形遮罩
export const FULL_MASK = 'radial-gradient(circle closest-side at 50% 50%, black 68%, transparent 79%)';

// 按取景显示图片（可叠加额外 transform / filter）
export const ViewImg: React.FC<{p: BackdropProps; transform?: string; filter?: string; opacity?: number; zoom?: number; mix?: React.CSSProperties['mixBlendMode']}> = ({
  p, transform = '', filter, opacity = 1, zoom = 1, mix,
}) => (
  <Img src={p.src} style={{...viewBox(p, zoom), objectFit: 'cover', opacity, mixBlendMode: mix,
    transform: `${transform} rotate(${p.view === 'dark' ? 180 : 0}deg)`, filter,
    WebkitMaskImage: p.view === 'full' ? FULL_MASK : undefined}} />
);

// 低分辨率预模糊铺底：先在 1/8 尺寸上做小半径模糊，再整体放大回来，效果接近大半径模糊但便宜得多
export const BlurFill: React.FC<{p: BackdropProps; radius?: number; bright?: number; scale?: number; opacity?: number; rotate?: number}> = ({
  p, radius = 30, bright = 0.42, scale = 1.15, opacity = 1, rotate = 0,
}) => {
  const k = 8;
  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: p.w / k, height: p.h / k, transformOrigin: '0 0',
        transform: `scale(${k})`}}>
        <Img src={p.src} style={{width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${scale}) rotate(${rotate}deg)`, filter: `blur(${radius / k}px) brightness(${bright})`}} />
      </div>
    </AbsoluteFill>
  );
};

// 统一的亮度（压暗 + 底鼓提亮）
export const brightOf = (p: BackdropProps, k = 0.16) => (1 - p.dim) * (1 + k * p.kick);
