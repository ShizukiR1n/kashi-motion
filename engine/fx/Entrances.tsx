import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Word, WordProps} from '../components/Word';
import {easeOut, FPS, prog, rand} from '../lib';
import {DirBlur, Distort, entryDistort} from './Distort';

/*
 * 文字入场方式。全部基于原有的 Word 组件，props 与 Word 相同，另外需要一个唯一 id。
 * 坐标和 Word 一致：横排 (x, y) = 左端/中心 + 垂直居中；竖排 (x, y) = 列中心 + 顶部。
 * 镜头冲击不在这里做：导演在 CameraRig 的 hits 里加 {t: at, strength} 即可。
 */
export type EntranceProps = WordProps & {id: string};

// 变换的原点：取文字锚点附近，让放大从字本身出发
const origin = (p: WordProps) => `${p.x}px ${p.y}px`;

/** 重砸：从 ~140% 带模糊砸下来，轻微过冲，附带一下扭曲 */
export const Slam: React.FC<EntranceProps & {from?: number}> = ({id, from = 1.4, ...p}) => {
  const f = useCurrentFrame();
  if (f < p.at * FPS - 1) return null;
  const q = prog(f, p.at, 0.2);
  const e = easeOut(q);
  const over = Math.sin(Math.min(1, prog(f, p.at + 0.16, 0.22)) * Math.PI) * 0.035; // 落地后的小回弹
  const s = from - (from - 1) * e - over;
  const blur = (1 - e) * 14;
  return (
    <AbsoluteFill style={{transform: `scale(${s})`, transformOrigin: origin(p), opacity: Math.min(1, q * 3), filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
      <Distort id={`${id}-d`} amount={entryDistort(f, p.at + 0.12, 28, 7)}>
        <Word stagger={0} letterDur={0.06} scatter={0} {...p} />
      </Distort>
    </AbsoluteFill>
  );
};

/** 闪烁入场：前 dur 秒内按确定性的随机节奏忽明忽暗，最后稳定 */
export const FlickerIn: React.FC<EntranceProps & {dur?: number}> = ({id, dur = 0.4, ...p}) => {
  const f = useCurrentFrame();
  if (f < p.at * FPS - 1) return null;
  const q = prog(f, p.at, dur);
  const on = q >= 1 || rand(f * 3.7 + p.x * 0.13) < 0.25 + q * 0.75;
  const ghost = q < 1 ? (rand(f * 1.9 + 5) - 0.5) * 18 : 0; // 闪的时候横向抖一下
  return (
    <AbsoluteFill style={{opacity: on ? 1 : 0.08, transform: `translateX(${ghost}px)`}} data-id={id}>
      <Word stagger={0.01} letterDur={0.05} {...p} ca={(p.ca ?? 1.4) + (1 - q) * 8} />
    </AbsoluteFill>
  );
};

/** 滑入 + 方向模糊：从 dir 方向滑入，模糊量随速度变化 */
export const SlideBlur: React.FC<EntranceProps & {dist?: number; dir?: 'left' | 'right' | 'up' | 'down'; dur?: number}> = ({
  id, dist = 320, dir = 'left', dur = 0.38, ...p
}) => {
  const f = useCurrentFrame();
  if (f < p.at * FPS - 1) return null;
  const off = (fr: number) => (1 - easeOut(prog(fr, p.at, dur))) * dist;
  const o = off(f);
  const v = Math.abs(o - off(f - 1)); // 像素/帧
  const horiz = dir === 'left' || dir === 'right';
  const sign = dir === 'left' || dir === 'up' ? -1 : 1;
  const tx = horiz ? sign * o : 0;
  const ty = horiz ? 0 : sign * o;
  const amt = Math.min(36, v * 0.55);
  return (
    <AbsoluteFill style={{transform: `translate(${tx}px,${ty}px)`, opacity: Math.min(1, prog(f, p.at, 0.12) * 1.5)}}>
      <DirBlur id={`${id}-b`} dx={horiz ? amt : 0} dy={horiz ? 0 : amt}>
        <Word stagger={0} letterDur={0.05} scatter={0} {...p} />
      </DirBlur>
    </AbsoluteFill>
  );
};

/** 逐字母 + 扭曲：字母依次出现，整个过程带水波扭曲，结束后迅速平复 */
export const LetterDistort: React.FC<EntranceProps & {peak?: number}> = ({id, peak = 34, ...p}) => {
  const f = useCurrentFrame();
  if (f < p.at * FPS - 1) return null;
  const stagger = p.stagger ?? 0.07;
  const build = p.at + Math.max(0, [...p.text].length - 1) * stagger + 0.15;
  const t = f / FPS;
  const amt = t < build ? peak * (0.7 + 0.3 * Math.sin(t * 20)) : entryDistort(f, build, peak, 6);
  return (
    <Distort id={`${id}-d`} amount={amt} freq={[0.008, 0.06]} speed={2}>
      <Word {...p} stagger={stagger} scatter={p.scatter ?? 0.5} />
    </Distort>
  );
};

export type EntranceKind = 'slam' | 'flicker' | 'slide' | 'letters' | 'plain';

/** 统一入口：导演只需要传 kind */
export const Entrance: React.FC<EntranceProps & {kind: EntranceKind}> = ({kind, ...p}) => {
  switch (kind) {
    case 'slam': return <Slam {...p} />;
    case 'flicker': return <FlickerIn {...p} />;
    case 'slide': return <SlideBlur {...p} />;
    case 'letters': return <LetterDistort {...p} />;
    default: return <Word {...p} />;
  }
};
