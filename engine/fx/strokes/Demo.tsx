// 笔画拼接演示（占位词，不使用任何歌词）：前半横排按笔顺 + 竖排乱序拼合，后半互换
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {fontFamily, FPS} from '../../lib';
import type {CharSlot, RevealColors} from '../reveals/types';
import {StrokeReveal} from './StrokeReveal';
import {DEMO_STROKES as DATA} from './demoStrokes';

const COLORS: RevealColors = {
  text: '#f4f1ff', glow: '170,150,255', accent: '#c3b4ff',
  particles: [[255, 255, 255], [225, 215, 255], [180, 165, 255], [140, 150, 255]],
};

const row = (word: string, x0: number, y: number, size: number, t0: number): CharSlot[] =>
  [...word].map((ch, i) => ({ch, x: x0 + i * size * 1.05, y, t: t0 + i * 0.35, size}));
const col = (word: string, x: number, y0: number, size: number, t0: number): CharSlot[] =>
  [...word].map((ch, i) => ({ch, x, y: y0 + i * size * 1.05, t: t0 + i * 0.35, size}));

const Label: React.FC<{x: number; y: number; text: string}> = ({x, y, text}) => (
  <div style={{position: 'absolute', left: x, top: y, fontFamily, fontSize: 26, color: 'rgba(255,255,255,0.55)', letterSpacing: 2}}>{text}</div>
);

export const StrokesDemo: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const half = t < 7.5;
  return (
    <AbsoluteFill style={{background: '#0b1026'}}>
      {half ? (
        <>
          <StrokeReveal id="sd1" chars={row('天使の輪', 260, 420, 190, 1.2)} vertical={false} end={7.4} seed={3} colors={COLORS} intensity={1} strokes={DATA} order="sequential" />
          <StrokeReveal id="sd2" chars={col('夜明けの光', 1520, 170, 150, 1.6)} vertical end={7.4} seed={9} colors={COLORS} intensity={1} strokes={DATA} order="shuffle" />
          <Label x={160} y={980} text="横排 · sequential（按笔顺）" />
          <Label x={1360} y={980} text="直书 · shuffle（乱序拼合）" />
        </>
      ) : (
        <>
          <StrokeReveal id="sd3" chars={row('天使の輪', 260, 420, 190, 8.6)} vertical={false} end={15} seed={5} colors={COLORS} intensity={1.2} strokes={DATA} order="shuffle" />
          <StrokeReveal id="sd4" chars={col('夜明けの光', 1520, 170, 150, 9.0)} vertical end={15} seed={11} colors={COLORS} intensity={1.2} strokes={DATA} order="sequential" />
          <Label x={160} y={980} text="横排 · shuffle（乱序拼合）" />
          <Label x={1360} y={980} text="直书 · sequential（按笔顺）" />
        </>
      )}
    </AbsoluteFill>
  );
};
