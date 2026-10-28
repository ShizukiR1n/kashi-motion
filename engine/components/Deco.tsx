import React from 'react';
import {useCurrentFrame} from 'remotion';
import {backOut, easeOut, FPS, H, PINK, prog, vis, W} from '../lib';

// 装饰元素都画在一个铺满画面的 SVG 图层里
export const Layer: React.FC<{children: React.ReactNode; opacity?: number}> = ({children, opacity = 1}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity}}>
    {children}
  </svg>
);

type Base = {at: number; out?: number; outDur?: number; opacity?: number};
const LINE = 'rgba(255,255,255,0.55)';

const useVis = ({at, out, outDur}: Base, inDur = 0.35) => {
  const f = useCurrentFrame();
  return {f, ...vis(f, at, inDur, out, outDur)};
};

const float = (f: number, k: number, amp = 3) => Math.sin(f / FPS * 1.3 + k) * amp;

// 五瓣花线稿：缩放弹入 + 轻微漂浮
export const Flower: React.FC<Base & {x: number; y: number; r?: number; color?: string; sw?: number}> = (p) => {
  const {f, e, o, shown} = useVis(p, 0.4);
  if (!shown) return null;
  const {x, y, r = 24, color = PINK, sw = 1.6, opacity = 1} = p;
  const s = backOut(e);
  return (
    <g transform={`translate(${x},${y + float(f, x)}) rotate(${(1 - e) * -60}) scale(${s})`} stroke={color} strokeWidth={sw / Math.max(0.3, s)} fill="none" opacity={o * opacity}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = ((i * 72 - 90) * Math.PI) / 180;
        return <circle key={i} cx={Math.cos(a) * r * 0.52} cy={Math.sin(a) * r * 0.52} r={r * 0.42} />;
      })}
      <circle r={r * 0.2} />
    </g>
  );
};

export const Hex: React.FC<Base & {x: number; y: number; r?: number; color?: string}> = (p) => {
  const {f, e, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, r = 10, color = LINE, opacity = 1} = p;
  const pts = [0, 1, 2, 3, 4, 5].map((i) => `${Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r},${Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r}`).join(' ');
  return <polygon points={pts} transform={`translate(${x},${y + float(f, y, 2)}) scale(${backOut(e)})`} stroke={color} strokeWidth={1.3} fill="none" opacity={o * opacity} />;
};

// 四角星
export const Sparkle: React.FC<Base & {x: number; y: number; s?: number; color?: string}> = (p) => {
  const {f, e, o, shown} = useVis(p, 0.3);
  if (!shown) return null;
  const {x, y, s = 9, color = '#ffffff', opacity = 1} = p;
  const tw = 0.75 + 0.25 * Math.sin(f / 4 + x);
  const d = `M0,${-s} Q0,0 ${s},0 Q0,0 0,${s} Q0,0 ${-s},0 Q0,0 0,${-s}Z`;
  return <path d={d} transform={`translate(${x},${y}) scale(${backOut(e) * tw})`} fill={color} opacity={o * opacity} />;
};

export const Plus: React.FC<Base & {x: number; y: number; s?: number; color?: string}> = (p) => {
  const {e, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, s = 6, color = LINE, opacity = 1} = p;
  return (
    <g transform={`translate(${x},${y}) scale(${backOut(e)})`} stroke={color} strokeWidth={1.3} opacity={o * opacity}>
      <line x1={-s} y1={0} x2={s} y2={0} />
      <line x1={0} y1={-s} x2={0} y2={s} />
    </g>
  );
};

export const Dot: React.FC<Base & {x: number; y: number; r?: number; color?: string; square?: boolean}> = (p) => {
  const {e, o, shown} = useVis(p, 0.2);
  if (!shown) return null;
  const {x, y, r = 2.5, color = '#fff', opacity = 1, square} = p;
  return square ? (
    <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={color} opacity={o * opacity * e} transform={`rotate(45 ${x} ${y})`} />
  ) : (
    <circle cx={x} cy={y} r={r * backOut(e)} fill={color} opacity={o * opacity} />
  );
};

