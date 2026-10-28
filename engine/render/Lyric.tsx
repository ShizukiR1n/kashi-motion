import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {Bar, Corners, Cross, Dot, Flower, Hatch, Hex, Layer, Line, Meteor, PurpleBar, Rect, Ring, Sparkle, Tri} from '../components/Deco';
import {Slices} from '../components/Fx';
import {Word} from '../components/Word';
import {easeOut, fontFamily, FPS, kf, loadJapaneseFor, prog} from '../lib';
import {demoLyrics} from '../director/demo';
import {Aspect, DecoSpec, direct, LayoutSpec, Plan, Shot} from '../director/director';
import type {Analysis, Lyrics} from '../director/types';
import {mergeStyle, Style} from '../style/style';
import {CameraRig} from './fxbridge';
import {ACCENTS} from '../fx/accents';
import {BACKDROPS} from './backdrops/index';
import {LineView, StrokeData} from './LineView';
import {EntranceX} from '../fx/entrances/index';
import {AmbientDust} from '../fx/Particles';
import {DebugOverlay, envAt} from './BeatLayer';
import {Chain, FeatherFall, FeatherPop, Sacred} from '../components/Seraph';
import {setParticlePalette} from '../fx/Particles';

export type LyricProps = {
  analysis: Analysis | null;
  lyrics: Lyrics | null;
  style: Partial<Style> | null;
  audio: string; // 相对于渲染素材目录
  seed: number;
  aspect: Aspect;
  debug?: boolean; // 叠加调试时间轴（拍子、鼓点、每个字的时间）
  clip?: {start: number; end: number} | null; // 只出一段时：开场效果放在 start，收尾放在 end
  strokes?: StrokeData | null; // 笔画数据（strokes.json，由 tools/strokes.py 生成）
};

// ---------------- 通用层（按画幅和风格自适应） ----------------
type View = 'light' | 'dark' | 'full';
// 段落 → 取景：高能量（副歌）拉远看全图；低能量（安静段）旋转 180° 看另一半；其余看上半
const viewOf = (a: Analysis, t: number): {view: View; start: number} => {
  const sec = a.sections.find((s) => t >= s.start && t < s.end) ?? a.sections[a.sections.length - 1];
  const e = sec?.energy ?? 0.5;
  return {view: e >= 0.7 ? 'full' : e < 0.25 ? 'dark' : 'light', start: sec?.start ?? 0};
};

