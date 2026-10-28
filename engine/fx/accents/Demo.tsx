import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Word} from '../../components/Word';
import {FPS, fontFamily, loadJapaneseFor, vlen} from '../../lib';
import {ACCENT_KINDS, ACCENTS, AccentProps} from './index';

// 主词点缀效果目录演示：每种 2 秒，横排 / 竖排（日文直书）交替。占位词只用通用词。
const WORDS = ['lumen', '天使', 'umbra', '光環', 'aether', '羽翼', 'nova', '月光', 'velum', '静寂'];
const COLORS: AccentProps['colors'] = {
  accent: '#c3b4ff',
  glow: '170,150,255',
  particles: [[255, 255, 255], [225, 215, 255], [180, 165, 255], [140, 150, 255]],
};
const SEG = 2; // 每种效果展示的秒数

loadJapaneseFor(WORDS.join(''));

export const AccentsDemo: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const i = Math.min(ACCENT_KINDS.length - 1, Math.floor(t / SEG));
  const kind = ACCENT_KINDS[i];
  const text = WORDS[i % WORDS.length];
  const vertical = i % 2 === 1;
  const at = i * SEG + 0.3;
  const end = (i + 1) * SEG;
  const size = vertical ? 150 : 170;
  const cx = 960;
  const cy = 540;
  const len = vlen(text) * size;
  const box = vertical
    ? {x: cx - size * 0.48, y: cy - len / 2, w: size * 0.96, h: len}
    : {x: cx - len / 2, y: cy - size * 0.42, w: len, h: size * 0.85};
  const {C, label, weight} = ACCENTS[kind];
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, #18204a 0%, #0b1026 70%)'}}>
      <C key={kind} box={box} at={at} end={end} seed={i * 17 + 3} intensity={1} vertical={vertical} colors={COLORS} />
      <Word text={text} x={cx} y={vertical ? box.y : cy} size={size} at={at} vertical={vertical} upright={vertical}
        anchor="center" glow={0.9} ca={2} glowColor={COLORS.glow} seed={i} />
      <div style={{position: 'absolute', left: 48, top: 40, fontFamily, color: '#c3b4ff', fontSize: 30, letterSpacing: 2}}>
        {`${i + 1}/${ACCENT_KINDS.length}  ${kind} · ${label} · ${weight}`}
      </div>
    </AbsoluteFill>
  );
};
