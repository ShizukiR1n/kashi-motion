// 逐字浮现效果库：导演排好每个字的位置和时间（CharSlot），这里决定"怎么出现"。
import type React from 'react';
import {Cursor, Dust, Rise, Water} from './kinds';
import type {RevealProps} from './types';

export type {CharSlot, RevealColors, RevealProps} from './types';
export {WindScatter, windFadeAt} from './kinds';
export {layoutLine, advanceOf, glyphPoints} from './common';

export type RevealKind = 'rise' | 'water' | 'cursor' | 'dust';

export const REVEALS: Record<RevealKind, {C: React.FC<RevealProps>; label: string}> = {
  rise: {C: Rise, label: '柔和浮现'},
  water: {C: Water, label: '水中浮现'},
  cursor: {C: Cursor, label: '光标显字'},
  dust: {C: Dust, label: '碎成光尘'},
};

export const REVEAL_KINDS = Object.keys(REVEALS) as RevealKind[];
