// 剪辑编排：给每个镜头分配「主词点缀 / 文字入场 / 背景处理」，避免同一手法反复出现。
// 规则：
//   1. 按段落能量分三档：安静（low）只用轻效果并多留白；中等（mid）轻中混用；激烈（high）用中重效果。
//   2. 冷却：同一效果用过后，至少隔 N 个镜头才能再用；相邻镜头一定不同。候选里优先挑"最久没用过"的。
//   3. 招牌时刻：副歌第一句用最重的招式；全曲最高点那句用碎片 / 放射光；拖长音配慢速逐字类入场。
//   4. 留白：一部分句子故意不加点缀，让有点缀的句子更突出。
// 纯 TypeScript，不依赖 Remotion，命令行也能运行（生成编排表）。
import {rand} from '../util';
import type {LineMode} from './lines';

export type AccentName = 'swirl' | 'burst' | 'streak' | 'halo' | 'feathers' | 'shards' | 'ink' | 'trail' | 'rays' | 'none';
export type EntranceName = 'slam' | 'flicker' | 'slide' | 'letters' | 'type' | 'wipe' | 'focus' | 'zoom' | 'split' | 'drop' | 'spin' | 'stroke' | 'decode' | 'echo';
export type BackdropName = 'drift' | 'pan' | 'tilt' | 'mirror' | 'void' | 'zoomburst' | 'duotone' | 'frame' | 'strips';
export type Tier = 'low' | 'mid' | 'high';

// 轻重：0 = 无，1 = 轻，2 = 中，3 = 重
// rays（放射光）、halo（光环扩散）、swirl（转圈粒子）用户不喜欢，权重设为 -1 = 不参与编排
const ACC: Record<AccentName, number> = {none: 0, streak: 1, trail: 1, ink: 1, feathers: 2, burst: 2, shards: 3, halo: -1, swirl: -1, rays: -1};
const ENT: Record<EntranceName, number> = {type: 1, wipe: 1, focus: 1, flicker: 1, slide: 1, letters: 2, stroke: 2, split: 2, drop: 2, spin: 2, echo: 2, decode: 3, zoom: 3, slam: 3};
const BD: Record<BackdropName, number> = {void: 1, drift: 1, frame: 1, pan: 1, duotone: 2, tilt: 2, strips: 2, mirror: 3, zoomburst: 3};

const ALLOW = {
  accent: {low: [0, 1], mid: [0, 1, 2], high: [1, 2, 3]}, // -1 的永远不会被选
  entrance: {low: [1, 2], mid: [1, 2, 3], high: [2, 3]},
  backdrop: {low: [1], mid: [1, 2], high: [2, 3]},
} as const;
const COOLDOWN = {accent: 4, entrance: 4, backdrop: 3};
// 看起来相近的背景处理归为一族：同族 3 个镜头内不连用（例如“局部特写”和“画中画”都在放大同一块画面）
const BD_FAMILY: Record<BackdropName, string> = {pan: 'detail', frame: 'detail', tilt: 'detail', strips: 'cut', mirror: 'cut',
  zoomburst: 'burst', drift: 'plain', void: 'dark', duotone: 'tone'};
const NONE_RATE: Record<Tier, number> = {low: 0.4, mid: 0.25, high: 0.08}; // 不加点缀的比例

export type ShotCue = {
  tier: Tier;
  sectionStart: boolean; // 是新段落的第一句
  peak: boolean; // 包含全曲最高点
  long: boolean; // 拖长音镜头
  vertical: boolean; // 主词竖排
};
export type ShotMode = LineMode | 'layout'; // layout = 用排版模板（大小字组合）
export type FxPick = {accent: AccentName; entrance: EntranceName; backdrop: BackdropName; mode: ShotMode; wind: boolean; order: 'sequential' | 'shuffle'};
// 各能量档可用的浮现方式
const MODES: Record<Tier, ShotMode[]> = {
  low: ['tate', 'water', 'strokes', 'follow', 'layout'],
  mid: ['follow', 'tate', 'water', 'cursor', 'strokes', 'layout'],
  high: ['follow', 'cursor', 'dust', 'strokes', 'layout', 'tate'],
};

export const tierOf = (energy: number): Tier => (energy >= 0.7 ? 'high' : energy < 0.25 ? 'low' : 'mid');