const Background: React.FC<{st: Style; L: LayoutSpec; kick: number; analysis: Analysis; plan: Plan}> = ({st, L, kick, analysis, plan}) => {
  const t = useCurrentFrame() / FPS;
  const d = st.background.drift;
  const k = kick * st.beat.kick;
  const s = 1.06 + 0.03 * Math.sin(t * 0.2) * d + 0.022 * k;
  const src = st.background.images.length ? `bg/${st.background.images[0]}` : L.wide ? 'bg_wide.jpg' : 'bg_tall.jpg';
  const bright = (1 - st.background.dim) * (1 + 0.16 * k);
  const drift = `translate(${Math.sin(t * 0.13) * 24 * d}px,${Math.cos(t * 0.11) * 30 * d}px)`;
  const glow = st.background.glow && (
    <AbsoluteFill style={{background: `radial-gradient(ellipse ${L.w * 0.45}px ${L.h * 0.42}px at 0px ${L.h * 0.37}px, ${st.background.glow}, transparent 70%)`}} />
  );
  if (!st.background.views) {
    return (
      <AbsoluteFill style={{background: st.palette.bg, overflow: 'hidden'}}>
        <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: 0, width: L.w, height: L.h, objectFit: 'cover',
          transform: `${drift} scale(${s})`, filter: `blur(${st.background.blur}px) brightness(${bright})`}} />
        {glow}
      </AbsoluteFill>
    );
  }
  // 分段取景：底层是整张图的强模糊铺满；上层按段落取景，段落交界做 0.5 秒的上下镜像翻转
  const cur = viewOf(analysis, t);
  const prev = viewOf(analysis, cur.start - 0.01);
  const FLIP = 0.5;
  const dt = t - cur.start;
  const flipping = prev.view !== cur.view && dt >= 0 && dt < FLIP / 2;
  const view: View = flipping ? prev.view : cur.view;
  const p = prev.view !== cur.view && dt < FLIP ? dt / FLIP : 1; // 0→1
  const flipY = p < 1 ? Math.abs(Math.cos(Math.PI * p)) : 1; // 1 → 0 → 1
  // 每个镜头按编排表换一种背景处理（见 backdrops/），取景仍按段落；段落交界保留镜像翻转
  const shot = plan.shots.find((sh) => t >= sh.start && t < sh.end);
  const B = BACKDROPS[shot?.backdrop ?? 'drift'].C;
  return (
    <AbsoluteFill style={{background: st.palette.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scaleY(${flipY})`}}>
        <B src={staticFile(src)} w={L.w} h={L.h} wide={L.wide} view={view}
          t0={shot?.start ?? 0} t1={shot?.end ?? plan.duration} seed={(shot?.id ?? 0) * 17 + 3}
          energy={shot?.secEnergy ?? 0.3} kick={k} blur={st.background.blur + 9 * Math.exp(-Math.max(0, t - (shot?.start ?? 0)) * 4)} dim={st.background.dim}
          bg={st.palette.bg} accent={st.palette.accent} />
      </AbsoluteFill>
      {/* 翻转瞬间的一道亮线 */}
      {p < 1 && <AbsoluteFill style={{background: `linear-gradient(180deg, transparent ${50 - 3 * (1 - flipY)}%, rgba(255,255,255,${0.5 * (1 - flipY)}) 50%, transparent ${50 + 3 * (1 - flipY)}%)`}} />}
      {glow}
    </AbsoluteFill>
  );
};

const Grain: React.FC<{st: Style; L: LayoutSpec}> = ({st, L}) => {
  const f = useCurrentFrame();
  if (st.grain <= 0) return null;
  return <Img src={staticFile(`grain_${Math.floor(f / 2) % 8}.png`)} style={{position: 'absolute', left: 0, top: 0, width: L.w, height: L.h, mixBlendMode: 'overlay', opacity: st.grain}} />;
};

const Vignette: React.FC<{st: Style}> = ({st}) =>
  st.vignette > 0 ? <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 75% at 50% 48%, transparent 55%, rgba(${st.palette.shade},${st.vignette}) 100%)`}} /> : null;

// 角落细线装饰：按画面边距定位
const Hud: React.FC<{L: LayoutSpec}> = ({L}) => {
  const m = L.wide ? 58 : 60; // 左右边距
  const top = L.wide ? 48 : 120; // 竖屏避开顶部状态栏
  const bot = L.h - (L.wide ? 48 : 124);
  return (
    <svg width={L.w} height={L.h} style={{position: 'absolute', inset: 0}}>
      <g stroke="rgba(255,255,255,0.7)" strokeWidth={1.4} fill="none">
        <line x1={m} y1={top} x2={m + 26} y2={top} strokeWidth={2.5} />
        <line x1={m} y1={top + 10} x2={m} y2={top + 100} strokeOpacity={0.5} />
        <line x1={L.w - m - 16} y1={top + 6} x2={L.w - m} y2={top + 6} /><line x1={L.w - m - 8} y1={top - 2} x2={L.w - m - 8} y2={top + 14} />
        <line x1={L.w - m} y1={bot - 136} x2={L.w - m} y2={bot - 6} strokeOpacity={0.5} />
        <line x1={L.w - m - 120} y1={bot} x2={L.w - m - 8} y2={bot} strokeOpacity={0.5} />
      </g>
      <circle cx={m} cy={bot} r={3} fill="rgba(255,255,255,0.8)" />
    </svg>
  );
};

// ---------------- 装饰：把导演给的描述换成组件 ----------------
/* eslint-disable @typescript-eslint/no-explicit-any */
const DecoView: React.FC<{d: DecoSpec; i: number; shot: Shot; st: Style}> = ({d, i, shot, st}) => {
  const f = useCurrentFrame();
  const p = d.p as any;
  const at = d.at;
  if (st.decor === 'seraph') {
    const c = st.palette.accent;
    switch (d.kind) {
      // 光环（Halo）和圆环（Ring）用户不喜欢，改用羽毛/星点
      case 'flower': return i % 2 === 0
        ? <Sparkle at={at} x={p.x} y={p.y} s={(p.r ?? 24) * 0.5} color="#ffffff" />
        : <FeatherPop at={at} x={p.x} y={p.y} s={(p.r ?? 24) * 1.1} rot={-30 + (i * 37) % 60} color="#e6defc" />;
      case 'purple': return <Chain at={at} x1={p.x + p.w / 2} y1={p.y} x2={p.x + p.w / 2} y2={p.y + p.h} color={c} />;
      case 'hatch': return <Sacred at={at} x={p.x + p.w / 2} y={p.y + p.h / 2} r={Math.max(p.w, p.h) * 0.45} color={c} />;
      case 'hex': return <Sparkle at={at} x={p.x} y={p.y} s={(p.r ?? 10) * 1.2} color="#ffffff" />;
      case 'bar': return <Bar at={at} {...p} color="rgba(200,190,240,0.32)" />;
      case 'tri': return <Sacred at={at} x={(p.pts[0][0] + p.pts[1][0] + p.pts[2][0]) / 3} y={(p.pts[0][1] + p.pts[1][1] + p.pts[2][1]) / 3} r={Math.abs(p.pts[2][0] - p.pts[1][0]) * 0.45} color={c} opacity={p.fill ? 0.9 : 0.6} />;
      case 'meteor': return <Meteor at={at} {...p} color={c} />;
      case 'ring': return null;
      default: break;
    }
  }
  switch (d.kind) {
    case 'flower': return <Flower at={at} {...p} />;
    case 'ring': return <Ring at={at} {...p} />;
    case 'rect': return <Rect at={at} {...p} />;
    case 'corners': return <Corners at={at} {...p} />;
    case 'sparkle': return <Sparkle at={at} {...p} />;
    case 'hex': return <Hex at={at} {...p} />;
    case 'cross': return <Cross at={at} {...p} />;
    case 'line': return <Line at={at} {...p} />;
    case 'meteor': return <Meteor at={at} {...p} />;
    case 'purple': return <PurpleBar at={at} {...p} />;
    case 'hatch': return <Hatch at={at} id={`h${shot.id}_${i}`} {...p} />;
    case 'bar': return <Bar at={at} {...p} />;
    case 'tri': return <Tri at={at} pts={p.pts} fill={p.fill} dy={p.drop ? kf(f, [[at, -400], [at + 0.45, 0]]) : 0} />;
    case 'dots': return <>{[0, 1, 2, 3].map((k) => <Dot key={k} at={at + k * 0.06} x={p.x + k * 18} y={p.y} r={3} square />)}</>;
    default: return null;
  }
};

// ---------------- 主词点缀（按编排表选择） ----------------
const BEHIND = new Set(['ink', 'rays']);
const AccentView: React.FC<{shot: Shot; st: Style; layer: 'behind' | 'front'}> = ({shot, st, layer}) => {
  if (shot.accent === 'none' || st.particles.swirl <= 0) return null;
  if (BEHIND.has(shot.accent) !== (layer === 'behind')) return null;
  const A = ACCENTS[shot.accent];
  const b = shot.mainBox;
  return (
    <A.C box={{x: b.x, y: b.y, w: b.w, h: b.h}} at={b.at} end={shot.end} seed={shot.id * 13 + 7}
      intensity={(0.7 + 0.6 * shot.secEnergy) * st.particles.swirl} vertical={b.h > b.w * 1.3}
      colors={{accent: st.palette.accent, glow: st.palette.glow, particles: st.palette.particles.map((c) => c.split(',').map(Number) as [number, number, number])}} />
  );
};

// ---------------- 句间转场（作用在本句开头和上一句结尾） ----------------
const transformFor = (shot: Shot, nextTr: string | undefined, t: number, W: number) => {
  let z = 1;
  let tx = 0;
  let blur = 0;
  let op = 1;
  const inT = t - shot.start;
  const outT = shot.end - t;
  const eo = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  if (shot.transIn === 'push' && inT < 0.35) { const p = eo(inT / 0.35); z *= 2.4 - 1.4 * p; blur += 12 * (1 - p); }
  if (shot.transIn === 'whip' && inT < 0.28) { const p = eo(inT / 0.28); tx += W * 0.45 * (1 - p); blur += 14 * (1 - p); }
  if (shot.transIn === 'pullout' && inT < 0.5) { const p = eo(inT / 0.5); z *= 1.35 - 0.35 * p; blur += 6 * (1 - p); }
  if (nextTr === 'push' && outT < 0.3) { const p = 1 - outT / 0.3; z *= 1 + 0.9 * p * p; blur += 10 * p; op *= 1 - 0.4 * p; }
  if (nextTr === 'whip' && outT < 0.25) { const p = 1 - outT / 0.25; tx -= W * 0.45 * p * p; blur += 14 * p; }
  return {z, tx, blur, op};
};

// ---------------- 单个镜头 ----------------
const ShotView: React.FC<{shot: Shot; st: Style; L: LayoutSpec; strokes: StrokeData | null; nextTr?: string; beats: number[]}> = ({shot, st, L, strokes, nextTr, beats}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < shot.start || t >= shot.end) return null;
  const k = (t - shot.start) / Math.max(0.1, shot.end - shot.start);
  const e = easeOut(Math.min(1, k));
  const tx = shot.cam.tx[0] + (shot.cam.tx[1] - shot.cam.tx[0]) * e;
  const ty = shot.cam.ty[0] + (shot.cam.ty[1] - shot.cam.ty[0]) * e;
  const s = 1 + 0.08 * e; // 慢呼吸：100% → 108%
  const slicing = shot.exitSlices && t > shot.end - 0.25;
  const hits = shot.hits.map((h) => ({t: h.t, strength: h.strength * st.camera.punch}));
  const tr = transformFor(shot, nextTr, t, L.w);
  const wrap = (node: React.ReactNode) => (
    <AbsoluteFill style={{transform: `translateX(${tr.tx}px) scale(${tr.z})`, filter: tr.blur > 0.3 ? `blur(${tr.blur}px)` : undefined, opacity: tr.op}}>
      {node}
    </AbsoluteFill>
  );
  if (shot.line) {
    // 整句逐字浮现：推拉交给镜头路线（LineView），这里只保留鼓点带来的冲击和抖动
    return wrap(
      <Slices active={slicing} amount={70} seed={shot.id + 3}>
        <CameraRig hits={hits} wiggle={st.camera.wiggle * 1.3} motionBlur={st.motionBlur} base={{tx: 0, ty: 0, s: 1, rot: 0}}>
          <LineView shot={shot} st={st} w={L.w} h={L.h} strokes={strokes} beats={beats}>
            <AccentView shot={shot} st={st} layer="behind" />
          </LineView>
          <AccentView shot={shot} st={st} layer="front" />
        </CameraRig>
      </Slices>
    );
  }
  return wrap(
    <Slices active={slicing} amount={70} seed={shot.id + 3}>
      <CameraRig hits={hits} wiggle={st.camera.wiggle} motionBlur={st.motionBlur} base={{tx, ty, s, rot: shot.cam.rot * e}}>
        <AccentView shot={shot} st={st} layer="behind" />
        <AbsoluteFill style={{filter: 'blur(1.2px)'}}><Layer>{shot.decos.map((d, i) => <DecoView key={i} d={d} i={i} shot={shot} st={st} />)}</Layer></AbsoluteFill>
        {shot.words.map((w, i) => w.role === 'main' ? (
          <EntranceX key={i} kind={shot.entrance} id={`m${shot.id}`} text={w.text} x={w.x} y={w.y} size={w.size} at={w.at}
            stagger={w.stagger} letterDur={w.letterDur} vertical={w.vertical} upright={w.upright} anchor={w.anchor}
            glow={w.glow} ca={w.ca} rotate={w.rotate} seed={w.seed} scatter={0.35} glowColor={st.palette.glow} />
        ) : (
          <Word key={i} text={w.text} x={w.x} y={w.y} size={w.size} at={w.at} stagger={w.stagger} letterDur={w.letterDur}
            vertical={w.vertical} upright={w.upright} anchor={w.anchor} glow={w.glow} ca={w.ca} outline={w.outline} rotate={w.rotate}
            box={w.box} seed={w.seed} opacity={w.opacity ?? 1} scatter={0.25} glowColor={st.palette.glow} />
        ))}
        <AccentView shot={shot} st={st} layer="front" />
      </CameraRig>
    </Slices>
  );
};

