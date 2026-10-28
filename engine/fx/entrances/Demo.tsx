import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS, loadJapaneseFor} from '../../lib';
import {ENTRANCE_KINDS, EntranceX} from './index';

// 入场目录演示：每种 1.4 秒，轮流用横排拉丁 / 日文直书 / 横排日文的通用占位词（不含任何歌词）
const SAMPLES = [
  {text: 'seraphim', vertical: false, upright: false},
  {text: '天使の輪', vertical: true, upright: true},
  {text: '夜明けの光', vertical: false, upright: false},
  {text: 'lumen', vertical: false, upright: false},
  {text: '夜明け', vertical: true, upright: true},
];
loadJapaneseFor(SAMPLES.map((s) => s.text).join(''));

const SLOT = 1.4;

export const EntrancesDemo: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const k = Math.min(ENTRANCE_KINDS.length - 1, Math.floor(t / SLOT));
  const kind = ENTRANCE_KINDS[k];
  const at = k * SLOT + 0.15;
  const s = SAMPLES[k % SAMPLES.length];
  const size = s.vertical ? 150 : 170;
  const len = s.vertical ? [...s.text].length * size : 0;
  return (
    <AbsoluteFill style={{background: '#0b1026'}}>
      <EntranceX key={k} kind={kind} id={`demo-${k}`} text={s.text} at={at} size={size}
        x={960} y={s.vertical ? 540 - len / 2 : 540} anchor="center" vertical={s.vertical} upright={s.upright}
        glow={0.9} ca={2.2} glowColor="170,150,255" seed={k + 3} />
      {/* 定位参考线：换入场方式时字不应偏离 */}
      <div style={{position: 'absolute', left: 958, top: 0, width: 2, height: 1080, background: 'rgba(255,255,255,0.06)'}} />
      <div style={{position: 'absolute', left: 0, top: 539, width: 1920, height: 2, background: 'rgba(255,255,255,0.06)'}} />
      <div style={{position: 'absolute', left: 40, bottom: 30, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: 26}}>
        {`${k + 1}/${ENTRANCE_KINDS.length}  ${kind}`}
      </div>
    </AbsoluteFill>
  );
};