// 从候选里挑：排除冷却中的；分数 = 随机 + "多久没用"的奖励
const pick = <T extends string>(cands: T[], history: T[], cooldown: number, seed: number): T => {
  const lastUse = (k: T) => {
    const i = history.lastIndexOf(k);
    return i < 0 ? Infinity : history.length - i;
  };
  let pool = cands.filter((k) => lastUse(k) > cooldown);
  if (!pool.length) pool = cands.filter((k) => lastUse(k) > 1); // 至少不和上一个相同
  if (!pool.length) pool = cands;
  let best = pool[0];
  let bestScore = -1;
  pool.forEach((k, i) => {
    const gap = Math.min(lastUse(k), 8);
    const score = rand(seed * 131 + i * 17.3 + k.length) + 0.12 * gap;
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  });
  return best;
};

const byWeight = <T extends string>(table: Record<T, number>, weights: readonly number[]) =>
  (Object.keys(table) as T[]).filter((k) => weights.includes(table[k]));

export const scheduleFx = (cues: ShotCue[], seed = 1): FxPick[] => {
  const hA: AccentName[] = [];
  const hE: EntranceName[] = [];
  const hB: BackdropName[] = [];
  const hM: ShotMode[] = [];
  return cues.map((c, i) => {
    const sd = seed * 1000 + i * 7;
    // ---- 点缀 ----
    let accent: AccentName;
    if (c.peak) accent = 'shards';
    else if (c.long) accent = pick<AccentName>(['feathers', 'ink', 'trail'], hA, 2, sd);
    else if (c.sectionStart && c.tier === 'high') accent = pick(byWeight(ACC, [2, 3]), hA, COOLDOWN.accent, sd);
    else if (hA[hA.length - 1] !== 'none' && rand(sd + 3) < NONE_RATE[c.tier]) accent = 'none';
    else accent = pick(byWeight(ACC, ALLOW.accent[c.tier]).filter((k) => k !== 'none'), hA, COOLDOWN.accent, sd);
    // ---- 入场 ----
    let entrance: EntranceName;
    if (c.long) entrance = pick<EntranceName>(['letters', 'type', 'drop'], hE, 2, sd + 1);
    else if (c.sectionStart && c.tier === 'high') entrance = pick(byWeight(ENT, [3]), hE, COOLDOWN.entrance, sd + 1);
    else entrance = pick(byWeight(ENT, ALLOW.entrance[c.tier]), hE, COOLDOWN.entrance, sd + 1);
    // ---- 背景 ----
    let bdCands = c.sectionStart && c.tier === 'high' ? byWeight(BD, [3]) : byWeight(BD, ALLOW.backdrop[c.tier]);
    const recentFam = new Set(hB.slice(-3).map((k) => BD_FAMILY[k]));
    const freshFam = bdCands.filter((k) => !recentFam.has(BD_FAMILY[k]));
    if (freshFam.length) bdCands = freshFam;
    const backdrop = pick(bdCands, hB, 6, sd + 2);
    // ---- 整句浮现方式（3 个镜头内不重复；排版模板至多隔两个镜头出现一次）----
    let modes = MODES[c.tier];
    if (hM.slice(-2).includes('layout')) modes = modes.filter((m) => m !== 'layout');
    const mode = c.long ? pick<ShotMode>(['water', 'strokes', 'tate'], hM, 2, sd + 4) : pick(modes, hM, 3, sd + 4);
    const wind = mode === 'follow' && c.tier !== 'low' && rand(sd + 5) < 0.6;
    const order = mode === 'strokes' && c.tier !== 'low' ? 'shuffle' : 'sequential';
    hA.push(accent);
    hE.push(entrance);
    hB.push(backdrop);
    hM.push(mode);
    return {accent, entrance, backdrop, mode, wind, order};
  });
};

// 用量统计（编排表用）
export const usage = (picks: FxPick[]) => {
  const count = <K extends keyof FxPick>(k: K) => {
    const m: Record<string, number> = {};
    picks.forEach((p) => (m[String(p[k])] = (m[String(p[k])] ?? 0) + 1));
    return m;
  };
  const maxRun = <K extends keyof FxPick>(k: K) => {
    let run = 1;
    let best = 1;
    for (let i = 1; i < picks.length; i++) {
      run = picks[i][k] === picks[i - 1][k] ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return picks.length ? best : 0;
  };
  return {
    accent: count('accent'), entrance: count('entrance'), backdrop: count('backdrop'),
    maxRun: {accent: maxRun('accent'), entrance: maxRun('entrance'), backdrop: maxRun('backdrop')},
  };
};
