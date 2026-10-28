// 整句逐字浮现镜头：镜头按路线推近 / 跟字 / 拉回；文字按浮现方式出现；句末可被风吹散；
// 主词背后垫一个空心描边回声大字（杂志式层级）；全程叠加 100%→108% 的慢呼吸和微漂移。
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS} from '../lib';
import {camAtTime} from '../director/lines';
import type {Shot} from '../director/director';
import type {Style} from '../style/style';
import {REVEALS, WindScatter} from '../fx/reveals/index';
import {REVEALS2} from '../fx/reveals2/index';
import type {RevealColors} from '../fx/reveals/types';
import {StrokeReveal} from '../fx/strokes/index';
import {Word} from '../components/Word';

export type StrokeData = Record<string, {viewBox: number[]; strokes: string[]}>;

export const LineView: React.FC<{shot: Shot; st: Style; w: number; h: number; strokes: StrokeData | null; beats: number[]; children?: React.ReactNode}> = ({
  shot, st, w, h, strokes, beats, children,
}) => {
  const t = useCurrentFrame() / FPS;
  const line = shot.line!;
  const cam = camAtTime(line.cam, t);
  const k = Math.min(1, Math.max(0, (t - shot.start) / Math.max(0.1, shot.end - shot.start)));
  const breathe = 1 + 0.08 * k; // 慢呼吸：100% → 108%
  const dx = Math.sin(t * 0.7 + shot.id) * 10;
  const dy = Math.cos(t * 0.5 + shot.id * 2) * 7;
  const colors: RevealColors = {
    text: st.palette.text, glow: st.palette.glow, accent: st.palette.accent,
    particles: st.palette.particles.map((c) => c.split(',').map(Number) as [number, number, number]),
  };
  const common = {id: `ln${shot.id}`, chars: line.chars, vertical: line.vertical, end: shot.end, seed: shot.id * 31 + 5,
    colors, intensity: 0.7 + 0.6 * shot.secEnergy, beats: beats.filter((b) => b >= shot.start && b < shot.end), start: shot.start};
  let body: React.ReactNode;
  switch (line.mode) {
    case 'water': body = <REVEALS.water.C {...common} />; break;
    case 'cursor': body = <REVEALS.cursor.C {...common} />; break;
    case 'dust': body = <REVEALS.dust.C {...common} />; break;
    case 'shatter': body = <REVEALS2.shatter.C {...common} />; break;
    case 'depth': body = <REVEALS2.depth.C {...common} />; break;
    case 'maskslide': body = <REVEALS2.maskslide.C {...common} />; break;
    case 'punch': body = <REVEALS2.punch.C {...common} />; break;
    case 'strokes':
      body = strokes ? <StrokeReveal {...common} strokes={strokes} order={line.order} /> : <REVEALS.rise.C {...common} />;
      break;
    default: body = <REVEALS.rise.C {...common} />; // follow / tate：柔和逐字浮现，镜头负责“跟字”
  }
  const e = line.echo;
  const echo = e && (
    <Word text={e.text} x={e.x} y={e.y} size={e.size} at={e.at} vertical={e.vertical} upright={e.vertical} rotate={e.rotate}
      outline outlineColor={`${st.palette.accent}66`} glow={0} ca={0} opacity={0.55} stagger={0.04} out={shot.end - 0.3} />
  );
  // 单字特写快切画在屏幕空间（不跟镜头推拉），只叠慢呼吸
  if (line.screen) {
    return (
      <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) scale(${breathe})`}}>
        {children}
        {body}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px) scale(${breathe})`}}>
      {/* 镜头：让 (cx, cy) 落在画面中心并放大 z 倍 */}
      <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${w / 2}px,${h / 2}px) scale(${cam.z}) translate(${-cam.cx}px,${-cam.cy}px)`}}>
        {echo}
        {children}
        {body}
        {line.wind && <WindScatter {...common} from={line.windFrom} dir={1} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