// ---------------- 转场覆盖层（作用在镜头开头） ----------------
const TransitionOverlay: React.FC<{plan: Plan; st: Style}> = ({plan, st}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const L = plan.L;
  const sh = plan.shots.find((s) => t >= s.start && t < s.start + 0.8);
  if (!sh) return null;
  const dt = t - sh.start;
  switch (sh.transIn) {
    case 'flash': {
      const o = dt < 0.05 ? 0.55 : Math.max(0, 0.55 - (dt - 0.05) * 3);
      return o > 0 ? <AbsoluteFill style={{background: `color-mix(in srgb, ${st.palette.accent} 12%, white)`, opacity: o, mixBlendMode: 'screen'}} /> : null;
    }
    case 'iris': {
      if (dt > 0.6) return null;
      const p = easeOut(dt / 0.6);
      return <AbsoluteFill style={{background: `radial-gradient(ellipse ${30 + p * 140}% ${2 + p * 140}% at 50% 50%, transparent 70%, #000 100%)`}} />;
    }
    case 'slab': {
      if (dt > 0.6) return null;
      const span = L.h + 900;
      const y = -500 + (dt / 0.6) * span;
      const size = Math.max(L.w, L.h) * 2;
      return (
        <div style={{position: 'absolute', left: (L.w - size) / 2, top: 0, width: size, height: size, transform: `translateY(${y}px) rotate(-14deg)`, transformOrigin: '50% 0'}}>
          <div style={{height: 300, background: 'linear-gradient(180deg,#d6d0d3,#a8a1a5)', opacity: 0.95}} />
          <div style={{height: size - 300, background: '#050205'}} />
        </div>
      );
    }
    default:
      return null;
  }
};

