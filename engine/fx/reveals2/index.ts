// 第二批逐字浮现（与 reveals/ 的 rise / water / cursor / dust 以及 strokes 都不同）
import type React from 'react';
import type {RevealProps} from '../reveals/types';
import {Kinds} from './kinds';

export type Reveal2Kind = 'shatter' | 'depth' | 'maskslide' | 'punch';

export const REVEALS2: Record<Reveal2Kind, {C: React.FC<RevealProps>; label: string}> = {
  shatter: {C: Kinds.Shatter, label: '碎片聚合'},
  depth: {C: Kinds.Depth, label: '纵深飞入'},
  maskslide: {C: Kinds.MaskSlide, label: '遮罩上滑+斜切'},
  // 注意：punch 在“屏幕坐标”里画大字，调用方不要再套镜头推拉变换
  punch: {C: Kinds.Punch, label: '单字特写快切'},
};

export const REVEAL2_KINDS = Object.keys(REVEALS2) as Reveal2Kind[];
