// 笔画拼接浮现（KanjiVG 笔顺数据，CC BY-SA 3.0，见 docs/third-party.md）
//
// 数据加载方式：渲染器把 tools/strokes.py 生成的 strokes.json 复制进渲染素材目录（public dir），
// 在 Composition 的 calculateMetadata 里调用 loadStrokes()，把结果作为 props 传给组件。
// 没有 strokes.json 时返回 {}，组件会对所有字使用普通文字的淡入上浮（不报错）。
import {staticFile} from 'remotion';
import type {StrokeData} from './StrokeReveal';

export {StrokeReveal} from './StrokeReveal';
export type {StrokeData, StrokeGlyph, StrokeRevealProps} from './StrokeReveal';

export const loadStrokes = async (file = 'strokes.json'): Promise<StrokeData> => {
  try {
    const r = await fetch(staticFile(file));
    return r.ok ? ((await r.json()) as StrokeData) : {};
  } catch {
    return {};
  }
};
