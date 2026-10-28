import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS} from '../lib';
import {fbm1} from './noise';

export type Hit = {t: number; strength: number};

export type CamState = {tx: number; ty: number; rot: number; s: number};

// 每次冲击的影响时长（秒）
const HIT_WINDOW = 1.4;

/**
 * 镜头状态：纯函数，只依赖时间。
 * - 冲击：快速放大（约 3–8%）后阻尼回弹，同时有阻尼抖动（位移 + 小角度旋转）
 * - 漂移：平滑噪声驱动的低幅度晃动
 */
export const camAt = (t: number, hits: Hit[], wiggle = 1): CamState => {
  let s = 1;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const dt = t - h.t;
    if (dt < 0 || dt > HIT_WINDOW) continue;
    const k = Math.max(0, Math.min(1.5, h.strength));
    const attack = Math.min(1, dt / 0.045); // 约 1–2 帧冲上去
    // 放大：阻尼弹簧（冲到峰值后回落并轻微过冲）
    s += k * 0.065 * attack * Math.exp(-dt * 7) * Math.cos(dt * 11);
    // 抖动：高频阻尼正弦，每次冲击相位不同
    const ph = i * 2.399;
    const shake = k * Math.exp(-dt * 8.5) * attack;
    tx += shake * 22 * Math.sin(dt * 47 + ph);
    ty += shake * 16 * Math.sin(dt * 41 + ph * 1.7);
    rot += shake * 1.1 * Math.sin(dt * 33 + ph * 0.6);
  }
  // 持续漂移
  tx += fbm1(t * 0.45, 1) * 14 * wiggle;
  ty += fbm1(t * 0.4, 2) * 18 * wiggle;
  rot += fbm1(t * 0.3, 3) * 0.6 * wiggle;
  s += fbm1(t * 0.25, 4) * 0.012 * wiggle;
  return {tx, ty, rot, s};
};

/** 镜头速度（像素/帧的近似量，含缩放和旋转换算），用来决定是否开运动模糊 */
export const camVelocity = (frame: number, hits: Hit[], wiggle = 1, extra?: (t: number) => Partial<CamState>) => {
  const a = combine(camAt(frame / FPS, hits, wiggle), extra?.(frame / FPS));
  const b = combine(camAt((frame - 1) / FPS, hits, wiggle), extra?.((frame - 1) / FPS));
  const dPos = Math.hypot(a.tx - b.tx, a.ty - b.ty);
  const dScale = Math.abs(a.s - b.s) * 1000; // 1% 缩放 ≈ 10px 边缘位移
  const dRot = Math.abs(a.rot - b.rot) * 15; // 1° ≈ 15px 边缘位移
  return dPos + dScale + dRot;
};

const combine = (c: CamState, e?: Partial<CamState>): CamState => ({
  tx: c.tx + (e?.tx ?? 0),
  ty: c.ty + (e?.ty ?? 0),
  rot: c.rot + (e?.rot ?? 0),
  s: c.s * (e?.s ?? 1),
});

/**
 * 镜头容器。
 * hits：冲击点（秒 + 力度 0..1.5）；wiggle：漂移幅度倍数；
 * extra：额外的镜头运动（比如甩镜头），按时间返回 {tx, ty, rot, s}
 */
export const CameraRig: React.FC<{
  hits: Hit[];
  wiggle?: number;
  extra?: (t: number) => Partial<CamState>;
  children: React.ReactNode;
}> = ({hits, wiggle = 1, extra, children}) => {
  const frame = useCurrentFrame();
  const c = combine(camAt(frame / FPS, hits, wiggle), extra?.(frame / FPS));
  return (
    <AbsoluteFill style={{transform: `translate(${c.tx}px,${c.ty}px) rotate(${c.rot}deg) scale(${c.s})`, transformOrigin: '50% 50%'}}>
      {children}
    </AbsoluteFill>
  );
};
