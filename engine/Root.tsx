import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {FPS} from './lib';
import {LAYOUTS} from './director/director';
import {FxDemo} from './fx/FxDemo';
import {AccentsDemo} from './fx/accents/Demo';
import {EntrancesDemo} from './fx/entrances/Demo';
import {BackdropsDemo} from './render/backdrops/Demo';
import {RevealsDemo} from './fx/reveals/Demo';
import {StrokesDemo} from './fx/strokes/Demo';
import {Reveals2Demo} from './fx/reveals2/Demo';
import {Lyric, LyricProps} from './render/Lyric';

// 渲染素材目录（由 lv.py 组装，通过 --public-dir 传入）里应有：
//   analysis.json（必需）  lyrics.json（可选，没有则用占位词演示）  style.json（可选）  strokes.json（可选，笔画拼接用）
//   音频文件、bg/ 背景素材、grain_*.png、bg_tall.jpg、bg_wide.jpg
const optionalJson = async (name: string) => {
  try {
    const r = await fetch(staticFile(name));
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

const loadSong: CalculateMetadataFunction<LyricProps> = async ({props}) => {
  const analysis = await fetch(staticFile('analysis.json')).then((r) => r.json());
  const [lyrics, style, strokes] = await Promise.all([optionalJson('lyrics.json'), optionalJson('style.json'), optionalJson('strokes.json')]);
  const L = LAYOUTS[props.aspect];
  return {
    durationInFrames: Math.ceil(analysis.duration * FPS),
    width: L.w,
    height: L.h,
    props: {...props, analysis, lyrics, style, strokes},
  };
};

// 默认出横屏 16:9；竖屏用 aspect: 'tall'
const defaults: LyricProps = {analysis: null, lyrics: null, style: null, audio: 'audio.mp3', seed: 1, aspect: 'wide'};

export const Root: React.FC = () => (
  <>
    {/* 歌词视频：aspect = 'wide'（16:9 横屏，默认）或 'tall'（9:16 竖屏） */}
    <Composition id="Lyric" component={Lyric} width={1920} height={1080} fps={FPS} durationInFrames={300}
      defaultProps={defaults} calculateMetadata={loadSong} />
    {/* 效果库演示（10 秒竖屏） */}
    <Composition id="FxDemo" component={FxDemo} width={1080} height={1920} fps={FPS} durationInFrames={300} />
    {/* 效果目录演示（横屏）：主词点缀 / 文字入场 / 背景处理，各自逐个展示 */}
    <Composition id="AccentsDemo" component={AccentsDemo} width={1920} height={1080} fps={FPS} durationInFrames={600} />
    <Composition id="EntrancesDemo" component={EntrancesDemo} width={1920} height={1080} fps={FPS} durationInFrames={600} />
    <Composition id="BackdropsDemo" component={BackdropsDemo} width={1920} height={1080} fps={FPS} durationInFrames={600} />
    {/* 逐字浮现演示：水中浮现 / 光标 / 光尘 / 风吹散 / 笔画拼接 */}
    <Composition id="RevealsDemo" component={RevealsDemo} width={1920} height={1080} fps={FPS} durationInFrames={600} />
    <Composition id="StrokesDemo" component={StrokesDemo} width={1920} height={1080} fps={FPS} durationInFrames={450} />
    <Composition id="Reveals2Demo" component={Reveals2Demo} width={1920} height={1080} fps={FPS} durationInFrames={600} />
  </>
);