// ---------------- 片头 / 片尾字卡（按画幅缩放定位） ----------------
const TitleCard: React.FC<{plan: Plan; st: Style; from: number; to: number}> = ({plan, st, from, to}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (t < from || t >= to) return null;
  const L = plan.L;
  const e = easeOut(prog(f, from + 0.2, 0.6));
  const o = 1 - prog(f, to - 0.35, 0.35);
  // 竖屏：卡片位于中部；横屏：卡片位于左侧
  const x0 = L.wide ? 150 : 130;
  const y0 = L.wide ? 260 : 700;
  const bodyW = L.wide ? 1500 : 820;
  const bodyH = L.wide ? 480 : 560;
  const k = L.wide ? 1.1 : 1;
  const {accent, text} = st.palette;
  return (
    <AbsoluteFill style={{opacity: e * o, filter: `blur(${(1 - e) * 8}px)`}}>
      <div style={{position: 'absolute', left: x0, top: y0, width: 110 * k, height: 4, background: accent}} />
      <div style={{position: 'absolute', left: x0, top: y0, width: 2, height: bodyH, background: accent, opacity: 0.6}} />
      <div style={{position: 'absolute', left: x0 + 20, top: y0 + 45 * k, fontFamily, color: accent, fontSize: 24 * k, letterSpacing: 6}}>{plan.artist.toUpperCase()}</div>
      <div style={{position: 'absolute', left: x0 + 16, top: y0 + 100 * k, fontFamily, color: text, fontSize: 96 * k, textShadow: `0 0 12px ${accent}66`}}>{plan.title}</div>
      <div style={{position: 'absolute', left: x0, top: y0 + bodyH + 40, width: bodyW, height: 1, background: 'rgba(255,255,255,0.35)'}} />
      <div style={{position: 'absolute', left: x0 + 20, top: y0 + bodyH + 70, fontFamily, color: 'rgba(255,255,255,0.7)', fontSize: 24 * k}}>— {plan.title}</div>
      <div style={{position: 'absolute', left: x0 + bodyW - 5, top: y0 + 80, width: 3, height: bodyH * 0.68, background: accent, opacity: 0.6}} />
    </AbsoluteFill>
  );
};

