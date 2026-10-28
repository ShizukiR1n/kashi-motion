// 第二批逐字浮现：碎片聚合 / 纵深飞入 / 遮罩上滑 + 斜切错位 / 单字特写快切
// 全部无状态：画面只由当前帧与 seed 决定。
import React, {CSSProperties} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {rand} from '../../lib';
import {clamp, easeOutCubic, easeOutQuart, exitFade, Glyph, smooth, useT} from '../reveals/common';
import type {CharSlot, RevealProps} from '../reveals/types';

const glowG = (c: CharSlot, base = 0.8) => (c.emph ? base * 1.25 : base);

// =====================================================================
// 1. shatter 碎片聚合：每个字切成 5–9 块多边形碎片，从画面四面八方飞来，旋转着拼合
// =====================================================================
type Frag = {poly: string; dx: number; dy: number; rot: number; delay: number};

// 以字框内一个随机中心点做放射状切分，得到覆盖整个字框的多边形（用 clip-path 百分比表示）
const fragsOf = (c: CharSlot, ci: number, seed: number): Frag[] => {
  const W = c.size * 1.4;
  const H = c.size;
  const s = seed * 97 + ci * 31;
  const n = 5 + Math.floor(rand(s + 1) * 5); // 5..9
  const cx = W * (0.35 + rand(s + 2) * 0.3);
  const cy = H * (0.35 + rand(s + 3) * 0.3);
  const angs = Array.from({length: n}, (_, i) => ((i + 0.2 + rand(s + 10 + i) * 0.6) / n) * Math.PI * 2).sort((a, b) => a - b);
  const corners: [number, number][] = [[W, 0], [W, H], [0, H], [0, 0]];
  const angOf = (p: [number, number]) => {
    const a = Math.atan2(p[1] - cy, p[0] - cx);
    return a < 0 ? a + Math.PI * 2 : a;
  };
  // 从中心沿角度 a 射到字框边上的点
  const hit = (a: number): [number, number] => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const ts = [dx > 0 ? (W - cx) / dx : dx < 0 ? -cx / dx : Infinity, dy > 0 ? (H - cy) / dy : dy < 0 ? -cy / dy : Infinity];
    const k = Math.min(...ts);
    return [cx + dx * k, cy + dy * k];
  };
  // 字飞来的主方向（每个字不同）
  const mainDir = rand(s + 4) * Math.PI * 2;
  return angs.map((a0, i) => {
    let a1 = angs[(i + 1) % n];
    if (a1 <= a0) a1 += Math.PI * 2;
    const pts: [number, number][] = [[cx, cy], hit(a0)];
    corners
      .map((p) => ({p, a: angOf(p)}))
      .map(({p, a}) => ({p, a: a < a0 ? a + Math.PI * 2 : a}))
      .filter(({a}) => a > a0 && a < a1)
      .sort((x, y) => x.a - y.a)
      .forEach(({p}) => pts.push(p));
    pts.push(hit(a1));
    const poly = `polygon(${pts.map(([x, y]) => `${((x / W) * 100).toFixed(2)}% ${((y / H) * 100).toFixed(2)}%`).join(',')})`;
    const dir = mainDir + (rand(s + 40 + i) - 0.5) * 1.6; // 主方向 ±45° 左右散开
    const dist = 1400 + rand(s + 60 + i) * 700; // 从画面外飞来
    return {poly, dx: Math.cos(dir) * dist, dy: Math.sin(dir) * dist, rot: (rand(s + 80 + i) - 0.5) * 440, delay: rand(s + 90 + i) * 0.12};
  });
};

