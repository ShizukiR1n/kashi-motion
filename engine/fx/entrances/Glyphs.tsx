// 逐字可控的文字渲染器：定位、色差层、辉光、描边与 components/Word.tsx 完全一致，
// 只是把"每个字怎么动"交给调用者，用来实现各种入场方式。换入场方式时字的位置不会变。
import React, {CSSProperties} from 'react';
import {useCurrentFrame} from 'remotion';
import type {WordProps} from '../../components/Word';
import {fontFamily, FPS, prog, WHITE} from '../../lib';

export type CharState = {
  o?: number; // 透明度 0..1
  tf?: string; // 额外 transform（作用在单个字上，局部坐标）
  blur?: number; // 单字模糊（px）
  cax?: number; // 色差偏移覆盖（px）
  ghost?: string; // 用别的字形覆盖显示（解码效果），占位仍是原字，避免排版跳动
  caret?: boolean; // 在这个字后面画闪烁光标（打字机）
};

export type Mode = 'h' | 'tate' | 'rot'; // 横排 / 日文直书 / 旋转 90° 的竖排（拉丁字母）
export const modeOf = (p: WordProps): Mode => (p.vertical ? (p.upright ? 'tate' : 'rot') : 'h');

// 沿阅读方向（along）和垂直于阅读方向（across）的位移 → 局部坐标的 translate
export const alongAcross = (m: Mode, along: number, across: number) =>
  m === 'tate' ? `translate(${across}px,${along}px)` : `translate(${along}px,${across}px)`;

// 画面上的物理位移（dx 右、dy 下）→ 局部坐标。旋转竖排的容器转了 90°，需要换算
export const physical = (m: Mode, dx: number, dy: number) =>
  m === 'rot' ? `translate(${dy}px,${-dx}px)` : `translate(${dx}px,${dy}px)`;

const glowShadow = (g: number, size: number, rgb = '255,120,180') =>
  [
    `0 0 ${Math.max(1, 0.03 * size * g)}px rgba(255,248,252,${0.9 * Math.min(1, g)})`,
    `0 0 ${0.1 * size * g}px rgba(${rgb},${0.6 * Math.min(1, g)})`,
    `0 0 ${0.26 * size * g}px rgba(${rgb},${0.34 * Math.min(1, g)})`,
  ].join(',');

export type GlyphsProps = WordProps & {
  state: (i: number, ch: string, n: number) => CharState;
  inner?: (content: React.ReactNode, outline: React.ReactNode) => React.ReactNode; // 包装/复制内容（遮罩、拆半、残影……）
  innerStyle?: CSSProperties; // 作用在文字盒上的样式（缩放、模糊、遮罩），原点为文字中心
  outlineColor2?: string; // 描边层颜色（stroke 入场用）
};

export const Glyphs: React.FC<GlyphsProps> = (p) => {
  const f = useCurrentFrame();
  const {
    text, x, y, size, at, vertical = false, anchor = 'left', glow = 0.55, ca = 1.4,
    outline = false, outlineColor = 'rgba(255,140,180,0.55)', opacity = 1, out, outDur = 0.3,
    rotate = 0, color = WHITE, weight = 500, box = false, glowColor, state, inner, innerStyle, outlineColor2,
  } = p;
  const m = modeOf(p);
  const tate = m === 'tate';
  if (f < at * FPS - 1) return null;
  const outO = out === undefined ? 1 : 1 - prog(f, out, outDur);
  if (outO <= 0) return null;

  const chars = [...text];
  const st = chars.map((ch, i) => state(i, ch, chars.length));
  const shift = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0';
  const transform = tate
    ? `translate(${x}px,${y}px) rotate(${rotate}deg) translate(-50%,0)`
    : vertical
    ? `translate(${x}px,${y}px) rotate(${90 + rotate}deg) translate(0,-50%)`
    : `translate(${x}px,${y}px) rotate(${rotate}deg) translate(${shift},-50%)`;

  const base: CSSProperties = {
    position: 'absolute', left: 0, top: 0, transform, transformOrigin: '0 0',
    fontFamily, fontSize: size, lineHeight: 1, whiteSpace: 'pre', fontWeight: weight,
    opacity: opacity * outO, writingMode: tate ? 'vertical-rl' : undefined, textOrientation: tate ? 'mixed' : undefined,
  };

  const caretEl = (
    <span style={{position: 'absolute', background: 'rgba(255,255,255,0.9)', boxShadow: `0 0 ${size * 0.08}px rgba(${glowColor ?? '255,120,180'},0.9)`,
      ...(tate ? {left: '10%', right: '10%', bottom: -size * 0.12, height: Math.max(2, size * 0.06)} : {top: '8%', bottom: '8%', right: -size * 0.12, width: Math.max(2, size * 0.06)})}} />
  );

  const layer = (kind: 'c' | 'm' | 'w' | 'o') => (
    <div style={{position: kind === 'w' || kind === 'o' ? 'relative' : 'absolute', left: 0, top: 0, mixBlendMode: kind === 'c' || kind === 'm' ? 'screen' : 'normal'}}>
      {chars.map((ch, i) => {
        const s = st[i];
        const cax = s.cax ?? ca;
        const dx = kind === 'c' ? -cax : kind === 'm' ? cax : 0;
        const isOutline = kind === 'o' || outline;
        const col = isOutline ? 'transparent' : kind === 'c' ? 'rgba(0,235,255,0.75)' : kind === 'm' ? 'rgba(255,40,120,0.8)' : color;
        const caShift = tate ? `translate(${dx}px,0)` : `translate(${dx}px,0)`;
        const ghost = s.ghost !== undefined && s.ghost !== ch;
        return (
          <span key={i} style={{
            display: 'inline-block', position: 'relative', opacity: s.o ?? 1,
            color: ghost ? 'transparent' : col,
            transform: `${caShift} ${s.tf ?? ''}`,
            filter: s.blur && s.blur > 0.05 ? `blur(${s.blur}px)` : undefined,
            WebkitTextStroke: isOutline ? `1.4px ${kind === 'o' ? outlineColor2 ?? 'rgba(255,255,255,0.85)' : outlineColor}` : undefined,
            textShadow: kind === 'w' && !outline && !ghost && glow > 0 ? glowShadow(glow, size, glowColor) : undefined,
          }}>
            {ch}
            {ghost && (
              <span style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', textAlign: 'center', color: col,
                textShadow: kind === 'w' && glow > 0 ? glowShadow(glow * 1.2, size, glowColor) : undefined}}>{s.ghost}</span>
            )}
            {kind === 'w' && s.caret && caretEl}
          </span>
        );
      })}
    </div>
  );

  const content = (
    <>
      {!outline && ca > 0 && layer('c')}
      {!outline && ca > 0 && layer('m')}
      {layer('w')}
    </>
  );
  const outlineContent = layer('o');

  return (
    <div style={base}>
      <div style={{position: 'relative', transformOrigin: '50% 50%', ...innerStyle}}>
        {inner ? inner(content, outlineContent) : content}
      </div>
      {box && (
        <div style={{position: 'absolute', left: -0.18 * size, right: -0.18 * size, top: -0.08 * size, bottom: -0.12 * size,
          border: '1px solid rgba(255,255,255,0.45)', opacity: st[0]?.o ?? 1}} />
      )}
    </div>
  );
};