// RGB 三通道错位（全曲能量最高点用一次）
const Channel: React.FC<{color: string; dx: number; first?: boolean; children: React.ReactNode}> = ({color, dx, first, children}) => (
  <AbsoluteFill style={{transform: `translateX(${dx}px)`, mixBlendMode: first ? 'normal' : 'screen', isolation: 'isolate'}}>
    {children}
    <AbsoluteFill style={{background: color, mixBlendMode: 'multiply'}} />
  </AbsoluteFill>
);
const RgbSplit: React.FC<{amt: number; children: React.ReactNode}> = ({amt, children}) =>
  amt <= 0.3 ? <>{children}</> : (
    <AbsoluteFill style={{background: '#000', isolation: 'isolate'}}>
      <Channel color="#f00" dx={amt} first>{children}</Channel>
      <Channel color="#0f0" dx={0}>{children}</Channel>
      <Channel color="#00f" dx={-amt}>{children}</Channel>
    </AbsoluteFill>
  );

// ---------------- 总装 ----------------
export const Lyric: React.FC<LyricProps> = ({analysis, lyrics, style, audio, seed, aspect, debug, clip, strokes}) => {
  const f = useCurrentFrame();
  const st = useMemo(() => {
    const s = mergeStyle(style ?? {});
    setParticlePalette(s.palette.particles.map((c) => c.split(',').map(Number) as [number, number, number]));
    return s;
  }, [style]);
  const plan = useMemo(() => {
    if (!analysis) return null;
    const lyr = lyrics ?? demoLyrics(analysis);
    loadJapaneseFor(lyr.lines.map((l) => l.text).join('') + (lyr.title ?? '') + (lyr.artist ?? ''));
    return direct(lyr, analysis, seed, aspect, mergeStyle(style ?? {}).directives);
  }, [analysis, lyrics, seed, aspect, style]);
  if (!plan) return <AbsoluteFill style={{background: st.palette.bg}} />;
  const L = plan.L;
  const t = f / FPS;
  const D = clip ? clip.end : plan.duration; // 收尾时间
  const T0 = clip ? clip.start : 0; // 开场时间
  const ft = f - T0 * FPS; // 相对开场的帧

  // 开场
  const winIntro = st.intro === 'window' && t - T0 < 1;
  const introS = kf(ft, [[0, 0.45], [0.55, 0.5], [1.0, 1]]);
  const introSY = kf(ft, [[0, 0.1], [0.2, 1]]);
  const fadeIn = st.intro === 'fade' ? kf(ft, [[0, 0], [0.8, 1]]) : 1;
  // 结尾
  const cS = D - 1.4;
  const collapse = st.outro === 'collapse';
  const endSY = kf(f, [[cS, 1], [cS + 0.55, 0.004]]);
  const endSX = kf(f, [[cS, 1], [cS + 0.55, 0.82]]);
  const collapsed = collapse && t >= cS + 0.55;
  const lineMax = L.w * 0.8;
  const lineW = kf(f, [[cS + 0.55, lineMax], [cS + 0.9, lineMax * 0.8], [cS + 1.15, 80], [cS + 1.35, 0]]);
  const fadeOut = collapse ? 1 : kf(f, [[D - 1.2, 1], [D - 0.1, 0]]);
  // 高潮点 RGB 爆发
  const pk = plan.peak;
  const rgb = st.peakGlitch ? kf(f, [[pk - 0.3, 0], [pk - 0.1, 12], [pk, 26], [pk + 0.2, 12], [pk + 0.45, 0]]) : 0;
  const flash = st.peakGlitch && Math.abs(t - pk) < 0.06;
  // 鼓点包络
  const secE = analysis ? (analysis.sections.find((s) => t >= s.start && t < s.end)?.energy ?? 0.5) : 0.5;
  const kick = envAt(analysis?.drums?.kick, t, 10) * (0.4 + 0.9 * secE); // 副歌推得更狠，主歌收着
  const hat = envAt(analysis?.drums?.hat, t, 18, 0.25);
  // 副歌里的军鼓：轻微 RGB 错位
  const snareG = secE >= 0.7 && st.beat.snareGlitch > 0 ? envAt(analysis?.drums?.snare?.filter((h) => h.strength > 0.5), t, 22, 0.15) * 6 * st.beat.snareGlitch : 0;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Audio src={staticFile(audio)} />
      {!collapsed && (
        <AbsoluteFill style={{
          transform: winIntro ? `scale(${introS},${introS * introSY})` : collapse && t >= cS ? `scale(${endSX},${endSY})` : undefined,
          borderRadius: winIntro ? 40 : 0, overflow: 'hidden', opacity: fadeIn * fadeOut,
          boxShadow: winIntro ? `0 0 80px 14px ${st.palette.accent}59` : collapse && t >= cS ? '0 0 0 4px rgba(255,255,255,0.9)' : undefined,
          filter: flash ? 'invert(0.85) brightness(1.15) saturate(0.4)' : undefined,
        }}>
          <RgbSplit amt={Math.max(rgb, snareG)}>
            <Background st={st} L={L} kick={kick} analysis={analysis!} plan={plan} />
            {st.particles.feathers > 0 && <FeatherFall count={st.particles.feathers} seed={seed + 7} color="#e6defc" />}
            {st.particles.dust > 0 && <AmbientDust count={st.particles.dust} seed={seed + 2} opacity={0.55 + 0.45 * Math.min(1, hat * st.beat.hat * 1.4)} />}
            {!clip && <TitleCard plan={plan} st={st} from={0} to={Math.max(0, plan.introEnd)} />}
            {plan.shots.map((s, i) => <ShotView key={s.id} shot={s} st={st} L={L} strokes={strokes ?? null} nextTr={plan.shots[i + 1]?.transIn} beats={analysis?.beats ?? []} />)}
            {!clip && <TitleCard plan={plan} st={st} from={plan.outroStart} to={D + 1} />}
            <TransitionOverlay plan={plan} st={st} />
            {st.hud && <Hud L={L} />}
          </RgbSplit>
          <Grain st={st} L={L} />
          <Vignette st={st} />
        </AbsoluteFill>
      )}
      {debug && analysis && <DebugOverlay plan={plan} analysis={analysis} L={L} />}
      {collapsed && lineW > 0.5 && <div style={{position: 'absolute', top: L.h / 2, left: L.w / 2 - lineW / 2, width: lineW, height: 3, background: 'rgba(255,255,255,0.9)'}} />}
    </AbsoluteFill>
  );
};
