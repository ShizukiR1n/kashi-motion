import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS} from '../../lib';
import {layoutLine, REVEAL_KINDS, REVEALS, WindScatter} from './index';
import type {CharSlot, RevealColors} from './types';

// 演示：每种浮现 4.5 秒，同时展示横排拉丁、横排日文、直书日文（占位词，非歌词）
const SEG = 4.5;
const colors: RevealColors = {
  text: '#f4f1ff', glow: '170,150,255', accent: '#c3b4ff',
  particles: [[255, 255, 255], [225, 215, 255], [180, 165, 255], [140, 150, 255]],
};

export const RevealsDemo: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const k = Math.min(REVEAL_KINDS.length - 1, Math.floor(t / SEG));
  const kind = REVEAL_KINDS[k];
  const t0 = k * SEG;
  const end = t0 + SEG - 0.05;
  const lines = useMemo(() => {
    const a: CharSlot[] = layoutLine('seraphim', 700, 300, 150, false, t0 + 0.4, 0.13);
    const b: CharSlot[] = layoutLine('夜明けの光', 700, 650, 130, false, t0 + 0.9, 0.3);
    const c: CharSlot[] = layoutLine('天使の輪', 1550, 540, 140, true, t0 + 0.6, 0.32);
    b[4].emph = true;
    return [a, b, c];
  }, [t0]);
  const R = REVEALS[kind].C;
  return (
    <AbsoluteFill style={{background: '#0b1026'}}>
      {lines.map((chars, i) => (
        <R key={`${k}-${i}`} id={`demo-${k}-${i}`} chars={chars} vertical={i === 2} end={kind === 'rise' ? end + 2 : end} seed={k * 10 + i} colors={colors} intensity={1} />
      ))}
      {kind === 'rise' && lines.map((chars, i) => (
        <WindScatter key={`w${i}`} id={`wind-${i}`} chars={chars} vertical={i === 2} end={end} seed={i + 3} colors={colors} intensity={1} from={t0 + 2.9} dir={1} />
      ))}
      <div style={{position: 'absolute', left: 30, bottom: 24, color: '#c3b4ff', fontSize: 26, fontFamily: 'monospace'}}>
        {kind} · {REVEALS[kind].label}{kind === 'rise' ? ' + WindScatter' : ''}
      </div>
    </AbsoluteFill>
  );
};
