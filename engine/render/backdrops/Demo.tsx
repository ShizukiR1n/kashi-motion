import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FPS} from '../../lib';
import {BACKDROP_KINDS, BACKDROPS} from './index';
import type {BackdropView} from './common';

// 背景处理演示：每种 2 秒，依次轮换 light / dark / full 取景，每 0.53 秒一个假底鼓
// 渲染时需要 --public-dir 指向含 bg/cover.jpg 的目录
const SEG = 2;
const VIEWS: BackdropView[] = ['light', 'dark', 'full'];

export const BackdropsDemo: React.FC = () => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = f / FPS;
  const i = Math.min(BACKDROP_KINDS.length - 1, Math.floor(t / SEG));
  const kind = BACKDROP_KINDS[i];
  const view = VIEWS[i % 3];
  const kick = Math.exp(-(t % 0.53) * 10);
  const {C, label, weight} = BACKDROPS[kind];
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <C src={staticFile('bg/cover.jpg')} w={width} h={height} wide={width >= height} view={view}
        t0={i * SEG} t1={(i + 1) * SEG} seed={i * 7 + 3} energy={i % 2 ? 0.9 : 0.4} kick={kick}
        blur={4} dim={0.3} bg="#0b1026" accent="#c3b4ff" />
      <div style={{position: 'absolute', right: 28, bottom: 22, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', fontSize: 22,
        background: 'rgba(0,0,0,0.45)', padding: '4px 10px'}}>
        {`${kind} · ${label} · ${weight} · view=${view}`}
      </div>
    </AbsoluteFill>
  );
};