// 圆环：expand=true 时扩散淡出
export const Ring: React.FC<Base & {x: number; y: number; r: number; color?: string; expand?: boolean; sw?: number}> = (p) => {
  const {f, e, o, shown} = useVis(p, 0.6);
  if (!shown) return null;
  const {x, y, r, color = 'rgba(255,255,255,0.35)', expand = false, sw = 1, opacity = 1} = p;
  if (expand) {
    const t = ((f - p.at * FPS) / (FPS * 1.6)) % 1;
    return <circle cx={x} cy={y} r={r * (0.4 + t)} stroke={color} strokeWidth={sw} fill="none" opacity={o * opacity * (1 - t)} />;
  }
  return <circle cx={x} cy={y} r={r * (0.85 + 0.15 * easeOut(e))} stroke={color} strokeWidth={sw} fill="none" opacity={o * opacity * e} />;
};

// 细线矩形框：描边生长（trim path 效果）
export const Rect: React.FC<Base & {x: number; y: number; w: number; h: number; color?: string; dash?: string; sw?: number; draw?: number; rot?: number; fill?: string}> = (p) => {
  const {f, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, w, h, color = LINE, dash, sw = 1.2, draw = 0.6, rot = 0, opacity = 1, fill} = p;
  const t = easeOut(prog(f, p.at, draw));
  const per = 2 * (w + h);
  return (
    <rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={sw} fill={fill ?? 'none'} opacity={o * opacity}
      transform={rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined}
      strokeDasharray={dash ?? `${per * t} ${per}`} pathLength={dash ? undefined : per} />
  );
};

export const Line: React.FC<Base & {x1: number; y1: number; x2: number; y2: number; color?: string; sw?: number; dash?: string; draw?: number}> = (p) => {
  const {f, o, shown} = useVis(p);
  if (!shown) return null;
  const {x1, y1, x2, y2, color = LINE, sw = 1, dash, draw = 0.5, opacity = 1} = p;
  const t = easeOut(prog(f, p.at, draw));
  return <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * t} y2={y1 + (y2 - y1) * t} stroke={color} strokeWidth={sw} strokeDasharray={dash} opacity={o * opacity} />;
};

