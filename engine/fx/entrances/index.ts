// 文字入场目录：编排器按 kind 轮换使用，避免一分钟里反复看到同一种入场。
// 所有 kind 的 props 都是 EntranceProps（= Word 的 props + 唯一 id），横排 / 日文直书 / 旋转竖排都支持。
import React from 'react';
import {FlickerIn, LetterDistort, Slam, SlideBlur} from '../Entrances';
import type {EntranceProps} from '../Entrances';
import {DecodeIn, DropIn, EchoIn, FocusIn, SpinIn, SplitIn, StrokeIn, TypeIn, WipeIn, ZoomIn} from './kinds';

export type {EntranceProps};
export type EntranceKind =
  | 'slam' | 'flicker' | 'slide' | 'letters'
  | 'type' | 'wipe' | 'focus' | 'zoom' | 'split' | 'drop' | 'spin' | 'stroke' | 'decode' | 'echo';

export const ENTRANCES: Record<EntranceKind, {C: React.FC<EntranceProps>; weight: 'light' | 'medium' | 'heavy'; label: string}> = {
  slam: {C: Slam, weight: 'heavy', label: '重砸'},
  flicker: {C: FlickerIn, weight: 'medium', label: '闪烁'},
  slide: {C: SlideBlur, weight: 'medium', label: '滑入模糊'},
  letters: {C: LetterDistort, weight: 'medium', label: '逐字扭曲'},
  type: {C: TypeIn, weight: 'light', label: '打字机'},
  wipe: {C: WipeIn, weight: 'light', label: '遮罩擦入'},
  focus: {C: FocusIn, weight: 'light', label: '对焦'},
  zoom: {C: ZoomIn, weight: 'heavy', label: '极小放大'},
  split: {C: SplitIn, weight: 'medium', label: '拆半合拢'},
  drop: {C: DropIn, weight: 'medium', label: '逐字落下'},
  spin: {C: SpinIn, weight: 'medium', label: '翻转'},
  stroke: {C: StrokeIn, weight: 'light', label: '描边填色'},
  decode: {C: DecodeIn, weight: 'heavy', label: '乱码解码'},
  echo: {C: EchoIn, weight: 'heavy', label: '残影收拢'},
};

export const ENTRANCE_KINDS = Object.keys(ENTRANCES) as EntranceKind[];

/** 分发器：编排器只需要传 kind */
export const EntranceX: React.FC<EntranceProps & {kind: EntranceKind}> = ({kind, ...p}) =>
  React.createElement((ENTRANCES[kind] ?? ENTRANCES.focus).C, p);