const Shatter: React.FC<RevealProps> = ({chars, end, seed, colors, intensity}) => {
  const t = useT();
  const fade = exitFade(t, end);
  if (fade <= 0) return null;
  const FLY = 0.55;
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {chars.map((c, ci) => {
        const t0 = c.t - FLY - 0.05;
        if (t < t0 - 0.2) return null;
        const locked = t >= c.t;
        const g = glowG(c);
        if (locked) {
          // 拼合瞬间：接缝闪光 + 轻微放大回落
          const fl = 1 - smooth(c.t, c.t + 0.28, t);
          return (
            <Glyph key={ci} c={c} color={colors.text} glow={colors.glow} g={g + fl * 1.6 * intensity} ca={1 + fl * 3}
              style={{transform: `scale(${1 + 0.05 * fl})`, filter: fl > 0.02 ? `brightness(${1 + fl * 0.8})` : undefined}} />
          );
        }
        const frags = fragsOf(c, ci, seed);
        return (
          <React.Fragment key={ci}>
            {frags.map((fr, fi) => {
              const p = clamp((t - t0 - fr.delay) / (FLY - fr.delay));
              if (p <= 0) return null;
              const copies = [0, 0.06, 0.12]; // 主体 + 两层拖尾
              return copies.map((lag, k) => {
                const q = easeOutQuart(clamp(p - lag));
                if (q <= 0) return null;
                const r = 1 - q;
                const st: CSSProperties = {
                  clipPath: fr.poly,
                  transform: `translate(${fr.dx * r}px,${fr.dy * r}px) rotate(${fr.rot * r}deg) scale(${1 + 0.3 * r})`,
                  opacity: (k === 0 ? Math.min(1, p * 2.5) : 0.35 / k) * (k === 0 ? 1 : r),
                  filter: k === 0 && r > 0.05 ? `blur(${Math.min(5, r * 7)}px)` : undefined,
                };
                return <Glyph key={`${fi}_${k}`} c={c} color={colors.text} glow={colors.glow} g={k === 0 ? g * 0.6 : 0} ca={k === 0 ? 1.5 : 0} style={st} />;
              });
            })}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// =====================================================================
// 2. depth 纵深飞入：从远处（小、虚）飞到镜头前落定（0.2 → 1，模糊 18 → 0），带 z 向残影和轻微透视倾斜
// =====================================================================
const Depth: React.FC<RevealProps> = ({chars, end, seed, colors}) => {
  const t = useT();
  const fade = exitFade(t, end);
  if (fade <= 0) return null;
  const DUR = 0.62;
  const state = (c: CharSlot, ci: number, p: number) => {
    const e = easeOutCubic(clamp(p));
    const r = 1 - e;
    const rx = (rand(seed * 13 + ci) - 0.5) * 50 * r;
    const ry = (rand(seed * 17 + ci) - 0.5) * 60 * r;
    return {
      transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${0.2 + 0.8 * e})`,
      filter: r > 0.01 ? `blur(${18 * r}px)` : undefined,
      opacity: clamp(p * 2.2),
    };
  };
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {chars.map((c, ci) => {
        const t0 = c.t - DUR;
        const p = (t - t0) / DUR;
        if (p <= 0) return null;
        const g = glowG(c);
        const trails = p < 1.15 ? [0.1, 0.2, 0.3] : [];
        return (
          <React.Fragment key={ci}>
            {trails.map((lag, k) => {
              const q = p - lag;
              if (q <= 0) return null;
              const s = state(c, ci, q);
              return <Glyph key={k} c={c} color={colors.text} glow={colors.glow} g={0} ca={0}
                style={{...s, opacity: s.opacity * 0.22 * (1 - k * 0.28) * clamp((1.15 - p) * 4)}} />;
            })}
            <Glyph c={c} color={colors.text} glow={colors.glow} g={g} ca={1.1} style={state(c, ci, p)} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// =====================================================================
// 3. maskslide 遮罩上滑 + 斜切错位：词从看不见的基线后滑上来；整句切成 3–4 条斜带，错位后滑入对齐；底部强调色细线画出
// =====================================================================
// 按空间间隔把字分组成“词”（导演在词之间留了约 0.3 字宽的空隙）
const groupWords = (chars: CharSlot[], vertical: boolean) => {
  const groups: number[] = [];
  let g = 0;
  chars.forEach((c, i) => {
    if (i > 0) {
      const p = chars[i - 1];
      const gap = vertical ? Math.abs(c.y - p.y) - (c.size + p.size) / 2 : Math.abs(c.x - p.x) - (c.size + p.size) * 0.3;
      const newRow = vertical ? Math.abs(c.x - p.x) > c.size * 0.5 : Math.abs(c.y - p.y) > c.size * 0.5;
      if (newRow || gap > c.size * 0.22) g++;
    }
    groups.push(g);
  });
  return groups;
};

const MaskSlide: React.FC<RevealProps> = ({chars, vertical, end, seed, colors}) => {
  const t = useT();
  const {width: W, height: H} = useVideoConfig();
  const fade = exitFade(t, end);
  if (fade <= 0 || !chars.length) return null;
  const groups = groupWords(chars, vertical);
  // 每个词的起始时间 = 词里第一个字的 t
  const gStart = new Map<number, number>();
  chars.forEach((c, i) => {
    if (!gStart.has(groups[i])) gStart.set(groups[i], c.t);
  });
  const SLIDE = 0.42;
  const xs = chars.map((c) => c.x);
  const ys = chars.map((c) => c.y);
  const sz = Math.max(...chars.map((c) => c.size));
  const minX = Math.min(...xs) - sz * 0.6;
  const maxX = Math.max(...xs) + sz * 0.6;
  const minY = Math.min(...ys) - sz * 0.6;
  const maxY = Math.max(...ys) + sz * 0.6;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const first = chars[0].t;
  const last = chars[chars.length - 1].t;

  // 词内每个字：在自己的字框里从基线下（或侧边）滑入
  const line = (
    <>
      {chars.map((c, i) => {
        const ws = gStart.get(groups[i])!;
        const st = Math.min(ws + (c.t - ws) * 0.35, c.t) - 0.16; // 词一起起步，词内略错开
        const p = clamp((t - st) / SLIDE);
        if (p <= 0) return null;
        const e = easeOutQuart(p);
        const inner: CSSProperties = vertical ? {transform: `translateX(${-(1 - e) * 105}%)`} : {transform: `translateY(${(1 - e) * 105}%)`};
        return (
          <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={p >= 1 ? glowG(c, 0.7) : 0.35} ca={p >= 1 ? 1 : 0}
            style={{overflow: p < 1 ? 'hidden' : 'visible'}} inner={inner} />
        );
      })}
    </>
  );

  // 斜切带：整句复制 N 份，各自用斜向 clip-path 切成一条带并水平错位，随后滑入对齐
  const N = 3 + Math.floor(rand(seed * 5 + 3) * 2); // 3–4
  const ang = ((12 + rand(seed * 7 + 1) * 6) * Math.PI) / 180;
  const slope = Math.tan(ang) * (rand(seed + 9) > 0.5 ? 1 : -1);
  const S0 = first - 0.3;
  const bands = Array.from({length: N}, (_, k) => {
    const p = clamp((t - S0 - k * 0.07) / (Math.max(0.55, last - first + 0.3)));
    const e = easeOutCubic(p);
    const amp = (90 + rand(seed * 11 + k) * 80) * (k % 2 === 0 ? 1 : -1);
    const off = amp * (1 - e);
    let clip: string;
    if (!vertical) {
      // 横排：沿 y 方向切带，带边是斜线 y = cy + (x - cx) * slope + b
      const h = (maxY - minY) / N;
      const b0 = minY - cy + k * h;
      const b1 = b0 + h;
      const yAt = (x: number, b: number) => cy + (x - cx) * slope + b;
      const top0 = k === 0 ? -H : yAt(0, b0);
      const top1 = k === 0 ? -H : yAt(W, b0);
      const bot0 = k === N - 1 ? H * 2 : yAt(0, b1);
      const bot1 = k === N - 1 ? H * 2 : yAt(W, b1);
      clip = `polygon(0px ${top0}px, ${W}px ${top1}px, ${W}px ${bot1}px, 0px ${bot0}px)`;
    } else {
      // 直书：沿 x 方向切带，带边是斜线 x = cx + (y - cy) * slope + b
      const w = (maxX - minX) / N;
      const b0 = minX - cx + k * w;
      const b1 = b0 + w;
      const xAt = (y: number, b: number) => cx + (y - cy) * slope + b;
      const l0 = k === 0 ? -W : xAt(0, b0);
      const l1 = k === 0 ? -W : xAt(H, b0);
      const r0 = k === N - 1 ? W * 2 : xAt(0, b1);
      const r1 = k === N - 1 ? W * 2 : xAt(H, b1);
      clip = `polygon(${l0}px 0px, ${r0}px 0px, ${r1}px ${H}px, ${l1}px ${H}px)`;
    }
    return {clip, off, settled: p >= 1};
  });
  const allSettled = bands.every((b) => b.settled);

  // 底部强调色细线（直书时画在左侧）
  const ruleP = easeOutQuart(clamp((t - first + 0.1) / 0.6));
  const rule: CSSProperties = vertical
    ? {position: 'absolute', left: minX - sz * 0.15, top: minY, width: 2, height: (maxY - minY) * ruleP, background: colors.accent, opacity: 0.85}
    : {position: 'absolute', left: minX, top: maxY + sz * 0.05, width: (maxX - minX) * ruleP, height: 2, background: colors.accent, opacity: 0.85};

  return (
    <AbsoluteFill style={{opacity: fade}}>
      {allSettled ? (
        line
      ) : (
        bands.map((b, k) => (
          <AbsoluteFill key={k} style={{clipPath: b.clip, transform: vertical ? `translateY(${b.off}px)` : `translateX(${b.off}px)`}}>
            {line}
          </AbsoluteFill>
        ))
      )}
      <div style={rule} />
    </AbsoluteFill>
  );
};

// =====================================================================
// 4. punch 单字特写快切：每个字在画面中央巨大地硬切出现（贴拍），最后切回整句
// =====================================================================
const Punch: React.FC<RevealProps> = ({chars, end, colors, beats, intensity}) => {
  const t = useT();
  const {width: W, height: H} = useVideoConfig();
  const fade = exitFade(t, end);
  if (fade <= 0 || !chars.length) return null;
  const snap = (x: number) => {
    if (!beats || !beats.length) return x;
    let best = x;
    let bd = 0.08;
    for (const b of beats) {
      const d = Math.abs(b - x);
      if (d <= bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  };
  // 分镜：字太密（间隔 < 0.12 秒）时两个字一刀
  const cuts: {idx: number[]; t: number}[] = [];
  for (let i = 0; i < chars.length; i++) {
    const nxt = chars[i + 1];
    if (nxt && nxt.t - chars[i].t < 0.12) {
      cuts.push({idx: [i, i + 1], t: snap(chars[i].t)});
      i++;
    } else cuts.push({idx: [i], t: snap(chars[i].t)});
  }
  // 保证切点单调
  for (let i = 1; i < cuts.length; i++) cuts[i].t = Math.max(cuts[i].t, cuts[i - 1].t + 1 / 30);
  const finalT = chars[chars.length - 1].t + 0.25;
  if (t < cuts[0].t) return null;

  if (t >= finalT) {
    // 切回整句（正常字号、原位置），0.2 秒内缩放落定
    const e = easeOutCubic(clamp((t - finalT) / 0.2));
    const xs = chars.map((c) => c.x);
    const ys = chars.map((c) => c.y);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return (
      <AbsoluteFill style={{opacity: fade, transformOrigin: `${ox}px ${oy}px`, transform: `scale(${1.12 - 0.12 * e})`}}>
        {chars.map((c, i) => <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={glowG(c)} ca={1 + (1 - e) * 6} />)}
      </AbsoluteFill>
    );
  }

  // 当前这一刀
  let k = 0;
  for (let i = 0; i < cuts.length; i++) if (t >= cuts[i].t) k = i;
  const cut = cuts[k];
  const dt = t - cut.t;
  const punch = 1.08 - 0.08 * easeOutCubic(clamp(dt / 0.12));
  const split = 14 * (1 - clamp(dt / 0.1)) * intensity + 1.5;
  const big = H * (cut.idx.length > 1 ? 0.5 : 0.62);
  const vert = chars.length > 1 && Math.abs(chars[1].x - chars[0].x) < chars[0].size * 0.5; // 直书
  const slots: CharSlot[] = cut.idx.map((ci, j) => {
    const n = cut.idx.length;
    const off = (j - (n - 1) / 2) * big * 1.02;
    return {...chars[ci], x: W / 2 + (vert ? 0 : off), y: H / 2 + (vert ? off : 0), size: big};
  });
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {/* 半透明暗角，让大字读得清（不是不透明的全屏底） */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(5,6,18,0.55), rgba(5,6,18,0.25) 70%, rgba(5,6,18,0) 100%)'}} />
      <AbsoluteFill style={{transformOrigin: `${W / 2}px ${H / 2}px`, transform: `scale(${punch})`}}>
        {slots.map((c, i) => <Glyph key={i} c={c} color={colors.text} glow={colors.glow} g={glowG(c, 0.9)} ca={split} />)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Kinds = {Shatter, Depth, MaskSlide, Punch};
