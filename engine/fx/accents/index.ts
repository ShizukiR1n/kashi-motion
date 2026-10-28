// 主词点缀效果目录。导演按编排规则给每个镜头挑一种；渲染器按 kind 取出组件绘制。
import type React from 'react';
import {Burst, Feathers, HaloRings, Ink, NoAccent, Rays, Shards, Streak, Swirl, Trail} from './Accents';

export type AccentKind = 'swirl' | 'burst' | 'streak' | 'halo' | 'feathers' | 'shards' | 'ink' | 'trail' | 'rays' | 'none';

export type AccentProps = {
  box: {x: number; y: number; w: number; h: number}; // 主词外框（画面坐标，左上角 + 宽高）
  at: number; // 主词出现的时间（秒）
  end: number; // 镜头结束时间（秒），效果在此之前结束或淡出
  seed: number;
  intensity: number; // 0.5..1.5：尺寸、亮度、数量倍数（副歌更高）
  vertical: boolean; // 主词竖排（外框瘦高）
  colors: {accent: string; glow: string /* 'r,g,b' */; particles: [number, number, number][]};
};

// weight：轻重等级，供编排规则分配（主歌用轻的、副歌和高潮用重的）
// 绘制层级：ink、rays 是"背后"的效果，建议画在文字下面；其余画在文字下面或上面都可以
export const ACCENTS: Record<AccentKind, {C: React.FC<AccentProps>; weight: 'none' | 'light' | 'medium' | 'heavy'; label: string}> = {
  swirl: {C: Swirl, weight: 'heavy', label: '粒子缠绕'},
  burst: {C: Burst, weight: 'medium', label: '粒子爆散'},
  streak: {C: Streak, weight: 'light', label: '光带扫过'},
  halo: {C: HaloRings, weight: 'medium', label: '光环扩散'},
  feathers: {C: Feathers, weight: 'medium', label: '羽毛迸散'},
  shards: {C: Shards, weight: 'heavy', label: '碎片飞散'},
  ink: {C: Ink, weight: 'light', label: '墨晕晕开'},
  trail: {C: Trail, weight: 'light', label: '星迹绕框'},
  rays: {C: Rays, weight: 'heavy', label: '放射光'},
  none: {C: NoAccent, weight: 'none', label: '留白'},
};

export const ACCENT_KINDS = Object.keys(ACCENTS) as AccentKind[];