// 三角：实心灰块 or 线框
export const Tri: React.FC<Base & {pts: [number, number][]; fill?: string; stroke?: string; dy?: number; draw?: number}> = (p) => {
  const {f, e, o, shown} = useVis(p);
  if (!shown) return null;
  const {pts, fill, stroke, dy = 0, draw = 0.6, opacity = 1} = p;
  const d = pts.map((q) => q.join(',')).join(' ');
  if (fill) {
    return (
      <g transform={`translate(0,${dy})`} opacity={o * opacity}>
        <defs>
          <linearGradient id={`tg${pts[0][0]}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d9d4d7" />
            <stop offset="1" stopColor="#a9a2a6" />
          </linearGradient>
        </defs>
        <polygon points={d} fill={fill === 'gray' ? `url(#tg${pts[0][0]})` : fill} opacity={0.88 * Math.min(1, e * 3)} />
      </g>
    );
  }
  const per = 3000;
  const t = easeOut(prog(f, p.at, draw));
  return <polygon points={d} fill="none" stroke={stroke ?? LINE} strokeWidth={1.3} opacity={o * opacity} pathLength={per} strokeDasharray={`${per * t} ${per}`} transform={`translate(0,${dy})`} />;
};

// 灰色实心横条：从小方块展开成长条
export const Bar: React.FC<Base & {x: number; y: number; w: number; h: number; grow?: number; color?: string}> = (p) => {
  const {f, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, w, h, grow = 0.45, color = 'rgba(214,208,211,0.92)', opacity = 1} = p;
  const t = easeOut(prog(f, p.at, grow));
  const cw = h + (w - h) * t;
  const cx = x + w / 2;
  return <rect x={cx - cw / 2} y={y} width={cw} height={h} fill={color} opacity={o * opacity} />;
};

// 斜纹填充块
export const Hatch: React.FC<Base & {id: string; x: number; y: number; w: number; h: number; rot?: number}> = (p) => {
  const {e, o, shown} = useVis(p, 0.5);
  if (!shown) return null;
  const {id, x, y, w, h, rot = 0, opacity = 1} = p;
  return (
    <g opacity={o * opacity * e} transform={rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined}>
      <defs>
        <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
};

// 流星线：带圆头的曲线，描边生长
export const Meteor: React.FC<Base & {from: [number, number]; to: [number, number]; ctrl?: [number, number]; color?: string; draw?: number}> = (p) => {
  const {f, o, shown} = useVis(p);
  if (!shown) return null;
  const {from, to, ctrl, color = PINK, draw = 0.45, opacity = 1} = p;
  const t = easeOut(prog(f, p.at, draw));
  const c = ctrl ?? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const pt = (s: number) => [
    (1 - s) * (1 - s) * from[0] + 2 * (1 - s) * s * c[0] + s * s * to[0],
    (1 - s) * (1 - s) * from[1] + 2 * (1 - s) * s * c[1] + s * s * to[1],
  ];
  const head = pt(t);
  return (
    <g opacity={o * opacity} stroke={color} fill="none" strokeWidth={1.6}>
      <path d={`M${from[0]},${from[1]} Q${c[0]},${c[1]} ${to[0]},${to[1]}`} pathLength={1} strokeDasharray={`${t} 1`} />
      <circle cx={from[0]} cy={from[1]} r={3} fill={color} />
      <circle cx={head[0]} cy={head[1]} r={4} fill={color} />
      <circle cx={head[0]} cy={head[1]} r={9} strokeWidth={1} opacity={0.6} />
    </g>
  );
};

// 取景框四角 + 角点小十字
export const Corners: React.FC<Base & {x: number; y: number; w: number; h: number; len?: number; color?: string}> = (p) => {
  const {e, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, w, h, len = 10, color = LINE, opacity = 1} = p;
  const L = len * e;
  const c = (cx: number, cy: number, sx: number, sy: number) => <path key={`${cx}${cy}`} d={`M${cx + sx * L},${cy} L${cx},${cy} L${cx},${cy + sy * L}`} />;
  return (
    <g stroke={color} strokeWidth={1.2} fill="none" opacity={o * opacity}>
      {c(x, y, 1, 1)}{c(x + w, y, -1, 1)}{c(x, y + h, 1, -1)}{c(x + w, y + h, -1, -1)}
    </g>
  );
};

// 四个小圆点组成的准星
export const Cross: React.FC<Base & {x: number; y: number; color?: string}> = (p) => {
  const {e, o, shown} = useVis(p, 0.25);
  if (!shown) return null;
  const {x, y, color = 'rgba(255,255,255,0.7)', opacity = 1} = p;
  return (
    <g transform={`translate(${x},${y}) scale(${backOut(e)})`} fill={color} opacity={o * opacity}>
      <circle cx={-4} cy={0} r={1.8} /><circle cx={4} cy={0} r={1.8} /><circle cx={0} cy={-4} r={1.8} /><circle cx={0} cy={4} r={1.8} />
    </g>
  );
};

// 淡紫竖条
export const PurpleBar: React.FC<Base & {x: number; y: number; w: number; h: number}> = (p) => {
  const {f, o, shown} = useVis(p);
  if (!shown) return null;
  const {x, y, w, h, opacity = 1} = p;
  const t = easeOut(prog(f, p.at, 0.5));
  return (
    <g opacity={o * opacity}>
      <rect x={x} y={y} width={w} height={h * t} fill="rgba(200,130,215,0.55)" />
      <rect x={x + w * 0.3} y={y + 30} width={w * 0.3} height={Math.max(0, h * t - 60)} fill="rgba(240,200,245,0.4)" />
    </g>
  );
};
