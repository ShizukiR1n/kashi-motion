// 第二批逐字浮现演示：每种方式各演示横排（夜明けの光）和直书（天使の輪），每段 2.5 秒（占位文字，非歌词）
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS, fontFamily} from '../../lib';
import type {CharSlot, RevealColors} from '../reveals/types';
import {REVEALS2, REVEAL2_KINDS} from './index';

const COLORS: RevealColors = {
  text: '#f4f1ff', glow: '170,150,255', accent: '#c3b4ff',
  particles: [[255, 255, 255], [225, 215, 255], [180, 165, 255], [140, 150, 255]],
};
const SEG = 2.5;

const rowSlots = (text: string, t0: number, size = 150): CharSlot[] => {
  const cs = [...text];
  const x0 = 960 - ((cs.length - 1) * size) / 2;
  return cs.map((ch, i) => ({ch, x: x0 + i * size, y: 540, t: t0 + i * 0.3, size, emph: i === cs.length - 1}));
};
const colSlots = (text: string, t0: number, size = 150): CharSlot[] => {
  const cs = [...text];
  const y0 = 540 - ((cs.length - 1) * size) / 2;
  return cs.map((ch, i) => ({ch, x: 960, y: y0 + i * size, t: t0 + i * 0.3, size, emph: i === 0}));
};

export const Reveals2Demo: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const seg = Math.floor(t / SEG);
  const kind = REVEAL2_KINDS[Math.floor(seg / 2) % REVEAL2_KINDS.length];
  const vertical = seg % 2 === 1;
  const s0 = seg * SEG;
  const chars = vertical ? colSlots('天使の輪', s0 + 0.45) : rowSlots('夜明けの光', s0 + 0.45);
  const beats = Array.from({length: 12}, (_, i) => s0 + i * 0.27);
  const R = REVEALS2[kind];
  return (
    <AbsoluteFill style={{background: '#0b1026'}}>
      <R.C key={seg} id={`d${seg}`} chars={chars} vertical={vertical} end={s0 + SEG} seed={seg + 3} colors={COLORS}
        intensity={1} beats={beats} start={s0} />
      <div style={{position: 'absolute', left: 30, bottom: 24, fontFamily, color: 'rgba(255,255,255,0.6)', fontSize: 26}}>
        {kind} · {R.label} · {vertical ? '直书' : '横排'}
      </div>
    </AbsoluteFill>
  );
};
