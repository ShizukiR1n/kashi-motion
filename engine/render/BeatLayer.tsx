// 跟拍层：鼓点包络（底鼓/军鼓/镲）+ 调试时间轴
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FPS} from '../lib';
import type {Analysis, Hit} from '../director/types';
import type {LayoutSpec, Plan} from '../director/director';

// 鼓点包络：最近一次敲击后按指数衰减，0..1
export const envAt = (hits: Hit[] | undefined, t: number, decay = 12, window = 0.4) => {
  if (!hits) return 0;
  let v = 0;
  // 二分找到 t 之前最近的敲击，只看最近的几个
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo - 1; i >= 0 && t - hits[i].t < window; i--) {
    v = Math.max(v, hits[i].strength * Math.exp(-(t - hits[i].t) * decay));
  }
  return v;
};

// ---------------- 调试时间轴 ----------------
const PAST = 2; // 播放头左侧显示的秒数
const FUTURE = 4; // 右侧

export const DebugOverlay: React.FC<{plan: Plan; analysis: Analysis; L: LayoutSpec}> = ({plan, analysis, L}) => {
  const t = useCurrentFrame() / FPS;
  const H = L.wide ? 260 : 330;
  const top = L.h - H;
  const pad = 30;
  const x = (tt: number) => pad + ((tt - (t - PAST)) / (PAST + FUTURE)) * (L.w - pad * 2);
  const vis = (tt: number) => tt >= t - PAST && tt <= t + FUTURE;
  const row = (i: number) => top + 46 + i * 34;
  const d = analysis.drums;
  const shot = plan.shots.find((s) => t >= s.start && t < s.end);
  const words = plan.shots.flatMap((s) => s.words.filter((w) => w.role !== 'echo').map((w) => ({...w, shot: s.id})));
  const lines = plan.shots.map((s) => ({s: s.start}));
  const mm = Math.floor(t / 60);
  const ss = (t % 60).toFixed(2).padStart(5, '0');
  const kick = envAt(d?.kick, t);
  const snare = envAt(d?.snare, t);
  const label = (txt: string, i: number, color: string) => (
    <text x={L.w - pad} y={row(i) + 5} fill={color} fontSize={18} textAnchor="end" fontFamily="monospace">{txt}</text>
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 底鼓/军鼓命中时画面边框闪一下，方便肉眼对拍 */}
      <AbsoluteFill style={{boxShadow: `inset 0 0 0 ${6 * kick}px rgba(255,60,60,${kick}), inset 0 0 0 ${12 * snare}px rgba(255,220,60,${snare * 0.8})`}} />
      <svg width={L.w} height={L.h} style={{position: 'absolute', inset: 0}}>
        <rect x={0} y={top} width={L.w} height={H} fill="rgba(0,0,0,0.72)" />
        <text x={pad} y={top + 30} fill="#fff" fontSize={24} fontFamily="monospace">
          {`${mm}:${ss}  shot ${shot?.id ?? '-'} ${shot?.template ?? ''} ${shot?.entrance ?? ''} ${shot?.transIn ?? ''}  sec ${shot?.section ?? ''}`}
        </text>
        {/* 拍子：细线；重拍：粗线 */}
        {analysis.beats.filter(vis).map((b, i) => <line key={`b${i}`} x1={x(b)} x2={x(b)} y1={row(0) - 12} y2={row(0) + 12} stroke="#aaa" strokeWidth={1.5} />)}
        {analysis.downbeats.filter(vis).map((b, i) => <line key={`d${i}`} x1={x(b)} x2={x(b)} y1={row(0) - 16} y2={row(0) + 16} stroke="#fff" strokeWidth={4} />)}
        {label('beat', 0, '#ccc')}
        {d && (['kick', 'snare', 'hat'] as const).map((k, ri) => (
          <g key={k}>
            {d[k].filter((h) => vis(h.t)).map((h, i) => (
              <circle key={i} cx={x(h.t)} cy={row(ri + 1)} r={3 + 7 * h.strength} fill={k === 'kick' ? '#ff4040' : k === 'snare' ? '#ffd23c' : '#4fe3ff'} />
            ))}
            {label(k, ri + 1, k === 'kick' ? '#ff6060' : k === 'snare' ? '#ffd23c' : '#4fe3ff')}
          </g>
        ))}
        {/* 切镜点 */}
        {lines.filter((l) => vis(l.s)).map((l, i) => <line key={`c${i}`} x1={x(l.s)} x2={x(l.s)} y1={row(4) - 14} y2={row(5) + 14} stroke="#b07cff" strokeWidth={3} strokeDasharray="6 4" />)}
        {/* 每个字的对齐区间 */}
        {words.filter((w) => w.at < t + FUTURE && w.at > t - PAST - 3).map((w, i) => {
          const x0 = Math.max(pad, x(w.at));
          return (
            <g key={`w${i}`}>
              <rect x={x0} y={row(4) - 12} width={Math.max(4, x(w.at + 0.35) - x0)} height={24} fill={w.role === 'main' ? '#ff5f93' : 'rgba(255,255,255,0.55)'} rx={3} />
              <text x={x0 + 4} y={row(5) + 8} fill="#fff" fontSize={18}>{w.text}</text>
            </g>
          );
        })}
        {label('word', 4, '#ff8fb4')}
        {/* 播放头 */}
        <line x1={x(t)} x2={x(t)} y1={top + 36} y2={L.h - 8} stroke="#ff2" strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};
