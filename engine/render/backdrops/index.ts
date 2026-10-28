// 背景处理目录：编排器按镜头挑选 kind，渲染器按 BACKDROPS[kind].C 渲染
import React from 'react';
import type {BackdropProps} from './common';
import {Drift, Duotone, Frame, Mirror, Pan, Strips, Tilt, Void, ZoomBurst} from './kinds';

export type {BackdropProps, BackdropView} from './common';
export type BackdropKind = 'drift' | 'pan' | 'tilt' | 'mirror' | 'void' | 'zoomburst' | 'duotone' | 'frame' | 'strips';

export const BACKDROPS: Record<BackdropKind, {C: React.FC<BackdropProps>; weight: 'calm' | 'medium' | 'intense'; label: string}> = {
  drift: {C: Drift, weight: 'calm', label: '漂移'},
  pan: {C: Pan, weight: 'calm', label: '局部游走'},
  tilt: {C: Tilt, weight: 'medium', label: '透视倾斜'},
  mirror: {C: Mirror, weight: 'intense', label: '镜像万花筒'},
  void: {C: Void, weight: 'calm', label: '留黑'},
  zoomburst: {C: ZoomBurst, weight: 'intense', label: '变焦冲击'},
  duotone: {C: Duotone, weight: 'medium', label: '双色调'},
  frame: {C: Frame, weight: 'medium', label: '画中画'},
  strips: {C: Strips, weight: 'intense', label: '竖条错动'},
};

export const BACKDROP_KINDS = Object.keys(BACKDROPS) as BackdropKind[];
